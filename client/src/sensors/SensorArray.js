/**
 * SensorArray.js
 * ─────────────────────────────────────────────────────────────
 * Owns all 6 physical sensor modules and produces noisy percept frames:
 *   1. ThermalSensor       → STENCH
 *   2. AirWindSensor       → BREEZE
 *   3. RadarSensor         → BUMP
 *   4. RoadScannerSensor   → GLITTER
 *   5. SignalSensor        → SCREAM
 *   6. VisualCameraSensor  → Visual confidence rating
 *
 * Configurable noise model scaled by difficulty tier and weather conditions.
 */

import { DIFFICULTY_TIERS, WEATHER_MODIFIERS } from '../state/DifficultyConfig.js';

export const Percept = Object.freeze({
  BREEZE:  'BREEZE',
  STENCH:  'STENCH',
  GLITTER: 'GLITTER',
  BUMP:    'BUMP',
  SCREAM:  'SCREAM',
});

export class SensorArray {
  /**
   * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
   * @param {Object} world
   * @param {Object} [options]
   */
  constructor(vehicle, world, options = {}) {
    this.vehicle = vehicle;
    this.world = world;
    this.graph = world?.graph ?? null;

    // Difficulty and weather configuration
    this.tier = DIFFICULTY_TIERS[options.difficulty ?? 'normal'] ?? DIFFICULTY_TIERS.normal;
    this.weather = options.weather ?? this.tier.weather ?? 'clear';

    // Sensor state flags
    this._bumpFlag = false;
    this._screamFlag = false;
    this._activeScanTriggered = false;

    // Hunter reference (for real-time thermal tracking)
    this.hunter = options.hunter ?? null;

    if (this.vehicle) {
      this.vehicle.onBump = () => { this._bumpFlag = true; };
      this.vehicle.onScan = () => { this._activeScanTriggered = true; };
    }
  }

  setDifficulty(tierId, weather = null) {
    if (DIFFICULTY_TIERS[tierId]) {
      this.tier = DIFFICULTY_TIERS[tierId];
      if (weather) this.weather = weather;
      console.log(`[sensors] Difficulty set to ${this.tier.name} (Weather: ${this.weather})`);
    }
  }

  setHunter(hunter) {
    this.hunter = hunter;
  }

  triggerScream() {
    this._screamFlag = true;
  }

  /**
   * Samples physical world truth before noise application.
   * @returns {Object} Ground-truth values
   */
  sampleGroundTruth() {
    let nearestNodeId = null;
    let minDistance = Infinity;

    if (this.vehicle && this.graph) {
      const vx = this.vehicle.position.x;
      const vz = this.vehicle.position.z;

      for (const id of this.graph.nodeIds) {
        const node = this.graph.nodes.get(id);
        const nx = node.x ?? 0;
        const nz = node.y ?? 0;
        const d = Math.hypot(vx - nx, vz - nz);

        if (d < minDistance) {
          minDistance = d;
          nearestNodeId = id;
        }
      }
    }

    let trueBreeze = false;
    let trueStench = false;
    let trueGlitter = false;

    // Within node junction proximity (~9.5m)
    if (nearestNodeId && minDistance < 9.5 && this.graph) {
      const currentNode = this.graph.nodes.get(nearestNodeId);

      // GLITTER: same-node percept only
      trueGlitter = currentNode?.hasObjective === true;

      const neighbors = this.graph.getNeighbors(nearestNodeId);

      // BREEZE: adjacent to any static pit node
      for (const neighborId of neighbors) {
        const neighborNode = this.graph.nodes.get(neighborId);
        if (neighborNode?.hazard === 'pit') {
          trueBreeze = true;
          break;
        }
      }

      // STENCH: adjacent to Hunter's current live node (or static hunter node)
      if (this.hunter && this.hunter.currentNodeId) {
        if (neighbors.includes(this.hunter.currentNodeId)) {
          trueStench = true;
        }
      } else {
        for (const neighborId of neighbors) {
          const neighborNode = this.graph.nodes.get(neighborId);
          if (neighborNode?.hazard === 'hunter') {
            trueStench = true;
            break;
          }
        }
      }
    }

    const trueBump = this._bumpFlag;
    const trueScream = this._screamFlag;

    return {
      nodeId: nearestNodeId,
      nodeDistance: minDistance,
      breeze: trueBreeze,
      stench: trueStench,
      glitter: trueGlitter,
      bump: trueBump,
      scream: trueScream,
    };
  }

  /**
   * Produces an imperfect, noisy percept frame according to difficulty/weather.
   * Feeds directly into KnowledgeBase and InferenceEngine.
   */
  sample() {
    const raw = this.sampleGroundTruth();

    // Reset single-frame contact/broadcast flags
    this._bumpFlag = false;
    this._screamFlag = false;

    const weatherMod = WEATHER_MODIFIERS[this.weather] ?? WEATHER_MODIFIERS.clear;
    const baseNoise = this.tier.sensorNoise;

    // Wind/Air noise
    const breezeFp = Math.min(0.40, baseNoise.falsePositiveRate * weatherMod.windNoiseMult);
    const breezeFn = Math.min(0.35, baseNoise.falseNegativeRate * weatherMod.windNoiseMult);
    const noisyBreeze = applyNoise(raw.breeze, breezeFp, breezeFn);

    // Thermal noise
    const stenchFp = Math.min(0.40, baseNoise.falsePositiveRate * weatherMod.thermalNoiseMult);
    const stenchFn = Math.min(0.35, baseNoise.falseNegativeRate * weatherMod.thermalNoiseMult);
    const noisyStench = applyNoise(raw.stench, stenchFp, stenchFn);

    // Road Scanner (Glitter is active scan; very low false positive, slight miss rate in storms)
    const glitterFn = this.weather === 'stormy' ? 0.05 : 0.01;
    const noisyGlitter = applyNoise(raw.glitter, 0.005, glitterFn);

    // Radar collision bump (highly reliable physical contact, rarely noisy)
    const noisyBump = raw.bump;

    // Visual camera confidence
    const visualConfidence = THREE_clamp(weatherMod.visibility * (1 - baseNoise.falsePositiveRate * 1.5), 0.2, 1.0);

    return {
      nodeId: raw.nodeId,
      nodeDistance: raw.nodeDistance,
      breeze: noisyBreeze,
      stench: noisyStench,
      glitter: noisyGlitter,
      bump: noisyBump,
      scream: raw.scream,
      visualConfidence,
      raw, // Exposed for Developer Debug overlay
      timestamp: performance.now(),
    };
  }
}

function applyNoise(groundTruth, falsePositiveRate, falseNegativeRate) {
  const rand = Math.random();
  if (groundTruth) {
    // False negative: hazard present but sensor fails to detect
    return rand >= falseNegativeRate;
  } else {
    // False positive: no hazard present but sensor reports false alarm
    return rand < falsePositiveRate;
  }
}

function THREE_clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
 * @param {Object} world
 * @param {Object} [options]
 * @returns {Promise<SensorArray>}
 */
export async function initSensors(vehicle, world, options = {}) {
  const sensors = new SensorArray(vehicle, world, options);
  console.log(`[sensors] SensorArray initialised with physical noisy sensors (${sensors.tier.name} tier)`);
  return sensors;
}
