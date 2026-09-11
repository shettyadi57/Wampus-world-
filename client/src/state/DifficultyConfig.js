/**
 * DifficultyConfig.js
 * ─────────────────────────────────────────────────────────────
 * Difficulty tiers directly driving sensor noise rates, hazard densities,
 * and Hunter roaming aggression.
 */

export const DIFFICULTY_TIERS = {
  easy: {
    id: 'easy',
    name: 'Easy',
    sensorNoise: {
      falsePositiveRate: 0.01,
      falseNegativeRate: 0.01,
    },
    pitDensity: 0.10,
    hunterCount: 1,
    hunterMoveInterval: 12.0, // seconds between moves
    hunterAggression: 0.1,    // 10% chance to move toward player
    startingFuel: 100,
    weather: 'clear',
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    sensorNoise: {
      falsePositiveRate: 0.05,
      falseNegativeRate: 0.04,
    },
    pitDensity: 0.16,
    hunterCount: 1,
    hunterMoveInterval: 8.0,
    hunterAggression: 0.35,
    startingFuel: 80,
    weather: 'foggy',
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    sensorNoise: {
      falsePositiveRate: 0.12,
      falseNegativeRate: 0.10,
    },
    pitDensity: 0.22,
    hunterCount: 2,
    hunterMoveInterval: 5.0,
    hunterAggression: 0.70,
    startingFuel: 65,
    weather: 'foggy',
  },
  nightmare: {
    id: 'nightmare',
    name: 'Nightmare',
    sensorNoise: {
      falsePositiveRate: 0.20,
      falseNegativeRate: 0.18,
    },
    pitDensity: 0.28,
    hunterCount: 2,
    hunterMoveInterval: 3.5,
    hunterAggression: 0.95,
    startingFuel: 50,
    weather: 'stormy',
  },
};

export const WEATHER_MODIFIERS = {
  clear: {
    windNoiseMult: 1.0,
    thermalNoiseMult: 1.0,
    visibility: 1.0,
  },
  foggy: {
    windNoiseMult: 1.2,
    thermalNoiseMult: 1.5,
    visibility: 0.65,
  },
  stormy: {
    windNoiseMult: 2.0,
    thermalNoiseMult: 1.8,
    visibility: 0.35,
  },
};
