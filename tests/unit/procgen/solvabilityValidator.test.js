/**
 * solvabilityValidator.test.js
 * ─────────────────────────────────────────────────────────────
 * Unit tests for SolvabilityValidator against known-good and known-bad graphs.
 */

import { RoadGraph } from '../../../engine/RoadGraph.js';
import { SolvabilityValidator } from '../../../engine/procgen/SolvabilityValidator.js';

describe('SolvabilityValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SolvabilityValidator();
  });

  // ─────────────────────────────────────────────────────────────────
  // 1. KNOWN-GOOD GRAPH
  // ─────────────────────────────────────────────────────────────────
  test('passes validation for a known-good graph with safe path and ample fuel', () => {
    // Topology:
    //   S (start) ──(10)──> A ──(10)──> B ──(10)──> O (objective)
    //                \                 /
    //                 ──(12)──> C ────
    const g = new RoadGraph();
    g.addNode('S');
    g.addNode('A');
    g.addNode('B');
    g.addNode('C');
    g.addNode('O', { hasObjective: true });

    g.addEdge('S', 'A', { distance: 10 });
    g.addEdge('A', 'B', { distance: 10 });
    g.addEdge('B', 'O', { distance: 10 });
    g.addEdge('S', 'C', { distance: 12 });
    g.addEdge('C', 'B', { distance: 12 });

    const spec = {
      startId: 'S',
      objectiveId: 'O',
      startingFuel: 50,
      tankCapacity: 50,
    };

    const result = validator.validate(g, spec);
    expect(result.valid).toBe(true);
    expect(result.failedCheck).toBeNull();
    expect(result.reason).toBeNull();
    expect(result.details.shortestSafeDistance).toBe(30);
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. KNOWN-BAD GRAPH: UNREACHABLE OBJECTIVE (Check 1)
  // ─────────────────────────────────────────────────────────────────
  test('fails validation when objective is cut off by hazards (unreachable)', () => {
    // Topology:
    //   S ──(10)──> A ──(10)──> P (pit) ──(10)──> O
    // All routes to O must pass through pit node P.
    const g = new RoadGraph();
    g.addNode('S');
    g.addNode('A');
    g.addNode('P', { hazard: 'pit' });
    g.addNode('O', { hasObjective: true });

    g.addEdge('S', 'A', { distance: 10 });
    g.addEdge('A', 'P', { distance: 10 });
    g.addEdge('P', 'O', { distance: 10 });

    const spec = {
      startId: 'S',
      objectiveId: 'O',
      startingFuel: 100,
    };

    const result = validator.validate(g, spec);
    expect(result.valid).toBe(false);
    expect(result.failedCheck).toBe('reachability');
    expect(result.reason).toMatch(/unreachable/i);
  });

  test('fails validation when objective itself contains a hazard', () => {
    const g = new RoadGraph();
    g.addNode('S');
    g.addNode('O', { hazard: 'hunter', hasObjective: true });
    g.addEdge('S', 'O', { distance: 10 });

    const spec = { startId: 'S', objectiveId: 'O', startingFuel: 50 };
    const result = validator.validate(g, spec);

    expect(result.valid).toBe(false);
    expect(result.failedCheck).toBe('reachability');
  });

  test('fails validation when start node contains a hazard', () => {
    const g = new RoadGraph();
    g.addNode('S', { hazard: 'pit' });
    g.addNode('O', { hasObjective: true });
    g.addEdge('S', 'O', { distance: 10 });

    const spec = { startId: 'S', objectiveId: 'O', startingFuel: 50 };
    const result = validator.validate(g, spec);

    expect(result.valid).toBe(false);
    expect(result.failedCheck).toBe('reachability');
  });

  // ─────────────────────────────────────────────────────────────────
  // 3. KNOWN-BAD GRAPH: INSUFFICIENT FUEL (Check 2)
  // ─────────────────────────────────────────────────────────────────
  test('fails validation when safe route distance exceeds starting fuel budget', () => {
    // S ──(30)──> A ──(30)──> O (total safe distance = 60, startingFuel = 40)
    const g = new RoadGraph();
    g.addNode('S');
    g.addNode('A');
    g.addNode('O', { hasObjective: true });

    g.addEdge('S', 'A', { distance: 30 });
    g.addEdge('A', 'O', { distance: 30 });

    const spec = {
      startId: 'S',
      objectiveId: 'O',
      startingFuel: 40,
      tankCapacity: 40,
    };

    const result = validator.validate(g, spec);
    expect(result.valid).toBe(false);
    expect(result.failedCheck).toBe('fuel');
    expect(result.reason).toMatch(/fuel/i);
    expect(result.details.minCost).toBe(60);
  });

  test('passes validation when intermediate fuel station enables completing long route', () => {
    // S ──(25)──> F (fuel) ──(25)──> O (total distance = 50, startingFuel = 30)
    const g = new RoadGraph();
    g.addNode('S');
    g.addNode('F', { hasFuel: true });
    g.addNode('O', { hasObjective: true });

    g.addEdge('S', 'F', { distance: 25 });
    g.addEdge('F', 'O', { distance: 25 });

    const spec = {
      startId: 'S',
      objectiveId: 'O',
      startingFuel: 30,
      tankCapacity: 30,
    };

    const result = validator.validate(g, spec);
    expect(result.valid).toBe(true);
    expect(result.failedCheck).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────
  // 4. KNOWN-BAD GRAPH: DEDUCTIVE AMBIGUITY / UNSOLVABLE (Check 3)
  // ─────────────────────────────────────────────────────────────────
  test('fails validation when hazard placement forces a blind gamble (unsolvable by perfect reasoner)', () => {
    // Classic 50/50 blind pit dilemma:
    //       ┌──> A (safe) ────┐
    //   S ──┤                 ├──> O (objective)
    //       └──> P (pit) ─────┘
    //
    // From S, the agent senses breeze (because P is adjacent).
    // The agent only knows {A, P} has at least one pit.
    // Neither A nor P is proven safe. The deductive frontier stalls at S.
    // The perfect reasoner refuses to step blindly onto A or P.
    const g = new RoadGraph();
    g.addNode('S');
    g.addNode('A');
    g.addNode('P', { hazard: 'pit' });
    g.addNode('O', { hasObjective: true });

    g.addEdge('S', 'A', { distance: 10 });
    g.addEdge('S', 'P', { distance: 10 });
    g.addEdge('A', 'O', { distance: 10 });
    g.addEdge('P', 'O', { distance: 10 });

    const spec = {
      startId: 'S',
      objectiveId: 'O',
      startingFuel: 100,
      tankCapacity: 100,
    };

    const result = validator.validate(g, spec);
    expect(result.valid).toBe(false);
    expect(result.failedCheck).toBe('reasoner');
    expect(result.reason).toMatch(/perfect reasoner/i);
  });

  test('passes validation when triangulation resolves candidate hazard via alternate safe path', () => {
    // Triangulation layout:
    //         ┌──> A ──> (feels breeze from P) ──┐
    //   S ────┤                                   ├──> B ──> O
    //         └──> K ──> (feels NO breeze) ───────┘
    //                         |
    //                      P (pit adjacent to A only, NOT K)
    //
    // 1. S has neighbors A and K. S feels NO breeze -> both A and K are proven safe!
    // 2. Reasoner visits A. A connects to B and P. A feels breeze! Clause: {B, P}.
    //    Reasoner cannot safely advance from A directly to B.
    // 3. Reasoner backtracks to safe node K.
    // 4. K connects to B. K feels NO breeze (P is not adjacent to K).
    //    -> B is proven pit_safe!
    // 5. Clause {B, P} collapses -> P is confirmed pit! B is proven safe.
    // 6. Reasoner safely advances through B to O!
    const g = new RoadGraph();
    g.addNode('S');
    g.addNode('A');
    g.addNode('K');
    g.addNode('B');
    g.addNode('P', { hazard: 'pit' });
    g.addNode('O', { hasObjective: true });

    g.addEdge('S', 'A', { distance: 5 });
    g.addEdge('S', 'K', { distance: 5 });
    g.addEdge('A', 'B', { distance: 5 });
    g.addEdge('A', 'P', { distance: 5 });
    g.addEdge('K', 'B', { distance: 5 });
    g.addEdge('B', 'O', { distance: 5 });

    const spec = {
      startId: 'S',
      objectiveId: 'O',
      startingFuel: 100,
    };

    const result = validator.validate(g, spec);
    expect(result.valid).toBe(true);
    expect(result.failedCheck).toBeNull();
  });
});
