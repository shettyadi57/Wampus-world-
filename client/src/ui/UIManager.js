/**
 * UIManager.js
 * ─────────────────────────────────────────────────────────────
 * Stage 5 UI/UX Suite for SENTINEL / THE UNKNOWN ROAD.
 * Coordinates all presentation systems while keeping the 3D world visually dominant:
 *   - MinimalHUD (Speedometer, physically-responsive RPM arc, fuel/hull gauges, compass tape)
 *   - ContextualSensorHUD (Slides in only near anomalies)
 *   - AICoPilotCard (Auto-dismissing live reasoning advice)
 *   - JunctionDecisionUI (Steering-settling branch cards, zero popups)
 *   - FieldComputer (Full-screen terminal: fog-of-war map, animated 5-stage pipeline, audit log)
 *   - GarageMenu (Real numeric mechanical upgrades)
 *   - MainMenu (Cinematic title screen) & MissionBriefing ("The Silent Checkpoint")
 *   - PauseMenu (3D world blurred behind it)
 *   - Multi-Sensory Hazard Feedback (Vignette distortion, Web Audio synthesis, camera shake)
 */

import { DIFFICULTY_TIERS } from '../state/DifficultyConfig.js';
import { MinimalHUD } from './components/MinimalHUD.js';
import { ContextualSensorHUD } from './components/ContextualSensorHUD.js';
import { AICoPilotCard } from './components/AICoPilotCard.js';
import { JunctionDecisionUI } from './components/JunctionDecisionUI.js';
import { FieldComputer } from './components/FieldComputer.js';
import { GarageMenu } from './components/GarageMenu.js';
import { MainMenu } from './components/MainMenu.js';
import { MissionBriefing } from './components/MissionBriefing.js';
import { PauseMenu } from './components/PauseMenu.js';

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
    this.audio = options.audio ?? null;
    this.physics = options.physics ?? null;
    this.missions = options.missions ?? null;
    this.roads = options.roads ?? null;
    this.graphics = options.graphics ?? null;

    // Modes: 'driver' | 'co_pilot' | 'ai_driver'
    this.mode = 'driver';

    // State flags
    this.showDebugMode = false;
    this.isPaused = false;
    this.keysPressed = new Set();
    this.lastHazardState = { breeze: false, stench: false, bump: false };

    this._mountUI();
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
    if (this.audio) this.audio.playClick();
  }

  cycleMode() {
    const modes = ['driver', 'co_pilot', 'ai_driver'];
    const nextIdx = (modes.indexOf(this.mode) + 1) % modes.length;
    this.setMode(modes[nextIdx]);
    return this.mode;
  }

  _mountUI() {
    this.container = document.getElementById('ui-overlay');
    this.vignetteEl = document.getElementById('hazard-vignette');
    if (!this.container) return;

    // 1. Minimal HUD (Speed, RPM arc, Fuel/Hull, Compass Tape)
    this.minimalHUD = new MinimalHUD(this.container);

    // 2. Contextual Sensor HUD (slides in only near anomalies)
    this.contextualSensors = new ContextualSensorHUD(this.container, this.audio);

    // 3. AI Co-Pilot Recommendation Card (auto-dismissing)
    this.coPilotCard = new AICoPilotCard(this.container);

    // 4. Junction Decision UI (steering-settling, no popup modals)
    this.junctionUI = new JunctionDecisionUI(this.container);

    // 5. Full-Screen Field Computer (Tab / F key)
    this.fieldComputer = new FieldComputer(
      this.container,
      {
        world: this.world,
        kb: this.kb,
        riskModel: this.riskModel,
        missions: this.missions,
        vehicle: this.vehicle,
      },
      this.audio
    );

    // 6. Garage Outfitter Menu (Numeric vehicle & sensor tuning)
    this.garageMenu = new GarageMenu(
      this.container,
      {
        vehicle: this.vehicle,
        physics: this.physics,
        sensors: this.sensors,
      },
      this.audio
    );

    // 7. Mission Briefing ("The Silent Checkpoint")
    this.missionBriefing = new MissionBriefing(
      this.container,
      { world: this.world, missions: this.missions },
      () => {
        // On Engage: unpause if paused and notify
        this.isPaused = false;
        if (this.audio) this.audio.playAlert();
        console.log('[ui] Mission engaged: The Silent Checkpoint');
      },
      this.audio
    );

    // 8. Cinematic Main Menu
    this.mainMenu = new MainMenu(
      this.container,
      {
        onStart: () => {
          this.missionBriefing.open();
        },
        onOpenGarage: () => {
          this.garageMenu.open();
        },
        onSelectTier: (tierId) => {
          this._setTier(tierId);
        },
      },
      this.audio
    );

    // 9. Pause Menu (blurred world backdrop)
    this.pauseMenu = new PauseMenu(
      this.container,
      {
        onResume: () => {
          this.isPaused = false;
        },
        onOpenFieldComputer: () => {
          this.fieldComputer.open();
        },
        onOpenGarage: () => {
          this.garageMenu.open();
        },
        onRestart: () => {
          if (this.vehicle) this.vehicle.resetTo();
          this.isPaused = false;
        },
      },
      this.audio
    );

    // 10. Developer Debug Overlay (Ctrl+Shift+D or Backquote)
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'hud-panel';
    this.debugOverlay.style.position = 'absolute';
    this.debugOverlay.style.bottom = '12px';
    this.debugOverlay.style.right = '12px';
    this.debugOverlay.style.maxWidth = '420px';
    this.debugOverlay.style.background = 'rgba(30, 10, 10, 0.88)';
    this.debugOverlay.style.border = '1px solid #ff4444';
    this.debugOverlay.style.fontFamily = 'var(--font-mono)';
    this.debugOverlay.style.fontSize = '11px';
    this.debugOverlay.style.display = 'none';
    this.debugOverlay.style.zIndex = '50';
    this.container.appendChild(this.debugOverlay);

    // Mode Banner Badge (top-left)
    this.modeBadge = document.createElement('div');
    this.modeBadge.className = 'glass-panel';
    this.modeBadge.style.position = 'absolute';
    this.modeBadge.style.top = '16px';
    this.modeBadge.style.left = '16px';
    this.modeBadge.style.padding = '8px 14px';
    this.modeBadge.style.fontFamily = 'var(--font-hud)';
    this.modeBadge.style.fontSize = '12px';
    this.modeBadge.style.fontWeight = '700';
    this.modeBadge.style.letterSpacing = '0.08em';
    this.modeBadge.style.border = '1px solid var(--border-glass)';
    this.modeBadge.style.pointerEvents = 'auto';
    this.modeBadge.style.cursor = 'pointer';
    this.modeBadge.innerHTML = `<span style="color:var(--accent-cyan)">DRIVER [MANUAL]</span> <span style="color:var(--text-muted);font-weight:normal;font-size:10px;">[M to switch]</span>`;
    this.modeBadge.addEventListener('click', () => this.cycleMode());
    this.container.appendChild(this.modeBadge);

    // Field Computer Trigger Button (top-right)
    this.fcBtn = document.createElement('button');
    this.fcBtn.className = 'sentinel-btn';
    this.fcBtn.style.position = 'absolute';
    this.fcBtn.style.top = '16px';
    this.fcBtn.style.right = '16px';
    this.fcBtn.style.padding = '8px 14px';
    this.fcBtn.style.fontSize = '11px';
    this.fcBtn.innerHTML = `FIELD COMPUTER <span style="font-family:var(--font-mono);font-size:9px;color:var(--accent-amber)">[TAB]</span>`;
    this.fcBtn.addEventListener('click', () => {
      this.fieldComputer.toggle();
    });
    this.container.appendChild(this.fcBtn);
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;

      // ── Developer Debug Mode combo: Ctrl + Shift + D OR Backquote ──
      if ((e.ctrlKey && e.shiftKey && code === 'KeyD') || code === 'Backquote') {
        e.preventDefault();
        this.showDebugMode = !this.showDebugMode;
        if (this.debugOverlay) {
          this.debugOverlay.style.display = this.showDebugMode ? 'block' : 'none';
        }
        console.log(`[ui] Developer debug overlay toggled: ${this.showDebugMode}`);
        return;
      }

      // Tab or KeyF: Field Computer Terminal Toggle
      if (code === 'Tab' || code === 'KeyF') {
        e.preventDefault();
        if (this.fieldComputer) this.fieldComputer.toggle();
        return;
      }

      // Escape: Pause Menu or Close open fullscreens
      if (code === 'Escape') {
        e.preventDefault();
        if (this.fieldComputer?.isOpen) {
          this.fieldComputer.close();
          return;
        }
        if (this.garageMenu?.isOpen) {
          this.garageMenu.close();
          return;
        }
        if (this.missionBriefing?.isOpen) {
          this.missionBriefing.close();
          return;
        }
        if (this.mainMenu?.isOpen) {
          return; // Don't toggle pause over main menu
        }

        this.isPaused = !this.isPaused;
        if (this.isPaused) {
          this.pauseMenu.open();
        } else {
          this.pauseMenu.close();
        }
        return;
      }

      // KeyG: Garage Outfitter Toggle
      if (code === 'KeyG') {
        e.preventDefault();
        if (this.garageMenu) this.garageMenu.toggle();
        return;
      }

      if (this.keysPressed.has(code)) return;
      this.keysPressed.add(code);

      // Mode switch (KeyM)
      if (code === 'KeyM') {
        this.cycleMode();
        return;
      }

      // Analysis Mode toggle (KeyI) -> open Field Computer to reasoning tab
      if (code === 'KeyI') {
        if (this.fieldComputer) {
          this.fieldComputer.open();
          this.fieldComputer.switchTab('reasoning');
        }
        return;
      }

      // Difficulty tiers (Digit 1-4)
      if (code === 'Digit1') this._setTier('easy');
      if (code === 'Digit2') this._setTier('normal');
      if (code === 'Digit3') this._setTier('hard');
      if (code === 'Digit4') this._setTier('nightmare');

      // Vehicle manual controls (only in manual or co-pilot modes)
      if (this.mode !== 'ai_driver') {
        if (code === 'KeyW' || code === 'ArrowUp') this.actuators.accelerate(1.0);
        if (code === 'KeyS' || code === 'ArrowDown') this.actuators.brake(1.0);
        if (code === 'KeyA' || code === 'ArrowLeft') this.actuators.steer(-1.0);
        if (code === 'KeyD' || code === 'ArrowRight') this.actuators.steer(1.0);
        if (code === 'Space') { e.preventDefault(); this.actuators.handbrake(); }
      }

      // Common actuators
      if (code === 'KeyE') this.actuators.interact();
      if (code === 'KeyR') { if (this.vehicle) this.vehicle.resetTo(); }
      if (code === 'KeyL') this.actuators.toggleHeadlights();
      if (code === 'KeyH') {
        this.actuators.horn();
        if (this.audio) this.audio.playHorn();
      }

      // Camera cycle (C / V)
      if (code === 'KeyC' || code === 'KeyV') {
        if (this.options.graphics?.cameraController) {
          this.options.graphics.cameraController.cycleMode();
        }
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
    console.log(`[ui] Difficulty tier switched to: ${tierId.toUpperCase()}`);
    if (this.audio) this.audio.playClick();
  }

  /**
   * Main telemetry and perceptual render pass from render loop.
   * @param {Object} data
   */
  updateHUD(data) {
    if (!data) return;

    // 1. Update Minimal HUD Telemetry Cluster
    if (this.minimalHUD && this.vehicle) {
      this.minimalHUD.update(data, this.vehicle);
    }

    // 2. Update Mode Badge
    if (this.modeBadge) {
      const badges = {
        driver: '<span style="color:var(--accent-cyan)">DRIVER [MANUAL]</span>',
        co_pilot: '<span style="color:var(--accent-amber)">CO-PILOT [AI ASSIST]</span>',
        ai_driver: '<span style="color:var(--status-success)">AI DRIVER [AUTONOMOUS]</span>',
      };
      this.modeBadge.innerHTML = `${badges[this.mode]} <span style="color:var(--text-muted);font-weight:normal;font-size:10px;">[M]</span>`;
    }

    // 3. Multi-Sensory Hazard Feedback (Audio, Vignette Distortion, Camera Shake)
    const p = data.percepts || {};
    this._updateHazardFeedback(p);

    // 4. Contextual Sensor HUD (slides in only near anomalies)
    if (this.contextualSensors) {
      this.contextualSensors.update(p);
    }

    // 5. AI Co-Pilot Recommendation Card
    let topRec = null;
    let rankedBranches = [];
    if (this.riskModel && p.nodeId) {
      rankedBranches = this.riskModel.rankNeighbors(p.nodeId, {
        fuelRemaining: this.vehicle?.fuelRemaining ?? 100,
      }) || [];

      if (rankedBranches.length > 0) {
        topRec = rankedBranches[0];
      }
    }

    if (this.coPilotCard) {
      if (this.mode === 'co_pilot' && topRec) {
        this.coPilotCard.update(topRec);
      } else if (this.mode !== 'co_pilot') {
        this.coPilotCard.hide();
      }
    }

    // 6. Junction Decision UI (updates dynamically with steering angle)
    if (this.junctionUI) {
      this.junctionUI.update(p.nodeId, rankedBranches, this.vehicle?.steerAngle ?? 0);
    }

    // 7. Developer Debug Overlay (if toggled)
    if (this.showDebugMode && this.debugOverlay) {
      this._renderDeveloperDebug(p);
    }
  }

  _updateHazardFeedback(p) {
    if (!this.vignetteEl) return;

    // Bump contact
    if (p.bump && !this.lastHazardState.bump) {
      if (this.audio) this.audio.playBump();
      this.vignetteEl.classList.add('danger');
      setTimeout(() => this.vignetteEl.classList.remove('danger'), 280);
    }

    // Stench (Hunter vicinity)
    if (p.stench) {
      this.vignetteEl.classList.add('stench');
      if (!this.lastHazardState.stench && this.audio) {
        this.audio.playStench();
      }
    } else {
      this.vignetteEl.classList.remove('stench');
    }

    // Breeze (Pit vicinity)
    if (p.breeze) {
      this.vignetteEl.classList.add('caution');
      if (!this.lastHazardState.breeze && this.audio) {
        this.audio.playBreeze();
      }
    } else {
      this.vignetteEl.classList.remove('caution');
    }

    // Glitter (Objective beacon chime)
    if (p.glitter && !this.lastHazardState.glitter && this.audio) {
      this.audio.playGlitter();
    }

    this.lastHazardState = {
      breeze: !!p.breeze,
      stench: !!p.stench,
      bump: !!p.bump,
      glitter: !!p.glitter,
    };
  }

  _renderDeveloperDebug(percepts) {
    const raw = percepts.raw || {};
    const spec = this.world?.spec || {};
    const pits = spec.pitNodes ? spec.pitNodes.join(', ') : 'none';
    const hunters = spec.hunterNodes ? spec.hunterNodes.join(', ') : 'none';
    const hunterLiveNode = this.hunter?.currentNodeId ?? 'none';
    const tier = this.sensors?.tier || {};

    this.debugOverlay.innerHTML = `
      <div style="color:#ff4444; font-weight:bold; margin-bottom:4px;">DEVELOPER DEBUG MODE [Ctrl+Shift+D]</div>
      <div>TOTAL NODES: ${this.world?.graph?.nodes?.length ?? 0} | START: ${spec.startId} | OBJ: ${spec.objectiveId}</div>
      <div>GROUND TRUTH PITS: [${pits}]</div>
      <div>STATIC HUNTERS:    [${hunters}]</div>
      <div>LIVE HUNTER NODE:   <span style="color:#ff00ff;font-weight:bold">${hunterLiveNode}</span> (Timer: ${(this.hunter?._timer ?? 0).toFixed(1)}s)</div>
      <div style="margin-top:4px;border-top:1px solid #663333;padding-top:4px;"><strong>SENSOR TRUTH vs NOISY READINGS</strong></div>
      <div>BREEZE:  Raw=${raw.breeze} | Noisy=${percepts.breeze}</div>
      <div>STENCH:  Raw=${raw.stench} | Noisy=${percepts.stench}</div>
      <div>GLITTER: Raw=${raw.glitter} | Noisy=${percepts.glitter}</div>
      <div>BUMP:    Raw=${raw.bump} | Noisy=${percepts.bump}</div>
      <div>TIER:    ${tier.name} (FP: ${(tier.sensorNoise?.falsePositiveRate*100).toFixed(0)}%, FN: ${(tier.sensorNoise?.falseNegativeRate*100).toFixed(0)}%)</div>
      <div style="color:#888;font-size:10px;margin-top:2px;">Authoritative Stage 1 validation</div>
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
  console.log('[ui] Stage 5 UI/UX Suite fully initialized');
  return ui;
}
