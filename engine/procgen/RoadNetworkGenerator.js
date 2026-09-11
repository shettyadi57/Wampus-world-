/**
 * RoadNetworkGenerator.js
 * ─────────────────────────────────────────────────────────────
 * Procedural road-network generation using Kruskal's Minimum Spanning Tree
 * (MST) plus extra edges for route variety and elevation noise for terrain realism.
 *
 * Uses Stage 1's RoadGraph structure without redefining it.
 */

import { RoadGraph } from '../RoadGraph.js';
import { SeededRNG } from './SeededRNG.js';

export class RoadNetworkGenerator {
  /**
   * @param {Object} [options]
   * @param {number} [options.gridWidth=5]
   * @param {number} [options.gridHeight=5]
   * @param {number} [options.nodeSpacing=10]
   * @param {number} [options.jitter=2.0]
   * @param {number} [options.extraEdgeRatio=0.3] - fraction of non-MST edges to add
   * @param {number} [options.elevationScale=12.0]
   * @param {number} [options.elevationNoiseFreq=0.08]
   * @param {number} [options.slopeMultiplier=0.35]
   */
  constructor(options = {}) {
    this.gridWidth = options.gridWidth ?? 5;
    this.gridHeight = options.gridHeight ?? 5;
    this.nodeSpacing = options.nodeSpacing ?? 10;
    this.jitter = options.jitter ?? 2.0;
    this.extraEdgeRatio = options.extraEdgeRatio ?? 0.3;
    this.elevationScale = options.elevationScale ?? 12.0;
    this.elevationNoiseFreq = options.elevationNoiseFreq ?? 0.08;
    this.slopeMultiplier = options.slopeMultiplier ?? 0.35;
  }

  /**
   * Generates a road graph deterministically from the given seed.
   * @param {number|string} [seed=42]
   * @returns {RoadGraph}
   */
  generate(seed = 42) {
    const rng = new SeededRNG(seed);
    const graph = new RoadGraph();

    // ── 1. Create nodes on a jittered 2D grid with elevation noise ──
    const nodes = [];
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const id = `n_${r}_${c}`;
        const jx = rng.nextFloat(-this.jitter, this.jitter);
        const jy = rng.nextFloat(-this.jitter, this.jitter);
        const x = c * this.nodeSpacing + jx;
        const y = r * this.nodeSpacing + jy;

        const elevNoise = rng.octaveNoise2D(
          x * this.elevationNoiseFreq,
          y * this.elevationNoiseFreq,
          3,
          0.5,
          2.0
        );
        const elevation = Math.round(elevNoise * this.elevationScale * 10) / 10;

        graph.addNode(id);
        const nodeDef = graph.nodes.get(id);
        nodeDef.x = x;
        nodeDef.y = y;
        nodeDef.elevation = elevation;
        nodeDef.position = { x, y, z: elevation };
        nodeDef.gridCoord = { r, c };

        nodes.push(nodeDef);
      }
    }

    // ── 2. Collect candidate planar edges (orthogonal + diagonal) ──
    const candidateEdges = [];
    const edgeKeySet = new Set();

    const addCandidate = (r1, c1, r2, c2) => {
      if (r2 < 0 || r2 >= this.gridHeight || c2 < 0 || c2 >= this.gridWidth) return;
      const uId = `n_${r1}_${c1}`;
      const vId = `n_${r2}_${c2}`;
      const key = uId < vId ? `${uId}|${vId}` : `${vId}|${uId}`;
      if (edgeKeySet.has(key)) return;
      edgeKeySet.add(key);

      const u = graph.nodes.get(uId);
      const v = graph.nodes.get(vId);

      const dx = u.x - v.x;
      const dy = u.y - v.y;
      const dz = u.elevation - v.elevation;
      const d2D = Math.hypot(dx, dy);
      // Slope penalty increases effective distance
      const distance = Math.max(1, Math.round((d2D + Math.abs(dz) * this.slopeMultiplier) * 10) / 10);

      candidateEdges.push({ u: uId, v: vId, distance, key });
    };

    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        // Orthogonal
        addCandidate(r, c, r + 1, c);
        addCandidate(r, c, r, c + 1);
        // Diagonal
        addCandidate(r, c, r + 1, c + 1);
        addCandidate(r, c, r + 1, c - 1);
      }
    }

    // ── 3. Kruskal's Minimum Spanning Tree ──
    // Sort edges by distance ascending; add slight deterministic jitter to break ties
    candidateEdges.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.key.localeCompare(b.key);
    });

    const parent = new Map();
    const rank = new Map();
    for (const node of nodes) {
      parent.set(node.id, node.id);
      rank.set(node.id, 0);
    }

    const find = (i) => {
      let root = i;
      while (root !== parent.get(root)) {
        root = parent.get(root);
      }
      let curr = i;
      while (curr !== root) {
        const nxt = parent.get(curr);
        parent.set(curr, root);
        curr = nxt;
      }
      return root;
    };

    const union = (i, j) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI === rootJ) return false;
      const rankI = rank.get(rootI);
      const rankJ = rank.get(rootJ);
      if (rankI < rankJ) {
        parent.set(rootI, rootJ);
      } else if (rankI > rankJ) {
        parent.set(rootJ, rootI);
      } else {
        parent.set(rootJ, rootI);
        rank.set(rootI, rankI + 1);
      }
      return true;
    };

    const remainingEdges = [];
    let mstEdgeCount = 0;

    for (const edge of candidateEdges) {
      if (union(edge.u, edge.v)) {
        graph.addEdge(edge.u, edge.v, { distance: edge.distance });
        mstEdgeCount++;
      } else {
        remainingEdges.push(edge);
      }
    }

    // ── 4. Add extra edges for route variety (cycles / bypasses) ──
    const extraCount = Math.floor(remainingEdges.length * this.extraEdgeRatio);
    // Shuffle remaining edges deterministically
    const shuffledRemaining = rng.shuffle(remainingEdges);
    const addedExtra = shuffledRemaining.slice(0, extraCount);

    for (const edge of addedExtra) {
      graph.addEdge(edge.u, edge.v, { distance: edge.distance });
    }

    return graph;
  }
}
