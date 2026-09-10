/**
 * RoadNetwork.js
 * ─────────────────────────────────────────────────────────────
 * Owns the drivable road graph: spline geometry, lane data,
 * speed limits, road surface metadata, and junction topology.
 *
 * Distinct from WorldManager (logical node graph) — RoadNetwork
 * stores the continuous spatial representation that navigation
 * and physics actually use when moving between nodes.
 *
 * Does NOT own the logical hazard/item state of nodes — that is
 * WorldManager's concern.
 */

/**
 * @typedef {Object} RoadSegment
 * @property {string}   id
 * @property {string}   fromNodeId
 * @property {string}   toNodeId
 * @property {number}   lengthM        – length in metres
 * @property {number}   speedLimitKph
 * @property {string}   surfaceType    – 'asphalt' | 'gravel' | 'dirt' | 'bridge'
 * @property {number[][]} splinePoints – [[x,y,z], ...]
 */

/**
 * @typedef {Object} RoadNetworkContext
 * @property {Map<string, RoadSegment>} segments
 * @property {function(string, string): RoadSegment|null} getSegment
 * @property {function(string): RoadSegment[]} getSegmentsFromNode
 */

/**
 * @param {import('../world/WorldManager.js').WorldContext} world
 * @returns {Promise<RoadNetworkContext>}
 */
export async function initRoads(world) {
  // TODO: build spline network from world graph edges.
  console.log('[roads] RoadNetwork initialised (stub)');
  return {};
}
