/**
 * VehicleController.js — R1 Force-Based Physics Rebuild
 * All inputs via ActuatorBus. Integrated by PhysicsEngine each tick.
 *
 * Key physics:
 *   a = F_net / mass  (Newton 2nd law)
 *   Engine: F = min(F_peak, P_max/|v|)  power-limited; terminal v emerges from drag balance
 *   Drag:   F_aero = C_drag * v*|v|     quadratic, always opposes motion
 *   Roll:   F_roll = C_rr * m * g       proportional to load
 *   Grip:   sqrt(F_long^2 + F_lat^2) <= mu*m*g  (friction circle)
 *   Zones:  boundary.zone 0=road(mu=0.85) 1=shoulder(mu=0.45) 2=hard-stop+Bump
 *
 * Justified constants:
 *   mass=1400kg  peakEngineForce=10000N  maxEnginePower=40000W
 *   C_drag=0.644  C_rr=0.015  peakBrakeForce=14000N  maxTractionMu=0.85
 *   Terminal v ~37 m/s emerges from force balance. Cap=42 m/s backstop only.
 */

export class VehicleController {
  constructor(config = {}) {
    this.position = { x: 0, y: 0.5, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw  = 0;
    this.pitch = 0;
    this.roll  = 0;
    this.verticalVelocity = 0;

    // Drivetrain (force-based R1)
    this.mass            = 1400;    // kg
    this.peakEngineForce = 10000;   // N  -- max low-speed traction
    this.maxEnginePower  = 40000;   // W  -- crossover at 4 m/s
    this.C_drag          = 0.644;   // N.s2/m2 -- Cd(0.42)*A(2.5)*rho/2
    this.C_rr            = 0.015;   // rolling resistance coeff
    this.peakBrakeForce  = 14000;   // N  -- two-axle disc brakes
    this.handbrakeForce  = 8000;    // N  -- rear axle lock
    this.maxTractionMu   = 0.85;    // tarmac grip
    this.maxSpeedCap     = 42;      // m/s safety backstop
    this.maxSpeedReverse = 10;      // m/s

    // Steering
    this.maxSteerAngle    = 0.58;
    this.steerAngle       = 0;
    this.steerSpeed       = 4.0;
    this.steerReturnSpeed = 6.0;

    // Actuator demands (set ONLY by ActuatorBus)
    this.throttleDemand   = 0;
    this.brakeDemand      = 0;
    this.steerDemand      = 0;
    this.handbrakeEngaged = false;
    this.reverseEngaged   = false;
    this.headlightsOn     = false;

    // Fuel and Hull
    this.fuelRemaining = config.startingFuel  ?? 100;
    this.tankCapacity  = config.tankCapacity  ?? 100;
    this.fuelEmpty     = false;
    this.hullIntegrity = config.hullIntegrity ?? 100;

    // Suspension
    this.suspensionHeight    = 0.45;
    this.suspensionPitch     = 0;
    this.suspensionRoll      = 0;
    this.suspensionHeave     = 0;
    this.suspensionStiffness = 45;
    this.suspensionDamping   = 12;

    // Callbacks
    this.onBump      = null;
    this.onCollision = null;
    this.onInteract  = null;
    this.onScan      = null;
    this.onHorn      = null;

    this.spawnPosition = { x: 0, y: 0.5, z: 0 };
    this.spawnYaw      = 0;
  }

  setThrottle(amount) { this.throttleDemand = Math.max(0, Math.min(1, amount)); }
  setBrake(amount)    { this.brakeDemand    = Math.max(0, Math.min(1, amount)); }
  setSteer(angle)     { this.steerDemand    = Math.max(-1, Math.min(1, angle)); }

  toggleHandbrake() {
    this.handbrakeEngaged = !this.handbrakeEngaged;
    return this.handbrakeEngaged;
  }

  toggleReverse() {
    if (this.getForwardSpeed() > 2.0) {
      console.warn('[vehicle] Reverse gear locked out: vehicle speed too high (>7 km/h)');
      return this.reverseEngaged;
    }
    this.reverseEngaged = !this.reverseEngaged;
    return this.reverseEngaged;
  }

  toggleHeadlights() { this.headlightsOn = !this.headlightsOn; return this.headlightsOn; }
  triggerScan()      { if (typeof this.onScan     === 'function') this.onScan();     }
  triggerInteract()  { if (typeof this.onInteract === 'function') this.onInteract(); }
  triggerHorn()      { if (typeof this.onHorn     === 'function') this.onHorn();     }

  /**
   * Main physics integration. Called by PhysicsEngine.step() every tick.
   * @param {object} physics  PhysicsEngine (obstacle/ground queries)
   * @param {number} dt       Timestep seconds
   * @param {{zone:number,tractionMu:number,distFromCenter:number}|null} boundary
   */
  integrate(physics, dt, boundary = null) {
    if (dt <= 0 || dt > 0.1) dt = 0.0166;

    // 1. Steering dynamics (speed-sensitive rack)
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const speedFactor = Math.max(0.25, 1.0 - (speed / this.maxSpeedCap) * 0.65);
    const targetSteer = this.steerDemand * this.maxSteerAngle * speedFactor;
    if (Math.abs(this.steerDemand) > 0.01) {
      this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, this.steerSpeed * dt);
    } else {
      this.steerAngle += (0 - this.steerAngle) * Math.min(1, this.steerReturnSpeed * dt);
    }

    // 2. Fuel consumption
    if (this.fuelRemaining > 0) {
      this.fuelRemaining = Math.max(0, this.fuelRemaining
        - (0.04 + this.throttleDemand * 0.7 + speed * 0.035) * dt);
      this.fuelEmpty = this.fuelRemaining <= 0;
    } else {
      this.fuelEmpty = true;
    }

    // 3. Basis vectors
    const fwdX =  Math.sin(this.yaw);
    const fwdZ =  Math.cos(this.yaw);
    const rgtX =  Math.cos(this.yaw);
    const rgtZ = -Math.sin(this.yaw);
    const vFwd = this.velocity.x * fwdX + this.velocity.z * fwdZ;
    const vLat = this.velocity.x * rgtX + this.velocity.z * rgtZ;

    // 4. Road zone
    const zoneMu     = boundary ? boundary.tractionMu : this.maxTractionMu;
    const isHardStop = boundary ? (boundary.zone === 2) : false;

    // 5. Engine force [N] -- power-limited above 4 m/s
    //    F = min(F_peak, P_max/|v|)
    //    At ~37 m/s: P_max/v = C_drag*v^2 + C_rr*m*g  --> force balance, terminal v
    let F_engine = 0;
    if (!this.fuelEmpty && this.throttleDemand > 0) {
      const dir    = this.reverseEngaged ? -1 : 1;
      const maxSpd = this.reverseEngaged ? this.maxSpeedReverse : this.maxSpeedCap;
      if (vFwd * dir < maxSpd) {
        const powerLimit = this.maxEnginePower / Math.max(Math.abs(vFwd), 1.0);
        F_engine = this.throttleDemand * Math.min(this.peakEngineForce, powerLimit) * dir;
      }
    }

    // 6. Brake force [N]
    let F_brake = 0;
    if (this.brakeDemand > 0 && Math.abs(vFwd) > 0.05) {
      F_brake = -Math.sign(vFwd) * this.brakeDemand * this.peakBrakeForce;
    }
    if (this.handbrakeEngaged && Math.abs(vFwd) > 0.05) {
      F_brake += -Math.sign(vFwd) * this.handbrakeForce;
    }

    // 7. Passive resistances [N] -- NOT tyre forces; excluded from friction circle
    const F_aero = -this.C_drag * vFwd * Math.abs(vFwd);
    const F_roll = Math.abs(vFwd) > 0.1
      ? -Math.sign(vFwd) * this.C_rr * this.mass * 9.81 : 0;

    // 8. Lateral grip spring [N] -- tyre resisting sideways slip
    const latStiffness = this.handbrakeEngaged ? 3500 : 18000;
    const F_lat_demand = -vLat * latStiffness;

    // 9. Friction circle: sqrt(F_long^2 + F_lat^2) <= mu*m*g
    //    Tyre forces = engine + brake (long) + lateral grip.
    //    Passive resistances (aero, rolling) are not tyre forces -- excluded.
    //    Scale down if demand exceeds grip: understeer/oversteer emerges naturally.
    const maxTractionForce   = zoneMu * this.mass * 9.81;
    const F_tyre_long_demand = F_engine + F_brake;
    const combinedDemand     = Math.hypot(F_tyre_long_demand, F_lat_demand);
    let tyrScale = 1.0;
    if (combinedDemand > maxTractionForce && combinedDemand > 0) {
      tyrScale = maxTractionForce / combinedDemand;
    }
    const F_long_tyre   = F_tyre_long_demand * tyrScale;
    const F_lat_applied = F_lat_demand        * tyrScale;
    const F_long_total  = F_long_tyre + F_aero + F_roll;

    // 10. a = F/m; integrate velocity
    const a_long = F_long_total / this.mass;
    const a_lat  = F_lat_applied / this.mass;
    this.velocity.x += (fwdX * a_long + rgtX * a_lat) * dt;
    this.velocity.z += (fwdZ * a_long + rgtZ * a_lat) * dt;

    // 11. Low-speed snap to rest
    if (this.throttleDemand === 0 && this.brakeDemand === 0
        && Math.hypot(this.velocity.x, this.velocity.z) < 0.15) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // 12. Road boundary hard stop (zone 2)
    if (isHardStop) {
      const impactKph = Math.hypot(this.velocity.x, this.velocity.z) * 3.6;
      this.velocity.x = 0;
      this.velocity.z = 0;
      if (typeof this.onBump === 'function') this.onBump({ type: 'road_edge' }, impactKph);
    }

    // 13. Safety speed cap (drag does real work; this is just a backstop)
    const speedNow = Math.hypot(this.velocity.x, this.velocity.z);
    if (speedNow > this.maxSpeedCap) {
      const cf = this.maxSpeedCap / speedNow;
      this.velocity.x *= cf;
      this.velocity.z *= cf;
    }

    // 14. Yaw: Ackermann bicycle model
    const wheelbase = 2.6;
    const vFwdNow   = this.velocity.x * fwdX + this.velocity.z * fwdZ;
    if (Math.abs(vFwdNow) > 0.05) {
      this.yaw += (vFwdNow / wheelbase) * Math.tan(this.steerAngle) * dt;
    }

    // 15. Position integration
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 16. Obstacle collision
    const col = physics.checkObstacleCollision(this.position.x, this.position.z, 1.25);
    if (col.hit) {
      this.position.x += col.nx * col.penetration;
      this.position.z += col.nz * col.penetration;
      const nv = this.velocity.x * col.nx + this.velocity.z * col.nz;
      if (nv < 0) {
        const kph = Math.abs(nv) * 3.6;
        this.velocity.x -= 1.35 * nv * col.nx;
        this.velocity.z -= 1.35 * nv * col.nz;
        if (kph > 15) this.hullIntegrity = Math.max(0, this.hullIntegrity - Math.round(kph * 0.35));
        if (typeof this.onBump      === 'function') this.onBump(col.obstacle, kph);
        if (typeof this.onCollision === 'function') this.onCollision(kph, col.obstacle);
      }
    }

    // 17. Ground height + suspension spring-damper
    const groundInfo = physics.getGroundHeight(this.position.x, this.position.z);
    const targetY    = groundInfo.y + this.suspensionHeight;
    const yError     = targetY - this.position.y;
    const suspForce  = yError * this.suspensionStiffness - this.verticalVelocity * this.suspensionDamping;
    this.verticalVelocity += suspForce * dt;
    this.position.y       += this.verticalVelocity * dt;
    if (this.position.y < groundInfo.y + 0.1) {
      this.position.y       = groundInfo.y + 0.1;
      this.verticalVelocity = Math.max(0, this.verticalVelocity);
    }
    this.suspensionHeave = this.position.y - targetY;

    // 18. Pitch & Roll feel
    const targetPitch = a_long * 0.02 + this.velocity.y * 0.05;
    this.suspensionPitch += (targetPitch - this.suspensionPitch) * Math.min(1, 10 * dt);
    this.pitch = this.suspensionPitch;
    const targetRoll = -(vFwdNow * this.steerAngle * 0.06);
    this.suspensionRoll += (targetRoll - this.suspensionRoll) * Math.min(1, 12 * dt);
    this.roll = this.suspensionRoll;
  }

