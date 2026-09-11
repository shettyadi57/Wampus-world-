/**
 * EntityPlacer.js
 * ─────────────────────────────────────────────────────────────
 * Places hazards (pits, hunters), the Objective, fuel nodes, and checkpoints
 * with difficulty scaling onto a RoadGraph.
 *
 * Employs critical-corridor preservation so worlds remain solvable by symbolic
 * deduction while scaling hazard density, fuel constraints, and alternate branch risks.
 */

import { SeededRNG } from './SeededRNG.js';

export const DIFFICULTY_PRESETS = {
  easy: {
    pitDensity: 0.12,
    hunterCount: 1,
    startingFuel: 100,
    tankCapacity: 100,
    fuelNodeCount: 4,
    checkpointCount: 3,
  },
  medium: {
    pitDensity: 0.18,
    hunterCount: 2,
    startingFuel: 80,
    tankCapacity: 80,
    fuelNodeCount: 3,
    checkpointCount: 2,
  },
  hard: {
    pitDensity: 0.25,
    hunterCount: 3,
    startingFuel: 65,
    tankCapacity: 65,
    fuelNodeCount: 2,
    checkpointCount: 1,
  },
};

export class EntityPlacer {
  /**
   * @param {Object} [config]
   * @param {'easy'|'medium'|'hard'|Object} [config.difficulty='medium']
   * @param {number} [config.pitDensity]
   * @param {number} [config.hunterCount]
   * @param {number} [config.startingFuel]
   * @param {number} [config.tankCapacity]
   * @param {number} [config.fuelNodeCount]
   * @param {number} [config.checkpointCount]
   * @param {string} [config.startId]
   */
  constructor(config = {}) {
    const diffName = typeof config.difficulty === 'string' ? config.difficulty : 'medium';
    const preset = DIFFICULTY_PRESETS[diffName] ?? DIFFICULTY_PRESETS.medium;

    this.difficulty = diffName;
    this.pitDensity = config.pitDensity ?? preset.pitDensity;
    this.hunterCount = config.hunterCount ?? preset.hunterCount;
    this.startingFuel = config.startingFuel ?? preset.startingFuel;
    this.tankCapacity = config.tankCapacity ?? preset.tankCapacity;
    this.fuelNodeCount = config.fuelNodeCount ?? preset.fuelNodeCount;
    this.checkpointCount = config.checkpointCount ?? preset.checkpointCount;
    this.startId = config.startId ?? null;
  }

