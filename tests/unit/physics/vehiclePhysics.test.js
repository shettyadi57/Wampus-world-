/**
 * vehiclePhysics.test.js
 * Headless (no rendering) physics integration test harness.
 *
 * Tests:
 *  1. Full-throttle top-speed convergence: prints speed every 5 s, asserts sane range.
 *  2. No unbounded growth: speed must never exceed safety cap across 120 s.
 *  3. Road boundary enforcement: vehicle driven perpendicular to road does not
 *     escape beyond the hard-stop zone (halfWidth + 4 m from centreline).
 *
 * Run:
 *   npm run test:unit -- tests/unit/physics
 */

import { VehicleController } from '../../../client/src/vehicle/VehicleController.js';

// ─────────────────────────────────────────────────────────────
// Minimal mock physics engine (no Three.js, no rendering)
// ─────────────────────────────────────────────────────────────

/**
 * Build a minimal PhysicsEngine mock.
 * @param {{ getDistanceFromCenterline?: (x,z)=>{} }} [roadNetworkMock]
 */
function makeMockPhysics(roadNetworkMock = null) {
  return {
    _roadNetwork: roadNetworkMock,

    getGroundHeight(x, z) {
      return { y: 0, surface: 'road', normal: [0, 1, 0] };
    },

    checkObstacleCollision(x, z, r) {
      return { hit: false, obstacle: null, nx: 0, nz: 0, penetration: 0 };
    },

    checkRoadBoundary(x, z) {
      if (!this._roadNetwork) return { zone: 0, tractionMu: 0.85, distFromCenter: 0 };
      const info = this._roadNetwork.getDistanceFromCenterline(x, z);
      const hw   = info.halfWidth;
      const d    = info.distFromCenter;
      if (d <= hw + 1.0) return { zone: 0, tractionMu: 0.85, distFromCenter: d };
      if (d <= hw + 4.0) return { zone: 1, tractionMu: 0.45, distFromCenter: d };
      return            { zone: 2, tractionMu: 0.45, distFromCenter: d };
    },

    step(vehicle, dt) {
      if (!vehicle || typeof vehicle.integrate !== 'function') return;
      const boundary = this.checkRoadBoundary(vehicle.position.x, vehicle.position.z);
      vehicle.integrate(this, dt, boundary);
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Straight road mock: centerline along Z axis, x=0
// halfWidth = 3.1 m  (road.roadWidth = 6.2)
// ─────────────────────────────────────────────────────────────
function makeStraightRoadMock() {
  return {
    getDistanceFromCenterline(x, z) {
      // Straight centreline at x=0, any z. Distance = |x|.
      return { distFromCenter: Math.abs(x), halfWidth: 3.1, onRoad: Math.abs(x) <= 3.1 };
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Simulate vehicle at full throttle along heading yaw=0 (forward = +Z axis).
 * Returns array of { t, speedMps, speedKph } snapshots every snapshotInterval s.
 */
function runFullThrottle(durationS, dt = 0.016, snapshotIntervalS = 5) {
  const physics = makeMockPhysics();          // no road boundary for straight-line test
  const vehicle = new VehicleController({ startingFuel: 99999 });
  vehicle.setThrottle(1.0);

  const snapshots = [];
  let   elapsed   = 0;
  let   nextSnap  = snapshotIntervalS;
  let   maxSpeed  = 0;

  while (elapsed < durationS) {
    physics.step(vehicle, dt);
    elapsed += dt;
    const s = Math.hypot(vehicle.velocity.x, vehicle.velocity.z);
    if (s > maxSpeed) maxSpeed = s;
    if (elapsed >= nextSnap - dt * 0.5) {
      snapshots.push({ t: Math.round(elapsed), speedMps: s, speedKph: s * 3.6 });
      nextSnap += snapshotIntervalS;
    }
  }
  return { snapshots, maxSpeed };
}

/**
 * Run vehicle perpendicular to a straight road (heading = PI/2, so velocity in +X direction).
 * Returns final position and distFromCenter.
 */
function runOffRoad(durationS, dt = 0.016) {
  const road    = makeStraightRoadMock();
  const physics = makeMockPhysics(road);
  const vehicle = new VehicleController({ startingFuel: 99999 });

  // Face perpendicular to road centreline: heading +X = yaw = PI/2
  vehicle.yaw = Math.PI / 2;
  vehicle.setThrottle(1.0);

  let   bumped = false;
  vehicle.onBump = () => { bumped = true; };

  let elapsed = 0;
  while (elapsed < durationS) {
    physics.step(vehicle, dt);
    elapsed += dt;
  }

  return {
    finalX:          vehicle.position.x,
    finalZ:          vehicle.position.z,
    distFromCenter:  Math.abs(vehicle.position.x),
    speedMps:        Math.hypot(vehicle.velocity.x, vehicle.velocity.z),
    bumped,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('VehicleController — Force-based physics (R1)', () => {

  // ── Test 1: Full-throttle top-speed convergence ──────────────
  test('[1] Full-throttle from standstill reaches sane top speed in 60 s', () => {
    const { snapshots, maxSpeed } = runFullThrottle(60, 0.016, 5);

    console.log('');
    console.log('=== TEST 1: Full-Throttle Top-Speed Convergence ===');
    console.log('  t(s)   Speed(m/s)   Speed(km/h)');
    for (const snap of snapshots) {
      console.log(
        '  ' + String(snap.t).padStart(3) + 's    ' +
        snap.speedMps.toFixed(2).padStart(9) + '    ' +
        snap.speedKph.toFixed(1).padStart(9) + ' km/h'
      );
    }
    console.log('');

    const finalSnap = snapshots[snapshots.length - 1];
    const finalSpeedMps = finalSnap.speedMps;
    const finalSpeedKph = finalSnap.speedKph;

    console.log('  Final speed: ' + finalSpeedMps.toFixed(2) + ' m/s  (' + finalSpeedKph.toFixed(1) + ' km/h)');
    console.log('  Peak speed:  ' + maxSpeed.toFixed(2) + ' m/s  (' + (maxSpeed * 3.6).toFixed(1) + ' km/h)');
    console.log('');

    // Assert: speed must be within a sane real-world range for this vehicle
    expect(finalSpeedMps).toBeGreaterThan(28);   // > 101 km/h (should reach near terminal)
    expect(finalSpeedMps).toBeLessThan(42);       // < safety cap (drag does real work, cap is backstop)
  });

  // ── Test 2: Speed converges (no unbounded growth) ────────────
  test('[2] Speed converges to a stable terminal value — does not grow unbounded over 120 s', () => {
    const { snapshots } = runFullThrottle(120, 0.016, 10);

    console.log('=== TEST 2: Speed Convergence Over 120 s ===');
    console.log('  t(s)   Speed(m/s)   Speed(km/h)');
    for (const snap of snapshots) {
      console.log(
        '  ' + String(snap.t).padStart(3) + 's    ' +
        snap.speedMps.toFixed(2).padStart(9) + '    ' +
        snap.speedKph.toFixed(1).padStart(9) + ' km/h'
      );
    }

    // Speed at t=110s vs t=120s: difference must be tiny (< 0.3 m/s)
    const s110 = snapshots[snapshots.length - 2];
    const s120 = snapshots[snapshots.length - 1];
    const delta = Math.abs(s120.speedMps - s110.speedMps);

    console.log('');
    console.log('  Speed at 110s: ' + s110.speedMps.toFixed(3) + ' m/s');
    console.log('  Speed at 120s: ' + s120.speedMps.toFixed(3) + ' m/s');
    console.log('  Delta (convergence): ' + delta.toFixed(4) + ' m/s  (must be < 0.3 m/s)');
    console.log('');

    expect(delta).toBeLessThan(0.3);
    expect(s120.speedMps).toBeLessThan(42);   // must never exceed safety cap
  });

  // ── Test 3: Road boundary enforcement ───────────────────────
  test('[3] Vehicle driven perpendicular to road does not escape beyond hard-stop zone', () => {
    // Road: centreline at x=0. halfWidth=3.1m. Soft shoulder to 7.1m. Hard stop at 7.1m.
    // Vehicle faces +X (perpendicular to road) with full throttle for 3 s.
    // Expected: vehicle stops at or before x = halfWidth + 4m = 7.1m from centreline.
    const result = runOffRoad(3.0, 0.016);

    console.log('=== TEST 3: Road Boundary Enforcement ===');
    console.log('  Road centreline: x = 0');
    console.log('  Road half-width: 3.1 m');
    console.log('  Soft shoulder:   3.1m -- 7.1m from centre (mu=0.45)');
    console.log('  Hard stop zone:  beyond 7.1m from centre');
    console.log('');
    console.log('  Final position:        x = ' + result.finalX.toFixed(3) + ' m');
    console.log('  Distance from centre:  ' + result.distFromCenter.toFixed(3) + ' m');
    console.log('  Final speed:           ' + result.speedMps.toFixed(3) + ' m/s');
    console.log('  Bump percept fired:    ' + result.bumped);
    console.log('');

    const hardStopBoundary = 3.1 + 4.0; // = 7.1 m
    // Vehicle must not pass through hard-stop zone
    expect(result.distFromCenter).toBeLessThanOrEqual(hardStopBoundary + 0.5);
    // Bump percept must have fired (road_edge detected)
    expect(result.bumped).toBe(true);
    // Vehicle must be approximately stopped (speed < 1 m/s after hard stop)
    expect(result.speedMps).toBeLessThan(1.0);
  });

});
