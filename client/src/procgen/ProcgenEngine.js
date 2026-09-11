/**
 * ProcgenEngine.js
 * ─────────────────────────────────────────────────────────────
 * Builds the Mountain/Forest 3D procedural environment around the
 * road network and registers collider obstacles with physics.
 */

import { MountainForestRegion } from '../world/MountainForestRegion.js';

/**
 * @param {Object} world
 * @param {import('../roads/RoadNetwork.js').RoadNetwork} roads
 * @param {import('../physics/PhysicsEngine.js').PhysicsEngine} physics
 * @returns {Promise<MountainForestRegion>}
 */
export async function initProcgen(world, roads, physics) {
  const region = new MountainForestRegion(roads, world.spec, physics, {
    seed: world.spec?.seed ?? 42,
  });

  // Bind terrain and road network to physics engine
  physics.setEnvironment({
    roadNetwork: roads,
    terrain: region,
  });

  console.log('[procgen] MountainForestRegion generated and bound to physics');
  return region;
}
