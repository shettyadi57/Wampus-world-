/**
 * StateManager.js
 * ─────────────────────────────────────────────────────────────
 * Owns the canonical, in-memory game state tree.
 *
 * Every subsystem reads state through this module's getters.
 * Writes happen only via well-typed mutate() calls so that
 * the persistence layer can snapshot diffs and the UI can
 * subscribe to change events.
 *
 * State is NOT a global singleton — it is passed down via
 * dependency injection through initXxx() functions.
 */

/**
 * @typedef {Object} GameState
 * @property {string}  worldSeed
 * @property {number}  score
 * @property {number}  lives
 * @property {boolean} wampusDead
 * @property {boolean} goldCollected
 * @property {'idle'|'playing'|'paused'|'dead'|'won'} phase
 * @property {Object}  settings        – user preferences (volume, graphics)
 */

/**
 * @typedef {Object} StateManagerContext
 * @property {function(): GameState} get
 * @property {function(Partial<GameState>): void} mutate
 * @property {function(function(GameState): void): function} subscribe
 *   Returns an unsubscribe function.
 */

/**
 * @returns {Promise<StateManagerContext>}
 */
export async function initState() {
  // TODO: implement reactive state store with subscriber notifications
  //       and deep-diff for persistence snapshots.
  console.log('[state] StateManager initialised (stub)');
  return {
    get:       () => ({}),
    mutate:    () => {},
    subscribe: () => () => {},
  };
}
