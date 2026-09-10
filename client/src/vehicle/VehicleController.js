/**
 * VehicleController.js
 * ─────────────────────────────────────────────────────────────
 * Owns the vehicle entity: chassis state, drivetrain state,
 * and delegation to physics for integration.
 *
 * Does NOT handle input. Input arrives exclusively via ActuatorBus.
 * Does NOT render. Rendering is owned by GraphicsEngine.
 */

/** @typedef {import('../physics/PhysicsEngine.js').PhysicsContext} PhysicsContext */
/** @typedef {import('../state/StateManager.js').GameState} GameState */

/**
 * @typedef {Object} VehicleState
 * @property {number} speedKph         – current speed in km/h
 * @property {number} steerAngleDeg    – current steer angle in degrees
 * @property {boolean} headlightsOn    – headlight toggle state
 * @property {boolean} handbrakeOn     – handbrake state
 * @property {boolean} reverseEngaged  – reverse gear state
 * @property {{ x: number, y: number, z: number }} position
 * @property {{ yaw: number, pitch: number, roll: number }} orientation
 */

/**
 * Initialise the vehicle subsystem.
 * @param {PhysicsContext} physics
 * @param {GameState} state
 * @returns {Promise<VehicleState>}
 */
export async function initVehicle(physics, state) {
  // TODO: load vehicle definition from state/config,
  //       register rigid body with physics engine.
  console.log('[vehicle] VehicleController initialised (stub)');
  return {};
}
