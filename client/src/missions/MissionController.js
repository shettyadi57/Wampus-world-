/**
 * MissionController.js
 * ─────────────────────────────────────────────────────────────
 * Owns mission state: objectives, triggers, scoring, and
 * mission lifecycle (start → active → complete / failed).
 *
 * Missions are data-driven: each mission is a plain JS object
 * describing goals, constraints, and reward/penalty tables.
 * No mission logic is hard-coded here — this is the interpreter.
 */

/** @typedef {import('../state/StateManager.js').GameState} GameState */
/** @typedef {import('../navigation/Navigator.js').NavigatorContext} NavigatorContext */

/**
 * @typedef {Object} MissionDef
 * @property {string}   id
 * @property {string}   name
 * @property {string[]} objectives   – list of objective node IDs or event types
 * @property {number}   reward
 * @property {number}   penalty
 * @property {number}   timeLimitSec – 0 = no limit
 */

/**
 * @typedef {Object} MissionControllerContext
 * @property {function(MissionDef): void} start
 * @property {function(): void} tick          – called each game tick
 * @property {function(): MissionDef|null} activeMission
 * @property {function(): boolean} isComplete
 * @property {function(): boolean} isFailed
 */

/**
 * @param {GameState} state
 * @param {NavigatorContext} navigator
 * @returns {Promise<MissionControllerContext>}
 */
export async function initMissions(state, navigator) {
  // TODO: load mission definitions, register trigger listeners,
  //       wire completion events to state persistence.
  console.log('[missions] MissionController initialised (stub)');
  return {
    start:         () => {},
    tick:          () => {},
    activeMission: () => null,
    isComplete:    () => false,
    isFailed:      () => false,
  };
}
