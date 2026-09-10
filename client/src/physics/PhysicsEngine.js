/**
 * PhysicsEngine.js
 * ─────────────────────────────────────────────────────────────
 * Owns the physics simulation tick: rigid bodies, collision
 * detection, and constraint solving.
 *
 * Candidate back-ends: Rapier (WASM), Cannon-es, or Ammo.js.
 * Back-end selection is an implementation detail; this module's
 * public surface must remain back-end agnostic.
 *
 * Does NOT own rendering or game state mutation.
 */

/**
 * @typedef {Object} PhysicsContext
 * @property {Function} addBody      – register a rigid body
 * @property {Function} removeBody   – unregister a rigid body
 * @property {Function} step         – advance simulation by dt
 * @property {Function} raycast      – synchronous ray-cast query
 */

/**
 * @param {Object} world  – WorldManager context (bounds, gravity, etc.)
 * @returns {Promise<PhysicsContext>}
 */
export async function initPhysics(world) {
  // TODO: load physics back-end (Rapier WASM preferred),
  //       configure gravity vector, broad-phase, collision layers.
  console.log('[physics] PhysicsEngine initialised (stub)');
  return {};
}
