/**
 * ProcgenEngine.js
 * ─────────────────────────────────────────────────────────────
 * Owns procedural content generation: terrain mesh, foliage,
 * building placement, weather seed, and world event seeding.
 *
 * Procgen reads the logical WorldContext and RoadNetworkContext
 * then decorates Three.js scene objects — it does NOT mutate the
 * logical world graph itself.
 *
 * Seeded determinism: all RNG must use a user-visible world seed
 * so the same seed always produces the same world.
 */

/**
 * @param {import('../world/WorldManager.js').WorldContext} world
 * @param {import('../roads/RoadNetwork.js').RoadNetworkContext} roads
 * @returns {Promise<void>}
 */
export async function initProcgen(world, roads) {
  // TODO: chunk-based terrain generation, L-system foliage,
  //       building grammar, texture splatting.
  console.log('[procgen] ProcgenEngine initialised (stub)');
}
