/**
 * SolvabilityValidator.js
 * ─────────────────────────────────────────────────────────────
 * Solvability validator run BEFORE a generated world is accepted:
 *
 * Check 1: Objective reachability — objective must be reachable from start
 *          avoiding all world hazards (pits and hunters).
 * Check 2: Fuel feasibility — at least one route from start to objective
 *          fits within starting fuel (accounting for reachable fuel nodes).
 * Check 3: Deductive solvability — hazard density and layout must allow
 *          a perfect symbolic reasoner (KnowledgeBase + InferenceEngine)
 *          working strictly from partial percepts to reach the objective
 *          without being forced into an unresolvable blind gamble.
 */

import { KnowledgeBase } from '../KnowledgeBase.js';
import { InferenceEngine } from '../InferenceEngine.js';

export class SolvabilityValidator {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.requireDeductiveProof=true]
   */
  constructor(options = {}) {
    this.requireDeductiveProof = options.requireDeductiveProof ?? true;
  }

  /**
   * Validates a world graph and spec.
   *
   * @param {import('../RoadGraph.js').RoadGraph} graph
   * @param {{
   *   startId: string,
   *   objectiveId: string,
   *   startingFuel?: number,
   *   tankCapacity?: number
   * }} spec
   * @returns {{
   *   valid: boolean,
   *   failedCheck: 'reachability'|'fuel'|'reasoner'|null,
   *   reason: string|null,
   *   details?: Object
   * }}
   */
  validate(graph, spec) {
    const { startId, objectiveId, startingFuel = 60, tankCapacity = 60 } = spec;

    if (!graph.nodes.has(startId)) {
      return {
        valid: false,
        failedCheck: 'reachability',
        reason: `Start node "${startId}" not found in graph`,
      };
    }
    if (!graph.nodes.has(objectiveId)) {
      return {
        valid: false,
        failedCheck: 'reachability',
        reason: `Objective node "${objectiveId}" not found in graph`,
      };
    }

    // ── Check 1: Objective Reachability Avoiding Hazards ──
    const reachability = this.checkReachability(graph, startId, objectiveId);
    if (!reachability.reachable) {
      return {
        valid: false,
        failedCheck: 'reachability',
        reason: 'Objective is unreachable from start avoiding confirmed hazards',
        details: reachability,
      };
    }

    // ── Check 2: Fuel-Feasible Route ──
    const fuelCheck = this.checkFuelFeasibility(graph, startId, objectiveId, startingFuel, tankCapacity);
    if (!fuelCheck.feasible) {
      return {
        valid: false,
        failedCheck: 'fuel',
        reason: `No route to objective fits within starting fuel (${startingFuel}) and available fuel stations; min cost is ${fuelCheck.minCost}`,
        details: fuelCheck,
      };
    }

    // ── Check 3: Deductive Solvability by Perfect Reasoner ──
    if (this.requireDeductiveProof) {
      const reasonerCheck = this.simulatePerfectReasoner(graph, startId, objectiveId);
      if (!reasonerCheck.solved) {
        return {
          valid: false,
          failedCheck: 'reasoner',
          reason: `Hazard density or ambiguity makes world unsolvable by a perfect reasoner: ${reasonerCheck.reason}`,
          details: reasonerCheck,
        };
      }
    }

    return {
      valid: true,
      failedCheck: null,
      reason: null,
      details: {
        shortestSafeDistance: fuelCheck.minCost,
      },
    };
  }

  /**
   * Check 1: BFS/Dijkstra to verify a path exists using only nodes with hazard === 'none'.
   */
  checkReachability(graph, startId, objectiveId) {
    const startNode = graph.nodes.get(startId);
    const objNode = graph.nodes.get(objectiveId);

    if (startNode.hazard !== 'none') {
      return { reachable: false, reason: 'Start node contains a hazard' };
    }
    if (objNode.hazard !== 'none') {
      return { reachable: false, reason: 'Objective node contains a hazard' };
    }

    const visited = new Set([startId]);
    const queue = [startId];

    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr === objectiveId) {
        return { reachable: true };
      }

      for (const neighbor of graph.getNeighbors(curr)) {
        const neighborNode = graph.nodes.get(neighbor);
        if (!neighborNode || neighborNode.hazard !== 'none') continue;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return { reachable: false, reason: 'No hazard-free path to objective' };
  }

  /**
   * Check 2: Dijkstra searching for path with maximum remaining fuel.
   */
  checkFuelFeasibility(graph, startId, objectiveId, startingFuel, tankCapacity) {
    // Dijkstra state: max fuel remaining when arriving at node
    const maxFuel = new Map();
    maxFuel.set(startId, startingFuel);

    // Min cost distance tracking for diagnostics
    const minCostMap = new Map([[startId, 0]]);

    // Priority queue simulation (array sorted descending by fuel)
    const pq = [{ id: startId, fuel: startingFuel, totalDist: 0 }];

    while (pq.length > 0) {
      // Pop highest remaining fuel
      pq.sort((a, b) => b.fuel - a.fuel);
      const { id: curr, fuel: currFuel, totalDist } = pq.shift();

      if (curr === objectiveId) {
        return {
          feasible: true,
          remainingFuelAtObjective: currFuel,
          minCost: minCostMap.get(objectiveId) ?? totalDist,
        };
      }

      for (const neighbor of graph.getNeighbors(curr)) {
        const node = graph.nodes.get(neighbor);
        if (!node || node.hazard !== 'none') continue;

        const edgeDist = graph.getDistance(curr, neighbor);
        if (edgeDist === Infinity) continue;

        const newDist = totalDist + edgeDist;
        if (!minCostMap.has(neighbor) || newDist < minCostMap.get(neighbor)) {
          minCostMap.set(neighbor, newDist);
        }

        const fuelAfterStep = currFuel - edgeDist;
        if (fuelAfterStep < 0) continue; // Ran out of fuel on edge

        // Refuel if node has fuel depot
        const arrivalFuel = node.hasFuel ? Math.max(fuelAfterStep, tankCapacity) : fuelAfterStep;

        const prevBest = maxFuel.get(neighbor) ?? -1;
        if (arrivalFuel > prevBest) {
          maxFuel.set(neighbor, arrivalFuel);
          pq.push({ id: neighbor, fuel: arrivalFuel, totalDist: newDist });
        }
      }
    }

    return {
      feasible: false,
      minCost: minCostMap.get(objectiveId) ?? Infinity,
      reason: 'Fuel exhausted before reaching objective',
    };
  }

  /**
   * Check 3: Simulates a perfect symbolic reasoner using Stage 1 KnowledgeBase + InferenceEngine.
   *
   * The reasoner starts at startId.
   * At each step, it visits an unvisited node that is PROVEN SAFE (safe === true).
   * It perceives world-truth physical sensors (breeze, stench, glitter).
   * It processes arrival through InferenceEngine, which asserts facts and collapses OR-clauses.
   * If the objective is reached, world is proven deductively solvable.
   * If the deductive frontier stalls (no unvisited proven-safe nodes left), it checks whether
   * the objective was reached.
   */
  simulatePerfectReasoner(graph, startId, objectiveId) {
    const kb = new KnowledgeBase(graph);
    const engine = new InferenceEngine(graph, kb);

    const visitedSet = new Set();
    const safeQueue = [startId];

    let steps = 0;
    const maxSteps = graph.nodeIds.length * 4;

    while (safeQueue.length > 0 && steps < maxSteps) {
      steps++;
      const curr = safeQueue.shift();
      if (visitedSet.has(curr)) continue;
      visitedSet.add(curr);

      // Sensed percepts at curr based on world truth
      const neighbors = graph.getNeighbors(curr);
      const breeze = neighbors.some(n => graph.nodes.get(n)?.hazard === 'pit');
      const stench = neighbors.some(n => graph.nodes.get(n)?.hazard === 'hunter');
      const glitter = graph.nodes.get(curr)?.hasObjective === true;

      // Process arrival into symbolic reasoning engine
      engine.processArrival(curr, { breeze, stench, glitter });

      if (curr === objectiveId || kb.objectiveNode === curr) {
        return {
          solved: true,
          visitedCount: visitedSet.size,
          steps,
        };
      }

      // Find any newly proven-safe nodes not yet visited or queued
      for (const id of graph.nodeIds) {
        if (!visitedSet.has(id) && !safeQueue.includes(id)) {
          const belief = kb.getBelief(id);
          if (belief.safe === true) {
            safeQueue.push(id);
          }
        }
      }
    }

    // Check if objective was deduced safe even if not yet entered
    const objBelief = kb.getBelief(objectiveId);
    if (objBelief.safe === true) {
      return {
        solved: true,
        visitedCount: visitedSet.size,
        steps,
      };
    }

    return {
      solved: false,
      visitedCount: visitedSet.size,
      reason: 'Deductive frontier stalled; objective cannot be safely reached without blind hazard risks',
    };
  }
}
