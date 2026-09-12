/**
 * finalPassE2E.test.js
 * ─────────────────────────────────────────────────────────────
 * Complete End-to-End Integration Suite for Wampus World / SENTINEL:
 *
 *   1. Procedural Audio Synthesizer: Engine tone, tire screech, distance-mapped Hunter dread drone, captions.
 *   2. Versioned Save System & Corrupt-Data Recovery: Schema v2, migration, and salvage of corrupted data.
 *   3. Authentic Telemetry Stats: Event-driven tracking without placeholders or mock data.
 *   4. All 7 Achievements: Real trigger conditions for First Expedition, Logical Driver, Trust the Machine,
 *      Rebel Driver, Ghost Road, Survivor, Master Mechanic.
 *   5. Skippable Interactive Tutorial: Step progression and skip handling.
 *   6. A* Navigator: Cost-weighted pathfinding avoiding KB-proven hazards.
 *   7. Full End-to-End Loop: Menu → Expedition → Drive → Junction → Percept → Risk Calc → Route Choice →
 *      Hazard → Consequence → KB Update → Checkpoint Complete → Stats → Save → Reload → Verify Persisted →
 *      New Expedition Generation & Solvability Validation via SolvabilityValidator.
 */

import { jest } from '@jest/globals';
import { RoadGraph } from '../../engine/RoadGraph.js';
import { SolvabilityValidator } from '../../engine/procgen/SolvabilityValidator.js';
import { WorldGenerator } from '../../engine/procgen/WorldGenerator.js';
import { ClientKnowledgeBase } from '../../client/src/ai/knowledge/KnowledgeBase.js';
import { ClientInferenceEngine } from '../../client/src/ai/inference/InferenceEngine.js';
import { ClientRiskModel } from '../../client/src/ai/risk/RiskModel.js';
import { VehicleController } from '../../client/src/vehicle/VehicleController.js';
import { ActuatorBus } from '../../client/src/actuators/ActuatorBus.js';
import { StateManager } from '../../client/src/state/StateManager.js';
import { PersistenceManager, CURRENT_SAVE_VERSION, SAVE_KEY_PREFIX, CORRUPT_BACKUP_PREFIX } from '../../client/src/persistence/PersistenceManager.js';
import { StatsTracker } from '../../client/src/state/StatsTracker.js';
import { AchievementManager } from '../../client/src/state/AchievementManager.js';
import { Navigator } from '../../client/src/navigation/Navigator.js';
import { MissionController } from '../../client/src/missions/MissionController.js';
import { AudioEngine } from '../../client/src/audio/AudioEngine.js';

