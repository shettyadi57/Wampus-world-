/**
 * entityPlacer.test.js
 * ─────────────────────────────────────────────────────────────
 * Unit tests for EntityPlacer (hazards, objective, fuel nodes, checkpoints).
 */

import { RoadNetworkGenerator } from '../../../engine/procgen/RoadNetworkGenerator.js';
import { EntityPlacer } from '../../../engine/procgen/EntityPlacer.js';

describe('EntityPlacer', () => {
  let graph;

  beforeEach(() => {
    const gen = new RoadNetworkGenerator({ gridWidth: 5, gridHeight: 5 });
    graph = gen.generate(42);
  });

  test('places exactly one objective on a safe non-start node', () => {
    const placer = new EntityPlacer({ difficulty: 'medium' });
    const spec = placer.placeEntities(graph, 42);

    expect(spec.startId).toBeDefined();
    expect(spec.objectiveId).toBeDefined();
    expect(spec.startId).not.toBe(spec.objectiveId);

    const startNode = graph.nodes.get(spec.startId);
    const objNode = graph.nodes.get(spec.objectiveId);

    expect(startNode.hazard).toBe('none');
    expect(startNode.hasObjective).toBe(false);

    expect(objNode.hazard).toBe('none');
    expect(objNode.hasObjective).toBe(true);
  });

  test('scales hazard density and fuel according to difficulty preset', () => {
    const easyPlacer = new EntityPlacer({ difficulty: 'easy' });
    const hardPlacer = new EntityPlacer({ difficulty: 'hard' });

    const easySpec = easyPlacer.placeEntities(graph, 100);
    const easyTotalHazards = easySpec.pitNodes.length + easySpec.hunterNodes.length;

    // Fresh graph for hard
    const gen = new RoadNetworkGenerator({ gridWidth: 5, gridHeight: 5 });
    const hardGraph = gen.generate(100);
    const hardSpec = hardPlacer.placeEntities(hardGraph, 100);
    const hardTotalHazards = hardSpec.pitNodes.length + hardSpec.hunterNodes.length;

    expect(hardTotalHazards).toBeGreaterThanOrEqual(easyTotalHazards);
    expect(easySpec.startingFuel).toBeGreaterThan(hardSpec.startingFuel);
  });

  test('places fuel nodes and checkpoints only on safe nodes', () => {
    const placer = new EntityPlacer({ difficulty: 'medium' });
    const spec = placer.placeEntities(graph, 555);

    const hazardSet = new Set([...spec.pitNodes, ...spec.hunterNodes]);

    for (const fuelId of spec.fuelNodes) {
      expect(hazardSet.has(fuelId)).toBe(false);
      expect(graph.nodes.get(fuelId).hasFuel).toBe(true);
      expect(graph.nodes.get(fuelId).hazard).toBe('none');
    }

    for (const cpId of spec.checkpoints) {
      expect(hazardSet.has(cpId)).toBe(false);
      expect(graph.nodes.get(cpId).isCheckpoint).toBe(true);
      expect(graph.nodes.get(cpId).hazard).toBe('none');
    }
  });
});
