/**
 * PhysicsEngine.js
 * ─────────────────────────────────────────────────────────────
 * Controllable semi-realistic vehicle physics engine.
 * Computes drivetrain forces, aerodynamic drag, tire traction,
 * weight transfer (pitch & roll), suspension heave, and obstacle collisions.
 */

export class PhysicsEngine {
  constructor() {
    this._roadNetwork = null;
    this._terrain = null;
    this._obstacles = []; // Array<{ x, z, radius, height, type }>

    // Physical constants
    this.gravity = 9.81;
    this.airDensity = 1.225;
  }

  /**
   * Bind environment references for heightfield & collision checks.
   * @param {Object} opts
   */
  setEnvironment({ roadNetwork, terrain, obstacles = [] }) {
    this._roadNetwork = roadNetwork;
    this._terrain = terrain;
    this._obstacles = obstacles;
  }

  /**
   * Register obstacle collider (rocks, trees, guardrails, tunnel walls).
   * @param {{ x: number, z: number, radius: number, type?: string }} obstacle
   */
  addObstacle(obstacle) {
    this._obstacles.push(obstacle);
  }

  /**
   * Sample ground elevation and surface normal at horizontal position (x, z).
   * Prioritizes elevated road splines / bridges if close to a road segment.
   *
   * @param {number} x
   * @param {number} z
   * @returns {{ y: number, surface: 'road'|'terrain'|'bridge'|'tunnel', normal: [number, number, number] }}
   */
  getGroundHeight(x, z) {
    // 1. Check if vehicle is over a road segment / spline
    if (this._roadNetwork && typeof this._roadNetwork.getRoadElevation === 'function') {
      const roadInfo = this._roadNetwork.getRoadElevation(x, z);
      if (roadInfo !== null) {
        return roadInfo;
      }
    }

    // 2. Sample terrain heightfield
    if (this._terrain && typeof this._terrain.getHeight === 'function') {
      const ty = this._terrain.getHeight(x, z);
      const normal = this._terrain.getNormal ? this._terrain.getNormal(x, z) : [0, 1, 0];
      return { y: ty, surface: 'terrain', normal };
    }

    // Fallback baseline ground
    return { y: 0, surface: 'terrain', normal: [0, 1, 0] };
  }

  /**
   * Check circle-cylinder collision against static obstacles.
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @returns {{ hit: boolean, obstacle: Object|null, nx: number, nz: number, penetration: number }}
   */
  checkObstacleCollision(x, z, radius = 1.2) {
    for (const obs of this._obstacles) {
      const dx = x - obs.x;
      const dz = z - obs.z;
      const dist = Math.hypot(dx, dz);
      const minDist = radius + (obs.radius || 1.0);

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const penetration = minDist - dist;
        return { hit: true, obstacle: obs, nx, nz, penetration };
      }
    }
    return { hit: false, obstacle: null, nx: 0, nz: 0, penetration: 0 };
  }

  /**
   * Advance simulation step by dt seconds.
   *
   * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
   * @param {number} dt
   */
  step(vehicle, dt) {
    if (!vehicle || typeof vehicle.integrate !== 'function') return;
    vehicle.integrate(this, dt);
  }
}

/**
 * @param {Object} world
 * @returns {Promise<PhysicsEngine>}
 */
export async function initPhysics(world) {
  const engine = new PhysicsEngine();
  console.log('[physics] PhysicsEngine initialised');
  return engine;
}
