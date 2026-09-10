/**
 * knowledgeBase.test.js
 * Unit tests for KnowledgeBase percept ingestion and fact queries.
 *
 * Run: npm test
 */

import { initKnowledge } from '../../client/src/ai/knowledge/KnowledgeBase.js';
import {
  PERCEPT_CLEAR,
  PERCEPT_BREEZE,
  PERCEPT_STENCH,
  PERCEPT_GLITTER,
  PERCEPT_SCREAM,
} from '../fixtures/percept.fixture.js';

describe('KnowledgeBase', () => {
  let kb;

  beforeEach(async () => {
    kb = await initKnowledge();
    kb.reset();
  });

  test('starts with no confirmed facts', () => {
    expect(kb.isSafe('r1c1')).toBe(false);
    expect(kb.hasPit('r1c1')).toBe(false);
    expect(kb.getWampusNode()).toBeNull();
  });

  test('ingest clears the percept log on reset', () => {
    kb.ingest(PERCEPT_CLEAR);
    kb.reset();
    expect(kb.getLog()).toHaveLength(0);
  });

  test('ingest BREEZE records the breeze node', () => {
    kb.ingest(PERCEPT_BREEZE);
    const log = kb.getLog();
    expect(log).toHaveLength(1);
    expect(log[0].breeze).toBe(true);
    expect(log[0].nodeId).toBe('r1c2');
  });

  test('GLITTER percept is same-node — not a neighbour inference', () => {
    // Glitter at r3c3 means gold IS at r3c3.
    // This test confirms the log records glitter=true at the CURRENT node,
    // not at a neighbour. Inference rules tested in inferenceEngine.test.js.
    kb.ingest(PERCEPT_GLITTER);
    const log = kb.getLog();
    expect(log[0].glitter).toBe(true);
    expect(log[0].nodeId).toBe('r3c3');
  });

  test('SCREAM percept is global broadcast', () => {
    kb.ingest(PERCEPT_SCREAM);
    // Wampus dead flag should be assertable after inference cycle
    // (tested in inferenceEngine.test.js). KB just logs the frame.
    const log = kb.getLog();
    expect(log[0].scream).toBe(true);
  });
});
