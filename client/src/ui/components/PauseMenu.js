/**
 * PauseMenu.js
 * ─────────────────────────────────────────────────────────────
 * Tactical pause menu overlay with complete Settings & Accessibility suite.
 *
 * Controls:
 *   - Audio Volumes: Master, Engine, SFX, Ambient
 *   - Accessibility: Audio Captions toggle, Colorblind Mode selector,
 *     Camera Shake toggle, Motion-Reduction toggle.
 *   - Navigation: Resume, Field Computer, Ranger Garage, Restart Run.
 */

export class PauseMenu {
  /**
   * @param {HTMLElement} parent
   * @param {Object} callbacks - { onResume, onOpenFieldComputer, onOpenGarage, onRestart, onUpdateSettings }
   * @param {import('../../audio/AudioEngine.js').AudioEngine} [audio]
   * @param {Object} [initialSettings={}]
   */
  constructor(parent, callbacks = {}, audio = null, initialSettings = {}) {
    this.parent = parent;
    this.callbacks = callbacks;
    this.audio = audio;
    this.isOpen = false;
    this.activeTab = 'main'; // 'main' | 'settings'

    this.settings = {
      masterVolume: 0.8,
      engineVolume: 0.7,
      sfxVolume: 0.85,
      ambientVolume: 0.6,
      captionsEnabled: true,
      colorblindMode: 'none',
      cameraShake: true,
      motionReduction: false,
      ...initialSettings,
    };

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'pause-menu';
    this.element.className = 'interactive-panel';
    this.element.style.position = 'fixed';
    this.element.style.inset = '0';
    this.element.style.background = 'rgba(10, 12, 16, 0.65)';
    this.element.style.backdropFilter = 'blur(16px)';
    this.element.style.webkitBackdropFilter = 'blur(16px)';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';
    this.element.style.zIndex = '95';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transition = 'opacity var(--dur-panel) var(--ease-shared)';

    this.card = document.createElement('div');
    this.card.className = 'glass-panel-heavy';
    this.card.style.width = '480px';
    this.card.style.maxHeight = '90vh';
    this.card.style.overflowY = 'auto';
    this.card.style.padding = '32px 36px';
    this.card.style.borderRadius = '8px';
    this.card.style.border = '1px solid var(--border-glass-hover)';
    this.card.style.textAlign = 'center';
    this.card.style.display = 'flex';
    this.card.style.flexDirection = 'column';
    this.card.style.gap = '18px';

    this.element.appendChild(this.card);
    this._renderContent();
  }

  _renderContent() {
    if (this.activeTab === 'settings') {
      this._renderSettings();
    } else {
      this._renderMain();
    }
  }

