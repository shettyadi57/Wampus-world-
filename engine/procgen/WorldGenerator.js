/**
 * WorldGenerator.js
 * ─────────────────────────────────────────────────────────────
 * Master orchestrator for procedural world generation.
 * Generates road network, places entities by difficulty, validates solvability,
 * and regenerates with deterministic seed variation on failure.
 */

import { RoadNetworkGenerator } from './RoadNetworkGenerator.js';
import { EntityPlacer } from './EntityPlacer.js';
import { SolvabilityValidator } from './SolvabilityValidator.js';

export class WorldGenerator {
  /**
   * @param {Object} [options]
   * @param {Object} [options.network]
   * @param {Object} [options.placement]
   * @param {Object} [options.validation]
   * @param {number} [options.maxRetries=25]
   */
  constructor(options = {}) {
    this.networkGen = new RoadNetworkGenerator(options.network);
    this.entityPlacer = new EntityPlacer(options.placement);
    this.validator = new SolvabilityValidator(options.validation);
    this.maxRetries = options.maxRetries ?? 25;
  }

  /**
   * Generates and validates a world.
   * If validation fails, rejects and regenerates up to maxRetries times.
   *
   * @param {number|string} [seed=42]
   * @param {Object} [overrides]
   * @returns {{
   *   graph: import('../RoadGraph.js').RoadGraph,
   *   spec: Object,
   *   valid: boolean,
   *   attempts: number,
   *   effectiveSeed: number|string,
   *   rejectionHistory: Array<{ attempt: number, reason: string, failedCheck: string }>
   * }}
   */
  generateWorld(seed = 42, overrides = {}) {
    const baseSeed = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);
    const rejectionHistory = [];

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Deterministic permutation for retry seeds
      const currentSeed = (baseSeed + attempt * 10007) >>> 0;

      const graph = this.networkGen.generate(currentSeed);
      const spec = this.entityPlacer.placeEntities(graph, currentSeed);

      if (overrides.startingFuel !== undefined) spec.startingFuel = overrides.startingFuel;
      if (overrides.tankCapacity !== undefined) spec.tankCapacity = overrides.tankCapacity;

      const validation = this.validator.validate(graph, spec);

      if (validation.valid) {
        return {
          graph,
          spec,
          valid: true,
          attempts: attempt + 1,
          effectiveSeed: currentSeed,
          rejectionHistory,
          validation,
        };
      }

      rejectionHistory.push({
        attempt: attempt + 1,
        seed: currentSeed,
        failedCheck: validation.failedCheck,
        reason: validation.reason,
      });
    }

    return {
      graph: null,
      spec: null,
      valid: false,
      attempts: this.maxRetries + 1,
      effectiveSeed: null,
      rejectionHistory,
    };
  }
}

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
