/**
 * PauseMenu.js
 * ─────────────────────────────────────────────────────────────
 * Tactical pause menu overlay triggered via ESC key.
 * Keeps the 3D world visible and blurred behind it.
 * Options: Resume, Field Computer, Garage, Restart Run.
 */

export class PauseMenu {
  /**
   * @param {HTMLElement} parent
   * @param {Object} callbacks - { onResume, onOpenFieldComputer, onOpenGarage, onRestart }
   * @param {import('../../audio/AudioEngine.js').AudioEngine} [audio]
   */
  constructor(parent, callbacks = {}, audio = null) {
    this.parent = parent;
    this.callbacks = callbacks;
    this.audio = audio;
    this.isOpen = false;

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'pause-menu';
    this.element.className = 'interactive-panel';
    this.element.style.position = 'fixed';
    this.element.style.inset = '0';
    this.element.style.background = 'rgba(10, 12, 16, 0.55)';
    this.element.style.backdropFilter = 'blur(16px)';
    this.element.style.webkitBackdropFilter = 'blur(16px)';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';
    this.element.style.zIndex = '95';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transition = 'opacity var(--dur-panel) var(--ease-shared)';

    const card = document.createElement('div');
    card.className = 'glass-panel-heavy';
    card.style.width = '420px';
    card.style.padding = '36px 40px';
    card.style.borderRadius = '8px';
    card.style.border = '1px solid var(--border-glass-hover)';
    card.style.textAlign = 'center';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '20px';

    card.innerHTML = `
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
        <button id="pause-btn-fc" class="sentinel-btn" style="padding:10px 20px;">
          FIELD COMPUTER (TAB)
        </button>
        <button id="pause-btn-garage" class="sentinel-btn" style="padding:10px 20px;">
          RANGER GARAGE
        </button>
        <button id="pause-btn-restart" class="sentinel-btn" style="padding:10px 20px; color:var(--status-warning);">
          RESTART TO START NODE
        </button>
      </div>

      <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
        PRESS [ESC] TO RESUME
      </div>
    `;

    this.element.appendChild(card);

    card.querySelector('#pause-btn-resume').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onResume) this.callbacks.onResume();
    });

    card.querySelector('#pause-btn-fc').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onOpenFieldComputer) this.callbacks.onOpenFieldComputer();
    });

    card.querySelector('#pause-btn-garage').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onOpenGarage) this.callbacks.onOpenGarage();
    });

    card.querySelector('#pause-btn-restart').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onRestart) this.callbacks.onRestart();
    });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
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
