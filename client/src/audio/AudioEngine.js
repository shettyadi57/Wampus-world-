/**
 * AudioEngine.js
 * ─────────────────────────────────────────────────────────────
 * Owns all audio: spatial 3-D sound, music, and UI sound effects.
 * Built on the Web Audio API; Three.js PositionalAudio for 3-D
 * placement of diegetic sounds.
 *
 * Audio is an output-only subsystem — it listens to game events
 * (emitted by ActuatorBus, MissionController, etc.) and plays
 * the appropriate sounds. It never mutates game state.
 *
 * Asset conventions:
 *   Audio files live in /assets/audio/.
 *   Format priority: OGG Vorbis → MP3 (fallback for Safari).
 *   All engine / tyre sounds are looping and pitch-shifted by speed.
 */

/**
 * @typedef {Object} AudioEngineContext
 * @property {function(string, Object): void} play
 *   (soundId, options?: { position, volume, loop }) → void
 * @property {function(string): void} stop    – stop a looping sound
 * @property {function(number): void} setMasterVolume  – 0..1
 * @property {function(): void} suspendContext  – pause AudioContext
 * @property {function(): void} resumeContext   – resume AudioContext
 */

/**
 * @returns {Promise<AudioEngineContext>}
 */
export async function initAudio() {
  // TODO: create AudioContext, load AudioBuffer bank (ogg/mp3),
  //       set up master gain chain, subscribe to game events.
  console.log('[audio] AudioEngine initialised (stub)');
  return {
    play:            () => {},
    stop:            () => {},
    setMasterVolume: () => {},
    suspendContext:  () => {},
    resumeContext:   () => {},
  };
}
