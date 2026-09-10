/**
 * KnowledgeBase.js
 * ─────────────────────────────────────────────────────────────
 * The agent's world model — the ONLY place where inferred facts
 * about the world are stored and queried.
 *
 * The KB is populated exclusively by:
 *   1. Percept frames delivered by SensorArray
 *   2. Logical consequences derived by InferenceEngine
 *
 * It NEVER reads WorldManager directly. The world is a black box
 * from the agent's perspective.
 *
 * Data model:
 *   visited    : Set<nodeId>      – nodes the vehicle has entered
 *   safeNodes  : Set<nodeId>      – nodes proven free of Pit & Wampus
 *   pitNodes   : Set<nodeId>      – nodes confirmed to contain a Pit
 *   wampusNode : nodeId | null    – confirmed Wampus location (if known)
 *   breezeNodes: Set<nodeId>      – nodes where BREEZE was perceived
 *   stenchNodes: Set<nodeId>      – nodes where STENCH was perceived
 *   goldFound  : boolean          – whether GLITTER was perceived (same node)
 *   wampusDead : boolean          – whether SCREAM was received
 *   perceptLog : PerceptFrame[]   – full chronological percept history
 */

/** @typedef {import('../sensors/SensorArray.js').PerceptFrame} PerceptFrame */

/**
 * @typedef {Object} KnowledgeBaseContext
 * @property {function(PerceptFrame): void} ingest   – add a percept frame
 * @property {function(string): boolean} isSafe       – is node provably safe?
 * @property {function(string): boolean} hasPit       – is pit confirmed?
 * @property {function(): string|null} getWampusNode  – confirmed location or null
 * @property {function(): PerceptFrame[]} getLog      – full percept history
 * @property {function(): void} reset                 – clear for new game
 */

/**
 * @returns {Promise<KnowledgeBaseContext>}
 */
export async function initKnowledge() {
  // TODO: implement fact storage, update logic, and query methods.
  console.log('[ai/knowledge] KnowledgeBase initialised (stub)');
  return {
    ingest:        () => {},
    isSafe:        () => false,
    hasPit:        () => false,
    getWampusNode: () => null,
    getLog:        () => [],
    reset:         () => {},
  };
}