  _renderMain() {
    this.card.innerHTML = `
      <div>
        <div style="font-family:var(--font-hud); font-size:11px; font-weight:700; letter-spacing:0.25em; color:var(--accent-amber); margin-bottom:4px;">
          SIMULATION SUSPENDED
        </div>
        <div style="font-family:var(--font-hud); font-size:32px; font-weight:700; color:var(--text-primary); letter-spacing:0.06em;">
          PAUSED
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        <button id="pause-btn-resume" class="sentinel-btn sentinel-btn-primary" style="padding:12px 20px;">
          RESUME OPERATION
        </button>
        <button id="pause-btn-settings" class="sentinel-btn" style="padding:10px 20px;">
          SETTINGS & ACCESSIBILITY
        </button>
        <button id="pause-btn-fc" class="sentinel-btn" style="padding:10px 20px;">
          FIELD COMPUTER [TAB]
        </button>
        <button id="pause-btn-garage" class="sentinel-btn" style="padding:10px 20px;">
          RANGER GARAGE [G]
        </button>
        <button id="pause-btn-restart" class="sentinel-btn" style="padding:10px 20px; color:var(--status-warning);">
          RESTART TO START NODE
        </button>
      </div>

      <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
        PRESS [ESC] TO RESUME
      </div>
    `;

    this.card.querySelector('#pause-btn-resume').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onResume) this.callbacks.onResume();
    });

    this.card.querySelector('#pause-btn-settings').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.activeTab = 'settings';
      this._renderContent();
    });

    this.card.querySelector('#pause-btn-fc').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onOpenFieldComputer) this.callbacks.onOpenFieldComputer();
    });

    this.card.querySelector('#pause-btn-garage').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onOpenGarage) this.callbacks.onOpenGarage();
    });

    this.card.querySelector('#pause-btn-restart').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onRestart) this.callbacks.onRestart();
    });
  }

  _renderSettings() {
    const s = this.settings;

    this.card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-glass); padding-bottom:12px;">
        <div style="font-family:var(--font-hud); font-size:18px; font-weight:700; color:var(--accent-amber);">
          SETTINGS & ACCESSIBILITY
        </div>
        <button id="pause-btn-back" class="sentinel-btn" style="padding:4px 12px; font-size:11px;">← BACK</button>
      </div>

      <!-- Volume Controls -->
      <div style="text-align:left; display:flex; flex-direction:column; gap:10px;">
        <div style="font-family:var(--font-hud); font-size:11px; font-weight:700; color:var(--text-muted); letter-spacing:0.1em;">
          AUDIO LEVELS
        </div>
        
        <div>
          <div style="display:flex; justify-content:space-between; font-size:11px; font-family:var(--font-mono); margin-bottom:2px;">
            <span>MASTER VOLUME</span>
            <span id="vol-lbl-master">${Math.round(s.masterVolume * 100)}%</span>
          </div>
          <input type="range" id="vol-master" min="0" max="1" step="0.05" value="${s.masterVolume}" style="width:100%;">
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:11px; font-family:var(--font-mono); margin-bottom:2px;">
            <span>ENGINE TONE</span>
            <span id="vol-lbl-engine">${Math.round(s.engineVolume * 100)}%</span>
          </div>
          <input type="range" id="vol-engine" min="0" max="1" step="0.05" value="${s.engineVolume}" style="width:100%;">
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:11px; font-family:var(--font-mono); margin-bottom:2px;">
            <span>SFX / HAZARDS</span>
            <span id="vol-lbl-sfx">${Math.round(s.sfxVolume * 100)}%</span>
          </div>
          <input type="range" id="vol-sfx" min="0" max="1" step="0.05" value="${s.sfxVolume}" style="width:100%;">
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:11px; font-family:var(--font-mono); margin-bottom:2px;">
            <span>WEATHER AMBIENCE</span>
            <span id="vol-lbl-ambient">${Math.round(s.ambientVolume * 100)}%</span>
          </div>
          <input type="range" id="vol-ambient" min="0" max="1" step="0.05" value="${s.ambientVolume}" style="width:100%;">
        </div>
      </div>

      <!-- Accessibility Options -->
      <div style="text-align:left; border-top:1px solid var(--border-glass); padding-top:12px; display:flex; flex-direction:column; gap:12px;">
        <div style="font-family:var(--font-hud); font-size:11px; font-weight:700; color:var(--text-muted); letter-spacing:0.1em;">
          ACCESSIBILITY SUITE
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12px; font-weight:600; color:var(--text-primary);">AUDIO CAPTIONS</div>
            <div style="font-size:10px; color:var(--text-muted);">Visual subtitles for every engine and hazard sound</div>
          </div>
          <button id="toggle-captions" class="sentinel-btn ${s.captionsEnabled ? 'sentinel-btn-primary' : ''}" style="padding:4px 12px; font-size:11px;">
            ${s.captionsEnabled ? 'ENABLED' : 'OFF'}
          </button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12px; font-weight:600; color:var(--text-primary);">CAMERA IMPACT SHAKE</div>
            <div style="font-size:10px; color:var(--text-muted);">Camera shake impulses upon obstacle collisions</div>
          </div>
          <button id="toggle-shake" class="sentinel-btn ${s.cameraShake ? 'sentinel-btn-primary' : ''}" style="padding:4px 12px; font-size:11px;">
            ${s.cameraShake ? 'ENABLED' : 'OFF'}
          </button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12px; font-weight:600; color:var(--text-primary);">MOTION REDUCTION</div>
            <div style="font-size:10px; color:var(--text-muted);">Dampens body roll/pitch and disables dynamic FOV sway</div>
          </div>
          <button id="toggle-motion" class="sentinel-btn ${s.motionReduction ? 'sentinel-btn-primary' : ''}" style="padding:4px 12px; font-size:11px;">
            ${s.motionReduction ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        <div>
          <div style="font-size:12px; font-weight:600; color:var(--text-primary); margin-bottom:4px;">COLORBLIND PALETTE</div>
          <div id="cb-mode-group" style="display:flex; gap:6px;">
            <button data-cb="none" class="sentinel-btn ${s.colorblindMode === 'none' ? 'sentinel-btn-primary' : ''}" style="padding:4px 8px; font-size:10px;">DEFAULT</button>
            <button data-cb="deuteranopia" class="sentinel-btn ${s.colorblindMode === 'deuteranopia' ? 'sentinel-btn-primary' : ''}" style="padding:4px 8px; font-size:10px;">DEUTER</button>
            <button data-cb="protanopia" class="sentinel-btn ${s.colorblindMode === 'protanopia' ? 'sentinel-btn-primary' : ''}" style="padding:4px 8px; font-size:10px;">PROTAN</button>
            <button data-cb="high_contrast" class="sentinel-btn ${s.colorblindMode === 'high_contrast' ? 'sentinel-btn-primary' : ''}" style="padding:4px 8px; font-size:10px;">HI-CONTRAST</button>
          </div>
        </div>
      </div>
    `;

    // Bind Back
    this.card.querySelector('#pause-btn-back').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.activeTab = 'main';
      this._renderContent();
    });

    // Bind Volume Sliders
    const setupSlider = (id, key, lblId, audioFn) => {
      const slider = this.card.querySelector(`#${id}`);
      const lbl = this.card.querySelector(`#${lblId}`);
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.settings[key] = val;
        lbl.textContent = `${Math.round(val * 100)}%`;
        if (this.audio && typeof this.audio[audioFn] === 'function') {
          this.audio[audioFn](val);
        }
        this._notifySettingsChanged();
      });
    };

    setupSlider('vol-master', 'masterVolume', 'vol-lbl-master', 'setMasterVolume');
    setupSlider('vol-engine', 'engineVolume', 'vol-lbl-engine', 'setEngineVolume');
    setupSlider('vol-sfx', 'sfxVolume', 'vol-lbl-sfx', 'setSFXVolume');
    setupSlider('vol-ambient', 'ambientVolume', 'vol-lbl-ambient', 'setAmbientVolume');

    // Bind Captions Toggle
    const captBtn = this.card.querySelector('#toggle-captions');
    captBtn.addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.settings.captionsEnabled = !this.settings.captionsEnabled;
      captBtn.textContent = this.settings.captionsEnabled ? 'ENABLED' : 'OFF';
      captBtn.classList.toggle('sentinel-btn-primary', this.settings.captionsEnabled);
      this._notifySettingsChanged();
    });

    // Bind Shake Toggle
    const shakeBtn = this.card.querySelector('#toggle-shake');
    shakeBtn.addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.settings.cameraShake = !this.settings.cameraShake;
      shakeBtn.textContent = this.settings.cameraShake ? 'ENABLED' : 'OFF';
      shakeBtn.classList.toggle('sentinel-btn-primary', this.settings.cameraShake);
      this._notifySettingsChanged();
    });

    // Bind Motion Toggle
    const motionBtn = this.card.querySelector('#toggle-motion');
    motionBtn.addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.settings.motionReduction = !this.settings.motionReduction;
      motionBtn.textContent = this.settings.motionReduction ? 'ACTIVE' : 'OFF';
      motionBtn.classList.toggle('sentinel-btn-primary', this.settings.motionReduction);
      this._notifySettingsChanged();
    });

    // Bind Colorblind buttons
    const cbBtns = this.card.querySelectorAll('#cb-mode-group button');
    cbBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.audio) this.audio.playClick();
        cbBtns.forEach(b => b.classList.remove('sentinel-btn-primary'));
        btn.classList.add('sentinel-btn-primary');
        this.settings.colorblindMode = btn.getAttribute('data-cb');
        this._notifySettingsChanged();
      });
    });
  }

  _notifySettingsChanged() {
    if (this.callbacks.onUpdateSettings) {
      this.callbacks.onUpdateSettings({ ...this.settings });
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.activeTab = 'main';
    this._renderContent();
    this.element.style.opacity = '1';
    this.element.style.pointerEvents = 'auto';
    if (this.audio) this.audio.playClick();
  }

  close() {
    this.isOpen = false;
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
  }
}
