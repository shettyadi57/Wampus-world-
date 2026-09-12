/**
 * AudioEngine.js
 * ─────────────────────────────────────────────────────────────
 * Production Procedural Web Audio Synthesizer for Wampus World.
 *
 * Capabilities:
 *   1. Multi-bus gain routing (Master, Engine, SFX, Ambient, Drone).
 *   2. Procedural Engine Tone: continuous dual oscillator reacting to RPM, throttle load & speed.
 *   3. Dynamic Tire / Brake Screech: modulated filtered noise reacting to deceleration & lateral slip.
 *   4. Heavy Collision / Impact Synthesizer: sub-bass drop + crunch noise burst mapped to impact velocity.
 *   5. Weather Ambience: continuous synthesized wind generator with gusting LFO filter modulation.
 *   6. AI Tactical Chimes: melodic arpeggios for safe route, alert beeps for hazards, decision pings.
 *   7. Hunter Dread Drone: volume and resonant low-pass filter cutoff mapped dynamically to real Hunter distance.
 *   8. Accessibility Cue Emitter: notifies subtitle/caption listeners for all auditory events.
 *   9. Dynamic volume controls for Master, Engine, SFX, and Ambient channels.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this._initialized = false;
    this.isMuted = false;

    // Bus gains
    this.masterGain = null;
    this.engineBus = null;
    this.sfxBus = null;
    this.ambientBus = null;
    this.droneBus = null;

    // Volumes (0.0 to 1.0)
    this.volumes = {
      master: 0.8,
      engine: 0.7,
      sfx: 0.85,
      ambient: 0.6,
      drone: 0.75,
    };

    // Engine sound nodes
    this._engineOsc1 = null;
    this._engineOsc2 = null;
    this._engineFilter = null;
    this._engineGain = null;
    this._engineRunning = false;

    // Tire screech nodes
    this._tireFilter = null;
    this._tireGain = null;
    this._tireNoiseNode = null;
    this._tireRunning = false;

    // Weather ambience nodes
    this._ambientFilter = null;
    this._ambientGain = null;
    this._ambientNoiseNode = null;
    this._ambientRunning = false;

    // Hunter dread drone nodes
    this._droneOsc1 = null;
    this._droneOsc2 = null;
    this._droneFilter = null;
    this._droneGain = null;
    this._droneRunning = false;
    this._lastHunterDist = Infinity;
    this._hunterAlertFired = false;

    // Accessibility caption listeners
    this.captionListeners = new Set();
  }

  /**
   * Register a caption listener callback: (caption: string, type: string) => void
   */
  onCaption(listener) {
    if (typeof listener === 'function') {
      this.captionListeners.add(listener);
    }
  }

  offCaption(listener) {
    this.captionListeners.delete(listener);
  }

  emitCaption(text, type = 'sfx') {
    for (const listener of this.captionListeners) {
      try {
        listener(text, type);
      } catch (err) {
        console.warn('[audio] Caption listener error:', err);
      }
    }
  }

  _initContext() {
    if (this._initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();

      // Master bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volumes.master, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Sub buses
      this.engineBus = this.ctx.createGain();
      this.engineBus.gain.setValueAtTime(this.volumes.engine, this.ctx.currentTime);
      this.engineBus.connect(this.masterGain);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.setValueAtTime(this.volumes.sfx, this.ctx.currentTime);
      this.sfxBus.connect(this.masterGain);

      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.setValueAtTime(this.volumes.ambient, this.ctx.currentTime);
      this.ambientBus.connect(this.masterGain);

      this.droneBus = this.ctx.createGain();
      this.droneBus.gain.setValueAtTime(this.volumes.drone, this.ctx.currentTime);
      this.droneBus.connect(this.masterGain);

      this._initialized = true;
      console.log('[audio] Web Audio multi-bus context initialised');

      // Start continuous procedural synthesizers
      this._startEngineSynth();
      this._startTireSynth();
      this._startAmbientSynth();
      this._startDroneSynth();
    } catch (e) {
      console.warn('[audio] Web Audio failed to initialise:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // ─── Volume Controls ─────────────────────────────────────────

  setMasterVolume(val) {
    this.volumes.master = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volumes.master, this.ctx.currentTime, 0.05);
    }
  }

  setEngineVolume(val) {
    this.volumes.engine = Math.max(0, Math.min(1, val));
    if (this.engineBus && this.ctx) {
      this.engineBus.gain.setTargetAtTime(this.volumes.engine, this.ctx.currentTime, 0.05);
    }
  }

  setSFXVolume(val) {
    this.volumes.sfx = Math.max(0, Math.min(1, val));
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, this.ctx.currentTime, 0.05);
    }
  }

  setAmbientVolume(val) {
    this.volumes.ambient = Math.max(0, Math.min(1, val));
    if (this.ambientBus && this.ctx) {
      this.ambientBus.gain.setTargetAtTime(this.volumes.ambient, this.ctx.currentTime, 0.05);
    }
  }

  setVolumes(settings = {}) {
    if (settings.master !== undefined) this.setMasterVolume(settings.master);
    if (settings.engine !== undefined) this.setEngineVolume(settings.engine);
    if (settings.sfx !== undefined) this.setSFXVolume(settings.sfx);
    if (settings.ambient !== undefined) this.setAmbientVolume(settings.ambient);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volumes.master, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // ─── Procedural Continuous Engine Synthesizer ─────────────────

  _startEngineSynth() {
    if (this._engineRunning || !this.ctx) return;

    this._engineOsc1 = this.ctx.createOscillator();
    this._engineOsc2 = this.ctx.createOscillator();
    this._engineFilter = this.ctx.createBiquadFilter();
    this._engineGain = this.ctx.createGain();

    this._engineOsc1.type = 'sawtooth';
    this._engineOsc2.type = 'triangle';

    // Base idle frequency
    this._engineOsc1.frequency.setValueAtTime(42, this.ctx.currentTime);
    this._engineOsc2.frequency.setValueAtTime(21, this.ctx.currentTime); // sub-octave rumble

    this._engineFilter.type = 'lowpass';
    this._engineFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
    this._engineFilter.Q.setValueAtTime(3.2, this.ctx.currentTime);

    this._engineGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    this._engineOsc1.connect(this._engineFilter);
    this._engineOsc2.connect(this._engineFilter);
    this._engineFilter.connect(this._engineGain);
    this._engineGain.connect(this.engineBus);

    this._engineOsc1.start();
    this._engineOsc2.start();
    this._engineRunning = true;
  }

  /**
   * Updates engine pitch, filter cutoff, and throttle roar.
   * @param {number} rpmNorm Normalized RPM (0.0 to 1.0)
   * @param {number} throttle Current throttle demand (0.0 to 1.0)
   * @param {number} speedKph Speed in km/h
   */
  updateEngine(rpmNorm = 0, throttle = 0, speedKph = 0) {
    if (!this._engineRunning || !this.ctx) return;

    const t = this.ctx.currentTime;
    const clampedRpm = Math.max(0, Math.min(1, rpmNorm));
    const clampedThrottle = Math.max(0, Math.min(1, throttle));

    // Base pitch: 42 Hz at idle up to 240 Hz at redline
    const targetFreq1 = 42 + clampedRpm * 190 + clampedThrottle * 20;
    const targetFreq2 = targetFreq1 * 0.5;

    // Filter opens with throttle demand: 200 Hz muffled idle -> 2400 Hz wide open
    const targetCutoff = 220 + clampedThrottle * 1800 + clampedRpm * 600;

    // Gain scales with load
    const targetGain = 0.16 + clampedThrottle * 0.22 + clampedRpm * 0.12;

    this._engineOsc1.frequency.setTargetAtTime(targetFreq1, t, 0.06);
    this._engineOsc2.frequency.setTargetAtTime(targetFreq2, t, 0.06);
    this._engineFilter.frequency.setTargetAtTime(targetCutoff, t, 0.05);
    this._engineGain.gain.setTargetAtTime(targetGain, t, 0.05);
  }

  // ─── Procedural Tire / Brake Screech ─────────────────────────

  _startTireSynth() {
    if (this._tireRunning || !this.ctx) return;

    // 2-second looped noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this._tireNoiseNode = this.ctx.createBufferSource();
    this._tireNoiseNode.buffer = noiseBuffer;
    this._tireNoiseNode.loop = true;

    this._tireFilter = this.ctx.createBiquadFilter();
    this._tireFilter.type = 'bandpass';
    this._tireFilter.frequency.setValueAtTime(2400, this.ctx.currentTime);
    this._tireFilter.Q.setValueAtTime(6.0, this.ctx.currentTime);

    this._tireGain = this.ctx.createGain();
    this._tireGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this._tireNoiseNode.connect(this._tireFilter);
    this._tireFilter.connect(this._tireGain);
    this._tireGain.connect(this.sfxBus);

    this._tireNoiseNode.start();
    this._tireRunning = true;
  }

  /**
   * Updates tire screech based on braking demand and lateral slip.
   * @param {boolean} isBraking
   * @param {number} speedKph
   * @param {boolean} isDrifting
   */
  updateTires(isBraking = false, speedKph = 0, isDrifting = false) {
    if (!this._tireRunning || !this.ctx) return;

    const t = this.ctx.currentTime;
    const active = (isBraking && speedKph > 12) || (isDrifting && speedKph > 8);

    if (active) {
      const intensity = Math.min(1.0, speedKph / 55);
      const targetGain = 0.18 + intensity * 0.18;
      const targetFreq = 1900 + intensity * 1200;

      this._tireGain.gain.setTargetAtTime(targetGain, t, 0.08);
      this._tireFilter.frequency.setTargetAtTime(targetFreq, t, 0.08);

      if (!this._lastTireCaptionTime || Date.now() - this._lastTireCaptionTime > 4000) {
        this.emitCaption(isDrifting ? '[Tires: Lateral traction slide]' : '[Brakes: Friction lockup deceleration]', 'vehicle');
        this._lastTireCaptionTime = Date.now();
      }
    } else {
      this._tireGain.gain.setTargetAtTime(0.0001, t, 0.12);
    }
  }

  // ─── Heavy Collision / Impact Synthesizer ────────────────────

  /**
   * Collision impact sound mapped to impact speed.
   * @param {number} [speedKph=25]
   */
  playCollision(speedKph = 25) {
    this._initContext();
    if (!this.ctx) return;

    const intensity = Math.min(1.5, Math.max(0.3, speedKph / 30));
    const t = this.ctx.currentTime;

    // 1. Sub-bass punch oscillator (130 Hz -> 32 Hz)
    const punchOsc = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();

    punchOsc.type = 'triangle';
    punchOsc.frequency.setValueAtTime(140 * intensity, t);
    punchOsc.frequency.exponentialRampToValueAtTime(28, t + 0.35);

    punchGain.gain.setValueAtTime(0.6 * intensity, t);
    punchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    punchOsc.connect(punchGain);
    punchGain.connect(this.sfxBus);

    punchOsc.start(t);
    punchOsc.stop(t + 0.45);

    // 2. Fracture/crunch noise burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.25);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800 * intensity, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5 * intensity, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxBus);

    noise.start(t);
    noise.stop(t + 0.26);

    this.emitCaption(`[Impact: Collision contact (${Math.round(speedKph)} km/h)]`, 'hazard');
  }

  // ─── Procedural Weather Ambience ──────────────────────────────

  _startAmbientSynth() {
    if (this._ambientRunning || !this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const out = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    // Pink noise filter
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      out[i] = (b0 + b1 + b2) * 0.25;
    }

    this._ambientNoiseNode = this.ctx.createBufferSource();
    this._ambientNoiseNode.buffer = buffer;
    this._ambientNoiseNode.loop = true;

    this._ambientFilter = this.ctx.createBiquadFilter();
    this._ambientFilter.type = 'lowpass';
    this._ambientFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this._ambientFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this._ambientGain = this.ctx.createGain();
    this._ambientGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    this._ambientNoiseNode.connect(this._ambientFilter);
    this._ambientFilter.connect(this._ambientGain);
    this._ambientGain.connect(this.ambientBus);

    this._ambientNoiseNode.start();
    this._ambientRunning = true;
  }

  /**
   * Updates wind gust modulation based on vehicle speed and mountain weather.
   * @param {number} speedKph
   */
  updateWeather(speedKph = 0) {
    if (!this._ambientRunning || !this.ctx) return;

    const t = this.ctx.currentTime;
    // Slow gust oscillation (LFO effect via time sine)
    const gust = (Math.sin(t * 0.4) + Math.sin(t * 0.85)) * 0.5 + 0.5;
    const speedEffect = Math.min(1.0, speedKph / 100);

    const targetFreq = 260 + gust * 280 + speedEffect * 500;
    const targetGain = 0.18 + gust * 0.12 + speedEffect * 0.2;

    this._ambientFilter.frequency.setTargetAtTime(targetFreq, t, 0.2);
    this._ambientGain.gain.setTargetAtTime(targetGain, t, 0.2);
  }

  // ─── Tactical AI Chimes ───────────────────────────────────────

  /**
   * Tactical AI audio chimes.
   * @param {'safe'|'warning'|'decision'} type
   */
  playAIChime(type = 'safe') {
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    if (type === 'safe') {
      // Ascending crystalline arpeggio: D5 (587Hz) -> A5 (880Hz) -> D6 (1174Hz)
      const notes = [587.3, 880.0, 1174.6];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.07);

        gain.gain.setValueAtTime(0.001, t + idx * 0.07);
        gain.gain.linearRampToValueAtTime(0.2, t + idx * 0.07 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.07 + 0.5);

        osc.connect(gain);
        gain.connect(this.sfxBus);

        osc.start(t + idx * 0.07);
        osc.stop(t + idx * 0.07 + 0.55);
      });
      this.emitCaption('[AI Co-Pilot: Safe route verified by deduction]', 'ai');

    } else if (type === 'warning') {
      // Dissonant tactical warning ping: 740 Hz -> 880 Hz square
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(740, t);
      osc.frequency.setValueAtTime(880, t + 0.08);

      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxBus);

      osc.start(t);
      osc.stop(t + 0.25);
      this.emitCaption('[AI Co-Pilot: Threat hazard detected ahead]', 'ai');

    } else {
      // Single tactical decision confirmation blip (660 Hz sine)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxBus);

      osc.start(t);
      osc.stop(t + 0.14);
      this.emitCaption('[AI Driver: Vector trajectory committed]', 'ai');
    }
  }

  // ─── Continuous Hunter Dread Drone ────────────────────────────

  _startDroneSynth() {
    if (this._droneRunning || !this.ctx) return;

    this._droneOsc1 = this.ctx.createOscillator();
    this._droneOsc2 = this.ctx.createOscillator();
    this._droneFilter = this.ctx.createBiquadFilter();
    this._droneGain = this.ctx.createGain();

    this._droneOsc1.type = 'sawtooth';
    this._droneOsc2.type = 'triangle';

    // Sub-bass dissonance: 38 Hz & 57 Hz (tritone relationship)
    this._droneOsc1.frequency.setValueAtTime(38, this.ctx.currentTime);
    this._droneOsc2.frequency.setValueAtTime(57.2, this.ctx.currentTime);

    this._droneFilter.type = 'lowpass';
    this._droneFilter.frequency.setValueAtTime(55, this.ctx.currentTime);
    this._droneFilter.Q.setValueAtTime(5.5, this.ctx.currentTime); // resonant snarl

    this._droneGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this._droneOsc1.connect(this._droneFilter);
    this._droneOsc2.connect(this._droneFilter);
    this._droneFilter.connect(this._droneGain);
    this._droneGain.connect(this.droneBus);

    this._droneOsc1.start();
    this._droneOsc2.start();
    this._droneRunning = true;
  }

  /**
   * Maps Hunter distance dynamically to dread drone volume and lowpass resonance.
   * @param {number} hunterDistance Distance in meters
   */
  updateHunterDrone(hunterDistance = Infinity) {
    if (!this._droneRunning || !this.ctx) return;

    const t = this.ctx.currentTime;
    this._lastHunterDist = hunterDistance;

    // Hunter distance mapped:
    // > 90m: silent (gain ~ 0)
    // 90m -> 15m: gain swells exponentially up to 0.42, filter opens from 55 Hz to 520 Hz
    if (hunterDistance > 90 || !Number.isFinite(hunterDistance)) {
      this._droneGain.gain.setTargetAtTime(0.0001, t, 0.3);
      this._droneFilter.frequency.setTargetAtTime(55, t, 0.3);
      this._hunterAlertFired = false;
    } else {
      const proximity = Math.max(0, Math.min(1, (90 - hunterDistance) / 75));
      const targetGain = Math.pow(proximity, 1.8) * 0.42;
      const targetCutoff = 55 + Math.pow(proximity, 1.5) * 480;

      this._droneGain.gain.setTargetAtTime(targetGain, t, 0.1);
      this._droneFilter.frequency.setTargetAtTime(targetCutoff, t, 0.1);

      // Critical proximity warning caption (< 25m)
      if (hunterDistance < 25 && !this._hunterAlertFired) {
        this.emitCaption(`[Hunter Dread: Entity nearby (${Math.round(hunterDistance)}m) — proximity critical!]`, 'hazard');
        this._hunterAlertFired = true;
      }
    }
  }

  // ─── Hazard & Game Percept Audio Cues ─────────────────────────

  playBreeze() {
    this._initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.85);

    this.emitCaption('[Sensor: Barometric pressure drop — pit cavity nearby]', 'sensor');
  }

  playStench() {
    this._initContext();
    if (!this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime);
    osc2.frequency.setValueAtTime(58.5, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.32, this.ctx.currentTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxBus);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 1.25);
    osc2.stop(this.ctx.currentTime + 1.25);

    this.emitCaption('[Sensor: Thermal air stench — Hunter pheromone signature]', 'sensor');
  }

  playGlitter() {
    this._initContext();
    if (!this.ctx) return;

    const freqs = [880, 1320, 1760];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.001, this.ctx.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + idx * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + idx * 0.08 + 0.6);

      osc.connect(gain);
      gain.connect(this.sfxBus);

      osc.start(this.ctx.currentTime + idx * 0.08);
      osc.stop(this.ctx.currentTime + idx * 0.08 + 0.65);
    });

    this.emitCaption('[Sensor: Objective beacon resonance — checkpoint in range]', 'sensor');
  }

  playBump() {
    this._initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);

    this.emitCaption('[Actuator: Chassis bump obstacle contact]', 'hazard');
  }

  playHorn() {
    this._initContext();
    if (!this.ctx) return;

    [440, 554].forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxBus);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    });

    this.emitCaption('[Horn: Acoustic blast]', 'vehicle');
  }

  playClick() {
    this._initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playAlert() {
    this._initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(740, this.ctx.currentTime);
    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);

    this.emitCaption('[Alert: Priority tactical alert]', 'system');
  }

  playAchievement() {
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Grand triumphant fanfare arpeggio: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
    const chord = [523.25, 659.25, 783.99, 1046.50];
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.09);

      gain.gain.setValueAtTime(0.001, t + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.25, t + idx * 0.09 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.09 + 0.7);

      osc.connect(gain);
      gain.connect(this.sfxBus);

      osc.start(t + idx * 0.09);
      osc.stop(t + idx * 0.09 + 0.75);
    });

    this.emitCaption('[Achievement: Directives Accomplished!]', 'system');
  }
}

/**
 * @returns {Promise<AudioEngine>}
 */
export async function initAudio() {
  const audio = new AudioEngine();
  // Enable audio context on first user click or keydown (browser autoplay policy)
  const unlock = () => {
    audio._initContext();
    audio.resume();
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('click', unlock);
  window.addEventListener('keydown', unlock);

  return audio;
}
