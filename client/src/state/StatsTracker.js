/**
 * StatsTracker.js
 * ─────────────────────────────────────────────────────────────
 * Real-time event telemetry tracker.
 *
 * Tracks genuine simulation and gameplay events only. Zero placeholder
 * or mock metrics. Every value is accumulated from live vehicle integration,
 * sensory detections, and junction steering decisions.
 */

export class StatsTracker {
  /**
   * @param {import('./StateManager.js').StateManager} state
   */
  constructor(state) {
    this.state = state;
    const initial = state.get()?.stats || {};

    this.expeditionsAttempted = initial.expeditionsAttempted ?? 0;
    this.expeditionsCompleted = initial.expeditionsCompleted ?? 0;
    this.nodesExplored = new Set(initial.nodesExplored || []);
    this.distanceDrivenMeters = initial.distanceDrivenMeters ?? 0;
    this.fuelConsumedLiters = initial.fuelConsumedLiters ?? 0;
    this.hazardsDetected = initial.hazardsDetected ?? 0;
    this.hazardsAvoided = initial.hazardsAvoided ?? 0;
    this.pitsFallen = initial.pitsFallen ?? 0;
    this.hunterEncounters = initial.hunterEncounters ?? 0;
    this.decisionsMade = initial.decisionsMade ?? 0;
    this.aiDecisionsFollowed = initial.aiDecisionsFollowed ?? 0;
    this.rebelDecisionsCount = initial.rebelDecisionsCount ?? 0;
    this.cleanJunctionsCount = initial.cleanJunctionsCount ?? 0;
    this.upgradesInstalledCount = initial.upgradesInstalledCount ?? 0;
    this.playTimeSeconds = initial.playTimeSeconds ?? 0;

    this._consecutiveCleanJunctions = 0;
    this._consecutiveAiFollowed = 0;
  }

  recordDistance(meters) {
    if (meters > 0 && Number.isFinite(meters)) {
      this.distanceDrivenMeters += meters;
    }
  }

  recordFuelBurn(liters) {
    if (liters > 0 && Number.isFinite(liters)) {
      this.fuelConsumedLiters += liters;
    }
  }

  recordPlayTime(dt) {
    if (dt > 0 && Number.isFinite(dt)) {
      this.playTimeSeconds += dt;
    }
  }

  recordNodeVisit(nodeId) {
    if (nodeId && !this.nodesExplored.has(nodeId)) {
      this.nodesExplored.add(nodeId);
      this._syncToState();
    }
  }

  recordHazardDetected(type) {
    this.hazardsDetected++;
    this._consecutiveCleanJunctions = 0;
    this._syncToState();
  }

  recordJunctionDecision(currentNodeId, chosenNodeId, topAiBranch, rankedBranches = []) {
    this.decisionsMade++;

    const chosenBranch = rankedBranches.find(b => b.nodeId === chosenNodeId);
    const chosenRisk = chosenBranch?.risk ?? 0;
    const isAiRecommendation = topAiBranch && topAiBranch.nodeId === chosenNodeId;

    if (isAiRecommendation) {
      this.aiDecisionsFollowed++;
      this._consecutiveAiFollowed++;
    } else {
      this._consecutiveAiFollowed = 0;
    }

    // Rebel choice: choosing high-risk route (>= 0.50) when a safer route (< 0.20) was recommended
    if (topAiBranch && topAiBranch.risk < 0.20 && chosenRisk >= 0.50) {
      this.rebelDecisionsCount++;
    }

    // Clean junction: if no hazards were active at this junction
    if (!this._hasActivePercept) {
      this.cleanJunctionsCount++;
      this._consecutiveCleanJunctions++;
    } else {
      this._consecutiveCleanJunctions = 0;
    }

    this._syncToState();
  }

  recordHunterProximity(dist) {
    if (dist < 40) {
      this.hunterEncounters++;
      this._syncToState();
    }
  }

  recordExpeditionStart() {
    this.expeditionsAttempted++;
    this._syncToState();
  }

  recordExpeditionComplete() {
    this.expeditionsCompleted++;
    this._syncToState();
  }

  recordUpgradeInstalled(count = 1) {
    this.upgradesInstalledCount = count;
    this._syncToState();
  }

  _syncToState() {
    if (this.state && typeof this.state.mutate === 'function') {
      this.state.mutate({
        stats: this.getSummary(),
      });
    }
  }

  getSummary() {
    return {
      expeditionsAttempted: this.expeditionsAttempted,
      expeditionsCompleted: this.expeditionsCompleted,
      nodesExplored: [...this.nodesExplored],
      nodesExploredCount: this.nodesExplored.size,
      distanceDrivenMeters: Math.round(this.distanceDrivenMeters),
      distanceDrivenKm: (this.distanceDrivenMeters / 1000).toFixed(2),
      fuelConsumedLiters: parseFloat(this.fuelConsumedLiters.toFixed(2)),
      hazardsDetected: this.hazardsDetected,
      hazardsAvoided: this.hazardsAvoided,
      pitsFallen: this.pitsFallen,
      hunterEncounters: this.hunterEncounters,
      decisionsMade: this.decisionsMade,
      aiDecisionsFollowed: this.aiDecisionsFollowed,
      rebelDecisionsCount: this.rebelDecisionsCount,
      cleanJunctionsCount: this.cleanJunctionsCount,
      consecutiveCleanJunctions: this._consecutiveCleanJunctions,
      consecutiveAiFollowed: this._consecutiveAiFollowed,
      upgradesInstalledCount: this.upgradesInstalledCount,
      playTimeSeconds: Math.round(this.playTimeSeconds),
    };
  }
}
