/**
 * ActuatorBus.js
 * ─────────────────────────────────────────────────────────────
 * The SINGLE, authoritative actuation API for the Wampus World vehicle.
 *
 * Both the human input handler (keyboard / gamepad) and the AI Driver
 * MUST issue all vehicle commands through this bus. No subsystem is
 * permitted to mutate VehicleState directly.
 */

export class ActuatorBus {
  /**
   * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
   */
  constructor(vehicle) {
    this._vehicle = vehicle;
    this._listeners = new Map();
  }

  /**
   * Apply throttle demand.
   * @param {number} amount – normalised ∈ [0, 1]. 0 = idle, 1 = full throttle.
   */
  accelerate(amount) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 0));
    if (this._vehicle && typeof this._vehicle.setThrottle === 'function') {
      this._vehicle.setThrottle(clamped);
    }
    this.emit('accelerate', clamped);
  }

  /**
   * Apply brake demand.
   * @param {number} amount – normalised ∈ [0, 1]. 0 = released, 1 = ABS threshold.
   */
  brake(amount) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 0));
    if (this._vehicle && typeof this._vehicle.setBrake === 'function') {
      this._vehicle.setBrake(clamped);
    }
    this.emit('brake', clamped);
  }

  /**
   * Set steering angle demand.
   * @param {number} angle – normalised ∈ [-1, 1]. -1 = full left, +1 = full right.
   */
  steer(angle) {
    const clamped = Math.max(-1, Math.min(1, Number.isFinite(angle) ? angle : 0));
    if (this._vehicle && typeof this._vehicle.setSteer === 'function') {
      this._vehicle.setSteer(clamped);
    }
    this.emit('steer', clamped);
  }

  /**
   * Toggle handbrake. Locks rear axle.
   */
  handbrake() {
    let state = false;
    if (this._vehicle && typeof this._vehicle.toggleHandbrake === 'function') {
      state = this._vehicle.toggleHandbrake();
    }
    this.emit('handbrake', state);
  }

  /**
   * Toggle reverse gear. Ignored if forward speed exceeds reverse-entry threshold.
   */
  reverse() {
    let state = false;
    if (this._vehicle && typeof this._vehicle.toggleReverse === 'function') {
      state = this._vehicle.toggleReverse();
    }
    this.emit('reverse', state);
  }

  /**
   * Trigger an active sensor sweep of the current node.
   */
  scan() {
    if (this._vehicle && typeof this._vehicle.triggerScan === 'function') {
      this._vehicle.triggerScan();
    }
    this.emit('scan');
  }

  /**
   * Interact with nearest world object (collect gold, activate checkpoint, fuel depot).
   */
  interact() {
    if (this._vehicle && typeof this._vehicle.triggerInteract === 'function') {
      this._vehicle.triggerInteract();
    }
    this.emit('interact');
  }

  /**
   * Toggle headlights on/off.
   */
  toggleHeadlights() {
    let state = false;
    if (this._vehicle && typeof this._vehicle.toggleHeadlights === 'function') {
      state = this._vehicle.toggleHeadlights();
    }
    this.emit('toggleHeadlights', state);
  }

  /**
   * Emit horn signal.
   */
  horn() {
    if (this._vehicle && typeof this._vehicle.triggerHorn === 'function') {
      this._vehicle.triggerHorn();
    }
    this.emit('horn');
  }

  /**
   * Event subscribe.
   * @param {string} event
   * @param {Function} cb
   */
  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(cb);
    return () => this._listeners.get(event)?.delete(cb);
  }

  emit(event, data) {
    const cbs = this._listeners.get(event);
    if (cbs) {
      for (const cb of cbs) cb(data);
    }
  }
}

/**
 * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
 * @returns {Promise<ActuatorBus>}
 */
export async function initActuators(vehicle) {
  const bus = new ActuatorBus(vehicle);
  console.log('[actuators] ActuatorBus initialised with full contract implementation');
  return bus;
}
