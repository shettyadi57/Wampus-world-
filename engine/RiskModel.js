/**
 * RiskModel.js
 * ─────────────────────────────────────────────────────────────
 * Risk scoring and route recommendation.
 *
 * All scoring is constraint-based. No LLM, no hardcoded flavor text,
 * no statistical ML. Risk is derived entirely from OR-clause structure
 * and proven KB facts.
 *
 * Composite risk score for a candidate node:
 *   risk = clamp(
 *     hazardProb * 0.60   +   // dominant term: known danger
 *     distNorm   * 0.15   +   // travel cost
 *     fuelCost   * 0.10   -   // fuel penalty
 *     infoGain   * 0.15       // exploration bonus (negative risk)
 *   , 0, 1)
 *
 * Hazard probability:
 *   confirmed          → 1.0
 *   in OR-clause(s)    → 1 / (mean candidates across all clauses containing node)
 *   no evidence        → 0.0
 *
 * Information gain heuristic:
 *   Count of unknown-safety neighbours that would be resolved by visiting.
 *   Normalised to [0, 1] over 4 potential neighbours.
 *
 * Reason strings are constructed from the actual evidence list, not templates.
 */

export class RiskModel {
  /**
   * @param {import('./RoadGraph.js').RoadGraph} graph
   * @param {import('./KnowledgeBase.js').KnowledgeBase} kb
   */
  constructor(graph, kb) {
    this._graph = graph;
    this._kb    = kb;
  }

  /**
   * Score a single candidate node for the agent to move into.
   *
   * @param {string} nodeId           – candidate target node
   * @param {{ agentNode: string, fuelRemaining?: number }} opts
   * @returns {{ risk: number, confidence: number, reason: string }}
   *   risk ∈ [0, 1], confidence ∈ [0, 100], reason: evidence-derived string
   */
  scoreNode(nodeId, { agentNode, fuelRemaining = Infinity }) {
    const b = this._kb.getBelief(nodeId);

    // ── Hazard probability ──────────────────────────────────────────
    let hazardProb = 0;
    if (b.pit_confirmed || b.hunter_confirmed) {
      hazardProb = 1.0;
    } else if (b.pit_possible || b.hunter_possible) {
      hazardProb = this._estimateHazardProb(nodeId);
    }
    // Proven safe nodes: hazardProb remains 0.

    // ── Distance (BFS hop count, normalised over 10) ───────────────
    const dist     = this._bfsHops(agentNode, nodeId);
    const distNorm = Math.min(dist / 10, 1.0);

    // ── Fuel cost ──────────────────────────────────────────────────
    const edgeDist = this._graph.getDistance(agentNode, nodeId);
    const fuelCost =
      fuelRemaining === Infinity ? 0 : Math.min(edgeDist / fuelRemaining, 1.0);

    // ── Information gain ───────────────────────────────────────────
    const infoGain = (b.safe === null) ? this._estimateInfoGain(nodeId) : 0;

    // ── Composite risk score ───────────────────────────────────────
    const rawRisk =
      hazardProb * 0.60 +
      distNorm   * 0.15 +
      fuelCost   * 0.10 -
      infoGain   * 0.15;

    const risk = Math.min(1, Math.max(0, rawRisk));

    // ── Confidence (0–100) ─────────────────────────────────────────
    let confidence;
    if (b.pit_confirmed || b.hunter_confirmed) {
      confidence = 100; // confirmed dangerous
    } else if (b.safe === true) {
      confidence = 100; // confirmed safe
    } else if (!b.pit_possible && !b.hunter_possible && b.evidence.length > 0) {
      confidence = 95;  // all evidence says safe, not yet visited
    } else {
      confidence = Math.round(Math.max(0, Math.min(100, b.confidence * 100)));
    }

    // ── Reason string from actual evidence ─────────────────────────
    const reason = this._buildReason(nodeId, b, hazardProb, dist, infoGain);

    return { risk, confidence, reason };
  }