  resetTo(target) {
    const t = target ?? this.spawnPosition;
    this.position.x = t.x; this.position.y = t.y ?? 0.5; this.position.z = t.z;
    this.velocity.x = 0; this.velocity.y = 0; this.velocity.z = 0;
    this.verticalVelocity = 0;
    this.yaw = t.yaw ?? this.spawnYaw;
    this.steerAngle = 0; this.throttleDemand = 0; this.brakeDemand = 0;
    this.handbrakeEngaged = false; this.reverseEngaged = false;
    this.hullIntegrity = 100;
    console.log('[vehicle] Reset to (' + this.position.x.toFixed(1) + ', ' + this.position.z.toFixed(1) + ')');
  }

  refuel(amount = null) {
    this.fuelRemaining = amount !== null ? Math.min(this.tankCapacity, amount) : this.tankCapacity;
    this.fuelEmpty = false;
    console.log('[vehicle] Refueled to ' + this.fuelRemaining.toFixed(1) + ' L');
  }

  getSpeedKph()     { return Math.hypot(this.velocity.x, this.velocity.z) * 3.6; }
  getForwardSpeed() { return this.velocity.x * Math.sin(this.yaw) + this.velocity.z * Math.cos(this.yaw); }
  getHeadingVector() { return { x: Math.sin(this.yaw), y: 0, z: Math.cos(this.yaw) }; }
}

export async function initVehicle(physics, state) {
  const vehicle = new VehicleController();
  console.log('[vehicle] VehicleController initialised (R1: force-based, friction circle, road boundary)');
  return vehicle;
}