  /**
   * Annotates the graph in-place and returns world specification metadata.
   *
   * @param {import('../RoadGraph.js').RoadGraph} graph
   * @param {number|string} [seed=42]
   * @returns {{
   *   startId: string,
   *   objectiveId: string,
   *   pitNodes: string[],
   *   hunterNodes: string[],
   *   fuelNodes: string[],
   *   checkpoints: string[],
   *   startingFuel: number,
   *   tankCapacity: number,
   *   difficulty: string
   * }}
   */
  placeEntities(graph, seed = 42) {
    const rng = new SeededRNG(seed);
    const allNodeIds = graph.nodeIds;
    if (allNodeIds.length < 4) {
      throw new Error('Graph too small for entity placement (minimum 4 nodes required)');
    }

    // Reset any existing entity states
    for (const id of allNodeIds) {
      const node = graph.nodes.get(id);
      node.hazard = 'none';
      node.hasObjective = false;
      node.hasFuel = false;
      node.isCheckpoint = false;
    }

    // ── 1. Select Start Node ──
    const startId = this.startId ?? (graph.nodes.has('n_0_0') ? 'n_0_0' : allNodeIds[0]);

    // ── 2. Select Objective Node ──
    const distFromStart = bfsDistances(graph, startId);
    let maxDist = -1;
    for (const d of distFromStart.values()) {
      if (d > maxDist) maxDist = d;
    }

    const startNeighbors = new Set(graph.getNeighbors(startId));
    const farCandidates = allNodeIds.filter(
      id => id !== startId && !startNeighbors.has(id) && (distFromStart.get(id) ?? 0) >= Math.max(2, maxDist - 1)
    );
    const objectiveId = farCandidates.length > 0 ? rng.pick(farCandidates) : allNodeIds[allNodeIds.length - 1];

    graph.nodes.get(objectiveId).hasObjective = true;

    // ── 3. Identify Critical Solution Path ──
    const criticalPath = findShortestPath(graph, startId, objectiveId);
    const criticalPathSet = new Set(criticalPath);

    // Critical corridor protection:
    // Pits and hunters are placed outside the critical corridor so that a perfect
    // symbolic reasoner can deduce and follow a valid route to the objective
    // without being blocked by inescapable ambiguity.
    const criticalCorridor = new Set(criticalPath);
    for (const p of criticalPath) {
      for (const n of graph.getNeighbors(p)) {
        criticalCorridor.add(n);
      }
    }
    criticalCorridor.add(startId);
    criticalCorridor.add(objectiveId);

    let hazardCandidates = allNodeIds.filter(id => !criticalCorridor.has(id));

    // Fallback if corridor covers almost all nodes (e.g. tiny graph)
    if (hazardCandidates.length < 2) {
      hazardCandidates = allNodeIds.filter(
        id => id !== startId && id !== objectiveId && !criticalPathSet.has(id) && !startNeighbors.has(id)
      );
    }

    // ── 4. Place Hazards (Pits & Hunters) ──
    const targetPitCount = Math.max(1, Math.round(hazardCandidates.length * this.pitDensity));
    const shuffledForHazards = rng.shuffle(hazardCandidates);

    const pitNodes = shuffledForHazards.slice(0, targetPitCount);
    for (const pitId of pitNodes) {
      graph.nodes.get(pitId).hazard = 'pit';
    }

    const hunterCandidates = shuffledForHazards.slice(targetPitCount);
    const hunterNodes = hunterCandidates.slice(0, Math.min(this.hunterCount, hunterCandidates.length));
    for (const hunterId of hunterNodes) {
      graph.nodes.get(hunterId).hazard = 'hunter';
    }

    const hazardSet = new Set([...pitNodes, ...hunterNodes]);

    // ── 5. Place Fuel Nodes ──
    const safeCandidates = allNodeIds.filter(
      id => id !== startId && id !== objectiveId && !hazardSet.has(id)
    );

    const fuelNodes = [];
    if (criticalPath.length >= 4) {
      const midIndex = Math.floor(criticalPath.length / 2);
      const midNode = criticalPath[midIndex];
      if (midNode && !hazardSet.has(midNode)) {
        fuelNodes.push(midNode);
      }
    }

    const remainingSafeForFuel = safeCandidates.filter(id => !fuelNodes.includes(id));
    const extraFuelCount = Math.max(0, this.fuelNodeCount - fuelNodes.length);
    fuelNodes.push(...rng.sample(remainingSafeForFuel, extraFuelCount));

    for (const fuelId of fuelNodes) {
      graph.nodes.get(fuelId).hasFuel = true;
    }

    // ── 6. Place Checkpoints ──
    const checkpointCandidates = safeCandidates.filter(
      id => !fuelNodes.includes(id) && graph.getNeighbors(id).length >= 2
    );
    const checkpoints = rng.sample(
      checkpointCandidates.length >= this.checkpointCount ? checkpointCandidates : safeCandidates,
      this.checkpointCount
    );
    for (const cpId of checkpoints) {
      graph.nodes.get(cpId).isCheckpoint = true;
    }

    return {
      startId,
      objectiveId,
      pitNodes,
      hunterNodes,
      fuelNodes,
      checkpoints,
      startingFuel: this.startingFuel,
      tankCapacity: this.tankCapacity,
      difficulty: this.difficulty,
    };
  }
}

function bfsDistances(graph, startId) {
  const dist = new Map([[startId, 0]]);
  const queue = [startId];
  while (queue.length > 0) {
    const curr = queue.shift();
    const d = dist.get(curr);
    for (const neighbor of graph.getNeighbors(curr)) {
      if (!dist.has(neighbor)) {
        dist.set(neighbor, d + 1);
        queue.push(neighbor);
      }
    }
  }
  return dist;
}

function findShortestPath(graph, startId, targetId) {
  const prev = new Map();
  const queue = [startId];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr === targetId) {
      const path = [];
      let step = targetId;
      while (step) {
        path.unshift(step);
        step = prev.get(step);
      }
      return path;
    }

    for (const neighbor of graph.getNeighbors(curr)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        prev.set(neighbor, curr);
        queue.push(neighbor);
      }
    }
  }

  return [startId, targetId];
}
