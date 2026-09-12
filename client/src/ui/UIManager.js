/**
 * UIManager.js
 * ─────────────────────────────────────────────────────────────
 * Comprehensive UI/UX Suite for SENTINEL / THE UNKNOWN ROAD.
 * Coordinates all presentation systems while keeping the 3D world visually dominant:
 *   - MinimalHUD (Speedometer, physically-responsive RPM arc, fuel/hull gauges, compass tape)
 *   - ContextualSensorHUD (Slides in only near anomalies with colorblind glyphs)
 *   - AICoPilotCard (Auto-dismissing live reasoning advice)
 *   - JunctionDecisionUI (Steering-settling branch cards, zero popups, colorblind glyphs)
 *   - FieldComputer (Full-screen terminal: fog map, 5-stage pipeline, audit log, real stats & achievements)
 *   - GarageMenu (Real numeric vehicle & sensor tuning)
 *   - MainMenu (Cinematic title screen) & MissionBriefing ("The Silent Checkpoint")
 *   - PauseMenu (Settings & Accessibility: volumes, captions, colorblind, camera shake, motion reduction)
 *   - CaptionsOverlay (Real-time subtitle toasts for all auditory cues)
 *   - TutorialOverlay (Interactive skippable onboarding tutorial)
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
import { CaptionsOverlay } from './components/CaptionsOverlay.js';
import { TutorialOverlay } from './components/TutorialOverlay.js';

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
    this.statsTracker = options.statsTracker ?? null;
    this.achievementManager = options.achievementManager ?? null;

    // Modes: 'driver' | 'co_pilot' | 'ai_driver'
    this.mode = 'driver';

    // State flags
    this.showDebugMode = false;
    this.isPaused = false;
    this.keysPressed = new Set();
    this.lastHazardState = { breeze: false, stench: false, bump: false };

    // Cached evaluation for on-event AI performance (no per-frame recalculation)
    this._cachedNodeId = null;
    this._cachedBranches = [];
    this._cachedTopRec = null;
    this._lastDecisionNodeId = null;
    this._lastKbRevision = -1;

    this._mountUI();
    this._bindKeyboard();
    this._bindAchievementToasts();
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
        state: this.state,
        statsTracker: this.statsTracker,
        achievementManager: this.achievementManager,
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
        state: this.state,
        statsTracker: this.statsTracker,
        achievementManager: this.achievementManager,
      },
      this.audio
    );

    // 7. Mission Briefing ("The Silent Checkpoint")
    this.missionBriefing = new MissionBriefing(
      this.container,
      { world: this.world, missions: this.missions },
      () => {
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

    // 9. Pause Menu with full Settings & Accessibility
    const currentSettings = this.state?.get ? (this.state.get().settings || {}) : {};
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
        onUpdateSettings: (newSettings) => {
          this._applySettings(newSettings);
        },
      },
      this.audio,
      currentSettings
    );

    // 10. Real-time Audio Cue Captions Overlay
    this.captionsOverlay = new CaptionsOverlay(
      this.container,
      this.audio,
      currentSettings.captionsEnabled ?? true
    );

    // 11. Skippable Interactive Tutorial Overlay
    this.tutorialOverlay = new TutorialOverlay(
      this.container,
      { state: this.state, audio: this.audio },
      () => {
        console.log('[ui] Interactive tutorial dismissed');
      }
    );

    // 12. Achievement Toast Container
    this.achievementToastContainer = document.createElement('div');
    this.achievementToastContainer.id = 'achievement-toast-container';
    this.achievementToastContainer.style.position = 'fixed';
    this.achievementToastContainer.style.top = '20px';
    this.achievementToastContainer.style.left = '50%';
    this.achievementToastContainer.style.transform = 'translateX(-50%)';
    this.achievementToastContainer.style.zIndex = '120';
    this.achievementToastContainer.style.pointerEvents = 'none';
    this.container.appendChild(this.achievementToastContainer);

    // 13. Developer Debug Overlay (Ctrl+Shift+D or Backquote)
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

  _bindAchievementToasts() {
    if (!this.achievementManager) return;
    this.achievementManager.onUnlock((ach) => {
      this._showAchievementToast(ach);
    });
  }

  _showAchievementToast(ach) {
    if (!this.achievementToastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'glass-panel-heavy';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '6px';
    toast.style.border = '2px solid var(--accent-amber)';
    toast.style.background = 'radial-gradient(circle at 50% 50%, rgba(30, 24, 16, 0.95), rgba(14, 16, 20, 0.98))';
    toast.style.boxShadow = '0 0 24px rgba(255, 184, 77, 0.4), 0 8px 32px rgba(0,0,0,0.8)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '14px';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-14px) scale(0.95)';
    toast.style.transition = 'opacity 0.3s var(--ease-shared), transform 0.3s var(--ease-shared)';

    toast.innerHTML = `
      <div style="font-size:28px;">🏆</div>
      <div style="text-align:left;">
        <div style="font-family:var(--font-hud); font-size:10px; font-weight:700; letter-spacing:0.18em; color:var(--accent-amber);">
          ACHIEVEMENT UNLOCKED
        </div>
        <div style="font-family:var(--font-hud); font-size:16px; font-weight:700; color:#FFFFFF; margin:2px 0;">
          ${ach.name}
        </div>
        <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary);">
          ${ach.desc}
        </div>
      </div>
    `;

    this.achievementToastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0) scale(1.0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-14px) scale(0.95)';
      setTimeout(() => {
        if (toast.parentNode === this.achievementToastContainer) {
          this.achievementToastContainer.removeChild(toast);
        }
      }, 350);
    }, 4500);
  }

  _applySettings(settings) {
    if (!settings) return;

    if (this.state && typeof this.state.mutate === 'function') {
      this.state.mutate({ settings });
    }

    if (this.audio) {
      this.audio.setVolumes({
        master: settings.masterVolume,
        engine: settings.engineVolume,
        sfx: settings.sfxVolume,
        ambient: settings.ambientVolume,
      });
    }

    if (this.captionsOverlay) {
      this.captionsOverlay.setEnabled(settings.captionsEnabled ?? true);
    }

    const cam = this.options.graphics?.cameraController;
    if (cam && cam.settings) {
      if (settings.cameraShake !== undefined) cam.settings.cameraShake = settings.cameraShake;
      if (settings.motionReduction !== undefined) cam.settings.motionReduction = settings.motionReduction;
    }

    // Colorblind class on body
    if (settings.colorblindMode) {
      document.body.classList.remove('cb-deuteranopia', 'cb-protanopia', 'cb-high_contrast');
      if (settings.colorblindMode !== 'none') {
        document.body.classList.add(`cb-${settings.colorblindMode}`);
      }
    }
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;

      // Developer Debug Mode
      if ((e.ctrlKey && e.shiftKey && code === 'KeyD') || code === 'Backquote') {
        e.preventDefault();
        this.showDebugMode = !this.showDebugMode;
        if (this.debugOverlay) {
          this.debugOverlay.style.display = this.showDebugMode ? 'block' : 'none';
        }
        return;
      }

      // Tab or KeyF: Field Computer Terminal Toggle
      if (code === 'Tab' || code === 'KeyF') {
        e.preventDefault();
        if (this.fieldComputer) this.fieldComputer.toggle();
        return;
      }

      // Escape: Pause Menu / Close modals / Skip tutorial
      if (code === 'Escape') {
        e.preventDefault();
        if (this.tutorialOverlay?.isActive) {
          this.tutorialOverlay.skip();
          return;
        }
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
          return;
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

      // Analysis Mode toggle (KeyI)
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

      // Vehicle manual controls
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

    // 5. On-Event AI Risk Calculation & Ranking Cache (Performance optimization)
    const isNewNode = p.nodeId && p.nodeId !== this._cachedNodeId;
    const isKbChanged = this.kb?.revision !== undefined && this.kb.revision !== this._lastKbRevision;

    if (isNewNode || isKbChanged) {
      this._cachedNodeId = p.nodeId;
      if (this.kb?.revision !== undefined) this._lastKbRevision = this.kb.revision;

      if (this.riskModel && p.nodeId) {
        this._cachedBranches = this.riskModel.rankNeighbors(p.nodeId, {
          fuelRemaining: this.vehicle?.fuelRemaining ?? 100,
        }) || [];
        this._cachedTopRec = this._cachedBranches.length > 0 ? this._cachedBranches[0] : null;
      }

      // Record node visit and check rebel/survivor conditions
      if (this.statsTracker && p.nodeId) {
        this.statsTracker.recordNodeVisit(p.nodeId);
      }
      if (this.achievementManager && p.nodeId) {
        const isSafe = this.kb?.isSafe ? this.kb.isSafe(p.nodeId) : true;
        this.achievementManager.notifyNodeArrival(p.nodeId, isSafe);
      }
    }

    // 6. AI Co-Pilot Recommendation Card
    if (this.coPilotCard) {
      if (this.mode === 'co_pilot' && this._cachedTopRec) {
        this.coPilotCard.update(this._cachedTopRec);
      } else if (this.mode !== 'co_pilot') {
        this.coPilotCard.hide();
      }
    }

    // 7. Junction Decision UI (updates dynamically with steering angle)
    const isJunctionActive = this._cachedBranches && this._cachedBranches.length >= 2;
    if (this.junctionUI) {
      this.junctionUI.update(p.nodeId, this._cachedBranches, this.vehicle?.steerAngle ?? 0);
    }

    // 8. Commit junction decisions to StatsTracker & AchievementManager
    if (isJunctionActive && Math.abs(this.vehicle?.steerAngle ?? 0) > 0.15 && this._lastDecisionNodeId !== p.nodeId) {
      const branchIdx = (this.vehicle.steerAngle < 0) ? 0 : this._cachedBranches.length - 1;
      const chosenBranch = this._cachedBranches[branchIdx];
      if (chosenBranch) {
        this._lastDecisionNodeId = p.nodeId;
        if (this.statsTracker) {
          this.statsTracker.recordJunctionDecision(p.nodeId, chosenBranch.nodeId, this._cachedTopRec, this._cachedBranches);
        }
        if (this.achievementManager) {
          const isSafeProven = this.kb?.isSafe ? this.kb.isSafe(chosenBranch.nodeId) : false;
          this.achievementManager.notifyJunctionDecision({
            chosenNodeId: chosenBranch.nodeId,
            chosenRisk: chosenBranch.risk,
            isSafeProven,
            rankedBranches: this._cachedBranches,
            topAiBranch: this._cachedTopRec,
            hasPercepts: !!(p.breeze || p.stench),
          });
        }
      }
    }

    // 9. Hunter Proximity tracking
    if (this.hunter && this.vehicle && this.achievementManager) {
      const hp = this.hunter.position;
      if (hp) {
        const dist = Math.hypot(this.vehicle.position.x - hp.x, this.vehicle.position.z - hp.z);
        const atSafeNode = this.kb?.isSafe ? this.kb.isSafe(p.nodeId) : false;
        this.achievementManager.notifyHunterProximity(dist, atSafeNode);
        if (this.statsTracker) {
          this.statsTracker.recordHunterProximity(dist);
        }
      }
    }

    // 10. Accumulate Real Stats (distance & play time)
    if (this.statsTracker && this.vehicle) {
      const dt = 0.0166;
      const speedMs = this.vehicle.getSpeedKph() / 3.6;
      this.statsTracker.recordDistance(speedMs * dt);
      this.statsTracker.recordPlayTime(dt);
    }

    // 11. Interactive Tutorial Tick
    if (this.tutorialOverlay && this.tutorialOverlay.isActive) {
      this.tutorialOverlay.tick(
        0.0166,
        this.vehicle,
        p,
        isJunctionActive,
        this.fieldComputer?.isOpen ?? false
      );
    }

    // 12. Developer Debug Overlay
    if (this.showDebugMode && this.debugOverlay) {
      this._renderDeveloperDebug(p, data.fps || 60);
    }
  }

  _updateHazardFeedback(p) {
    if (!this.vignetteEl) return;

    // Bump contact
    if (p.bump && !this.lastHazardState.bump) {
      if (this.audio) this.audio.playBump();
      if (this.statsTracker) this.statsTracker.recordHazardDetected('bump');
      this.vignetteEl.classList.add('danger');
      setTimeout(() => this.vignetteEl.classList.remove('danger'), 280);
    }

    // Stench (Hunter vicinity)
    if (p.stench) {
      this.vignetteEl.classList.add('stench');
      if (!this.lastHazardState.stench) {
        if (this.audio) this.audio.playStench();
        if (this.statsTracker) this.statsTracker.recordHazardDetected('stench');
      }
    } else {
      this.vignetteEl.classList.remove('stench');
    }

    // Breeze (Pit vicinity)
    if (p.breeze) {
      this.vignetteEl.classList.add('caution');
      if (!this.lastHazardState.breeze) {
        if (this.audio) this.audio.playBreeze();
        if (this.statsTracker) this.statsTracker.recordHazardDetected('breeze');
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

  _renderDeveloperDebug(percepts, fps = 60) {
    const raw = percepts.raw || {};
    const spec = this.world?.spec || {};
    const pits = spec.pitNodes ? spec.pitNodes.join(', ') : 'none';
    const hunters = spec.hunterNodes ? spec.hunterNodes.join(', ') : 'none';
    const hunterLiveNode = this.hunter?.currentNodeId ?? 'none';
    const tier = this.sensors?.tier || {};

    this.debugOverlay.innerHTML = `
      <div style="color:#ff4444; font-weight:bold; margin-bottom:4px;">DEVELOPER DEBUG MODE [Ctrl+Shift+D] | FPS: ${fps}</div>
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
