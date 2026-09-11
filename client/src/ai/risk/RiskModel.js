/**
 * client/src/ai/risk/RiskModel.js
 * ─────────────────────────────────────────────────────────────
 * Client adapter for Stage 1 RiskModel.
 * Scores risk and utility for candidate moves based on OR-clauses and proven facts.
 */

import { RiskModel as EngineRiskModel } from '../../../../engine/RiskModel.js';

export class ClientRiskModel {
  /**
   * @param {import('../../../../engine/RoadGraph.js').RoadGraph} graph
   * @param {import('../knowledge/KnowledgeBase.js').ClientKnowledgeBase} kb
   */
  constructor(graph, kb) {
    this.graph = graph;
    this.kb = kb;
    const rawKB = kb.engineKB ?? kb;
    this._engineRisk = new EngineRiskModel(graph, rawKB);
  }

  get engineRisk() {
    return this._engineRisk;
  }

  scoreNode(nodeId, opts) {
    return this._engineRisk.scoreNode(nodeId, opts);
  }

  rankNeighbors(agentNode, opts = {}) {
    return this._engineRisk.rankNeighbors(agentNode, opts);
  }
}

/**
 * @param {import('../knowledge/KnowledgeBase.js').ClientKnowledgeBase} kb
 * @param {Object} inference
 * @param {import('../../../../engine/RoadGraph.js').RoadGraph} [graph]
 * @returns {Promise<ClientRiskModel>}
 */
export async function initRisk(kb, inference, graph = null) {
  const g = graph ?? kb._graph;
  const risk = new ClientRiskModel(g, kb);
  console.log('[ai/risk] Stage 1 RiskModel adapter initialised');
  return risk;
}
