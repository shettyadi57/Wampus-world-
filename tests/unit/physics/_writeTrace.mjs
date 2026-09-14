import { writeFileSync } from 'fs';

const code = `/**
 * aiReasoningTrace.test.js
 * Fixed 5-node scenario with KNOWN hazard layout.
 * Prints full KB state after every move. Then runs AI DRIVER
 * on the same KB and logs every decision with risk scores.
 *
 * Scenario (printed before any execution):
 *
 *   n0 -- n1 -- n2(PIT)
 *          |
 *         n3(HUNTER)
 *          |
 *         n4(OBJECTIVE)
 *
 *   n0 = SAFE  start node
 *   n1 = SAFE  bridge (adjacent to n2=pit AND n3=hunter)
 *   n2 = PIT   (hazard=pit; never entered by agent)
 *   n3 = HUNTER (hazard=hunter; never entered by agent)
 *   n4 = SAFE  + OBJECTIVE (glitter fires here)
 */

import { RoadGraph }       from '../../../engine/RoadGraph.js';
import { KnowledgeBase }   from '../../../engine/KnowledgeBase.js';
import { InferenceEngine } from '../../../engine/InferenceEngine.js';
import { RiskModel }       from '../../../engine/RiskModel.js';

function printKBTable(label, kb, nodeIds) {
  console.log('');
  console.log('  KB STATE AFTER: ' + label);
  const hdr = ['NODE','visited','safe','pit_safe','pit_poss','pit_conf','hun_safe','hun_poss','hun_conf','evidence'];
  console.log('  ' + hdr.map((h,i) => i===0 ? h.padEnd(8) : h.padEnd(9)).join('  '));
  for (const id of nodeIds) {
    const b = kb.getBelief(id);
    const row = [
      id.padEnd(8),
      String(b.visited).padEnd(9),
      String(b.safe).padEnd(9),
      String(b.pit_safe).padEnd(9),
      String(b.pit_possible).padEnd(9),
      String(b.pit_confirmed).padEnd(9),
      String(b.hunter_safe).padEnd(9),
      String(b.hunter_possible).padEnd(9),
      String(b.hunter_confirmed).padEnd(9),
      '[' + b.evidence.join(', ') + ']',
    ];
    console.log('  ' + row.join('  '));
  }
}

function buildScenario() {
  const graph = new RoadGraph();
  graph
    .addNode('n0', { hazard: 'none' })
    .addNode('n1', { hazard: 'none' })
    .addNode('n2', { hazard: 'pit' })
    .addNode('n3', { hazard: 'hunter' })
    .addNode('n4', { hazard: 'none', hasObjective: true })
    .addEdge('n0', 'n1', { distance: 1 })
    .addEdge('n1', 'n2', { distance: 1 })
    .addEdge('n1', 'n3', { distance: 1 })
    .addEdge('n3', 'n4', { distance: 1 });

  const kb = new KnowledgeBase(graph);
  const ie = new InferenceEngine(graph, kb);
  const rm = new RiskModel(graph, kb);
  return { graph, kb, ie, rm };
}

const HEADER = [
  '',
  '+==============================================================+',
  '|   FIXED 5-NODE SCENARIO -- KNOWN HAZARD LAYOUT              |',
  '+==============================================================+',
  '|  Topology:                                                   |',
  '|    n0 -- n1 -- n2                                            |',
  '|           |                                                  |',
  '|          n3                                                  |',
  '|           |                                                  |',
  '|          n4                                                  |',
  '|                                                              |',
  '|  Ground truth (world model; KB learns ONLY from percepts):  |',
  '|    n0 = SAFE  start node                                     |',
  '|    n1 = SAFE  bridge (adjacent to n2=pit AND n3=hunter)      |',
  '|    n2 = PIT                                                  |',
  '|    n3 = HUNTER                                               |',
  '|    n4 = SAFE + OBJECTIVE (glitter fires here)                |',
  '|                                                              |',
  '|  Expected deduction chain:                                   |',
  '|    n0 visited, no percepts -> n1 becomes pit_safe+hun_safe   |',
  '|    n1 visited, breeze+stench:                                |',
  '|      neighbors={n0,n2} for pit; n0 pit_safe                  |',
  '|        -> OR-clause collapses to {n2} -> n2 pit_CONFIRMED    |',
  '|      neighbors={n0,n3} for hunter; n0 hunter_safe            |',
  '|        -> OR-clause collapses to {n3} -> n3 hunter_CONFIRMED |',
  '|    breeze@n1 must NOT set pit_possible on n1 itself          |',
  '|    n4 visited, glitter -> objectiveNode=n4 (not neighbor)    |',
  '+==============================================================+',
].join('\\n');

const ALL_NODES = ['n0','n1','n2','n3','n4'];

describe('AI Reasoning -- Fixed 5-node scenario trace', () => {

  beforeAll(() => { console.log(HEADER); });

  // ---- Move 1: arrive at n0 -----------------------------------
  test('Move 1: n0, no percepts -- n1 must become pit_safe + hunter_safe', () => {
    const { kb, ie } = buildScenario();
    const percepts = { breeze: false, stench: false, glitter: false };
    console.log('');
    console.log('> MOVE 1: arrive at n0');
    console.log('  Percepts received: ' + JSON.stringify(percepts));
    ie.processArrival('n0', percepts);
    printKBTable('Move 1 -- n0 arrival', kb, ALL_NODES);

    const n1 = kb.getBelief('n1');
    const n0 = kb.getBelief('n0');

    // Rule: no-breeze at n0 -> n1 definitively pit-safe
    expect(n1.pit_safe).toBe(true);
    // Rule: no-stench at n0 -> n1 definitively hunter-safe
    expect(n1.hunter_safe).toBe(true);
    // n1 must NOT be marked pit_possible (no positive evidence yet)
    expect(n1.pit_possible).toBe(false);
    expect(n1.hunter_possible).toBe(false);
    // n0 itself is visited and safe
    expect(n0.visited).toBe(true);
    expect(n0.safe).toBe(true);
    // pit_possible must never be set on n0 by the no-breeze rule
    expect(n0.pit_possible).toBe(false);
  });

  // ---- Move 2: arrive at n1 -----------------------------------
  test('Move 2: n1, BREEZE+STENCH -- n2=pit_confirmed, n3=hunter_confirmed', () => {
    const { kb, ie } = buildScenario();
    ie.processArrival('n0', { breeze: false, stench: false });

    const percepts = { breeze: true, stench: true, glitter: false };
    console.log('');
    console.log('> MOVE 2: arrive at n1');
    console.log('  Percepts received: ' + JSON.stringify(percepts));
    ie.processArrival('n1', percepts);
    printKBTable('Move 2 -- n1 arrival (after n0 safe)', kb, ALL_NODES);

    const n0 = kb.getBelief('n0');
    const n1 = kb.getBelief('n1');
    const n2 = kb.getBelief('n2');
    const n3 = kb.getBelief('n3');

    // breeze@n1: neighbors={n0,n2}; n0 is pit_safe -> OR-clause={n2} -> collapse -> confirmed
    console.log('');
    console.log('  [RULE] breeze@n1, neighbors=[n0,n2], n0 pit_safe -> OR-clause={n2} -> collapse');
    console.log('  n2.pit_possible  = ' + n2.pit_possible  + '  (must be true)');
    console.log('  n2.pit_confirmed = ' + n2.pit_confirmed + '  (must be true)');
    expect(n2.pit_possible).toBe(true);
    expect(n2.pit_confirmed).toBe(true);

    // stench@n1: neighbors={n0,n3}; n0 is hunter_safe -> OR-clause={n3} -> collapse -> confirmed
    console.log('');
    console.log('  [RULE] stench@n1, neighbors=[n0,n3], n0 hunter_safe -> OR-clause={n3} -> collapse');
    console.log('  n3.hunter_possible  = ' + n3.hunter_possible  + '  (must be true)');
    console.log('  n3.hunter_confirmed = ' + n3.hunter_confirmed + '  (must be true)');
    expect(n3.hunter_possible).toBe(true);
    expect(n3.hunter_confirmed).toBe(true);

    // breeze at n1 must NOT mark n1 itself as pit_possible (agent survived here)
    console.log('');
    console.log('  [RULE] breeze@n1 must NOT propagate pit_possible to n1 itself');
    console.log('  n1.pit_possible = ' + n1.pit_possible + '  (must be false -- agent is alive here)');
    console.log('  n1.pit_safe     = ' + n1.pit_safe     + '  (must be true  -- visited)');
    expect(n1.pit_possible).toBe(false);
    expect(n1.pit_safe).toBe(true);

    // n0 must remain untouched by new breezes (already safe)
    expect(n0.pit_possible).toBe(false);
    expect(n0.hunter_possible).toBe(false);
  });

  // ---- Move 3: arrive at n4 -----------------------------------
  test('Move 3: n4, GLITTER -- objectiveNode=n4 (same-node, never neighbor)', () => {
    const { kb, ie } = buildScenario();
    ie.processArrival('n0', { breeze: false, stench: false });
    ie.processArrival('n1', { breeze: true, stench: true });

    const percepts = { breeze: false, stench: false, glitter: true };
    console.log('');
    console.log('> MOVE 3: arrive at n4');
    console.log('  Percepts received: ' + JSON.stringify(percepts));
    ie.processArrival('n4', percepts);
    printKBTable('Move 3 -- n4 arrival', kb, ALL_NODES);

    const n3 = kb.getBelief('n3');

    // GLITTER is same-node: objectiveNode = n4, not any neighbor
    console.log('');
    console.log('  [RULE] glitter@n4 -> objectiveNode must = n4 (NOT n3 or any neighbor)');
    console.log('  kb.objectiveNode = ' + kb.objectiveNode + '  (must be n4)');
    expect(kb.objectiveNode).toBe('n4');
    expect(kb.objectiveNode).not.toBe('n3');

    // no-breeze at n4: n3 gets pit_safe=true
    // hunter_confirmed on n3 must NOT be cleared by pit_safe
    console.log('');
    console.log('  [RULE] no-breeze@n4 -> n3.pit_safe=true; hunter_confirmed must persist');
    console.log('  n3.pit_safe        = ' + n3.pit_safe        + '  (must be true)');
    console.log('  n3.hunter_confirmed= ' + n3.hunter_confirmed + '  (must be true -- hunter does not vanish)');
    expect(n3.pit_safe).toBe(true);
    expect(n3.hunter_confirmed).toBe(true);
  });

  // ---- AI DRIVER mode -----------------------------------------
  test('AI DRIVER: decisions from KB state -- risk scores traceable to evidence', () => {
    const { graph, kb, ie, rm } = buildScenario();
    ie.processArrival('n0', { breeze: false, stench: false });
    ie.processArrival('n1', { breeze: true, stench: true });

    console.log('');
    console.log('=================================================');
    console.log('  AI DRIVER MODE -- decisions from n0 and n1');
    console.log('  (same KB that produced the Move 2 trace above)');
    console.log('=================================================');

    // --- From n0 ---
    const rankedFromN0 = rm.rankNeighbors('n0', { fuelRemaining: 100 });
    console.log('');
    console.log('  rankNeighbors("n0") -- full candidate list:');
    for (const r of rankedFromN0) {
      console.log(
        '    -> ' + r.nodeId.padEnd(4) +
        '  utility=' + r.utility.toFixed(4).padStart(7) +
        '  risk=' + (r.risk * 100).toFixed(1).padStart(6) + '%' +
        '  conf=' + String(r.confidence).padStart(4) +
        '  reason: ' + r.reason
      );
    }
    const chosen0 = rankedFromN0[0];
    console.log('');
    console.log('  AI DRIVER CHOICE from n0: ' + chosen0.nodeId +
      ' (utility=' + chosen0.utility.toFixed(4) + ', risk=' + (chosen0.risk*100).toFixed(1) + '%)');
    // n0 has one neighbor: n1 (visited, safe) -> must be chosen
    expect(chosen0.nodeId).toBe('n1');
    expect(chosen0.risk).toBeLessThan(0.3);

    // --- From n1 ---
    const rankedFromN1 = rm.rankNeighbors('n1', { fuelRemaining: 100 });
    console.log('');
    console.log('  rankNeighbors("n1") -- full candidate list:');
    for (const r of rankedFromN1) {
      console.log(
        '    -> ' + r.nodeId.padEnd(4) +
        '  utility=' + r.utility.toFixed(4).padStart(7) +
        '  risk=' + (r.risk * 100).toFixed(1).padStart(6) + '%' +
        '  conf=' + String(r.confidence).padStart(4) +
        '  reason: ' + r.reason
      );
    }
    const chosen1 = rankedFromN1[0];
    console.log('');
    console.log('  AI DRIVER CHOICE from n1: ' + chosen1.nodeId +
      ' (utility=' + chosen1.utility.toFixed(4) + ', risk=' + (chosen1.risk*100).toFixed(1) + '%)');
    // From n1: n2=pit_confirmed (risk=1.0), n3=hunter_confirmed (risk=1.0), n0=safe -> choose n0
    expect(chosen1.nodeId).toBe('n0');

    // Confirm n2 and n3 have risk=1.0 and reason strings built from actual evidence
    const s2 = rm.scoreNode('n2', { agentNode: 'n1', fuelRemaining: 100 });
    const s3 = rm.scoreNode('n3', { agentNode: 'n1', fuelRemaining: 100 });
    console.log('');
    console.log('  VERIFICATION -- confirmed-hazard risk scores:');
    console.log('    n2 (pit_confirmed):    risk=' + (s2.risk*100).toFixed(1) + '%');
    console.log('    n2 reason: ' + s2.reason);
    console.log('    n3 (hunter_confirmed): risk=' + (s3.risk*100).toFixed(1) + '%');
    console.log('    n3 reason: ' + s3.reason);

    expect(s2.risk).toBe(1.0);
    expect(s3.risk).toBe(1.0);
    // Reason strings must come from actual KB evidence, not hardcoded templates
    expect(s2.reason).toContain('PIT CONFIRMED');
    expect(s2.reason).toContain('breeze_at_n1');
    expect(s3.reason).toContain('HUNTER CONFIRMED');
    expect(s3.reason).toContain('stench_at_n1');

    console.log('');
    console.log('  [CONFIRMED] reason strings constructed from live KB evidence, not templates.');
    console.log('  [CONFIRMED] AI DRIVER decisions computed from this exact KB state.');
  });
});
`;

writeFileSync('tests/unit/physics/aiReasoningTrace.test.js', code, 'utf8');
console.log('written, lines:', code.split('\n').length);
