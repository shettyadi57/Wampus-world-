/**
 * KnowledgeBase.js
 * ─────────────────────────────────────────────────────────────
 * Per-node belief state and OR-clause constraint store.
 *
 * Belief state per node:
 *   visited          – agent has been here and survived
 *   safe             – proven free of all hazards
 *   pit_safe         – proven to contain no pit (from no-breeze rule)
 *   pit_possible     – at least one percept suggests pit might be here
 *   pit_confirmed    – OR-clause collapsed; pit is here with certainty
 *   hunter_safe      – proven to contain no hunter (from no-stench rule)
 *   hunter_possible  – at least one percept suggests hunter might be here
 *   hunter_confirmed – OR-clause collapsed; hunter is here with certainty
 *   evidence[]       – ordered list of evidence strings (built from actual percepts)
 *   confidence       – float ∈ [0,1]; 1.0 when fully resolved
 *
 * OR-clauses:
 *   Each breeze/stench percept creates an OR-clause: "at least one of
 *   these candidate nodes contains the hazard." When a candidate is
 *   proven hazard-free, it is removed from the clause. When only one
 *   candidate remains, that node is confirmed.
 *
 *   Pit clauses and hunter clauses are stored separately.
 *   Removal from a pit clause is triggered by pit_safe, not by full
 *   node safety — these are independent constraints.
 */

