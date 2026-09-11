/**
 * UIManager.js
 * ─────────────────────────────────────────────────────────────
 * Driving modes (DRIVER, AI DRIVER, CO-PILOT), live 5-stage
 * ANALYSIS MODE pipeline, telemetry HUD, and Developer Debug overlay.
 */

import { DIFFICULTY_TIERS } from '../state/DifficultyConfig.js';

export class UIManager {
  /**
   * @param {Object} state
   * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
   * @param {import('../actuators/ActuatorBus.js').ActuatorBus} actuators
   * @param {Object} [options]
   */
  constructor(state, vehicle, actuators, options = {}) {
    this.state = state;
    this.vehicle = vehicle;
    this.actuators = actuators;
    this.options = options;

    this.aiDriver = options.aiDriver ?? null;
    this.riskModel = options.riskModel ?? null;
    this.kb = options.kb ?? null;
    this.sensors = options.sensors ?? null;
    this.hunter = options.hunter ?? null;
    this.world = options.world ?? null;

    // Modes: 'driver' | 'co_pilot' | 'ai_driver'
    this.mode = 'driver';

    // UI Panel visibility toggles
    this.showAnalysisMode = false;
    this.showDebugMode = false;
    this.isPaused = false;
    this.keysPressed = new Set();

    this._mountHUD();
    this._bindKeyboard();
  }

  setAIDriver(aiDriver) {
    this.aiDriver = aiDriver;
  }

  setMode(mode) {
    if (this.mode === 'ai_driver' && mode !== 'ai_driver') {
      if (this.aiDriver) this.aiDriver.disable();
    }
    this.mode = mode;
    if (this.mode === 'ai_driver') {
      if (this.aiDriver) this.aiDriver.enable();
    }
    console.log(`[ui] Driving mode switched to: ${this.mode.toUpperCase()}`);
  }

  cycleMode() {
    const modes = ['driver', 'co_pilot', 'ai_driver'];
    const nextIdx = (modes.indexOf(this.mode) + 1) % modes.length;
    this.setMode(modes[nextIdx]);
    return this.mode;
  }

