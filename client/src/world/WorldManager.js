/**
 * WorldManager.js
 * ─────────────────────────────────────────────────────────────
 * Owns the world graph: the logical grid of nodes (tiles / rooms)
 * that the agent perceives and reasons about.
 *
 * The world is modelled as an undirected graph where each node
 * has coordinates, adjacency edges, and a set of properties
 * (hazards, items, topology). Geometry / Three.js meshes are
 * NOT stored here — that is GraphicsEngine's concern.
 *
 * Core Wumpus-World mapping:
 *   Node  → grid cell / intersection
 *   Edge  → traversable road segment between adjacent nodes
 *   Pit   → hazard node (bottomless pit / sinkhole)
 *   Wampus → mobile hazard entity tracked in KnowledgeBase
 *   Gold  → mission item at a specific node
 */

/**
 * @typedef {Object} WorldNode
 * @property {string}   id          – unique node identifier "r{row}c{col}"
 * @property {number}   row
 * @property {number}   col
 * @property {string[]} adjacent    – ids of directly connected nodes
 * @property {boolean}  hasPit
 * @property {boolean}  hasWampus
 * @property {boolean}  hasGold
 * @property {boolean}  visited
 */

/**
 * @typedef {Object} WorldContext
 * @property {Map<string, WorldNode>} nodes
 * @property {WorldNode}              spawnNode
 * @property {function(string): WorldNode} getNode
 * @property {function(string): WorldNode[]} getNeighbors
 */

/**
 * @param {Object} state – GameState
 * @returns {Promise<WorldContext>}
 */
export async function initWorld(state) {
  // TODO: build world graph from seed / saved state.
  //       Procgen will overlay the generated geometry on top.
  console.log('[world] WorldManager initialised (stub)');
  return {};
}
