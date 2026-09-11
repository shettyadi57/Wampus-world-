#!/usr/bin/env node
/**
 * scripts/generate-worlds.js
 * ─────────────────────────────────────────────────────────────
 * Headless batch procedural world generator and solvability validator.
 *
 * Usage:
 *   node scripts/generate-worlds.js [N=100] [difficulty=medium] [baseSeed=42]
 */

import { RoadNetworkGenerator } from '../engine/procgen/RoadNetworkGenerator.js';
import { EntityPlacer, DIFFICULTY_PRESETS } from '../engine/procgen/EntityPlacer.js';
import { SolvabilityValidator } from '../engine/procgen/SolvabilityValidator.js';
import { WorldGenerator } from '../engine/procgen/WorldGenerator.js';

const args = process.argv.slice(2);
const N = parseInt(args[0] ?? '100', 10);
const difficulty = args[1] ?? 'medium';
const baseSeed = parseInt(args[2] ?? '42', 10);

console.log('='.repeat(70));
console.log(`  WAMPUS WORLD — STAGE 2 PROCEDURAL GENERATION BATCH RUN`);
console.log(`  Target Worlds: ${N} | Difficulty: ${difficulty} | Base Seed: ${baseSeed}`);
console.log('='.repeat(70));

const networkGen = new RoadNetworkGenerator();
const placer = new EntityPlacer({ difficulty });
const validator = new SolvabilityValidator();
const worldGen = new WorldGenerator({
  network: {},
  placement: { difficulty },
  validation: {},
  maxRetries: 10,
});

let firstAttemptPasses = 0;
let acceptedWorlds = 0;
let rejectedWorlds = 0;

const rejectionByCheck = {
  reachability: 0,
  fuel: 0,
  reasoner: 0,
};

const safeDistances = [];
const nodeCounts = [];
const edgeCounts = [];
const retryDistribution = {};

const startTime = Date.now();

for (let i = 0; i < N; i++) {
  const seed = baseSeed + i * 31;

  // 1. Evaluate first-attempt raw generation pass rate
  const rawGraph = networkGen.generate(seed);
  const rawSpec = placer.placeEntities(rawGraph, seed);
  const rawValidation = validator.validate(rawGraph, rawSpec);

  if (rawValidation.valid) {
    firstAttemptPasses++;
  } else if (rawValidation.failedCheck) {
    rejectionByCheck[rawValidation.failedCheck] = (rejectionByCheck[rawValidation.failedCheck] || 0) + 1;
  }

  // 2. Run master world generator with rejection & regeneration gate
  const result = worldGen.generateWorld(seed);

  const attempts = result.attempts;
  retryDistribution[attempts] = (retryDistribution[attempts] || 0) + 1;

  if (result.valid) {
    acceptedWorlds++;
    nodeCounts.push(result.graph.nodeIds.length);
    edgeCounts.push(result.graph._edges.size);
    if (result.validation?.details?.shortestSafeDistance) {
      safeDistances.push(result.validation.details.shortestSafeDistance);
    }
  } else {
    rejectedWorlds++;
  }

  if ((i + 1) % 25 === 0 || i + 1 === N) {
    process.stdout.write(`  [Progress] Generated & validated ${i + 1}/${N} worlds...\r`);
  }
}

const elapsedMs = Date.now() - startTime;

console.log('\n' + '-'.repeat(70));
console.log('  GENERATION & VALIDATION RESULTS');
console.log('-'.repeat(70));

const firstPassRate = ((firstAttemptPasses / N) * 100).toFixed(1);
const finalAcceptedRate = ((acceptedWorlds / N) * 100).toFixed(1);

console.log(`  Raw 1st-Attempt Pass Rate:  ${firstAttemptPasses}/${N} (${firstPassRate}%)`);
console.log(`  Accepted Worlds Rate:       ${acceptedWorlds}/${N} (${finalAcceptedRate}%)`);
console.log(`  Rejection / Failure Rate:   ${rejectedWorlds}/${N} (${((rejectedWorlds / N) * 100).toFixed(1)}%)`);
console.log(`  Batch Duration:             ${elapsedMs}ms (${(elapsedMs / N).toFixed(2)}ms / world)`);

console.log('\n' + '-'.repeat(70));
console.log('  FIRST-ATTEMPT FAILURE HISTOGRAM BY VALIDATION CHECK');
console.log('-'.repeat(70));
console.log(`  - Reachability (no safe path to obj):  ${rejectionByCheck.reachability}`);
console.log(`  - Fuel Feasibility (exceeds budget):   ${rejectionByCheck.fuel}`);
console.log(`  - Deductive Solvability (ambiguity):   ${rejectionByCheck.reasoner}`);

console.log('\n' + '-'.repeat(70));
console.log('  ATTEMPTS DISTRIBUTION (WorldGenerator Retry Gate)');
console.log('-'.repeat(70));
for (const [attempts, count] of Object.entries(retryDistribution).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`  - ${attempts} attempt(s): ${count} worlds (${((count / N) * 100).toFixed(1)}%)`);
}

if (safeDistances.length > 0) {
  const avgDist = (safeDistances.reduce((a, b) => a + b, 0) / safeDistances.length).toFixed(1);
  const minDist = Math.min(...safeDistances).toFixed(1);
  const maxDist = Math.max(...safeDistances).toFixed(1);
  console.log('\n' + '-'.repeat(70));
  console.log('  ACCEPTED WORLDS TOPOLOGY METRICS');
  console.log('-'.repeat(70));
  console.log(`  - Nodes per world:            ${nodeCounts[0] ?? 0}`);
  console.log(`  - Average edges per world:    ${(edgeCounts.reduce((a, b) => a + b, 0) / edgeCounts.length).toFixed(1)}`);
  console.log(`  - Safe path distance:         min=${minDist}, avg=${avgDist}, max=${maxDist}`);
}

console.log('='.repeat(70));
