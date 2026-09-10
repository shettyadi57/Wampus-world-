/**
 * RoadGraph.js
 * ─────────────────────────────────────────────────────────────
 * Undirected weighted graph of road nodes.
 *
 * Node properties are WORLD TRUTH — never read by the KB directly.
 * The KB only learns about the world through percepts.
 *
 * Usage:
 *   const g = new RoadGraph();
 *   g.addNode('n1_1').addNode('n1_2').addEdge('n1_1','n1_2',{distance:1});
 */

export class RoadGraph {
  constructor() {
    /** @type {Map<string, NodeDef>} */
    this.nodes = new Map();

    /** @type {Map<string, EdgeDef>} */
    this._edges = new Map();
  }

  /**
   * @param {string} id
   * @param {{ hazard?: 'none'|'pit'|'hunter', hasObjective?: boolean,
   *           hasFuel?: boolean, isCheckpoint?: boolean }} [opts]
   * @returns {this} – for chaining
   */
  addNode(id, opts = {}) {
    if (this.nodes.has(id)) return this; // idempotent
    this.nodes.set(id, {
      id,
      hazard:        opts.hazard        ?? 'none',
      hasObjective:  opts.hasObjective  ?? false,
      hasFuel:       opts.hasFuel       ?? false,
      isCheckpoint:  opts.isCheckpoint  ?? false,
      adjacent: new Set(),
    });
    return this;
  }

  /**
   * Add an undirected edge between two existing nodes.
   * @param {string} a
   * @param {string} b
   * @param {{ distance?: number }} [opts]
   * @returns {this}
   */
  addEdge(a, b, opts = {}) {
    if (!this.nodes.has(a)) throw new Error(`RoadGraph: node "${a}" not found`);
    if (!this.nodes.has(b)) throw new Error(`RoadGraph: node "${b}" not found`);

    const key = edgeKey(a, b);
    if (!this._edges.has(key)) {
      this._edges.set(key, { a, b, distance: opts.distance ?? 1, passable: true });
      this.nodes.get(a).adjacent.add(b);
      this.nodes.get(b).adjacent.add(a);
    }
    return this;
  }

  /**
   * Mark an edge as impassable (Bump inference). This is NOT hazard evidence.
   * @param {string} a
   * @param {string} b
   */
  markEdgeImpassable(a, b) {
    const edge = this._edges.get(edgeKey(a, b));
    if (edge) {
      edge.passable = false;
      this.nodes.get(a)?.adjacent.delete(b);
      this.nodes.get(b)?.adjacent.delete(a);
    }
  }

  /**
   * @param {string} nodeId
   * @returns {string[]} neighbour node IDs (passable edges only)
   */
  getNeighbors(nodeId) {
    return [...(this.nodes.get(nodeId)?.adjacent ?? [])];
  }

  /**
   * Direct edge distance between adjacent nodes. Returns Infinity if not adjacent.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  getDistance(a, b) {
    return this._edges.get(edgeKey(a, b))?.distance ?? Infinity;
  }

  /** @returns {string[]} */
  get nodeIds() {
    return [...this.nodes.keys()];
  }
}

/** Canonical undirected edge key. */
function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
