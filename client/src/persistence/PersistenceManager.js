/**
 * PersistenceManager.js
 * ─────────────────────────────────────────────────────────────
 * Production versioned save system with corrupt-data recovery.
 *
 * Guarantees:
 *   1. Versioned schema (v2) with backwards migration runners from v1.
 *   2. Corrupt-data recovery: if save is malformed or invalid JSON,
 *      it creates an immutable backup (wampus_save_corrupt_backup_<ts>),
 *      salvages readable fragments, and NEVER silently wipes player progress.
 *   3. Persists vehicle telemetry, garage upgrades, mission progress,
 *      real gameplay statistics, achievements, accessibility settings,
 *      and tutorial status.
 *   4. Multi-slot management (0..2) and throttled auto-save.
 */

export const CURRENT_SAVE_VERSION = 2;
export const SAVE_KEY_PREFIX = 'wampus_save_slot_';
export const CORRUPT_BACKUP_PREFIX = 'wampus_save_corrupt_backup_';

export class PersistenceManager {
  /**
   * @param {import('../state/StateManager.js').StateManager} stateManager
   * @param {Object} [storage=localStorage]
   */
  constructor(stateManager, storage = null) {
    this.state = stateManager;
    this.storage = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    this._autoSaveTimer = null;
    this._lastSaveHash = '';
    this._unsubscribe = null;

    this._bindAutoSave();
  }

  _bindAutoSave() {
    if (!this.state || typeof this.state.subscribe !== 'function') return;

    // Debounced auto-save on state mutation
    this._unsubscribe = this.state.subscribe((currentState, prevState) => {
      if (!prevState) return;

      // Check if critical persistent properties changed
      const shouldSave =
        currentState.phase !== prevState.phase ||
        currentState.missions?.activeId !== prevState.missions?.activeId ||
        currentState.missions?.completed?.length !== prevState.missions?.completed?.length ||
        currentState.upgrades?.length !== prevState.upgrades?.length ||
        currentState.vehicle?.currentNodeId !== prevState.vehicle?.currentNodeId ||
        currentState.tutorial?.completed !== prevState.tutorial?.completed;

      if (shouldSave) {
        this.scheduleAutoSave(0);
      }
    });
  }

