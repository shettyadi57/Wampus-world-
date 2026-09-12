/**
 * TutorialOverlay.js
 * ─────────────────────────────────────────────────────────────
 * Interactive, skippable in-game tutorial for SENTINEL / Wampus World.
 *
 * Teaches:
 *   1. Driving dynamics: throttle, steering, and braking (accelerate > 15 km/h).
 *   2. Physical sensor array: Breeze (Pits), Stench (Hunter), Glitter (Objective).
 *   3. Junction risk evaluation: Steering into the safest sector.
 *   4. Tactical Field Computer terminal: [TAB] or [F] to inspect 5-stage deductive proofs.
 */

export class TutorialOverlay {
  /**
   * @param {HTMLElement} parent
   * @param {Object} context - { state, audio }
   * @param {function(): void} [onComplete]
   */
  constructor(parent, context = {}, onComplete = null) {
    this.parent = parent;
    this.state = context.state;
    this.audio = context.audio;
    this.onComplete = onComplete;

    this.currentStep = 0;
    this.isActive = false;
    this._stepTimer = 0;

    this.steps = [
      {
        id: 'drive',
        title: 'TACTICAL INSTRUCTION // STEP 1: VEHICLE PROPULSION',
        instruction: 'Use [W/A/S/D] or [Arrow Keys] to throttle, steer, and brake. Accelerate above 15 km/h.',
        check: (vehicle) => (vehicle ? vehicle.getSpeedKph() > 15 : false),
      },
      {
        id: 'sensors',
        title: 'TACTICAL INSTRUCTION // STEP 2: SENSOR TELEMETRY',
        instruction: 'Watch top HUD for anomalies: [BREEZE = Pit cavity nearby], [STENCH = Roaming Hunter], [GLITTER = Objective].',
        check: (vehicle, percepts) => this._stepTimer > 4.5 || (percepts && (percepts.breeze || percepts.stench || percepts.glitter)),
      },
      {
        id: 'junction',
        title: 'TACTICAL INSTRUCTION // STEP 3: ROUTE & RISK EVALUATION',
        instruction: 'At upcoming forks, review risk ratings. Steer left or right to commit to the lowest-risk road vector.',
        check: (vehicle, percepts, junctionActive) => junctionActive || this._stepTimer > 6.0,
      },
      {
        id: 'terminal',
        title: 'TACTICAL INSTRUCTION // STEP 4: TACTICAL FIELD COMPUTER',
        instruction: 'Press [TAB] or [F] to open the Field Computer and audit the 5-Stage Propositional Reasoning Matrix.',
        check: (vehicle, percepts, junctionActive, fieldComputerOpen) => !!fieldComputerOpen,
      },
    ];

    this._build();
    this.parent.appendChild(this.element);

    // Check if tutorial already completed
    const tutState = this.state?.get()?.tutorial;
    if (tutState && (tutState.completed || tutState.skipped)) {
      this.close();
    } else {
      this.start();
    }
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'tutorial-overlay';
    this.element.className = 'glass-panel-heavy interactive-panel';
    this.element.style.position = 'fixed';
    this.element.style.top = '24px';
    this.element.style.left = '50%';
    this.element.style.transform = 'translateX(-50%)';
    this.element.style.width = '640px';
    this.element.style.padding = '16px 22px';
    this.element.style.borderRadius = '6px';
    this.element.style.border = '1px solid var(--accent-amber)';
    this.element.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6)';
    this.element.style.zIndex = '70';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '8px';
    this.element.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

    this.titleEl = document.createElement('div');
    this.titleEl.style.fontFamily = 'var(--font-hud)';
    this.titleEl.style.fontSize = '12px';
    this.titleEl.style.fontWeight = '700';
    this.titleEl.style.letterSpacing = '0.12em';
    this.titleEl.style.color = 'var(--accent-amber)';

    this.bodyEl = document.createElement('div');
    this.bodyEl.style.fontFamily = 'var(--font-mono)';
    this.bodyEl.style.fontSize = '13px';
    this.bodyEl.style.color = 'var(--text-primary)';
    this.bodyEl.style.lineHeight = '1.45';

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.marginTop = '4px';
    footer.style.borderTop = '1px solid var(--border-glass)';
    footer.style.paddingTop = '8px';

    this.stepIndicator = document.createElement('span');
    this.stepIndicator.style.fontFamily = 'var(--font-mono)';
    this.stepIndicator.style.fontSize = '11px';
    this.stepIndicator.style.color = 'var(--accent-cyan)';

    const skipBtn = document.createElement('button');
    skipBtn.id = 'tut-skip-btn';
    skipBtn.className = 'sentinel-btn';
    skipBtn.style.padding = '4px 10px';
    skipBtn.style.fontSize = '11px';
    skipBtn.textContent = 'SKIP TUTORIAL [ESC]';
    skipBtn.addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.skip();
    });

    footer.appendChild(this.stepIndicator);
    footer.appendChild(skipBtn);

    this.element.appendChild(this.titleEl);
    this.element.appendChild(this.bodyEl);
    this.element.appendChild(footer);
  }

  start() {
    this.isActive = true;
    this.currentStep = 0;
    this._stepTimer = 0;
    this._renderStep();
    this.element.style.opacity = '1';
    this.element.style.pointerEvents = 'auto';
  }

  _renderStep() {
    const s = this.steps[this.currentStep];
    if (!s) {
      this.complete();
      return;
    }
    this.titleEl.textContent = s.title;
    this.bodyEl.textContent = s.instruction;
    this.stepIndicator.textContent = `PROGRESS: STEP ${this.currentStep + 1} OF ${this.steps.length}`;
    if (this.audio) this.audio.playAIChime('decision');
  }

  /**
   * Ticked from render loop to evaluate objective progression.
   */
  tick(dt, vehicle, percepts, junctionActive, fieldComputerOpen) {
    if (!this.isActive) return;
    this._stepTimer += dt;

    const s = this.steps[this.currentStep];
    if (s && s.check(vehicle, percepts, junctionActive, fieldComputerOpen)) {
      this.currentStep++;
      this._stepTimer = 0;
      if (this.currentStep < this.steps.length) {
        this._renderStep();
      } else {
        this.complete();
      }
    }
  }

  complete() {
    this.isActive = false;
    this.titleEl.textContent = 'TACTICAL ONBOARDING COMPLETE';
    this.titleEl.style.color = 'var(--status-success)';
    this.bodyEl.textContent = 'Directives cleared. You are fully authorized for independent mountain exploration.';
    this.stepIndicator.textContent = 'STATUS: CERTIFIED';

    if (this.state && typeof this.state.mutate === 'function') {
      this.state.mutate({ tutorial: { completed: true, step: this.steps.length, skipped: false } });
    }

    if (this.audio) this.audio.playAIChime('safe');

    setTimeout(() => {
      this.close();
      if (typeof this.onComplete === 'function') this.onComplete();
    }, 2800);
  }

  skip() {
    this.isActive = false;
    if (this.state && typeof this.state.mutate === 'function') {
      this.state.mutate({ tutorial: { completed: true, step: this.currentStep, skipped: true } });
    }
    this.close();
    if (typeof this.onComplete === 'function') this.onComplete();
  }

  close() {
    this.isActive = false;
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
  }
}
