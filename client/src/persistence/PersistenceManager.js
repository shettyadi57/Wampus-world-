/**
 * PersistenceManager.js
 * ─────────────────────────────────────────────────────────────
 * Owns save/load: serialises GameState snapshots to localStorage
 * (browser) with a versioned schema so old saves can be migrated.
 *
 * Save slots are keyed by worldSeed + slot index.
 * Auto-save triggers on every node transition and mission event.
 */

/** @typedef {import('./StateManager.js').GameState} GameState */
/** @typedef {import('./StateManager.js').StateManagerContext} StateManagerContext */

const SAVE_VERSION = 1;
const SAVE_KEY_PREFIX = 'wampus_save_v';

/**
 * @typedef {Object} PersistenceManagerContext
 * @property {function(number): void} save    – save to slot 0..N
 * @property {function(number): GameState|null} load
 * @property {function(number): void} deleteSave
 * @property {function(): number[]} listSlots  – slots with saved data
 */

/**
 * @param {StateManagerContext} state
 * @returns {Promise<PersistenceManagerContext>}
 */
export async function initPersistence(state) {
  // TODO: implement versioned JSON serialisation, migration runners,
  //       auto-save listener on state.subscribe().
  console.log('[persistence] PersistenceManager initialised (stub)');
  return {
    save:       () => {},
    load:       () => null,
    deleteSave: () => {},
    listSlots:  () => [],
  };
}
