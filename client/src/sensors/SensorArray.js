/**
 * SensorArray.js
 * ─────────────────────────────────────────────────────────────
 * Owns all sensor polling and percept production.
 *
 * Each physical sensor samples the world and emits a normalised
 * Percept object. Percepts are the ONLY channel through which the
 * KnowledgeBase learns about the world — the KB must never query
 * the world directly.
 *
 * ┌──────────────────────┬───────────────────────────────────────────────────────┐
 * │ Sensor               │ Percept(s) produced                                   │
 * ├──────────────────────┼───────────────────────────────────────────────────────┤
 * │ ThermalSensor        │ STENCH  – detects Wampus heat signature               │
 * │ AirWindSensor        │ BREEZE  – detects air currents near pit edges          │
 * │ RadarSensor          │ BUMP    – detects collision / obstacle contact         │
 * │ RoadScannerSensor    │ GLITTER – detects mission item (gold) in CURRENT node  │
 * │ SignalSensor         │ SCREAM  – detects Wampus elimination event (broadcast) │
 * │ VisualCameraSensor   │ auxiliary visual data fed to risk model (not KB rules) │
 * └──────────────────────┴───────────────────────────────────────────────────────┘
 *
 * IMPORTANT percept locality rules (see ARCHITECTURE.md §3):
 *   BREEZE  — produced when vehicle is IN a node adjacent to a Pit
 *   STENCH  — produced when vehicle is IN a node adjacent to the Wampus
 *   GLITTER — produced ONLY when vehicle is IN the SAME node as the Gold
 *   BUMP    — produced when vehicle collides with a wall/impassable boundary
 *   SCREAM  — broadcast globally after Wampus is eliminated; no locality
 */

/** Percept type constants — import these wherever percepts are used */
export const Percept = Object.freeze({
  BREEZE:  'BREEZE',
  STENCH:  'STENCH',
  GLITTER: 'GLITTER',
  BUMP:    'BUMP',
  SCREAM:  'SCREAM',
});

/**
 * @typedef {Object} PerceptFrame
 * @property {string}   nodeId     – world node the vehicle is currently in
 * @property {boolean}  breeze
 * @property {boolean}  stench
 * @property {boolean}  glitter
 * @property {boolean}  bump
 * @property {boolean}  scream
 * @property {number}   timestamp  – performance.now() at sample time
 */

/**
 * @typedef {Object} SensorArrayContext
 * @property {function(): PerceptFrame} sample  – poll all sensors, return frame
 */

/**
 * @param {import('../vehicle/VehicleController.js').VehicleState} vehicle
 * @param {import('../world/WorldManager.js').WorldContext} world
 * @returns {Promise<SensorArrayContext>}
 */
export async function initSensors(vehicle, world) {
  // TODO: instantiate ThermalSensor, AirWindSensor, RadarSensor,
  //       RoadScannerSensor, SignalSensor, VisualCameraSensor.
  //       Compose their outputs into a single PerceptFrame.
  console.log('[sensors] SensorArray initialised (stub)');
  return {
    sample: () => ({
      nodeId: null,
      breeze: false, stench: false, glitter: false,
      bump: false, scream: false,
      timestamp: performance.now(),
    }),
  };
}
