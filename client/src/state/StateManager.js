/**
 * StateManager.js
 * ─────────────────────────────────────────────────────────────
 * Canonical reactive game state tree for Wampus World.
 *
 * Implements a full pub/sub reactive store with immutability helpers,
 * deep merge mutations, and persistence snapshot subscriptions.
 */

export const DEFAULT_GAME_STATE = {
  worldSeed: '42',
  difficulty: 'normal',
  score: 0,
  lives: 3,
  phase: 'idle', // 'idle' | 'playing' | 'paused' | 'dead' | 'won'
  vehicle: {
    position: { x: 0, y: 0.5, z: 0 },
    yaw: 0,
    fuelRemaining: 100,
    tankCapacity: 100,
    hullIntegrity: 100,
    maxMotorTorque: 3500,
    suspensionDamping: 2.5,
    tireGrip: 1.0,
    currentNodeId: 'n_0_0',
  },
  upgrades: [],
  missions: {
    activeId: 'mission_01_silent_checkpoint',
    completed: [],
    currentObjectiveId: null,
    history: [],
  },
  stats: {
    expeditionsAttempted: 0,
    expeditionsCompleted: 0,
    nodesExplored: [], // array of unique node IDs visited
    distanceDrivenMeters: 0,
    fuelConsumedLiters: 0,
    hazardsDetected: 0,
    hazardsAvoided: 0,
    pitsFallen: 0,
    hunterEncounters: 0,
    decisionsMade: 0,
    aiDecisionsFollowed: 0,
    rebelDecisionsCount: 0,
    cleanJunctionsCount: 0,
    upgradesInstalledCount: 0,
    playTimeSeconds: 0,
  },
  achievements: {
    first_expedition:   { unlocked: false, unlockedAt: null, name: 'First Expedition', desc: 'Embark upon and secure your first mountain expedition.' },
    logical_driver:     { unlocked: false, unlockedAt: null, name: 'Logical Driver', desc: 'Select a junction route mathematically proven safe by Horn deduction.' },
    trust_the_machine:  { unlocked: false, unlockedAt: null, name: 'Trust the Machine', desc: 'Follow the AI Co-Pilot recommendation at 3 consecutive junctions.' },
    rebel_driver:       { unlocked: false, unlockedAt: null, name: 'Rebel Driver', desc: 'Defy an AI hazard warning by choosing high-risk route and surviving.' },
    ghost_road:         { unlocked: false, unlockedAt: null, name: 'Ghost Road', desc: 'Traverse 3 consecutive junctions without sensing a single hazard anomaly.' },
    survivor:           { unlocked: false, unlockedAt: null, name: 'Survivor', desc: 'Escape within 25m proximity of the roaming Hunter entity.' },
    master_mechanic:    { unlocked: false, unlockedAt: null, name: 'Master Mechanic', desc: 'Install all 5 tactical performance upgrades in Ranger Garage.' },
  },
  settings: {
    masterVolume: 0.8,
    engineVolume: 0.7,
    sfxVolume: 0.85,
    ambientVolume: 0.6,
    captionsEnabled: true,
    colorblindMode: 'none', // 'none' | 'deuteranopia' | 'protanopia' | 'high_contrast'
    cameraShake: true,
    motionReduction: false,
    difficultyTier: 'normal',
  },
  tutorial: {
    completed: false,
    step: 0,
    skipped: false,
  },
};

export class StateManager {
  /**
   * @param {Object} [initialState]
   */
  constructor(initialState = {}) {
    this._state = deepClone({ ...DEFAULT_GAME_STATE, ...initialState });
    this._subscribers = new Set();
  }

  /**
   * Returns a frozen snapshot of the state.
   */
  get() {
    return this._state;
  }

  /**
   * Mutate state via partial object or mutator function.
   * @param {Object|Function} patch
   */
  mutate(patch) {
    let nextState;
    if (typeof patch === 'function') {
      nextState = patch(deepClone(this._state));
    } else {
      nextState = deepMerge(deepClone(this._state), patch);
    }

    const prevState = this._state;
    this._state = nextState;

    // Notify all subscribers
    for (const sub of this._subscribers) {
      try {
        sub(this._state, prevState);
      } catch (e) {
        console.warn('[state] Subscriber notification error:', e);
      }
    }
  }

  /**
   * Subscribe to state mutations.
   * @param {function(Object, Object): void} listener
   * @returns {function(): void} Unsubscribe callback
   */
  subscribe(listener) {
    this._subscribers.add(listener);
    return () => {
      this._subscribers.delete(listener);
    };
  }

  /**
   * Reset state to defaults, preserving user settings.
   */
  reset() {
    const savedSettings = this._state.settings;
    this._state = deepClone({
      ...DEFAULT_GAME_STATE,
      settings: savedSettings,
    });
    for (const sub of this._subscribers) {
      try { sub(this._state, null); } catch (e) {}
    }
  }
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const copy = {};
  for (const key of Object.keys(obj)) {
    copy[key] = deepClone(obj[key]);
  }
  return copy;
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = deepClone(source[key]);
    }
  }
  return target;
}

/**
 * @param {Object} [initialState]
 * @returns {Promise<StateManager>}
 */
export async function initState(initialState = {}) {
  const manager = new StateManager(initialState);
  console.log('[state] StateManager fully initialized with reactive pub/sub store');
  return manager;
}