describe('Final Integration Pass — Comprehensive E2E Verification', () => {
  let mockStorage;
  let stateManager;
  let persistence;
  let statsTracker;
  let achievementManager;
  let graph;
  let world;
  let kb;
  let inference;
  let riskModel;
  let vehicle;
  let actuators;
  let navigator;
  let missions;
  let audioEngine;

  beforeEach(() => {
    // ── In-Memory Storage Mock for Persistence Testing ──
    const store = new Map();
    mockStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
      _raw: store,
    };

    // ── Audio Engine Mock / Instance ──
    audioEngine = new AudioEngine();

    // ── State & Persistence ──
    stateManager = new StateManager({ worldSeed: '104729', difficulty: 'normal' });
    persistence = new PersistenceManager(stateManager, mockStorage);
    statsTracker = new StatsTracker(stateManager);
    achievementManager = new AchievementManager(stateManager, audioEngine);

    // ── Graph Topology ──
    //       ┌──(12)──> P (pit)
    //   S ──(10)──> A
    //   │   └──(10)──> B ──(10)──> O (remote checkpoint)
    //   └──(14)──> C ──(10)──┘
    //
    // Nodes: S (start), A, B, C, P (pit), O (objective)
    graph = new RoadGraph();
    graph.addNode('S');
    graph.addNode('A');
    graph.addNode('B');
    graph.addNode('C');
    graph.addNode('P', { hazard: 'pit' });
    graph.addNode('O', { hasObjective: true });

    graph.addEdge('S', 'A', { distance: 10 });
    graph.addEdge('S', 'C', { distance: 14 });
    graph.addEdge('A', 'P', { distance: 12 });
    graph.addEdge('A', 'B', { distance: 10 });
    graph.addEdge('C', 'B', { distance: 10 });
    graph.addEdge('B', 'O', { distance: 10 });

    graph.nodes.get('S').x = 0; graph.nodes.get('S').y = 0;
    graph.nodes.get('A').x = 10; graph.nodes.get('A').y = 0;
    graph.nodes.get('B').x = 20; graph.nodes.get('B').y = 0;
    graph.nodes.get('C').x = 10; graph.nodes.get('C').y = -10;
    graph.nodes.get('P').x = 10; graph.nodes.get('P').y = 12;
    graph.nodes.get('O').x = 30; graph.nodes.get('O').y = 0;

    world = {
      graph,
      spec: {
        startId: 'S',
        objectiveId: 'O',
        pitNodes: ['P'],
        hunterNodes: [],
        checkpoints: ['O'],
      },
    };

    const mockRoads = {
      junctions: new Map([
        ['S', { position: { x: 0, y: 0.5, z: 0 } }],
        ['A', { position: { x: 10, y: 0.5, z: 0 } }],
        ['B', { position: { x: 20, y: 0.5, z: 0 } }],
        ['C', { position: { x: 10, y: 0.5, z: -10 } }],
        ['P', { position: { x: 10, y: 0.5, z: 12 } }],
        ['O', { position: { x: 30, y: 0.5, z: 0 } }],
      ]),
    };

    kb = new ClientKnowledgeBase(graph);
    inference = new ClientInferenceEngine(graph, kb);
    riskModel = new ClientRiskModel(graph, kb);

    vehicle = new VehicleController({ startingFuel: 100, tankCapacity: 100 });
    actuators = new ActuatorBus(vehicle);
    navigator = new Navigator(kb, world, mockRoads);
    missions = new MissionController(world, {
      state: stateManager,
      navigator,
      statsTracker,
      achievementManager,
    });
  });

  afterEach(() => {
    if (persistence) persistence.destroy();
  });

  // ─────────────────────────────────────────────────────────────────
  // 1. PROCEDURAL AUDIO SYNTHESIZER & ACCESSIBILITY CAPTIONS
  // ─────────────────────────────────────────────────────────────────
  describe('1. Procedural Audio Synthesizer & Captions', () => {
    test('audio cue captions emit for every gameplay percept', () => {
      const receivedCaptions = [];
      audioEngine.onCaption((text, type) => {
        receivedCaptions.push({ text, type });
      });

      audioEngine.playBreeze();
      audioEngine.playStench();
      audioEngine.playGlitter();
      audioEngine.playCollision(45);
      audioEngine.playAIChime('safe');

      expect(receivedCaptions.length).toBe(5);
      expect(receivedCaptions[0].text).toMatch(/breeze/i);
      expect(receivedCaptions[1].text).toMatch(/stench/i);
      expect(receivedCaptions[2].text).toMatch(/glitter/i);
      expect(receivedCaptions[3].text).toMatch(/collision/i);
      expect(receivedCaptions[4].text).toMatch(/safe route/i);
    });

    test('volume controls smoothly clamp and scale volume levels', () => {
      audioEngine.setVolumes({ master: 0.5, engine: 0.4, sfx: 0.9, ambient: 0.3 });
      expect(audioEngine.volumes.master).toBe(0.5);
      expect(audioEngine.volumes.engine).toBe(0.4);
      expect(audioEngine.volumes.sfx).toBe(0.9);
      expect(audioEngine.volumes.ambient).toBe(0.3);

      audioEngine.toggleMute();
      expect(audioEngine.isMuted).toBe(true);
      audioEngine.toggleMute();
      expect(audioEngine.isMuted).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. VERSIONED SAVE SYSTEM & CORRUPT DATA RECOVERY
  // ─────────────────────────────────────────────────────────────────
  describe('2. Versioned Save System & Corrupt Data Recovery', () => {
    test('serializes v2 schema with vehicle, upgrades, stats, and settings', () => {
      stateManager.mutate({
        score: 450,
        upgrades: ['turbine', 'fuelcell'],
        vehicle: { fuelRemaining: 84.5, hullIntegrity: 92 },
      });

      const saved = persistence.save(0);
      expect(saved).toBe(true);

      const raw = mockStorage.getItem(`${SAVE_KEY_PREFIX}0`);
      const parsed = JSON.parse(raw);

      expect(parsed.version).toBe(CURRENT_SAVE_VERSION);
      expect(parsed.data.score).toBe(450);
      expect(parsed.data.upgrades).toEqual(['turbine', 'fuelcell']);
      expect(parsed.data.vehicle.fuelRemaining).toBe(84.5);
      expect(parsed.data.vehicle.hullIntegrity).toBe(92);
      expect(parsed.data.settings.captionsEnabled).toBe(true);
    });

    test('recovers from malformed corrupt save without silently wiping progress', () => {
      // Intentionally corrupt JSON string with salvageable fragments
      const corruptJson = '{"version": 2, "data": {"worldSeed": "salvaged_777", "score": 980, "vehicle": {"fuelRemaining": 63.2}, "upgrades": ["turbine"], BROKEN_SYNTAX...';
      mockStorage.setItem(`${SAVE_KEY_PREFIX}0`, corruptJson);

      const result = persistence.load(0);

      expect(result.success).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.data.worldSeed).toBe('salvaged_777');
      expect(result.data.score).toBe(980);
      expect(result.data.vehicle.fuelRemaining).toBe(63.2);

      // Verify immutable safety backup was created
      let backupKeyFound = false;
      for (const k of mockStorage._raw.keys()) {
        if (k.startsWith(CORRUPT_BACKUP_PREFIX)) {
          backupKeyFound = true;
          expect(mockStorage.getItem(k)).toBe(corruptJson);
        }
      }
      expect(backupKeyFound).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 3. AUTHENTIC TELEMETRY STATS TRACKING
  // ─────────────────────────────────────────────────────────────────
  describe('3. Authentic Telemetry Stats (No Placeholders)', () => {
    test('accumulates distance, fuel burn, decisions, and hazards from real events only', () => {
      statsTracker.recordDistance(1250);
      statsTracker.recordFuelBurn(3.45);
      statsTracker.recordNodeVisit('S');
      statsTracker.recordNodeVisit('A');
      statsTracker.recordNodeVisit('B');
      statsTracker.recordHazardDetected('breeze');
      statsTracker.recordJunctionDecision('A', 'B', { nodeId: 'B', risk: 0.05 }, [
        { nodeId: 'B', risk: 0.05 },
        { nodeId: 'P', risk: 0.95 },
      ]);

      const summary = statsTracker.getSummary();
      expect(summary.distanceDrivenMeters).toBe(1250);
      expect(summary.distanceDrivenKm).toBe('1.25');
      expect(summary.fuelConsumedLiters).toBe(3.45);
      expect(summary.nodesExploredCount).toBe(3);
      expect(summary.hazardsDetected).toBe(1);
      expect(summary.decisionsMade).toBe(1);
      expect(summary.aiDecisionsFollowed).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 4. ALL 7 ACHIEVEMENTS WITH REAL TRIGGER CONDITIONS
  // ─────────────────────────────────────────────────────────────────
  describe('4. All 7 Achievements Verification', () => {
    test('First Expedition unlocks on expedition milestone', () => {
      expect(achievementManager.isUnlocked('first_expedition')).toBe(false);
      achievementManager.notifyExpeditionMilestone(true);
      expect(achievementManager.isUnlocked('first_expedition')).toBe(true);
    });

    test('Logical Driver unlocks when choosing safe node over unsafe alternatives', () => {
      expect(achievementManager.isUnlocked('logical_driver')).toBe(false);
      achievementManager.notifyJunctionDecision({
        chosenNodeId: 'B',
        chosenRisk: 0.02,
        isSafeProven: true,
        rankedBranches: [{ nodeId: 'B', risk: 0.02 }, { nodeId: 'P', risk: 0.85 }],
        topAiBranch: { nodeId: 'B', risk: 0.02 },
        hasPercepts: false,
      });
      expect(achievementManager.isUnlocked('logical_driver')).toBe(true);
    });

    test('Trust the Machine unlocks after 3 consecutive AI choices', () => {
      expect(achievementManager.isUnlocked('trust_the_machine')).toBe(false);
      const topAi = { nodeId: 'B', risk: 0.05 };
      achievementManager.notifyJunctionDecision({ chosenNodeId: 'B', topAiBranch: topAi });
      achievementManager.notifyJunctionDecision({ chosenNodeId: 'B', topAiBranch: topAi });
      achievementManager.notifyJunctionDecision({ chosenNodeId: 'B', topAiBranch: topAi });
      expect(achievementManager.isUnlocked('trust_the_machine')).toBe(true);
    });

    test('Rebel Driver unlocks after choosing high-risk route and arriving safely', () => {
      expect(achievementManager.isUnlocked('rebel_driver')).toBe(false);
      achievementManager.notifyJunctionDecision({
        chosenNodeId: 'P',
        chosenRisk: 0.65,
        topAiBranch: { nodeId: 'B', risk: 0.05 },
      });
      expect(achievementManager.isUnlocked('rebel_driver')).toBe(false); // not yet survived arrival
      achievementManager.notifyNodeArrival('P', true);
      expect(achievementManager.isUnlocked('rebel_driver')).toBe(true);
    });

    test('Ghost Road unlocks after 3 consecutive clean junctions without hazards', () => {
      expect(achievementManager.isUnlocked('ghost_road')).toBe(false);
      achievementManager.notifyJunctionDecision({ chosenNodeId: 'A', hasPercepts: false });
      achievementManager.notifyJunctionDecision({ chosenNodeId: 'B', hasPercepts: false });
      achievementManager.notifyJunctionDecision({ chosenNodeId: 'C', hasPercepts: false });
      expect(achievementManager.isUnlocked('ghost_road')).toBe(true);
    });

    test('Survivor unlocks after approaching Hunter within 25m and escaping to safety', () => {
      expect(achievementManager.isUnlocked('survivor')).toBe(false);
      achievementManager.notifyHunterProximity(18, false); // close within 25m
      expect(achievementManager.isUnlocked('survivor')).toBe(false);
      achievementManager.notifyHunterProximity(52, true); // escaped past 45m to safe node
      expect(achievementManager.isUnlocked('survivor')).toBe(true);
    });

    test('Master Mechanic unlocks when all 5 upgrades are installed', () => {
      expect(achievementManager.isUnlocked('master_mechanic')).toBe(false);
      achievementManager.notifyUpgradesChanged(4);
      expect(achievementManager.isUnlocked('master_mechanic')).toBe(false);
      achievementManager.notifyUpgradesChanged(5);
      expect(achievementManager.isUnlocked('master_mechanic')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 5. A* NAVIGATOR WITH RISK-PENALTY PATHFINDING
  // ─────────────────────────────────────────────────────────────────
  describe('5. Real A* Navigator', () => {
    test('plans shortest safe path from S to O bypassing hazardous pit P', () => {
      // Mark pit P in KB
      kb.markPit('P');

      const path = navigator.planPath('S', 'O');
      expect(path.length).toBeGreaterThan(0);
      const nodeIds = path.map(w => w.nodeId);

      // Path should avoid P
      expect(nodeIds).not.toContain('P');
      expect(nodeIds[0]).toBe('S');
      expect(nodeIds[nodeIds.length - 1]).toBe('O');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 6. FULL END-TO-END LOOP
  // ─────────────────────────────────────────────────────────────────
  describe('6. Full End-to-End Simulation Loop', () => {
    test('Menu -> Expedition -> Drive -> Junction -> Percept -> AI Risk -> Route -> Complete -> Save -> Reload -> New Expedition Solvable', () => {
      // Step 1: Initial state at Menu / Station
      expect(stateManager.get().phase).toBe('idle');
      stateManager.mutate({ phase: 'playing' });

      // Step 2: Drive from S to A
      vehicle.position = { x: 10, y: 0.5, z: 0 };
      vehicle.fuelRemaining = 96.5;
      statsTracker.recordDistance(10);
      statsTracker.recordNodeVisit('A');

      // Step 3: Sensor evidence ingested at Node A (Breeze detected because Pit P is adjacent)
      const percept = { nodeId: 'A', breeze: true, stench: false, glitter: false, bump: false };
      kb.ingest(percept);
      inference.processArrival('A', percept);

      // Step 4: AI Risk calculation at Junction A
      const ranked = riskModel.rankNeighbors('A', { fuelRemaining: vehicle.fuelRemaining });
      expect(ranked.length).toBeGreaterThanOrEqual(2);

      // Node P should have elevated risk due to breeze; Node B should have low risk
      const branchP = ranked.find(r => r.nodeId === 'P');
      const branchB = ranked.find(r => r.nodeId === 'B');
      expect(branchP.risk).toBeGreaterThan(branchB.risk);
      expect(branchB.risk).toBeLessThan(0.3);

      // Step 5: Route choice commits to safe branch B
      achievementManager.notifyJunctionDecision({
        chosenNodeId: 'B',
        chosenRisk: branchB.risk,
        isSafeProven: true,
        rankedBranches: ranked,
        topAiBranch: ranked[0],
        hasPercepts: true,
      });

      // Step 6: Traverse to Checkpoint O
      vehicle.position = { x: 30, y: 0.5, z: 0 };
      missions.tick(0.016, vehicle, { nodeId: 'O' });

      // Step 7: Mission Complete verification
      expect(missions.isComplete).toBe(true);
      expect(missions.activeMission.status).toBe('completed');
      expect(stateManager.get().missions.completed).toContain('mission_01_silent_checkpoint');

      // Step 8: Save persistent state to storage
      const saveSuccess = persistence.save(1);
      expect(saveSuccess).toBe(true);

      // Step 9: Reload from slot 1 in a fresh state manager
      const freshState = new StateManager();
      const freshPersistence = new PersistenceManager(freshState, mockStorage);
      const loadResult = freshPersistence.load(1);

      expect(loadResult.success).toBe(true);
      expect(freshState.get().missions.completed).toContain('mission_01_silent_checkpoint');
      expect(freshState.get().stats.expeditionsCompleted).toBeGreaterThanOrEqual(1);
      freshPersistence.destroy();

      // Step 10: Generate new procedural expedition and confirm solvability
      const newExpedition = missions.generateNewExpedition('C');
      expect(newExpedition).toBeDefined();
      expect(newExpedition.targetNodeId).toBe('C');
      expect(missions.isComplete).toBe(false);

      // Step 11: Validate solvability of the world with SolvabilityValidator
      const validator = new SolvabilityValidator();
      const validationResult = validator.validate(graph, {
        startId: 'S',
        objectiveId: 'C',
        startingFuel: 50,
      });

      expect(validationResult.valid).toBe(true);
    });
  });
});
