/**
 * RiskModel.js
 * ─────────────────────────────────────────────────────────────
 * Quantifies the danger of each candidate action and produces a
 * ranked action set for the AI Driver to execute.
 *
 * The risk model sits between InferenceEngine and the ActuatorBus:
 *   InferenceEngine classifies nodes → RiskModel scores actions →
 *   AIDriver selects and issues actuator commands.
 *
 * Risk scoring approach (constraint-based, not statistical ML):
 *   • Each candidate move target node gets a risk score ∈ [0, 1].
 *   • Score 0.0 = provably safe (visited, no hazards inferred).
 *   • Score 1.0 = provably lethal (confirmed Pit or confirmed Wampus).
 *   • Score in (0, 1) = uncertain — risk proportional to unresolved
 *     constraint count.
 *   • Utility = (expected reward) / (1 + risk).
 *   • Agent always chooses max-utility safe move; falls back to
 *     min-risk uncertain move if no safe move exists.
 */

/** @typedef {import('../knowledge/KnowledgeBase.js').KnowledgeBaseContext} KBContext */
/** @typedef {import('../inference/InferenceEngine.js').InferenceContext} InferenceContext */

/**
 * @typedef {Object} RankedAction
 * @property {string} actionType   – 'move' | 'scan' | 'interact' | 'shoot'
 * @property {string} [targetNode] – for 'move' actions
 * @property {number} risk         – ∈ [0, 1]
 * @property {number} utility      – ∈ [0, ∞)
 */

/**
 * @typedef {Object} RiskModelContext
 * @property {function(string[]): RankedAction[]} rankActions
 *   candidateNodeIds → ranked list of actions (best first)
 */

/**
 * @param {KBContext} kb
 * @param {InferenceContext} inference
 * @returns {Promise<RiskModelContext>}
 */
export async function initRisk(kb, inference) {
  // TODO: implement constraint-based utility scoring.
  console.log('[ai/risk] RiskModel initialised (stub)');
  return {
    rankActions: (candidates) => candidates.map((id) => ({
      actionType: 'move', targetNode: id, risk: 0.5, utility: 0.5,
    })),
  };
}
