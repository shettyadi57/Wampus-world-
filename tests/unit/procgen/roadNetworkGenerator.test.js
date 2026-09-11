/**
 * roadNetworkGenerator.test.js
 * ─────────────────────────────────────────────────────────────
 * Unit tests for RoadNetworkGenerator (Kruskal's MST, extra edges, elevation).
 */

import { RoadNetworkGenerator } from '../../../engine/procgen/RoadNetworkGenerator.js';

describe('RoadNetworkGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new RoadNetworkGenerator({
      gridWidth: 4,
      gridHeight: 4,
      nodeSpacing: 10,
      jitter: 1.5,
      extraEdgeRatio: 0.25,
      elevationScale: 10,
    });
  });

  test('generates expected number of nodes with valid coordinates and elevation', () => {
    const graph = generator.generate(42);
    expect(graph.nodeIds).toHaveLength(16);

    for (const id of graph.nodeIds) {
      const node = graph.nodes.get(id);
      expect(node).toBeDefined();
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(typeof node.elevation).toBe('number');
      expect(node.position).toEqual({ x: node.x, y: node.y, z: node.elevation });
    }
  });

  test('builds a fully connected graph with more edges than MST backbone', () => {
    const graph = generator.generate(42);
    const N = graph.nodeIds.length;

    // A spanning tree requires at least N - 1 edges
    // With extraEdgeRatio > 0, total edges must strictly exceed N - 1
    expect(graph._edges.size).toBeGreaterThan(N - 1);

    // Verify global graph connectivity via BFS
    const visited = new Set();
    const queue = [graph.nodeIds[0]];
    visited.add(graph.nodeIds[0]);

    while (queue.length > 0) {
      const curr = queue.shift();
      for (const neighbor of graph.getNeighbors(curr)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    expect(visited.size).toBe(N);
  });

  test('calculates positive edge distances influenced by elevation slope', () => {
    const graph = generator.generate(123);

    for (const [key, edge] of graph._edges) {
      expect(edge.distance).toBeGreaterThan(0);
      expect(edge.passable).toBe(true);

      const u = graph.nodes.get(edge.a);
      const v = graph.nodes.get(edge.b);
      const d2D = Math.hypot(u.x - v.x, u.y - v.y);
      // Edge distance must be at least the 2D Euclidean distance (or equal if dz is 0)
      expect(edge.distance).toBeGreaterThanOrEqual(Math.floor(d2D));
    }
  });

  test('is fully deterministic given the same seed', () => {
    const g1 = generator.generate(999);
    const g2 = generator.generate(999);

    expect(g1.nodeIds).toEqual(g2.nodeIds);
    expect(g1._edges.size).toBe(g2._edges.size);

    for (const [key, edge1] of g1._edges) {
      const edge2 = g2._edges.get(key);
      expect(edge2).toBeDefined();
      expect(edge1.distance).toBe(edge2.distance);
    }
  });
});
