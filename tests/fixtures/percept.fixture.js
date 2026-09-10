/**
 * percept.fixture.js
 * ─────────────────────────────────────────────────────────────
 * Test fixture: canonical percept frames for unit tests.
 * Import these instead of constructing percepts inline.
 */

/** @typedef {import('../../client/src/sensors/SensorArray.js').PerceptFrame} PerceptFrame */

/** @type {PerceptFrame} */
export const PERCEPT_CLEAR = {
  nodeId: 'r1c1', breeze: false, stench: false,
  glitter: false, bump: false, scream: false, timestamp: 0,
};

/** @type {PerceptFrame} */
export const PERCEPT_BREEZE = { ...PERCEPT_CLEAR, breeze: true, nodeId: 'r1c2' };

/** @type {PerceptFrame} */
export const PERCEPT_STENCH = { ...PERCEPT_CLEAR, stench: true, nodeId: 'r2c1' };

/** @type {PerceptFrame} */
export const PERCEPT_GLITTER = {
  ...PERCEPT_CLEAR, glitter: true, nodeId: 'r3c3',
  // GLITTER means gold IS at r3c3 — not a neighbour inference.
};

/** @type {PerceptFrame} */
export const PERCEPT_BUMP = { ...PERCEPT_CLEAR, bump: true, nodeId: 'r0c0' };

/** @type {PerceptFrame} */
export const PERCEPT_SCREAM = { ...PERCEPT_CLEAR, scream: true, nodeId: 'r2c2' };

/** @type {PerceptFrame} */
export const PERCEPT_BREEZE_AND_STENCH = {
  ...PERCEPT_CLEAR, breeze: true, stench: true, nodeId: 'r2c3',
};