  /**
   * Rank all neighbours of agentNode by utility (best first).
   * Utility = (explorationBonus + objectiveBonus) / (1 + risk)
   *
   * @param {string} agentNode
   * @param {{ fuelRemaining?: number }} [opts]
   * @returns {Array<{nodeId:string, risk:number, confidence:number, reason:string, utility:number}>}
   */
  rankNeighbors(agentNode, opts = {}) {
    const neighbors = this._graph.getNeighbors(agentNode);

    return neighbors
      .map(nodeId => {
        const score = this.scoreNode(nodeId, { agentNode, ...opts });
        const b     = this._kb.getBelief(nodeId);

        // Prefer unexplored safe nodes; reward objective node.
        const explorationBonus = (b.safe === true && !b.visited) ? 0.30 : 0;
        const objectiveBonus   = (this._kb.objectiveNode === nodeId) ? 0.50 : 0;
        const utility          =
          (explorationBonus + objectiveBonus) / (1 + score.risk);

        return { nodeId, ...score, utility };
      })
      .sort((a, b) => b.utility - a.utility);
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────

  /**
   * Estimate hazard probability for a node that is only "possible."
   * Uses OR-clause sizes: P(node is hazard) ≈ 1 / mean_clause_size.
   * Takes the maximum estimate across pit and hunter clauses.
   */
  _estimateHazardProb(nodeId) {
    const b = this._kb.getBelief(nodeId);
    let maxProb = 0;

    if (b.pit_possible) {
      maxProb = Math.max(maxProb,
        this._probFromClauses(nodeId, this._kb._pitClauses));
    }
    if (b.hunter_possible) {
      maxProb = Math.max(maxProb,
        this._probFromClauses(nodeId, this._kb._hunterClauses));
    }
    return Math.min(maxProb, 1.0);
  }

  /** 1 / (mean clause-size for clauses containing nodeId) */
  _probFromClauses(nodeId, clauseMap) {
    let total = 0, count = 0;
    for (const clause of clauseMap.values()) {
      if (clause.candidates.has(nodeId)) {
        total += clause.candidates.size;
        count++;
      }
    }
    if (count === 0) return 0.5; // no clause info — prior
    return 1 / (total / count);
  }

  /**
   * Estimate information gain: how many currently-unknown neighbours of
   * nodeId would become resolvable if we visit nodeId and observe percepts.
   * Normalised to [0, 1] over 4 neighbours.
   */
  _estimateInfoGain(nodeId) {
    const neighbors = this._graph.getNeighbors(nodeId);
    const unknown   = neighbors.filter(n => this._kb.getBelief(n).safe === null);
    return Math.min(unknown.length / 4, 1.0);
  }

  /**
   * BFS hop count from `from` to `to` on the current passable graph.
   * Returns Infinity if unreachable.
   */
  _bfsHops(from, to) {
    if (from === to) return 0;
    const visited = new Set([from]);
    const queue   = [[from, 0]];
    while (queue.length) {
      const [node, d] = queue.shift();
      for (const n of this._graph.getNeighbors(node)) {
        if (n === to) return d + 1;
        if (!visited.has(n)) { visited.add(n); queue.push([n, d + 1]); }
      }
    }
    return Infinity;
  }

  /**
   * Build a reason string from the node's actual evidence list.
   * No canned templates — every clause is derived from real percept data.
   */
  _buildReason(nodeId, b, hazardProb, dist, infoGain) {
    const parts = [];

    if (b.pit_confirmed) {
      const clauseEv = b.evidence.filter(e => e.startsWith('or_clause_collapse'));
      const breezeEv = b.evidence.filter(e => e.startsWith('breeze_at'));
      parts.push(
        `PIT CONFIRMED — collapsed from: ${breezeEv.join(', ')}` +
        (clauseEv.length ? `; via ${clauseEv.join(', ')}` : '')
      );
    } else if (b.hunter_confirmed) {
      const clauseEv = b.evidence.filter(e => e.startsWith('or_clause_collapse'));
      const stenchEv = b.evidence.filter(e => e.startsWith('stench_at'));
      parts.push(
        `HUNTER CONFIRMED — collapsed from: ${stenchEv.join(', ')}` +
        (clauseEv.length ? `; via ${clauseEv.join(', ')}` : '')
      );
    } else if (b.safe === true) {
      const safeEv = b.evidence.filter(
        e => e.startsWith('no_breeze') || e.startsWith('no_stench') || e === 'visited'
      );
      parts.push(`safe; proven by: ${safeEv.join(', ') || '(none)'}`);
    } else {
      if (b.pit_possible) {
        const src = b.evidence.filter(e => e.startsWith('breeze_at'));
        parts.push(
          `pit possible (est. ${(hazardProb * 100).toFixed(0)}%) — evidence: ${src.join(', ')}`
        );
      }
      if (b.hunter_possible) {
        const src = b.evidence.filter(e => e.startsWith('stench_at'));
        parts.push(`hunter possible — evidence: ${src.join(', ')}`);
      }
      if (parts.length === 0) parts.push('no evidence — prior unknown');
    }

    if (dist > 1)       parts.push(`${dist} hops from agent`);
    if (infoGain > 0.1) parts.push(`info gain ${(infoGain * 100).toFixed(0)}%`);

    return parts.join('; ');
  }
}
