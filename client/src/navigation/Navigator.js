/**
 * Navigator.js
 * ─────────────────────────────────────────────────────────────
 * Owns path planning and waypoint management between world nodes.
 *
 * Navigator queries the KnowledgeBase for safe/known nodes and
 * the RoadNetwork for traversal costs, then produces a sequence
 * of road segments the vehicle should follow.
 *
 * Algorithm: A* over the road graph, with edge weights that
 * combine distance and KB-derived risk score.
 *
 * Navigator does NOT issue actuator commands — it hands waypoints
 * to the AI Driver which translates them to accelerate/steer calls.
 */

/** @typedef {import('../ai/knowledge/KnowledgeBase.js').KnowledgeBaseContext} KBContext */
/** @typedef {import('../world/WorldManager.js').WorldContext} WorldContext */
/** @typedef {import('../roads/RoadNetwork.js').RoadNetworkContext} RoadNetworkContext */

/**
 * @typedef {Object} Waypoint
 * @property {string}   nodeId
 * @property {number[]} position  – [x, y, z] world position of node centre
 */

/**
 * @typedef {Object} NavigatorContext
 * @property {function(string, string): Waypoint[]} planPath
 *   (fromNodeId, toNodeId) → ordered list of waypoints
 * @property {function(): Waypoint|null} nextWaypoint  – peek at current target
 * @property {function(string): void} setDestination   – set goal node
 */

/**
 * @param {KBContext} kb
 * @param {WorldContext} world
 * @param {RoadNetworkContext} roads
 * @returns {Promise<NavigatorContext>}
 */
export async function initNavigation(kb, world, roads) {
  // TODO: implement A* planner, waypoint queue, rerouting on KB updates.
  console.log('[navigation] Navigator initialised (stub)');
  return {
    planPath:       () => [],
    nextWaypoint:   () => null,
    setDestination: () => {},
  };
}