  _mountHUD() {
    this.container = document.getElementById('ui-overlay');
    if (!this.container) return;

    // Left Telemetry & Co-Pilot Panel
    this.hudElement = document.createElement('div');
    this.hudElement.className = 'hud-panel';
    this.hudElement.style.top = '12px';
    this.hudElement.style.left = '12px';
    this.hudElement.style.maxWidth = '380px';
    this.hudElement.style.fontFamily = 'monospace';
    this.hudElement.style.lineHeight = '1.45';

    // Right Mission Panel
    this.missionElement = document.createElement('div');
    this.missionElement.className = 'hud-panel';
    this.missionElement.style.top = '12px';
    this.missionElement.style.right = '12px';
    this.missionElement.style.fontFamily = 'monospace';
    this.missionElement.style.lineHeight = '1.45';

    // Center-Bottom Live Analysis Mode Pipeline Panel
    this.analysisElement = document.createElement('div');
    this.analysisElement.className = 'hud-panel';
    this.analysisElement.style.bottom = '12px';
    this.analysisElement.style.left = '50%';
    this.analysisElement.style.transform = 'translateX(-50%)';
    this.analysisElement.style.width = '880px';
    this.analysisElement.style.maxHeight = '240px';
    this.analysisElement.style.overflowY = 'auto';
    this.analysisElement.style.fontFamily = 'monospace';
    this.analysisElement.style.fontSize = '12px';
    this.analysisElement.style.display = 'none';

    // Developer Debug Overlay (unreachable in normal play)
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'hud-panel';
    this.debugOverlay.style.bottom = '12px';
    this.debugOverlay.style.right = '12px';
    this.debugOverlay.style.maxWidth = '420px';
    this.debugOverlay.style.background = 'rgba(30, 10, 10, 0.88)';
    this.debugOverlay.style.border = '1px solid #ff4444';
    this.debugOverlay.style.fontFamily = 'monospace';
    this.debugOverlay.style.fontSize = '11px';
    this.debugOverlay.style.display = 'none';

    this.container.appendChild(this.hudElement);
    this.container.appendChild(this.missionElement);
    this.container.appendChild(this.analysisElement);
    this.container.appendChild(this.debugOverlay);
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;

      // ── Developer Debug Mode specific key combo: Ctrl + Shift + D OR Backquote ──
      if ((e.ctrlKey && e.shiftKey && code === 'KeyD') || code === 'Backquote') {
        e.preventDefault();
        this.showDebugMode = !this.showDebugMode;
        if (this.debugOverlay) {
          this.debugOverlay.style.display = this.showDebugMode ? 'block' : 'none';
        }
        console.log(`[ui] Developer debug overlay toggled: ${this.showDebugMode}`);
        return;
      }

      if (this.keysPressed.has(code)) return;
      this.keysPressed.add(code);

      // Driving Mode switch (KeyM)
      if (code === 'KeyM') {
        this.cycleMode();
        return;
      }

      // Analysis Mode toggle (KeyI)
      if (code === 'KeyI') {
        this.showAnalysisMode = !this.showAnalysisMode;
        if (this.analysisElement) {
          this.analysisElement.style.display = this.showAnalysisMode ? 'block' : 'none';
        }
        console.log(`[ui] Live Analysis Mode pipeline toggled: ${this.showAnalysisMode}`);
        return;
      }

      // Difficulty tier switches (Digit 1-4)
      if (code === 'Digit1') this._setTier('easy');
      if (code === 'Digit2') this._setTier('normal');
      if (code === 'Digit3') this._setTier('hard');
      if (code === 'Digit4') this._setTier('nightmare');

      // Manual actuator controls (active in DRIVER and CO-PILOT modes)
      if (this.mode !== 'ai_driver') {
        if (code === 'KeyW' || code === 'ArrowUp') this.actuators.accelerate(1.0);
        if (code === 'KeyS' || code === 'ArrowDown') this.actuators.brake(1.0);
        if (code === 'KeyA' || code === 'ArrowLeft') this.actuators.steer(-1.0);
        if (code === 'KeyD' || code === 'ArrowRight') this.actuators.steer(1.0);
        if (code === 'Space') { e.preventDefault(); this.actuators.handbrake(); }
        if (code === 'Tab') { e.preventDefault(); this.actuators.reverse(); }
      }

      // Common utility actuators
      if (code === 'KeyE') this.actuators.interact();
      if (code === 'KeyR') { if (this.vehicle) this.vehicle.resetTo(); }
      if (code === 'KeyL') this.actuators.toggleHeadlights();
      if (code === 'KeyH') this.actuators.horn();

      // Camera cycle (C / V)
      if (code === 'KeyC' || code === 'KeyV') {
        if (this.options.graphics?.cameraController) {
          this.options.graphics.cameraController.cycleMode();
        }
      }

      // Pause
      if (code === 'Escape') {
        this.isPaused = !this.isPaused;
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      this.keysPressed.delete(code);

      if (this.mode !== 'ai_driver') {
        if (code === 'KeyW' || code === 'ArrowUp') this.actuators.accelerate(0.0);
        if (code === 'KeyS' || code === 'ArrowDown') this.actuators.brake(0.0);

        if (code === 'KeyA' || code === 'ArrowLeft' || code === 'KeyD' || code === 'ArrowRight') {
          const left = this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft');
          const right = this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight');
          if (left && !right) this.actuators.steer(-1.0);
          else if (right && !left) this.actuators.steer(1.0);
          else this.actuators.steer(0.0);
        }
      }
    });
  }

  _setTier(tierId) {
    if (this.sensors) this.sensors.setDifficulty(tierId);
    if (this.hunter) this.hunter.setDifficulty(DIFFICULTY_TIERS[tierId]);
  }

  updateHUD(data) {
    if (!this.hudElement || !data) return;

    const speed = data.speedKph.toFixed(0);
    const fuel = data.fuelRemaining.toFixed(1);
    const gear = data.reverse ? 'R' : 'D';
    const hb = data.handbrake ? 'LOCKED' : 'OFF';
    const lights = data.headlights ? 'ON' : 'OFF';
    const cam = (data.cameraMode || 'chase').toUpperCase();

    const modeLabels = {
      driver: '<span style="color:#00e5ff;font-weight:bold">DRIVER (MANUAL)</span>',
      co_pilot: '<span style="color:#ffb700;font-weight:bold">CO-PILOT (AI ASSIST)</span>',
      ai_driver: '<span style="color:#00ff66;font-weight:bold">AI DRIVER (AUTONOMOUS)</span>',
    };

    const p = data.percepts || {};
    const breezeStr = p.breeze ? '<span style="color:#44bbff;font-weight:bold">BREEZE</span>' : '---';
    const stenchStr = p.stench ? '<span style="color:#44ff44;font-weight:bold">STENCH</span>' : '---';
    const glitterStr = p.glitter ? '<span style="color:#ffcc00;font-weight:bold">GLITTER</span>' : '---';
    const bumpStr = p.bump ? '<span style="color:#ff4444;font-weight:bold">BUMP!</span>' : '---';

    // Co-pilot live recommendation calculation
    let coPilotHtml = '';
    let topRecommendation = null;

    if (this.riskModel && p.nodeId) {
      const ranked = this.riskModel.rankNeighbors(p.nodeId, {
        fuelRemaining: this.vehicle?.fuelRemaining ?? 100,
      });

      if (ranked && ranked.length > 0) {
        topRecommendation = ranked[0];
        if (this.mode === 'co_pilot') {
          const rColor = topRecommendation.risk < 0.2 ? '#00ff88' : topRecommendation.risk < 0.6 ? '#ffcc00' : '#ff4444';
          coPilotHtml = `
            <div style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.15)">
              <div style="color:#ffb700"><strong>CO-PILOT RECOMMENDATION</strong></div>
              <div>RECOMMENDED MOVE: <strong>${topRecommendation.nodeId}</strong> (Risk: <span style="color:${rColor}">${(topRecommendation.risk * 100).toFixed(0)}%</span>, Conf: ${topRecommendation.confidence}%)</div>
              <div style="font-size:11px; color:#c0d0e0; font-style:italic">"${topRecommendation.reason}"</div>
            </div>
          `;
        }
      }
    }

    this.hudElement.innerHTML = `
      <div><strong>MODE</strong>: ${modeLabels[this.mode]} [Press M to switch]</div>
      <div>SPEED:      ${speed.padStart(3, ' ')} km/h [GEAR: ${gear}]</div>
      <div>FUEL:       ${fuel.padStart(5, ' ')}%</div>
      <div>HANDBRAKE:  ${hb} | LIGHTS: ${lights}</div>
      <div>CAMERA:     ${cam} (Press C)</div>
      <div style="margin-top:6px"><strong>SENSORS</strong> (Tier: ${this.sensors?.tier?.name ?? 'Normal'})</div>
      <div>${breezeStr} | ${stenchStr} | ${glitterStr} | ${bumpStr}</div>
      ${coPilotHtml}
      <div style="margin-top:6px; font-size:11px; color:#8899aa">
        [M] Mode [I] Analysis Mode [C] Camera [1-4] Difficulty<br/>
        [W/A/S/D] Drive [SPACE] Handbrake [TAB] Reverse [E] Interact
      </div>
    `;

    // Right Mission Box
    if (this.missionElement && data.mission) {
      const m = data.mission;
      const statusColor = m.completed ? '#00ff88' : m.failed ? '#ff4444' : '#ffcc00';
      this.missionElement.innerHTML = `
        <div><strong>MISSION</strong>: ${m.name}</div>
        <div>STATUS: <span style="color:${statusColor};font-weight:bold">${m.status.toUpperCase()}</span></div>
        <div>TARGET: ${m.targetDesc}</div>
        <div>DISTANCE: ${m.distToTarget ? m.distToTarget.toFixed(1) + 'm' : '---'}</div>
        <div style="font-size:12px; color:#bbccdd; margin-top:4px">${m.instruction}</div>
      `;
    }

    // Live 5-Stage Analysis Pipeline Overlay
    if (this.showAnalysisMode && this.analysisElement) {
      this._renderAnalysisPipeline(p, topRecommendation);
    }

    // Developer Debug Overlay
    if (this.showDebugMode && this.debugOverlay) {
      this._renderDeveloperDebug(p);
    }
  }

  _renderAnalysisPipeline(percepts, topRecommendation) {
    const rawKB = this.kb?.engineKB ?? this.kb;
    const currNode = percepts.nodeId ?? 'n_0_0';
    const belief = rawKB?.getBelief(currNode);

    // 1. OBSERVATION
    const obsStr = `Thermal: ${percepts.stench ? 'STENCH' : 'none'}, Wind: ${percepts.breeze ? 'BREEZE' : 'none'}, Radar: ${percepts.bump ? 'BUMP' : 'clear'}, Scanner: ${percepts.glitter ? 'GLITTER' : 'none'}, Vis: ${((percepts.visualConfidence ?? 1) * 100).toFixed(0)}%`;

    // 2. EVIDENCE
    const evList = belief?.evidence?.length ? belief.evidence.join(', ') : '(none)';

    // 3. INFERENCE
    const pitClausesCount = rawKB?._pitClauses?.size ?? 0;
    const hunterClausesCount = rawKB?._hunterClauses?.size ?? 0;
    const isSafe = belief?.safe === true ? 'PROVEN SAFE' : belief?.safe === false ? 'CONFIRMED HAZARD' : 'UNCERTAIN';
    const infStr = `Node ${currNode}: ${isSafe} | Active OR-clauses: [Pits: ${pitClausesCount}, Hunters: ${hunterClausesCount}] | Hunter Eliminated: ${rawKB?.hunterDead ? 'YES' : 'NO'}`;

    // 4. RISK
    const riskStr = topRecommendation
      ? `Best candidate: ${topRecommendation.nodeId} (Risk: ${(topRecommendation.risk * 100).toFixed(1)}%, Confidence: ${topRecommendation.confidence}%) — Reason: "${topRecommendation.reason}"`
      : 'Evaluating risk surface...';

    // 5. DECISION
    const decStr = this.mode === 'ai_driver'
      ? `AI DRIVER ACTION: Moving to ${topRecommendation?.nodeId ?? 'hold'} (Utility: ${topRecommendation?.utility.toFixed(2) ?? '0.00'})`
      : `CO-PILOT ADVISORY: Steer toward ${topRecommendation?.nodeId ?? 'none'}`;

    this.analysisElement.innerHTML = `
      <div style="color:#00e5ff; font-weight:bold; margin-bottom:4px">
        LIVE STAGE 1 REASONING PIPELINE [ANALYSIS MODE — Press I to hide]
      </div>
      <div><span style="color:#ff88aa"><strong>[1. OBSERVATION]</strong></span>: ${obsStr}</div>
      <div><span style="color:#44bbff"><strong>[2. EVIDENCE]</strong></span>: Ingested tokens at ${currNode}: ${evList}</div>
      <div><span style="color:#ffcc00"><strong>[3. INFERENCE]</strong></span>: Horn-clause deduction: ${infStr}</div>
      <div><span style="color:#ff9944"><strong>[4. RISK]</strong></span>: Composite score: ${riskStr}</div>
      <div><span style="color:#00ff88"><strong>[5. DECISION]</strong></span>: ${decStr}</div>
    `;
  }

  _renderDeveloperDebug(percepts) {
    const raw = percepts.raw || {};
    const rawKB = this.kb?.engineKB ?? this.kb;
    const spec = this.world?.spec || {};

    const pits = spec.pitNodes ? spec.pitNodes.join(', ') : 'none';
    const hunters = spec.hunterNodes ? spec.hunterNodes.join(', ') : 'none';
    const hunterLiveNode = this.hunter?.currentNodeId ?? 'none';
    const tier = this.sensors?.tier || {};

    this.debugOverlay.innerHTML = `
      <div style="color:#ff4444; font-weight:bold">DEVELOPER DEBUG MODE [Ctrl+Shift+D]</div>
      <div>TOTAL NODES: ${this.world?.graph?.nodeIds?.length ?? 0} | EDGES: ${this.world?.graph?._edges?.size ?? 0}</div>
      <div>GROUND TRUTH PITS: [${pits}]</div>
      <div>STATIC HUNTERS:    [${hunters}]</div>
      <div>LIVE HUNTER NODE:   <span style="color:#ff00ff;font-weight:bold">${hunterLiveNode}</span> (Move timer: ${(this.hunter?._timer ?? 0).toFixed(1)}s)</div>
      <div style="margin-top:4px;border-top:1px solid #663333"><strong>SENSOR TRUTH vs NOISY READINGS</strong></div>
      <div>BREEZE:  Raw=${raw.breeze} | Noisy=${percepts.breeze}</div>
      <div>STENCH:  Raw=${raw.stench} | Noisy=${percepts.stench}</div>
      <div>GLITTER: Raw=${raw.glitter} | Noisy=${percepts.glitter}</div>
      <div>BUMP:    Raw=${raw.bump} | Noisy=${percepts.bump}</div>
      <div>TIER:    ${tier.name} (FP: ${(tier.sensorNoise?.falsePositiveRate*100).toFixed(0)}%, FN: ${(tier.sensorNoise?.falseNegativeRate*100).toFixed(0)}%)</div>
      <div style="color:#888;font-size:10px">Confirms unreachability in normal play</div>
    `;
  }
}

/**
 * @param {Object} state
 * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
 * @param {import('../actuators/ActuatorBus.js').ActuatorBus} actuators
 * @param {Object} [options]
 * @returns {Promise<UIManager>}
 */
export async function initUI(state, vehicle, actuators, options = {}) {
  const ui = new UIManager(state, vehicle, actuators, options);
  console.log('[ui] UIManager initialised with DRIVER / AI DRIVER / CO-PILOT modes and live analysis pipeline');
  return ui;
}
