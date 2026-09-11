/**
 * VehicleController.js
 * ─────────────────────────────────────────────────────────────
 * Vehicle chassis, drivetrain, suspension, steering, and fuel physics.
 *
 * All inputs are received EXCLUSIVELY via ActuatorBus.
 * Integrated by PhysicsEngine each simulation step.
 */

export class VehicleController {
  /**
   * @param {Object} [config]
   */
  constructor(config = {}) {
    // ── Transform state ──
    this.position = { x: 0, y: 0.5, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 }; // m/s world space
    this.yaw = 0; // heading angle in radians (0 = along +Z axis)
    this.pitch = 0; // nose up/down in radians
    this.roll = 0; // body lean left/right in radians
    this.verticalVelocity = 0;

    // ── Drivetrain parameters ──
    this.mass = 1400; // kg
    this.maxSpeedForward = 35; // ~126 km/h in m/s
    this.maxSpeedReverse = 10; // ~36 km/h in m/s
    this.engineAcceleration = 12.5; // m/s^2 at full throttle
    this.brakeDeceleration = 18.0; // m/s^2 full braking
    this.handbrakeDecel = 12.0;
    this.rollingResistance = 0.8;
    this.airDragCoeff = 0.0025;

    // ── Steering parameters ──
    this.maxSteerAngle = 0.58; // ~33 degrees
    this.steerAngle = 0; // current steer angle in radians
    this.steerSpeed = 4.0; // radians/sec
    this.steerReturnSpeed = 6.0;

    // ── Actuator demands (set ONLY by ActuatorBus) ──
    this.throttleDemand = 0;
    this.brakeDemand = 0;
    this.steerDemand = 0;
    this.handbrakeEngaged = false;
    this.reverseEngaged = false;
    this.headlightsOn = false;

    // ── Fuel system ──
    this.fuelRemaining = config.startingFuel ?? 100;
    this.tankCapacity = config.tankCapacity ?? 100;
    this.fuelEmpty = false;

    // ── Suspension & Feel ──
    this.suspensionHeight = 0.45;
    this.suspensionPitch = 0;
    this.suspensionRoll = 0;
    this.suspensionHeave = 0;
    this.suspensionStiffness = 45;
    this.suspensionDamping = 12;

    // ── Collision / Bump callback ──
    this.onBump = null;
    this.onInteract = null;
    this.onScan = null;
    this.onHorn = null;

    // ── Spawn configuration ──
    this.spawnPosition = { x: 0, y: 0.5, z: 0 };
    this.spawnYaw = 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Actuator Setters — called exclusively by ActuatorBus
  // ─────────────────────────────────────────────────────────────

  setThrottle(amount) {
    this.throttleDemand = Math.max(0, Math.min(1, amount));
  }

  setBrake(amount) {
    this.brakeDemand = Math.max(0, Math.min(1, amount));
  }

  setSteer(angle) {
    this.steerDemand = Math.max(-1, Math.min(1, angle));
  }

  toggleHandbrake() {
    this.handbrakeEngaged = !this.handbrakeEngaged;
    return this.handbrakeEngaged;
  }

  toggleReverse() {
    // Interlock: cannot engage reverse if moving forward faster than 2 m/s (~7 km/h)
    const forwardSpeed = this.getForwardSpeed();
    if (forwardSpeed > 2.0) {
      console.warn('[vehicle] Reverse gear locked out: vehicle speed too high (> 7 km/h)');
      return this.reverseEngaged;
    }
    this.reverseEngaged = !this.reverseEngaged;
    return this.reverseEngaged;
  }

  toggleHeadlights() {
    this.headlightsOn = !this.headlightsOn;
    return this.headlightsOn;
  }

  triggerScan() {
    if (typeof this.onScan === 'function') this.onScan();
  }

  triggerInteract() {
    if (typeof this.onInteract === 'function') this.onInteract();
  }

  triggerHorn() {
    if (typeof this.onHorn === 'function') this.onHorn();
  }

  // ─────────────────────────────────────────────────────────────
  // Physics Integration Step (called by PhysicsEngine)
  // ─────────────────────────────────────────────────────────────

  integrate(physics, dt) {
    if (dt <= 0 || dt > 0.1) dt = 0.0166; // clamp extreme delta times

    // 1. Steering dynamics: speed-sensitive rack interpolation
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const speedFactor = Math.max(0.35, 1 - (speed / this.maxSpeedForward) * 0.55);
    const targetSteer = this.steerDemand * this.maxSteerAngle * speedFactor;

    if (Math.abs(this.steerDemand) > 0.01) {
      this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, this.steerSpeed * dt);
    } else {
      // Auto-centering
      this.steerAngle += (0 - this.steerAngle) * Math.min(1, this.steerReturnSpeed * dt);
    }

    // 2. Fuel consumption
    if (this.fuelRemaining > 0) {
      const idleBurn = 0.04;
      const throttleBurn = this.throttleDemand * 0.7;
      const distanceBurn = speed * 0.035;
      const totalBurn = (idleBurn + throttleBurn + distanceBurn) * dt;
      this.fuelRemaining = Math.max(0, this.fuelRemaining - totalBurn);
      this.fuelEmpty = this.fuelRemaining <= 0;
    } else {
      this.fuelEmpty = true;
    }

    // 3. Forward/reverse acceleration & braking forces
    const forwardDirX = Math.sin(this.yaw);
    const forwardDirZ = Math.cos(this.yaw);
    const rightDirX = Math.cos(this.yaw);
    const rightDirZ = -Math.sin(this.yaw);

    // Current longitudinal speed (+ forward, - reverse)
    const forwardSpeed = this.velocity.x * forwardDirX + this.velocity.z * forwardDirZ;
    // Current lateral slip speed (+ right, - left)
    const lateralSpeed = this.velocity.x * rightDirX + this.velocity.z * rightDirZ;

    let accelForce = 0;
    if (!this.fuelEmpty && this.throttleDemand > 0) {
      const dir = this.reverseEngaged ? -1 : 1;
      const maxSpd = this.reverseEngaged ? this.maxSpeedReverse : this.maxSpeedForward;
      if (Math.abs(forwardSpeed) < maxSpd || Math.sign(forwardSpeed) !== dir) {
        accelForce = this.throttleDemand * this.engineAcceleration * dir;
      }
    }

    // Braking force opposes current forward speed
    let brakeForce = 0;
    if (this.brakeDemand > 0 && Math.abs(forwardSpeed) > 0.05) {
      brakeForce = -Math.sign(forwardSpeed) * this.brakeDemand * this.brakeDeceleration;
    }

    // Handbrake locks rear axle
    if (this.handbrakeEngaged && Math.abs(forwardSpeed) > 0.05) {
      brakeForce += -Math.sign(forwardSpeed) * this.handbrakeDecel;
    }

    // Resistances
    const dragForce = -this.airDragCoeff * forwardSpeed * Math.abs(forwardSpeed);
    const rollResist = -Math.sign(forwardSpeed) * Math.min(Math.abs(forwardSpeed), this.rollingResistance);

    const netLongitudinalAccel = accelForce + brakeForce + dragForce + rollResist;

    // Lateral grip (anti-slip tire model)
    // Handbrake reduces rear lateral grip, allowing power slides
    const lateralGrip = this.handbrakeEngaged ? 3.5 : 16.0;
    const lateralAccel = -lateralSpeed * lateralGrip;

    // Update world velocity
    this.velocity.x += (forwardDirX * netLongitudinalAccel + rightDirX * lateralAccel) * dt;
    this.velocity.z += (forwardDirZ * netLongitudinalAccel + rightDirZ * lateralAccel) * dt;

    // Low-speed damp to full rest
    if (this.throttleDemand === 0 && this.brakeDemand === 0 && Math.hypot(this.velocity.x, this.velocity.z) < 0.15) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // 4. Yaw rotation (Ackermann-like steering)
    const wheelbase = 2.6; // meters
    const currentForwardSpeed = this.velocity.x * forwardDirX + this.velocity.z * forwardDirZ;
    if (Math.abs(currentForwardSpeed) > 0.05) {
      const yawRate = (currentForwardSpeed / wheelbase) * Math.tan(this.steerAngle);
      this.yaw += yawRate * dt;
    }

    // 5. Position integration
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 6. Obstacle collision detection
    const col = physics.checkObstacleCollision(this.position.x, this.position.z, 1.25);
    if (col.hit) {
      // Reposition along normal to push out of obstacle
      this.position.x += col.nx * col.penetration;
      this.position.z += col.nz * col.penetration;

      // Bounce velocity along collision normal with restitution
      const normalVelocity = this.velocity.x * col.nx + this.velocity.z * col.nz;
      if (normalVelocity < 0) {
        const restitution = 0.35;
        this.velocity.x -= (1 + restitution) * normalVelocity * col.nx;
        this.velocity.z -= (1 + restitution) * normalVelocity * col.nz;

        // Trigger bump percept event
        if (typeof this.onBump === 'function') {
          this.onBump(col.obstacle);
        }
      }
    }

    // 7. Ground height sampling & suspension dynamics
    const groundInfo = physics.getGroundHeight(this.position.x, this.position.z);
    const targetY = groundInfo.y + this.suspensionHeight;

    // Vertical suspension spring-damper
    const yError = targetY - this.position.y;
    const suspensionForce = yError * this.suspensionStiffness - this.verticalVelocity * this.suspensionDamping;
    this.verticalVelocity += suspensionForce * dt;
    this.position.y += this.verticalVelocity * dt;

    // Clamping to ground to prevent falling through terrain
    if (this.position.y < groundInfo.y + 0.1) {
      this.position.y = groundInfo.y + 0.1;
      this.verticalVelocity = Math.max(0, this.verticalVelocity);
    }

    // Suspension Heave/Wobble
    this.suspensionHeave = this.position.y - targetY;

    // 8. Dynamic Pitch and Roll (suspension feel)
    // Pitch: nose dive on brake (-), squat on accel (+)
    const targetPitch = (netLongitudinalAccel * 0.02) + (this.velocity.y * 0.05);
    this.suspensionPitch += (targetPitch - this.suspensionPitch) * Math.min(1, 10 * dt);
    this.pitch = this.suspensionPitch;

    // Roll: body leans outwards in turns
    const targetRoll = -(currentForwardSpeed * this.steerAngle * 0.06);
    this.suspensionRoll += (targetRoll - this.suspensionRoll) * Math.min(1, 12 * dt);
    this.roll = this.suspensionRoll;
  }

