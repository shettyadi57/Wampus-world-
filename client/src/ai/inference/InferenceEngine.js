/**
 * client/src/ai/inference/InferenceEngine.js
 * ─────────────────────────────────────────────────────────────
 * Client adapter for Stage 1 InferenceEngine.
 * Executes Horn-clause forward-chaining deduction over KnowledgeBase.
 */

import { InferenceEngine as EngineInference } from '../../../../engine/InferenceEngine.js';

export class ClientInferenceEngine {
  /**
   * @param {import('../../../../engine/RoadGraph.js').RoadGraph} graph
   * @param {import('./knowledge/KnowledgeBase.js').ClientKnowledgeBase} kb
   */
  constructor(graph, kb) {
    this.graph = graph;
    this.kb = kb;
    const rawKB = kb.engineKB ?? kb;
    this._engineInference = new EngineInference(graph, rawKB);

    if (typeof kb.setInferenceEngine === 'function') {
      kb.setInferenceEngine(this._engineInference);
    }
  }

  get engineInference() {
    return this._engineInference;
  }

  processArrival(nodeId, percepts) {
    this._engineInference.processArrival(nodeId, percepts);
  }

  classifyNode(nodeId) {
    const b = this.kb.getBelief(nodeId);
    if (!b) return 'unknown';
    if (b.safe === true) return 'safe';
    if (b.pit_confirmed || b.hunter_confirmed) return 'unsafe';
    return 'unknown';
  }
}

/**
 * @param {import('./knowledge/KnowledgeBase.js').ClientKnowledgeBase} kb
 * @param {import('../../../../engine/RoadGraph.js').RoadGraph} [graph]
 * @returns {Promise<ClientInferenceEngine>}
 */
export async function initInference(kb, graph = null) {
  const g = graph ?? kb._graph;
  const inference = new ClientInferenceEngine(g, kb);
  console.log('[ai/inference] Stage 1 InferenceEngine adapter initialised');
  return inference;
}
