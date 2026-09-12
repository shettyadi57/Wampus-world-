/**
 * AIDriver.js
 * ─────────────────────────────────────────────────────────────
 * Autonomous AI driver driven EXCLUSIVELY by Stage 1 RiskModel utility rankings.
 *
 * Calls Stage 3 ActuatorBus directly. No separate "pretend AI" logic.
 * Every decision is logged and traceable directly to Stage 1 Horn-clause evidence.
 */

import * as THREE from 'three';

export class AIDriver {
  /**
   * @param {Object} context
   * @param {import('../../../../engine/RoadGraph.js').RoadGraph} context.graph
   * @param {import('../knowledge/KnowledgeBase.js').ClientKnowledgeBase} context.kb
   * @param {import('../risk/RiskModel.js').ClientRiskModel} context.riskModel
   * @param {import('../../actuators/ActuatorBus.js').ActuatorBus} context.actuators
   * @param {import('../../vehicle/VehicleController.js').VehicleController} context.vehicle
   * @param {import('../../roads/RoadNetwork.js').RoadNetwork} context.roads
   */
  constructor({ graph, kb, riskModel, actuators, vehicle, roads }) {
    this.graph = graph;
    this.kb = kb;
    this.riskModel = riskModel;
    this.actuators = actuators;
    this.vehicle = vehicle;
    this.roads = roads;

    this.enabled = false;
    this.currentTargetNodeId = null;
    this.lastDecidedNodeId = null;
    this.lastDecisions = []; // Full audit log of decisions
    this._stuckTimer = 0;
  }

  enable() {
    this.enabled = true;
    this.lastDecidedNodeId = null;
    console.log('[ai/driver] Autonomous AI Driver ENGAGED — driving via Stage 1 RiskModel');
  }

  disable() {
    this.enabled = false;
    this.lastDecidedNodeId = null;
    // Release actuators
    this.actuators.accelerate(0);
    this.actuators.brake(0);
    this.actuators.steer(0);
    console.log('[ai/driver] Autonomous AI Driver DISENGAGED — returning to DRIVER mode');
  }

  /**
   * Selects next node using Stage 1 RiskModel utility scoring.
   * @param {string} currentNodeId
   * @returns {Object|null} RankedAction choice
   */
  chooseNextNode(currentNodeId) {
    if (!this.graph || !currentNodeId) return null;

    const ranked = this.riskModel.rankNeighbors(currentNodeId, {
      fuelRemaining: this.vehicle.fuelRemaining,
    });

    if (!ranked || ranked.length === 0) return null;

    // Top utility choice
    const chosen = ranked[0];

    const decisionRecord = {
      timestamp: Date.now(),
      fromNode: currentNodeId,
      toNode: chosen.nodeId,
      utility: chosen.utility,
      risk: chosen.risk,
      confidence: chosen.confidence,
      reason: chosen.reason,
      candidates: ranked.map(r => ({ nodeId: r.nodeId, utility: r.utility, risk: r.risk })),
    };

    this.lastDecisions.push(decisionRecord);
    console.log(
      `[ai/driver] Decision at ${currentNodeId} → Chose ${chosen.nodeId} (Utility: ${chosen.utility.toFixed(2)}, Risk: ${(chosen.risk * 100).toFixed(0)}%, Reason: "${chosen.reason}")`
    );

    return chosen;
  }

  /**
   * Main driving control step called on each game tick when in AI DRIVER mode.
   * @param {number} dt
   */
  tick(dt) {
    if (!this.enabled || !this.vehicle || !this.actuators) return;

    // 1. Identify nearest node to current vehicle position
    let nearestNodeId = null;
    let minDistance = Infinity;

    for (const id of this.graph.nodeIds) {
      const node = this.graph.nodes.get(id);
      const nx = node.x ?? 0;
      const nz = node.y ?? 0;
      const d = Math.hypot(this.vehicle.position.x - nx, this.vehicle.position.z - nz);
      if (d < minDistance) {
        minDistance = d;
        nearestNodeId = id;
      }
    }

    // 2. On-event evaluation: only query Stage 1 engine when entering a new junction node
    const isAtJunction = minDistance < 5.0;
    const isNewNodeArrival = nearestNodeId && nearestNodeId !== this.lastDecidedNodeId;

    if (!this.currentTargetNodeId || (isAtJunction && isNewNodeArrival)) {
      this.lastDecidedNodeId = nearestNodeId;
      const choice = this.chooseNextNode(nearestNodeId);
      if (choice && choice.nodeId !== nearestNodeId) {
        this.currentTargetNodeId = choice.nodeId;
      }
    }

    if (!this.currentTargetNodeId) return;

    // 3. Compute 3D steering heading toward target junction
    const targetJunc = this.roads?.junctions.get(this.currentTargetNodeId);
    if (!targetJunc) return;

    const tx = targetJunc.position.x;
    const tz = targetJunc.position.z;

    const dx = tx - this.vehicle.position.x;
    const dz = tz - this.vehicle.position.z;
    const distToTarget = Math.hypot(dx, dz);

    // Target yaw angle relative to vehicle yaw
    const targetAngle = Math.atan2(dx, dz);
    let angleDiff = targetAngle - this.vehicle.yaw;

    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // 4. Proportional steering actuator demand
    const steerDemand = Math.max(-1.0, Math.min(1.0, angleDiff * 1.8));
    this.actuators.steer(steerDemand);

    // 5. Speed and throttle actuator demand
    const currentSpeedKph = this.vehicle.getSpeedKph();
    const absAngleDiff = Math.abs(angleDiff);

    if (absAngleDiff > 0.6) {
      // Sharp turn: slow down
      if (currentSpeedKph > 18) {
        this.actuators.brake(0.4);
        this.actuators.accelerate(0.0);
      } else {
        this.actuators.brake(0.0);
        this.actuators.accelerate(0.35);
      }
    } else {
      // Straight road: accelerate up to cruising speed (~45 km/h)
      if (currentSpeedKph < 45) {
        this.actuators.accelerate(0.75);
        this.actuators.brake(0.0);
      } else {
        this.actuators.accelerate(0.2);
        this.actuators.brake(0.0);
      }
    }
  }

  getLastDecision() {
    return this.lastDecisions[this.lastDecisions.length - 1] ?? null;
  }
}
