/**
 * AchievementManager.js
 * ─────────────────────────────────────────────────────────────
 * Real-time condition evaluator for in-game achievements.
 *
 * Requirements:
 *   1. First Expedition: First mission embarked upon / checkpoint secured.
 *   2. Logical Driver: Select a node mathematically proven safe by Horn deduction.
 *   3. Trust the Machine: Follow AI recommendation at 3 consecutive junctions.
 *   4. Rebel Driver: Steer toward a high-risk route contrary to AI warning and survive.
 *   5. Ghost Road: Traverse 3 consecutive junctions with zero hazard anomalies.
 *   6. Survivor: Escape within 25m proximity of the roaming Hunter entity.
 *   7. Master Mechanic: Install all 5 tactical upgrades in Ranger Garage.
 */

export class AchievementManager {
  /**
   * @param {import('./StateManager.js').StateManager} state
   * @param {import('../audio/AudioEngine.js').AudioEngine} [audio]
   */
  constructor(state, audio = null) {
    this.state = state;
    this.audio = audio;
    this.listeners = new Set();

    // Internal trackers
    this._consecutiveAiChoices = 0;
    this._consecutiveCleanJunctions = 0;
    this._nearHunterEscaped = false;
    this._rebelAttemptActive = false;
  }

  onUnlock(callback) {
    this.listeners.add(callback);
  }

  offUnlock(callback) {
    this.listeners.delete(callback);
  }

  isUnlocked(id) {
    const achs = this.state.get()?.achievements || {};
    return !!achs[id]?.unlocked;
  }

  unlock(id) {
    if (this.isUnlocked(id)) return;

    const achs = this.state.get()?.achievements || {};
    const ach = achs[id];
    if (!ach) return;

    const updated = {
      ...achs,
      [id]: {
        ...ach,
        unlocked: true,
        unlockedAt: Date.now(),
      },
    };

    this.state.mutate({ achievements: updated });

    if (this.audio) {
      this.audio.playAchievement();
    }

    console.log(`[achievement] UNLOCKED: "${ach.name}" — ${ach.desc}`);

    for (const listener of this.listeners) {
      try {
        listener(ach);
      } catch (e) {
        console.warn('[achievement] Listener notification error:', e);
      }
    }
  }

  // ─── Trigger Hooks ───────────────────────────────────────────

  /**
   * Hook 1: Expedition started or completed
   */
  notifyExpeditionMilestone(isComplete = false) {
    this.unlock('first_expedition');
  }

  /**
   * Hook 2: Junction route selected
   * @param {Object} context
   * @param {string} context.chosenNodeId
   * @param {number} context.chosenRisk
   * @param {boolean} context.isSafeProven - True if KB proved safe by deduction
   * @param {Array<{nodeId: string, risk: number}>} context.rankedBranches
   * @param {Object} context.topAiBranch
   * @param {boolean} context.hasPercepts - Whether breeze/stench active at junction
   */
  notifyJunctionDecision({
    chosenNodeId,
    chosenRisk = 0,
    isSafeProven = false,
    rankedBranches = [],
    topAiBranch = null,
    hasPercepts = false,
  }) {
    // 1. Logical Driver: Chose a node proven safe by deduction when an unsafe alternative existed
    const hasUnsafeOption = rankedBranches.some(b => b.nodeId !== chosenNodeId && b.risk > 0.25);
    if (isSafeProven && hasUnsafeOption && chosenRisk <= 0.05) {
      this.unlock('logical_driver');
    }

    // 2. Trust the Machine: Followed AI recommendation 3 times consecutively
    if (topAiBranch && topAiBranch.nodeId === chosenNodeId) {
      this._consecutiveAiChoices++;
      if (this._consecutiveAiChoices >= 3) {
        this.unlock('trust_the_machine');
      }
    } else {
      this._consecutiveAiChoices = 0;
    }

    // 3. Rebel Driver check setup: chose high-risk (>= 0.50) when AI advised safe (< 0.20)
    if (topAiBranch && topAiBranch.risk < 0.20 && chosenRisk >= 0.50) {
      this._rebelAttemptActive = true;
    }

    // 4. Ghost Road: 3 consecutive junctions with zero hazard anomalies
    if (!hasPercepts) {
      this._consecutiveCleanJunctions++;
      if (this._consecutiveCleanJunctions >= 3) {
        this.unlock('ghost_road');
      }
    } else {
      this._consecutiveCleanJunctions = 0;
    }
  }

  /**
   * Hook 3: Node arrival safe verification (for Rebel Driver)
   */
  notifyNodeArrival(nodeId, isSafe = true) {
    if (this._rebelAttemptActive && isSafe) {
      this.unlock('rebel_driver');
      this._rebelAttemptActive = false;
    }
  }

  /**
   * Hook 4: Hunter proximity monitoring (for Survivor)
   * @param {number} distance Distance to Hunter in meters
   * @param {boolean} atSafeNode Whether current node is safe
   */
  notifyHunterProximity(distance, atSafeNode = false) {
    if (distance <= 25) {
      this._nearHunterEscaped = true;
    } else if (distance > 45 && this._nearHunterEscaped && atSafeNode) {
      this.unlock('survivor');
      this._nearHunterEscaped = false;
    }
  }

  /**
   * Hook 5: Garage upgrade installed (for Master Mechanic)
   * @param {number} count Total installed upgrades
   */
  notifyUpgradesChanged(count) {
    if (count >= 5) {
      this.unlock('master_mechanic');
    }
  }
}
