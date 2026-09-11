/**
 * client/src/ai/knowledge/KnowledgeBase.js
 * ─────────────────────────────────────────────────────────────
 * Client adapter for Stage 1 KnowledgeBase.
 * Populated exclusively by physical sensor percepts.
 */

import { KnowledgeBase as EngineKB } from '../../../../engine/KnowledgeBase.js';
import { RoadGraph } from '../../../../engine/RoadGraph.js';

export class ClientKnowledgeBase {
  /**
   * @param {RoadGraph} [graph]
   */
  constructor(graph = null) {
    this._graph = graph ?? new RoadGraph();
    this._engineKB = new EngineKB(this._graph);
    this._log = [];
    this._inferenceEngine = null;
  }

  setInferenceEngine(engine) {
    this._inferenceEngine = engine;
  }

  get engineKB() {
    return this._engineKB;
  }

  ingest(perceptFrame) {
    if (!perceptFrame) return;
    this._log.push({ ...perceptFrame });

    if (this._inferenceEngine && perceptFrame.nodeId) {
      this._inferenceEngine.processArrival(perceptFrame.nodeId, perceptFrame);
    }
  }

  isSafe(nodeId) {
    return this._engineKB.getBelief(nodeId)?.safe === true;
  }

  hasPit(nodeId) {
    return this._engineKB.getBelief(nodeId)?.pit_confirmed === true;
  }

  getWampusNode() {
    for (const [id, belief] of this._engineKB._beliefs) {
      if (belief.hunter_confirmed) return id;
    }
    return null;
  }

  getBelief(nodeId) {
    return this._engineKB.getBelief(nodeId);
  }

  snapshot() {
    return this._engineKB.snapshot();
  }

  getLog() {
    return [...this._log];
  }

  reset() {
    this._log = [];
    this._engineKB = new EngineKB(this._graph);
  }
}

/**
 * @param {RoadGraph} [graph]
 * @returns {Promise<ClientKnowledgeBase>}
 */
export async function initKnowledge(graph = null) {
  const kb = new ClientKnowledgeBase(graph);
  console.log('[ai/knowledge] Stage 1 KnowledgeBase adapter initialised');
  return kb;
}
