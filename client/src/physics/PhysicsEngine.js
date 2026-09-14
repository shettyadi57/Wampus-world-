/**
 * PhysicsEngine.js
 * Controllable semi-realistic vehicle physics engine.
 * Computes drivetrain forces, aerodynamic drag, tire traction,
 * weight transfer (pitch and roll), suspension heave, and obstacle collisions.
 *
 * R1 addition: checkRoadBoundary() enforces road ribbon containment via
 * a SOFT-CONSTRAINT zone model (chosen over hard collision walls because the
 * road is spline-based and boundary geometry would require hundreds of boxes):
 *   Zone 0 (within roadWidth/2 + 1m): full grip, tractionMu = 0.85
 *   Zone 1 (within roadWidth/2 + 4m): rough shoulder, tractionMu = 0.45
 *   Zone 2 (beyond roadWidth/2 + 4m): hard stop + Bump percept fired
 * step() queries this zone and passes a boundary descriptor to vehicle.integrate().
 */

export class PhysicsEngine {
  constructor() {
    this._roadNetwork = null;
    this._terrain     = null;
    this._obstacles   = [];

    this.gravity    = 9.81;
    this.airDensity = 1.225;
  }

  setEnvironment({ roadNetwork, terrain, obstacles = [] }) {
    this._roadNetwork = roadNetwork;
    this._terrain     = terrain;
    this._obstacles   = obstacles;
  }

  addObstacle(obstacle) {
    this._obstacles.push(obstacle);
  }

  /**
   * Sample ground elevation at (x, z).
   * Prioritises road splines over terrain heightfield.
   */
  getGroundHeight(x, z) {
    if (this._roadNetwork && typeof this._roadNetwork.getRoadElevation === 'function') {
      const roadInfo = this._roadNetwork.getRoadElevation(x, z);
      if (roadInfo !== null) return roadInfo;
    }
    if (this._terrain && typeof this._terrain.getHeight === 'function') {
      const ty     = this._terrain.getHeight(x, z);
      const normal = this._terrain.getNormal ? this._terrain.getNormal(x, z) : [0, 1, 0];
      return { y: ty, surface: 'terrain', normal };
    }
    return { y: 0, surface: 'terrain', normal: [0, 1, 0] };
  }

  /**
   * Circle-cylinder collision against static obstacles.
   */
  checkObstacleCollision(x, z, radius = 1.2) {
    for (const obs of this._obstacles) {
      const dx   = x - obs.x;
      const dz   = z - obs.z;
      const dist = Math.hypot(dx, dz);
      const minDist = radius + (obs.radius || 1.0);
      if (dist < minDist && dist > 0.001) {
        return { hit: true, obstacle: obs,
                 nx: dx / dist, nz: dz / dist, penetration: minDist - dist };
      }
    }
    return { hit: false, obstacle: null, nx: 0, nz: 0, penetration: 0 };
  }

  /**
   * Road ribbon containment check (soft-constraint, R1).
   *
   * Zone model (why soft, not hard walls):
   *   Road is a Catmull-Rom spline. Adding invisible wall geometry to every
   *   curve requires hundreds of oriented boxes per segment and integration
   *   into the obstacle system. A centerline distance check is cheaper,
   *   deterministic, and already integrates with getRoadElevation().
   *
   * @param {number} x
   * @param {number} z
   * @returns {{ zone: 0|1|2, tractionMu: number, distFromCenter: number }}
   */
  checkRoadBoundary(x, z) {
    if (!this._roadNetwork
        || typeof this._roadNetwork.getDistanceFromCenterline !== 'function') {
      // No road network bound -- treat as open terrain, full grip
      return { zone: 0, tractionMu: 0.85, distFromCenter: 0 };
    }

    const info = this._roadNetwork.getDistanceFromCenterline(x, z);
    const hw   = info.halfWidth;       // road half-width in metres
    const d    = info.distFromCenter;  // distance from nearest spline centreline

    if (d <= hw + 1.0) {
      // Zone 0: within road ribbon + 1m margin -- full tarmac grip
      return { zone: 0, tractionMu: 0.85, distFromCenter: d };
    } else if (d <= hw + 4.0) {
      // Zone 1: soft shoulder (1m--4m beyond edge) -- rough terrain, grip reduced
      return { zone: 1, tractionMu: 0.45, distFromCenter: d };
    } else {
      // Zone 2: beyond soft shoulder -- hard stop + Bump percept
      return { zone: 2, tractionMu: 0.45, distFromCenter: d };
    }
  }

  /**
   * Advance simulation step by dt seconds.
   * Queries road boundary zone and passes it to vehicle.integrate().
   */
  step(vehicle, dt) {
    if (!vehicle || typeof vehicle.integrate !== 'function') return;
    const boundary = this.checkRoadBoundary(vehicle.position.x, vehicle.position.z);
    vehicle.integrate(this, dt, boundary);
  }
}

export async function initPhysics(world) {
  const engine = new PhysicsEngine();
  console.log('[physics] PhysicsEngine initialised (R1: road boundary zones)');
  return engine;
}
