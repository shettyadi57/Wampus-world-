/**
 * InferenceEngine.js
 * ─────────────────────────────────────────────────────────────
 * Symbolic, constraint-based reasoning over the KnowledgeBase.
 *
 * DESIGN MANDATE: This is a REAL reasoning system.
 *   • No LLM calls.
 *   • No hard-coded flavor text substituting for inference.
 *   • No lookup tables disguised as AI.
 *
 * The engine applies logical rules (Horn clauses / forward chaining)
 * to derive new facts from percepts and asserts them back into the KB.
 *
 * Core inference rules (illustrative, non-exhaustive):
 *
 *   ∀n: visited(n) ∧ ¬breeze(n)  → ∀adj(n): ¬pit(adj)
 *   ∀n: visited(n) ∧ ¬stench(n)  → ∀adj(n): ¬wampus(adj)
 *   ∀n: visited(n) ∧ breeze(n)   → ∃adj(n): pit(adj)   [probabilistic]
 *   ∀n: visited(n) ∧ stench(n)   → ∃adj(n): wampus(adj)[probabilistic]
 *   scream()                      → wampusDead := true
 *
 * Glitter is NOT a neighbour inference.
 * Glitter at node n → gold IS at n (same-node fact, not neighbour).
 */

/** @typedef {import('./knowledge/KnowledgeBase.js').KnowledgeBaseContext} KBContext */

/**
 * @typedef {Object} InferenceContext
 * @property {function(): void} reason  – run one inference cycle over KB
 * @property {function(string): 'safe'|'unsafe'|'unknown'} classifyNode
 */

/**
 * @param {KBContext} kb
 * @returns {Promise<InferenceContext>}
 */
export async function initInference(kb) {
  // TODO: implement forward-chaining rule engine.
  //       Rules are encoded as pure functions: (KB) → new facts.
  console.log('[ai/inference] InferenceEngine initialised (stub)');
  return {
    reason:       () => {},
    classifyNode: () => 'unknown',
  };
}