export class KnowledgeBase {
  /**
   * @param {import('./RoadGraph.js').RoadGraph} graph
   */
  constructor(graph) {
    this._graph = graph;

    /** @type {Map<string, NodeBelief>} */
    this._beliefs = new Map();

    /** @type {Map<string, {id:string, sourceNode:string, candidates:Set<string>}>} */
    this._pitClauses = new Map();

    /** @type {Map<string, {id:string, sourceNode:string, candidates:Set<string>}>} */
    this._hunterClauses = new Map();

    this._clauseCounter = 0;

    /** Confirmed objective (gold) location — set by glitter at current node. */
    this.objectiveNode = null;

    /** Set true when SCREAM percept received — hunter globally eliminated. */
    this.hunterDead = false;

    // Pre-populate beliefs for known graph nodes.
    for (const id of graph.nodeIds) {
      this._beliefs.set(id, createBelief(id));
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Public query API
  // ─────────────────────────────────────────────────────────────────

  /**
   * Returns the belief record for a node, creating one on demand if
   * the node was not in the original graph (future extensibility).
   * @param {string} nodeId
   * @returns {NodeBelief}
   */
  getBelief(nodeId) {
    if (!this._beliefs.has(nodeId)) {
      this._beliefs.set(nodeId, createBelief(nodeId));
    }
    return this._beliefs.get(nodeId);
  }

  /**
   * Snapshot of all beliefs (shallow-clone for debugging / tests).
   * @returns {Object.<string, NodeBelief>}
   */
  snapshot() {
    const out = {};
    for (const [id, b] of this._beliefs) out[id] = { ...b };
    return out;
  }

  // ─────────────────────────────────────────────────────────────────
  // Write operations — called exclusively by InferenceEngine
  // ─────────────────────────────────────────────────────────────────

  /**
   * Mark a node as visited (agent is alive here → it is safe).
   * Idempotent.
   * @param {string} nodeId
   */
  markVisited(nodeId) {
    const b = this.getBelief(nodeId);
    b.visited      = true;
    b.safe         = true;
    b.pit_safe     = true;
    b.hunter_safe  = true;
    b.pit_possible = false;
    b.hunter_possible = false;
    b.confidence   = 1.0;
    if (!b.evidence.includes('visited')) b.evidence.push('visited');

    // Surviving here proves no hazard → remove from ALL clauses.
    this._removePitFreeFromPitClauses(nodeId);
    this._removeHunterFreeFromHunterClauses(nodeId);
  }

  /**
   * Definitively rule out a pit at nodeId.
   * Called when no-breeze is perceived at a neighbour.
   * @param {string} nodeId
   * @param {string} sourceNode – the node where no-breeze was sensed
   */
  setPitImpossible(nodeId, sourceNode) {
    const b = this.getBelief(nodeId);
    if (b.pit_safe) return;          // already proven pit-free
    if (b.pit_confirmed) return;     // contradiction — world must be well-formed

    b.pit_safe     = true;
    b.pit_possible = false;
    const ev = `no_breeze_at_${sourceNode}`;
    if (!b.evidence.includes(ev)) b.evidence.push(ev);

    this._checkAutoSafe(nodeId);
    // Remove from all pit clauses — may trigger collapse.
    this._removePitFreeFromPitClauses(nodeId);
  }

  /**
   * Record that nodeId might contain a pit (from a breeze observation).
   * @param {string} nodeId
   * @param {string} sourceNode – the node where breeze was sensed
   */
  setPitPossible(nodeId, sourceNode) {
    const b = this.getBelief(nodeId);
    if (b.pit_safe)      return; // proven pit-free; positive evidence cannot override
    if (b.pit_confirmed) return; // already confirmed — no need to re-flag

    b.pit_possible = true;
    const ev = `breeze_at_${sourceNode}`;
    if (!b.evidence.includes(ev)) b.evidence.push(ev);
    this._updateConfidence(nodeId);
  }

  /**
   * Confirm a pit at nodeId (OR-clause collapse).
   * @param {string} nodeId
   * @param {string} reason
   */
  setPitConfirmed(nodeId, reason) {
    const b = this.getBelief(nodeId);
    b.pit_possible  = true;
    b.pit_confirmed = true;
    b.safe          = false;
    b.confidence    = 1.0;
    if (!b.evidence.includes(reason)) b.evidence.push(reason);
  }

  /**
   * Definitively rule out a hunter at nodeId.
   * @param {string} nodeId
   * @param {string} sourceNode – the node where no-stench was sensed
   */
  setHunterImpossible(nodeId, sourceNode) {
    const b = this.getBelief(nodeId);
    if (b.hunter_safe)      return;
    if (b.hunter_confirmed) return;

    b.hunter_safe     = true;
    b.hunter_possible = false;
    const ev = `no_stench_at_${sourceNode}`;
    if (!b.evidence.includes(ev)) b.evidence.push(ev);

    this._checkAutoSafe(nodeId);
    this._removeHunterFreeFromHunterClauses(nodeId);
  }

  /**
   * Record that nodeId might contain a hunter (from a stench observation).
   * @param {string} nodeId
   * @param {string} sourceNode
   */
  setHunterPossible(nodeId, sourceNode) {
    const b = this.getBelief(nodeId);
    if (b.hunter_safe)      return;
    if (b.hunter_confirmed) return;

    b.hunter_possible = true;
    const ev = `stench_at_${sourceNode}`;
    if (!b.evidence.includes(ev)) b.evidence.push(ev);
    this._updateConfidence(nodeId);
  }

  /**
   * Confirm a hunter at nodeId (OR-clause collapse).
   * @param {string} nodeId
   * @param {string} reason
   */
  setHunterConfirmed(nodeId, reason) {
    const b = this.getBelief(nodeId);
    b.hunter_possible  = true;
    b.hunter_confirmed = true;
    b.safe             = false;
    b.confidence       = 1.0;
    if (!b.evidence.includes(reason)) b.evidence.push(reason);
  }

  // ─────────────────────────────────────────────────────────────────
  // OR-clause management
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a pit OR-clause: "at least one of candidateIds contains a pit."
   * Candidates already proven pit-free are excluded before insertion.
   * If only 1 candidate remains after filtering, it is immediately confirmed.
   *
   * @param {string[]} candidateIds
   * @param {string} sourceNode – node where breeze was sensed
   * @returns {string|null} clause ID, or null if no useful clause created
   */
  addPitOrClause(candidateIds, sourceNode) {
    // Filter out nodes already proven pit-free or already confirmed.
    const candidates = new Set(
      candidateIds.filter(n => {
        const b = this.getBelief(n);
        return !b.pit_safe; // pit_confirmed is still a valid candidate
      })
    );

    if (candidates.size === 0) return null;

    const id = `pit_c${++this._clauseCounter}`;
    this._pitClauses.set(id, { id, sourceNode, candidates });
    this._propagatePitClause(id);  // immediate collapse check
    return id;
  }

  /**
   * Add a hunter OR-clause: "at least one of candidateIds contains a hunter."
   *
   * @param {string[]} candidateIds
   * @param {string} sourceNode – node where stench was sensed
   * @returns {string|null}
   */
  addHunterOrClause(candidateIds, sourceNode) {
    const candidates = new Set(
      candidateIds.filter(n => {
        const b = this.getBelief(n);
        return !b.hunter_safe;
      })
    );

    if (candidates.size === 0) return null;

    const id = `hunter_c${++this._clauseCounter}`;
    this._hunterClauses.set(id, { id, sourceNode, candidates });
    this._propagateHunterClause(id);
    return id;
  }

  /**
   * Full constraint-propagation sweep. Run until no new facts are derived.
   * Called at end of processArrival for any deferred propagation.
   */
  propagateConstraints() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...this._pitClauses.keys()]) {
        if (this._propagatePitClause(id)) changed = true;
      }
      for (const id of [...this._hunterClauses.keys()]) {
        if (this._propagateHunterClause(id)) changed = true;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────

  /**
   * Remove a node from all pit OR-clauses (because it is now pit_safe).
   * After each removal, check whether the clause should collapse.
   */
  _removePitFreeFromPitClauses(nodeId) {
    for (const [id, clause] of this._pitClauses) {
      if (clause.candidates.has(nodeId)) {
        clause.candidates.delete(nodeId);
        this._propagatePitClause(id);
      }
    }
  }

  /**
   * Remove a node from all hunter OR-clauses (because it is now hunter_safe).
   */
  _removeHunterFreeFromHunterClauses(nodeId) {
    for (const [id, clause] of this._hunterClauses) {
      if (clause.candidates.has(nodeId)) {
        clause.candidates.delete(nodeId);
        this._propagateHunterClause(id);
      }
    }
  }

  /**
   * Evaluate a pit OR-clause after a candidate was removed.
   *   size = 0 → delete clause (contradiction; should not occur in valid world)
   *   size = 1 → the remaining candidate MUST be the pit → confirm it
   *   size > 1 → nothing new to derive yet
   * @returns {boolean} true if a new fact was derived
   */
  _propagatePitClause(clauseId) {
    const clause = this._pitClauses.get(clauseId);
    if (!clause) return false;

    if (clause.candidates.size === 0) {
      this._pitClauses.delete(clauseId);
      return false;
    }

    if (clause.candidates.size === 1) {
      const [lastNode] = clause.candidates;
      const b = this.getBelief(lastNode);
      if (!b.pit_confirmed) {
        const reason =
          `or_clause_collapse:${clauseId}(source:${clause.sourceNode})`;
        this.setPitConfirmed(lastNode, reason);
        this._pitClauses.delete(clauseId);
        return true;
      }
      this._pitClauses.delete(clauseId); // already confirmed — clean up
    }
    return false;
  }

  /**
   * Evaluate a hunter OR-clause after a candidate was removed.
   * @returns {boolean}
   */
  _propagateHunterClause(clauseId) {
    const clause = this._hunterClauses.get(clauseId);
    if (!clause) return false;

    if (clause.candidates.size === 0) {
      this._hunterClauses.delete(clauseId);
      return false;
    }

    if (clause.candidates.size === 1) {
      const [lastNode] = clause.candidates;
      const b = this.getBelief(lastNode);
      if (!b.hunter_confirmed) {
        const reason =
          `or_clause_collapse:${clauseId}(source:${clause.sourceNode})`;
        this.setHunterConfirmed(lastNode, reason);
        this._hunterClauses.delete(clauseId);
        return true;
      }
      this._hunterClauses.delete(clauseId);
    }
    return false;
  }

  /**
   * Mark safe=true if BOTH pit and hunter are definitively ruled out.
   * @param {string} nodeId
   */
  _checkAutoSafe(nodeId) {
    const b = this.getBelief(nodeId);
    if (b.safe === true) return;
    if (b.pit_safe && b.hunter_safe) {
      b.safe       = true;
      b.confidence = 1.0;
    }
  }

  /**
   * Recompute confidence heuristic for an uncertain node.
   * Confidence = 1 − max(pitProb, hunterProb)
   * where probability is estimated as 1 / (mean clause size for this node).
   */
  _updateConfidence(nodeId) {
    const b = this.getBelief(nodeId);
    if (b.safe || b.pit_confirmed || b.hunter_confirmed) {
      b.confidence = 1.0;
      return;
    }

    const pitProb = b.pit_possible
      ? this._hazardProbFromClauses(nodeId, this._pitClauses)
      : 0;

    const hunterProb = b.hunter_possible
      ? this._hazardProbFromClauses(nodeId, this._hunterClauses)
      : 0;

    b.confidence = 1 - Math.max(pitProb, hunterProb);
  }

  /**
   * Estimate probability this node is the hazard: 1 / (avg clause size).
   * Uniform prior within each OR-clause.
   */
  _hazardProbFromClauses(nodeId, clauseMap) {
    let total = 0, count = 0;
    for (const clause of clauseMap.values()) {
      if (clause.candidates.has(nodeId)) {
        total += clause.candidates.size;
        count++;
      }
    }
    if (count === 0) return 0.5; // no clause info → prior
    return 1 / (total / count);  // 1 / average-clause-size
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} NodeBelief
 * @property {string}  nodeId
 * @property {boolean} visited
 * @property {boolean|null} safe           – null = unknown
 * @property {boolean} pit_safe            – proven no pit
 * @property {boolean} pit_possible
 * @property {boolean} pit_confirmed
 * @property {boolean} hunter_safe         – proven no hunter
 * @property {boolean} hunter_possible
 * @property {boolean} hunter_confirmed
 * @property {string[]} evidence
 * @property {number}  confidence          – ∈ [0, 1]
 */

/** @returns {NodeBelief} */
function createBelief(id) {
  return {
    nodeId:           id,
    visited:          false,
    safe:             null,   // null = unknown; true = safe; false = confirmed hazard
    pit_safe:         false,
    pit_possible:     false,
    pit_confirmed:    false,
    hunter_safe:      false,
    hunter_possible:  false,
    hunter_confirmed: false,
    evidence:         [],
    confidence:       0.5,    // prior: maximum uncertainty
  };
}
