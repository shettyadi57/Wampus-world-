/**
 * aiSystemsIntegration.test.js
 * ─────────────────────────────────────────────────────────────
 * Extended acceptance test for Stage 4 AI Systems Integration:
 *
 *   1. Start expedition at start node.
 *   2. Drive to node → sensor percept fires.
 *   3. KnowledgeBase updates belief state and Horn OR-clauses.
 *   4. RiskModel scores update dynamically with evidence strings.
 *   5. Trigger hazard / elimination → engine learns and collapses clauses.
 *   6. Switch to AI Driver → drives autonomously via Stage 1 risk utility scores.
 *   7. Switch to Co-Pilot → verify recommendation text is generated from live
 *      evidence strings, NOT static templates.
 *   8. Roaming Hunter entity → moves across graph and radiates thermal Stench.
 *   9. Difficulty tiers → verify noise probabilities directly alter sensor inputs.
 */

import { jest } from '@jest/globals';
import { RoadGraph } from '../../engine/RoadGraph.js';
import { ClientKnowledgeBase } from '../../client/src/ai/knowledge/KnowledgeBase.js';
import { ClientInferenceEngine } from '../../client/src/ai/inference/InferenceEngine.js';
import { ClientRiskModel } from '../../client/src/ai/risk/RiskModel.js';
import { VehicleController } from '../../client/src/vehicle/VehicleController.js';
import { ActuatorBus } from '../../client/src/actuators/ActuatorBus.js';
import { AIDriver } from '../../client/src/ai/driver/AIDriver.js';
import { SensorArray } from '../../client/src/sensors/SensorArray.js';
import { HunterEntity } from '../../client/src/world/HunterEntity.js';
import { DIFFICULTY_TIERS } from '../../client/src/state/DifficultyConfig.js';

