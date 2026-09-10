/**
 * ActuatorBus.js
 * ─────────────────────────────────────────────────────────────
 * The SINGLE, authoritative actuation API for the Wampus World vehicle.
 *
 * Both the human input handler (keyboard / gamepad) and the AI Driver
 * MUST issue all vehicle commands through this bus. No subsystem is
 * permitted to mutate VehicleState directly.
 *
 * Calling convention:
 *   All functions return void.
 *   amount / angle parameters are normalised unless noted otherwise.
 *   Validation and clamping are responsibilities of this module.
 *
 * ────────────────────────────────────────────────────────────
 * ACTUATOR CONTRACT  (function signatures — no implementation yet)
 * ────────────────────────────────────────────────────────────
 *
 * accelerate(amount: number): void
 *   amount ∈ [0, 1]  – throttle demand, 0 = idle, 1 = full throttle.
 *
 * brake(amount: number): void
 *   amount ∈ [0, 1]  – brake demand, 0 = released, 1 = ABS threshold.
 *
 * steer(angle: number): void
 *   angle ∈ [-1, 1]  – normalised steering angle,
 *                      -1 = full left, +1 = full right.
 *
 * handbrake(): void
 *   Engage / disengage handbrake (toggle). Locks rear axle.
 *
 * reverse(): void
 *   Toggle reverse gear. Speed must be below threshold or ignored.
 *
 * scan(): void
 *   Trigger an active sensor sweep of the current node.
 *   Wakes RoadScannerSensor synchronously.
 *
 * interact(): void
 *   Interact with the nearest interactable world object
 *   (pick up gold, activate junction switch, etc.).
 *
 * toggleHeadlights(): void
 *   Toggle headlights on / off. Affects GraphicsEngine and
 *   VisualCameraSensor noise model.
 *
 * horn(): void
 *   Emit horn sound. Used as a signal in mission triggers.
 */

/**
 * @typedef {Object} ActuatorBusContext
 * @property {function(number): void} accelerate
 * @property {function(number): void} brake
 * @property {function(number): void} steer
 * @property {function(): void}       handbrake
 * @property {function(): void}       reverse
 * @property {function(): void}       scan
 * @property {function(): void}       interact
 * @property {function(): void}       toggleHeadlights
 * @property {function(): void}       horn
 */

/**
 * @param {import('../vehicle/VehicleController.js').VehicleState} vehicle
 * @returns {Promise<ActuatorBusContext>}
 */
export async function initActuators(vehicle) {
  // TODO: implement each actuator function, wiring to VehicleController
  //       and emitting events for AudioEngine (horn, handbrake screech).
  const noop = () => {};
  const stub = (name) => (...args) => {
    console.debug(`[actuators] ${name}(${args.join(', ')}) called (stub)`);
  };

  console.log('[actuators] ActuatorBus initialised (stub)');

  return {
    accelerate:       stub('accelerate'),
    brake:            stub('brake'),
    steer:            stub('steer'),
    handbrake:        stub('handbrake'),
    reverse:          stub('reverse'),
    scan:             stub('scan'),
    interact:         stub('interact'),
    toggleHeadlights: stub('toggleHeadlights'),
    horn:             stub('horn'),
  };
}