  scheduleAutoSave(slot = 0, delayMs = 1200) {
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      this.save(slot, { isAutoSave: true });
    }, delayMs);
  }

  destroy() {
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
    if (typeof this._unsubscribe === 'function') {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  /**
   * Serializes and writes state to designated save slot.
   * @param {number} [slot=0]
   * @param {Object} [meta={}]
   * @returns {boolean} Success status
   */
  save(slot = 0, meta = {}) {
    if (!this.storage) {
      console.warn('[persistence] No storage engine available (localStorage missing)');
      return false;
    }

    try {
      const current = this.state.get();
      const payload = {
        version: CURRENT_SAVE_VERSION,
        timestamp: Date.now(),
        isoDate: new Date().toISOString(),
        slot,
        isAutoSave: !!meta.isAutoSave,
        data: {
          worldSeed: current.worldSeed,
          difficulty: current.difficulty,
          score: current.score,
          lives: current.lives,
          phase: current.phase,
          vehicle: {
            position: current.vehicle?.position ?? { x: 0, y: 0.5, z: 0 },
            yaw: current.vehicle?.yaw ?? 0,
            fuelRemaining: current.vehicle?.fuelRemaining ?? 100,
            tankCapacity: current.vehicle?.tankCapacity ?? 100,
            hullIntegrity: current.vehicle?.hullIntegrity ?? 100,
            maxMotorTorque: current.vehicle?.maxMotorTorque ?? 3500,
            suspensionDamping: current.vehicle?.suspensionDamping ?? 2.5,
            tireGrip: current.vehicle?.tireGrip ?? 1.0,
            currentNodeId: current.vehicle?.currentNodeId ?? 'n_0_0',
          },
          upgrades: Array.isArray(current.upgrades) ? [...current.upgrades] : [],
          missions: {
            activeId: current.missions?.activeId,
            completed: current.missions?.completed ?? [],
            currentObjectiveId: current.missions?.currentObjectiveId,
          },
          stats: { ...(current.stats || {}) },
          achievements: { ...(current.achievements || {}) },
          settings: { ...(current.settings || {}) },
          tutorial: { ...(current.tutorial || {}) },
        },
      };

      const serialized = JSON.stringify(payload);
      const key = `${SAVE_KEY_PREFIX}${slot}`;
      this.storage.setItem(key, serialized);

      console.log(`[persistence] Successfully saved state to Slot ${slot} (v${payload.version})`);
      return true;
    } catch (err) {
      console.error(`[persistence] Save failed for Slot ${slot}:`, err);
      return false;
    }
  }

  /**
   * Loads and validates save file, executing corrupt recovery if damaged.
   * @param {number} [slot=0]
   * @returns {{ success: boolean, recovered: boolean, data: Object|null, error?: string }}
   */
  load(slot = 0) {
    if (!this.storage) {
      return { success: false, recovered: false, data: null, error: 'No storage engine' };
    }

    const key = `${SAVE_KEY_PREFIX}${slot}`;
    const raw = this.storage.getItem(key);

    if (!raw) {
      console.log(`[persistence] Slot ${slot} is empty`);
      return { success: false, recovered: false, data: null };
    }

    let parsed = null;
    let isCorrupted = false;

    try {
      parsed = JSON.parse(raw);
    } catch (syntaxErr) {
      console.warn(`[persistence] JSON syntax corruption detected in Slot ${slot}:`, syntaxErr);
      isCorrupted = true;
    }

    // Verify basic structure
    if (!isCorrupted && (!parsed || typeof parsed !== 'object' || !parsed.data)) {
      console.warn(`[persistence] Structural schema corruption in Slot ${slot}`);
      isCorrupted = true;
    }

    // Corrupt-Data Recovery Routine: NEVER silently wipe progress!
    if (isCorrupted) {
      const backupKey = `${CORRUPT_BACKUP_PREFIX}slot${slot}_${Date.now()}`;
      try {
        this.storage.setItem(backupKey, raw);
        console.warn(`[persistence] Created immutable safety backup at "${backupKey}"`);
      } catch (backupErr) {
        console.error('[persistence] Failed to write safety backup:', backupErr);
      }

      const salvaged = this._salvageCorruptedSave(raw);
      if (salvaged) {
        console.warn('[persistence] Partial data successfully salvaged from corrupted save!');
        this.state.mutate(salvaged);
        return { success: true, recovered: true, data: salvaged };
      }

      return {
        success: false,
        recovered: false,
        data: null,
        error: 'Save file was corrupted and unreadable. Backup was preserved in storage.',
      };
    }

    // Run version migrations if necessary
    const migratedData = this._migrateSchema(parsed);

    // Apply to state manager
    this.state.mutate(migratedData);
    console.log(`[persistence] Loaded Slot ${slot} successfully (v${parsed.version} -> v${CURRENT_SAVE_VERSION})`);

    return { success: true, recovered: false, data: migratedData };
  }

  /**
   * Version migration runner: transforms older schema saves into current schema.
   */
  _migrateSchema(saveRecord) {
    const data = saveRecord.data || {};
    const version = saveRecord.version || 1;

    if (version < 2) {
      console.log(`[persistence] Migrating save from schema v${version} to v2...`);
      // Ensure v2 stats object exists
      if (!data.stats) {
        data.stats = {};
      }
      // Ensure v2 achievements structure exists
      if (!data.achievements) {
        data.achievements = {};
      }
      // Ensure v2 accessibility settings exist
      if (!data.settings) {
        data.settings = {};
      }
      if (data.settings.captionsEnabled === undefined) data.settings.captionsEnabled = true;
      if (data.settings.colorblindMode === undefined) data.settings.colorblindMode = 'none';
      if (data.settings.cameraShake === undefined) data.settings.cameraShake = true;
      if (data.settings.motionReduction === undefined) data.settings.motionReduction = false;

      // Ensure vehicle hull exists
      if (data.vehicle && data.vehicle.hullIntegrity === undefined) {
        data.vehicle.hullIntegrity = 100;
      }
    }

    return data;
  }

  /**
   * Attempts regex-based heuristic salvage of JSON text fragments.
   */
  _salvageCorruptedSave(rawString) {
    if (!rawString || typeof rawString !== 'string') return null;

    const salvaged = {};
    try {
      // 1. Salvage seed
      const seedMatch = rawString.match(/"worldSeed"\s*:\s*"([^"]+)"/);
      if (seedMatch) salvaged.worldSeed = seedMatch[1];

      // 2. Salvage fuelRemaining
      const fuelMatch = rawString.match(/"fuelRemaining"\s*:\s*([0-9.]+)/);
      if (fuelMatch) {
        salvaged.vehicle = salvaged.vehicle || {};
        salvaged.vehicle.fuelRemaining = parseFloat(fuelMatch[1]);
      }

      // 3. Salvage score
      const scoreMatch = rawString.match(/"score"\s*:\s*([0-9]+)/);
      if (scoreMatch) salvaged.score = parseInt(scoreMatch[1], 10);

      // 4. Salvage upgrades array
      const upgradesMatch = rawString.match(/"upgrades"\s*:\s*\[([^\]]*)\]/);
      if (upgradesMatch) {
        try {
          salvaged.upgrades = JSON.parse(`[${upgradesMatch[1]}]`);
        } catch (e) {}
      }

      // 5. Salvage completed missions
      const compMatch = rawString.match(/"completed"\s*:\s*\[([^\]]*)\]/);
      if (compMatch) {
        try {
          salvaged.missions = salvaged.missions || {};
          salvaged.missions.completed = JSON.parse(`[${compMatch[1]}]`);
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[persistence] Salvage parsing encountered error:', e);
    }

    return Object.keys(salvaged).length > 0 ? salvaged : null;
  }

  deleteSave(slot = 0) {
    if (!this.storage) return;
    const key = `${SAVE_KEY_PREFIX}${slot}`;
    this.storage.removeItem(key);
    console.log(`[persistence] Slot ${slot} deleted`);
  }

  listSlots() {
    if (!this.storage) return [];
    const slots = [];

    for (let slot = 0; slot < 3; slot++) {
      const key = `${SAVE_KEY_PREFIX}${slot}`;
      const raw = this.storage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          slots.push({
            slot,
            version: parsed.version,
            timestamp: parsed.timestamp,
            isoDate: parsed.isoDate,
            isAutoSave: !!parsed.isAutoSave,
            worldSeed: parsed.data?.worldSeed,
            difficulty: parsed.data?.difficulty,
            activeMission: parsed.data?.missions?.activeId,
            fuelRemaining: parsed.data?.vehicle?.fuelRemaining,
            hullIntegrity: parsed.data?.vehicle?.hullIntegrity,
            upgradesCount: parsed.data?.upgrades?.length ?? 0,
            achievementsCount: Object.values(parsed.data?.achievements || {}).filter(a => a.unlocked).length,
          });
        } catch (e) {
          slots.push({ slot, corrupted: true });
        }
      }
    }
    return slots;
  }
}

/**
 * @param {import('../state/StateManager.js').StateManager} state
 * @returns {Promise<PersistenceManager>}
 */
export async function initPersistence(state) {
  const persistence = new PersistenceManager(state);
  console.log('[persistence] PersistenceManager fully initialized with corrupt-recovery safeguards');
  return persistence;
}