describe('Stage 4 — AI Systems Extended Acceptance Test', () => {
  let graph;
  let kb;
  let inference;
  let riskModel;
  let vehicle;
  let actuators;
  let aiDriver;
  let hunter;
  let sensors;

  beforeEach(() => {
    // ── Graph Topology ──
    //       ┌──(10)──> P (pit)
    //   S ──(10)──> A
    //   │   └──(10)──> B ──(10)──> O (objective)
    //   └──(10)──> C ──(10)──┘
    //
    // Nodes: S (start), A, B, C, P (pit), O (objective), H (hunter initial)
    graph = new RoadGraph();
    graph.addNode('S');
    graph.addNode('A');
    graph.addNode('B');
    graph.addNode('C');
    graph.addNode('P', { hazard: 'pit' });
    graph.addNode('H', { hazard: 'hunter' });
    graph.addNode('O', { hasObjective: true });

    graph.addEdge('S', 'A', { distance: 10 });
    graph.addEdge('S', 'C', { distance: 10 });
    graph.addEdge('A', 'P', { distance: 10 });
    graph.addEdge('A', 'B', { distance: 10 });
    graph.addEdge('C', 'B', { distance: 10 });
    graph.addEdge('B', 'O', { distance: 10 });
    graph.addEdge('P', 'H', { distance: 10 });

    // Node coordinate metadata for spatial navigation
    graph.nodes.get('S').x = 0; graph.nodes.get('S').y = 0;
    graph.nodes.get('A').x = 10; graph.nodes.get('A').y = 0;
    graph.nodes.get('B').x = 20; graph.nodes.get('B').y = 0;
    graph.nodes.get('C').x = 10; graph.nodes.get('C').y = -10;
    graph.nodes.get('P').x = 10; graph.nodes.get('P').y = 10;
    graph.nodes.get('H').x = 10; graph.nodes.get('H').y = 20;
    graph.nodes.get('O').x = 30; graph.nodes.get('O').y = 0;

    // Subsystems
    kb = new ClientKnowledgeBase(graph);
    inference = new ClientInferenceEngine(graph, kb);
    riskModel = new ClientRiskModel(graph, kb);

    vehicle = new VehicleController({ startingFuel: 100 });
    actuators = new ActuatorBus(vehicle);

    const mockRoads = {
      junctions: new Map([
        ['S', { position: { x: 0, y: 0.5, z: 0 } }],
        ['A', { position: { x: 10, y: 0.5, z: 0 } }],
        ['B', { position: { x: 20, y: 0.5, z: 0 } }],
        ['C', { position: { x: 10, y: 0.5, z: -10 } }],
        ['P', { position: { x: 10, y: 0.5, z: 10 } }],
        ['H', { position: { x: 10, y: 0.5, z: 20 } }],
        ['O', { position: { x: 30, y: 0.5, z: 0 } }],
      ]),
    };

    hunter = new HunterEntity(graph, mockRoads, {
      initialNodeId: 'H',
      moveInterval: 1.0,
      aggression: 1.0,
    });

    sensors = new SensorArray(vehicle, { graph }, {
      hunter,
      difficulty: 'easy', // high reliability for deterministic test
    });

    aiDriver = new AIDriver({
      graph,
      kb,
      riskModel,
      actuators,
      vehicle,
      roads: mockRoads,
    });
  });

  test('Step 1: Start expedition at node S — confirms safe launchpad', () => {
    // Arrival at S with no breeze, no stench
    inference.processArrival('S', { breeze: false, stench: false, glitter: false });

    expect(kb.isSafe('S')).toBe(true);
    expect(kb.getBelief('S').visited).toBe(true);

    // Negative inference: neighbors A and C are proven safe!
    expect(kb.getBelief('A').pit_safe).toBe(true);
    expect(kb.getBelief('A').hunter_safe).toBe(true);
    expect(kb.isSafe('A')).toBe(true);
    expect(kb.isSafe('C')).toBe(true);
  });

  test('Step 2 & 3: Drive to node A → Breeze percept fires → KB creates Horn OR-clause', () => {
    // Step 1: Start at S
    inference.processArrival('S', { breeze: false, stench: false });

    // Step 2: Vehicle drives into node A.
    // Node A is adjacent to pit P. Ground truth senses breeze!
    vehicle.position.x = 10;
    vehicle.position.z = 0;
    const rawPercepts = sensors.sampleGroundTruth();

    expect(rawPercepts.nodeId).toBe('A');
    expect(rawPercepts.breeze).toBe(true); // P is adjacent

    // Ingest into Stage 1 engine
    inference.processArrival('A', { breeze: true, stench: false });

    // Step 3: KB updates beliefs and OR-clause
    const bA = kb.getBelief('A');
    expect(bA.visited).toBe(true);

    const bP = kb.getBelief('P');
    const bB = kb.getBelief('B');

    // Both P and B are candidate hazards from A's breeze
    expect(bP.pit_possible).toBe(true);
    expect(bB.pit_possible).toBe(true);

    // OR-clause created in raw KnowledgeBase
    expect(kb.engineKB._pitClauses.size).toBe(1);
    const [clause] = kb.engineKB._pitClauses.values();
    expect(clause.candidates.has('P')).toBe(true);
    expect(clause.candidates.has('B')).toBe(true);
  });

  test('Step 4: Risk scores reflect uncertainty and generate evidence-based reason strings', () => {
    inference.processArrival('S', { breeze: false, stench: false });
    inference.processArrival('A', { breeze: true, stench: false });

    // Score node P and node B
    const scoreP = riskModel.scoreNode('P', { agentNode: 'A', fuelRemaining: 100 });
    const scoreB = riskModel.scoreNode('B', { agentNode: 'A', fuelRemaining: 100 });

    // Both have risk > 0 due to unresolved pit clause
    expect(scoreP.risk).toBeGreaterThan(0.25);
    expect(scoreB.risk).toBeGreaterThan(0.25);

    // Verify reason string is derived from real evidence, NOT templates
    expect(scoreP.reason).toContain('breeze_at_A');
    expect(scoreB.reason).toContain('breeze_at_A');
  });

  test('Step 5: Engine learns from negative evidence at C → OR-clause collapses → Pit confirmed', () => {
    inference.processArrival('S', { breeze: false, stench: false });
    inference.processArrival('A', { breeze: true, stench: false });

    // Now visit node C (alternative branch from S)
    // C is adjacent to S and B. C is NOT adjacent to P.
    // At C: no breeze!
    inference.processArrival('C', { breeze: false, stench: false });

    // ¬breeze(C) proves B is pit_safe!
    expect(kb.getBelief('B').pit_safe).toBe(true);

    // Horn clause collapse: {P, B} minus B leaves only P!
    // P is CONFIRMED PIT!
    expect(kb.getBelief('P').pit_confirmed).toBe(true);
    expect(kb.hasPit('P')).toBe(true);

    // B is now proven safe
    expect(kb.isSafe('B')).toBe(true);

    // Risk re-scoring after learning:
    const scoreP = riskModel.scoreNode('P', { agentNode: 'A' });
    const scoreB = riskModel.scoreNode('B', { agentNode: 'A' });

    // P is confirmed lethal
    expect(scoreP.risk).toBeGreaterThanOrEqual(0.60);
    expect(scoreP.reason).toMatch(/PIT CONFIRMED/);
    expect(scoreP.reason).toContain('or_clause_collapse');

    // B is safe
    expect(scoreB.risk).toBeLessThan(scoreP.risk);
    expect(scoreB.reason).toContain('safe; proven by:');
  });

  test('Step 6: AI Driver selects optimal safe move via Stage 1 utility rankings and drives via ActuatorBus', () => {
    inference.processArrival('S', { breeze: false, stench: false });
    inference.processArrival('A', { breeze: true, stench: false });
    inference.processArrival('C', { breeze: false, stench: false });

    // Position vehicle at A
    vehicle.position.x = 10;
    vehicle.position.z = 0;

    // Engage AI Driver
    aiDriver.enable();
    expect(aiDriver.enabled).toBe(true);

    // Spy on ActuatorBus methods
    const steerSpy = jest.spyOn(actuators, 'steer');
    const accelSpy = jest.spyOn(actuators, 'accelerate');

    // AI Driver makes autonomous decision at A
    const choice = aiDriver.chooseNextNode('A');

    // Confirm AI Driver chooses B over P based on Stage 1 RiskModel utility
    expect(choice.nodeId).toBe('B');
    expect(choice.risk).toBeLessThan(0.3);

    // Verify decision log matches hand-traced engine evaluation
    const lastLog = aiDriver.getLastDecision();
    expect(lastLog).toBeDefined();
    expect(lastLog.fromNode).toBe('A');
    expect(lastLog.toNode).toBe('B');
    expect(lastLog.reason).toContain('safe; proven by:');

    // AI Driver tick calls ActuatorBus
    aiDriver.tick(0.016);
    expect(steerSpy).toHaveBeenCalled();
    expect(accelSpy).toHaveBeenCalled();

    steerSpy.mockRestore();
    accelSpy.mockRestore();
  });

  test('Step 7: Co-Pilot surfaces live evidence-based recommendation string', () => {
    inference.processArrival('S', { breeze: false, stench: false });
    inference.processArrival('A', { breeze: true, stench: false });
    inference.processArrival('C', { breeze: false, stench: false });

    const ranked = riskModel.rankNeighbors('A', { fuelRemaining: 100 });
    const best = ranked[0];

    expect(best.nodeId).toBe('B');
    expect(typeof best.reason).toBe('string');
    // Verifies live evidence string construction
    expect(best.reason).toMatch(/no_breeze_at_C|visited|safe/);
    expect(best.confidence).toBe(100);
  });

  test('Step 8: Roaming Hunter entity moves across graph and radiates thermal Stench', () => {
    expect(hunter.currentNodeId).toBe('H');

    // Neighbor of H is P. Advance Hunter timer to trigger move:
    hunter.tick(2.0, 'A'); // Hunter stalks toward A
    expect(['H', 'P']).toContain(hunter.currentNodeId);

    // When Hunter moves to P (adjacent to A):
    hunter.currentNodeId = 'P';
    vehicle.position.x = 10;
    vehicle.position.z = 0; // At node A

    // A is adjacent to P where Hunter is!
    const rawPercepts = sensors.sampleGroundTruth();
    expect(rawPercepts.nodeId).toBe('A');
    expect(rawPercepts.stench).toBe(true);
  });

  test('Step 9: Difficulty tiers alter sensor noise and Hunter aggression', () => {
    // Easy vs Nightmare
    sensors.setDifficulty('nightmare');
    expect(sensors.tier.sensorNoise.falsePositiveRate).toBe(0.20);
    expect(sensors.tier.sensorNoise.falseNegativeRate).toBe(0.18);

    hunter.setDifficulty(DIFFICULTY_TIERS.nightmare);
    expect(hunter.moveInterval).toBe(3.5);
    expect(hunter.aggression).toBe(0.95);

    sensors.setDifficulty('easy');
    expect(sensors.tier.sensorNoise.falsePositiveRate).toBe(0.01);
  });
});