  /**
   * Reset vehicle position and velocity to a safe node or spawn point.
   * @param {{ x: number, y?: number, z: number, yaw?: number }} [target]
   */
  resetTo(target) {
    const t = target ?? this.spawnPosition;
    this.position.x = t.x;
    this.position.y = t.y ?? 0.5;
    this.position.z = t.z;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.velocity.z = 0;
    this.verticalVelocity = 0;
    this.yaw = t.yaw ?? this.spawnYaw;
    this.steerAngle = 0;
    this.throttleDemand = 0;
    this.brakeDemand = 0;
    this.handbrakeEngaged = false;
    this.reverseEngaged = false;
    console.log(`[vehicle] Reset to position (${this.position.x.toFixed(1)}, ${this.position.z.toFixed(1)})`);
  }

  refuel(amount = null) {
    this.fuelRemaining = amount !== null ? Math.min(this.tankCapacity, amount) : this.tankCapacity;
    this.fuelEmpty = false;
    console.log(`[vehicle] Refueled to ${this.fuelRemaining.toFixed(1)} units`);
  }

  getSpeedKph() {
    return Math.hypot(this.velocity.x, this.velocity.z) * 3.6;
  }

  getForwardSpeed() {
    const forwardDirX = Math.sin(this.yaw);
    const forwardDirZ = Math.cos(this.yaw);
    return this.velocity.x * forwardDirX + this.velocity.z * forwardDirZ;
  }

  getHeadingVector() {
    return {
      x: Math.sin(this.yaw),
      y: 0,
      z: Math.cos(this.yaw),
    };
  }
}

/**
 * @param {import('../physics/PhysicsEngine.js').PhysicsEngine} physics
 * @param {Object} state
 * @returns {Promise<VehicleController>}
 */
export async function initVehicle(physics, state) {
  const vehicle = new VehicleController();
  console.log('[vehicle] VehicleController initialised');
  return vehicle;
}
