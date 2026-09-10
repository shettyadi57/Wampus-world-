/**
 * InferenceEngine.js
 * ─────────────────────────────────────────────────────────────
 * Processes percept frames and updates the KnowledgeBase.
 *
 * Agent loop (called once per node arrival):
 *
 *   processArrival(nodeId, percepts)
 *     1. markVisited(nodeId) — agent is alive here; node is safe
 *     2. Negative (definitive) inference:
 *          ¬breeze(n) → ∀ adj(n): pit_safe    [remove from pit clauses]
 *          ¬stench(n) → ∀ adj(n): hunter_safe [remove from hunter clauses]
 *        Negative inference runs FIRST so that when positive inference
 *        later creates OR-clauses, it can immediately filter out nodes
 *        just proven safe.
 *     3. Positive (possibility) inference:
 *          breeze(n)  → ∃ adj(n): pit    [add pit OR-clause over unsafe neighbors]
 *          stench(n)  → ∃ adj(n): hunter [add hunter OR-clause over unsafe neighbors]
 *     4. Same-node percepts:
 *          glitter    → objectiveNode = n  (NOT neighbors)
 *     5. Edge percept:
 *          bump       → mark edge impassable (NOT hazard evidence)
 *     6. Global percept:
 *          scream     → hunterDead = true; clear all hunter_possible
 *     7. Final propagateConstraints() sweep.
 *
 * No LLM calls. No hardcoded flavor text. No lookup tables.
 */

export class InferenceEngine {
  /**
   * @param {import('./RoadGraph.js').RoadGraph} graph
   * @param {import('./KnowledgeBase.js').KnowledgeBase} kb
   */
  constructor(graph, kb) {
    this._graph = graph;
    this._kb    = kb;
  }

  /**
   * Process the agent arriving at nodeId with the given percept frame.
   *
   * @param {string} nodeId – the node just entered
   * @param {{
   *   breeze?:      boolean,
   *   stench?:      boolean,
   *   glitter?:     boolean,
   *   bump?:        boolean,
   *   bumpedFrom?:  string,   // node the agent tried to move from
   *   scream?:      boolean,
   * }} [percepts]
   */
  processArrival(nodeId, percepts = {}) {
    const {
      breeze     = false,
      stench     = false,
      glitter    = false,
      bump       = false,
      bumpedFrom = null,
      scream     = false,
    } = percepts;

    // ── 1. Mark this node visited (agent is alive → definitively safe) ──
    this._kb.markVisited(nodeId);

    const neighbors = this._graph.getNeighbors(nodeId);

    // ── 2. Negative (definitive) inference — run before positive ──
    if (!breeze) this._noBreeze(nodeId, neighbors);
    if (!stench) this._noStench(nodeId, neighbors);

    // ── 3. Positive (possibility) inference ──
    if (breeze)  this._breeze(nodeId, neighbors);
    if (stench)  this._stench(nodeId, neighbors);

    // ── 4. Same-node: Glitter → objective is HERE, never a neighbour ──
    if (glitter) this._glitter(nodeId);

    // ── 5. Edge: Bump → mark impassable (no hazard inference) ──
    if (bump && bumpedFrom) this._bump(bumpedFrom, nodeId);

    // ── 6. Global: Scream → hunter eliminated ──
    if (scream) this._scream();

    // ── 7. Final propagation sweep ──
    this._kb.propagateConstraints();
  }

  // ─────────────────────────────────────────────────────────────────
  // Private inference handlers
  // ─────────────────────────────────────────────────────────────────

  /**
   * ¬breeze(n) → ∀ adj(n): ¬pit
   * This is DEFINITIVE: every neighbour is provably pit-free.
   */
  _noBreeze(nodeId, neighbors) {
    for (const n of neighbors) {
      this._kb.setPitImpossible(n, nodeId);
    }
  }

  /**
   * breeze(n) → ∃ adj(n): pit
   * At least one non-safe neighbour has a pit; create an OR-clause.
   * Neighbours already proven safe are excluded from the clause.
   */
  _breeze(nodeId, neighbors) {
    // Candidates: neighbours not yet proven pit-free.
    const candidates = neighbors.filter(n => !this._kb.getBelief(n).pit_safe);

    for (const n of candidates) {
      this._kb.setPitPossible(n, nodeId);
    }

    if (candidates.length > 0) {
      this._kb.addPitOrClause(candidates, nodeId);
    }
  }

  /**
   * ¬stench(n) → ∀ adj(n): ¬hunter
   */
  _noStench(nodeId, neighbors) {
    for (const n of neighbors) {
      this._kb.setHunterImpossible(n, nodeId);
    }
  }

  /**
   * stench(n) → ∃ adj(n): hunter
   */
  _stench(nodeId, neighbors) {
    const candidates = neighbors.filter(n => !this._kb.getBelief(n).hunter_safe);

    for (const n of candidates) {
      this._kb.setHunterPossible(n, nodeId);
    }

    if (candidates.length > 0) {
      this._kb.addHunterOrClause(candidates, nodeId);
    }
  }

  /**
   * glitter(n) → objective_at(n)
   *
   * CRITICAL: This is a SAME-NODE fact. The objective is at n, not at
   * any neighbour of n. No OR-clause. No propagation to adjacent nodes.
   */
  _glitter(nodeId) {
    this._kb.objectiveNode = nodeId;
    const b = this._kb.getBelief(nodeId);
    if (!b.evidence.includes('glitter_here')) {
      b.evidence.push('glitter_here');
    }
  }

  /**
   * bump(edge a→b) → edge is impassable
   *
   * Bump is a spatial percept about an EDGE, not about a NODE hazard.
   * It gives zero information about pits or hunters. Do NOT add to
   * any OR-clause; do NOT set pit_possible or hunter_possible.
   */
  _bump(fromNode, toNode) {
    this._graph.markEdgeImpassable(fromNode, toNode);
    // Record as an edge-level fact, not a node hazard.
    const b = this._kb.getBelief(toNode);
    const ev = `impassable_from_${fromNode}`;
    if (!b.evidence.includes(ev)) b.evidence.push(ev);
  }

  /**
   * scream() → hunter_dead = true (global broadcast)
   *
   * Clears all hunter_possible flags that have not already been
   * confirmed (a confirmed hunter is now dead — both can be true).
   * This is a GLOBAL percept with no node locality.
   */
  _scream() {
    this._kb.hunterDead = true;
    for (const [nodeId, belief] of this._kb._beliefs) {
      if (!belief.hunter_confirmed) {
        belief.hunter_possible = false;
        if (!belief.evidence.includes('scream_broadcast')) {
          belief.evidence.push('scream_broadcast');
        }
        // If already pit_safe, node may now be safe too.
        this._kb._checkAutoSafe(nodeId);
      }
    }
    // Clear all open hunter OR-clauses (hunter is dead — no longer relevant).
    this._kb._hunterClauses.clear();
  }
}
