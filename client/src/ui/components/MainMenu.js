/**
 * MainMenu.js
 * ─────────────────────────────────────────────────────────────
 * Cinematic title menu for SENTINEL / THE UNKNOWN ROAD.
 * Tagline: "READ THE ROAD. TRUST THE SIGNALS."
 * Smoked glass panels with atmospheric backdrop.
 */

export class MainMenu {
  /**
   * @param {HTMLElement} parent
   * @param {Object} callbacks - { onStart, onOpenGarage, onSelectTier }
   * @param {import('../../audio/AudioEngine.js').AudioEngine} [audio]
   */
  constructor(parent, callbacks = {}, audio = null) {
    this.parent = parent;
    this.callbacks = callbacks;
    this.audio = audio;
    this.isOpen = true; // Open on game boot

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'main-menu';
    this.element.className = 'interactive-panel';
    this.element.style.position = 'fixed';
    this.element.style.inset = '0';
    this.element.style.background = 'radial-gradient(circle at 50% 40%, rgba(20, 22, 26, 0.4) 0%, rgba(10, 11, 14, 0.88) 100%)';
    this.element.style.backdropFilter = 'blur(12px)';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';
    this.element.style.zIndex = '80';
    this.element.style.transition = 'opacity var(--dur-scene) var(--ease-shared)';

    const card = document.createElement('div');
    card.className = 'glass-panel-heavy';
    card.style.width = '560px';
    card.style.padding = '40px 48px';
    card.style.borderRadius = '10px';
    card.style.border = '1px solid var(--border-glass-hover)';
    card.style.textAlign = 'center';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.gap = '24px';

    card.innerHTML = `
      <div>
        <div style="font-family:var(--font-hud); font-size:12px; font-weight:700; letter-spacing:0.35em; color:var(--accent-amber); margin-bottom:6px;">
          TACTICAL EXPEDITION SIMULATION
        </div>
        <div style="font-family:var(--font-hud); font-size:46px; font-weight:700; letter-spacing:0.04em; color:var(--text-primary); line-height:1.05;">
          SENTINEL
        </div>
        <div style="font-family:var(--font-hud); font-size:20px; font-weight:600; letter-spacing:0.25em; color:var(--text-muted); margin-top:4px;">
          THE UNKNOWN ROAD
        </div>
        <div style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan); letter-spacing:0.18em; margin-top:10px;">
          "READ THE ROAD. TRUST THE SIGNALS."
        </div>
      </div>

      <div style="width:100%; display:flex; flex-direction:column; gap:12px;">
        <button id="menu-btn-start" class="sentinel-btn sentinel-btn-primary" style="padding:14px 28px; font-size:16px;">
          ENGAGE EXPEDITION
        </button>
        <button id="menu-btn-garage" class="sentinel-btn" style="padding:12px 24px;">
          RANGER GARAGE & OUTFITTING
        </button>
      </div>

      <!-- Difficulty Tier Selector -->
      <div style="width:100%; border-top:1px solid var(--border-glass); padding-top:16px;">
        <div style="font-family:var(--font-hud); font-size:11px; font-weight:700; color:var(--text-muted); letter-spacing:0.12em; margin-bottom:10px;">
          THREAT ENVIRONMENT DIFFICULTY
        </div>
        <div id="difficulty-btn-group" style="display:flex; justify-content:center; gap:8px;">
          <button data-tier="easy" class="sentinel-btn" style="padding:6px 12px; font-size:11px;">EASY</button>
          <button data-tier="normal" class="sentinel-btn sentinel-btn-primary" style="padding:6px 12px; font-size:11px;">NORMAL</button>
          <button data-tier="hard" class="sentinel-btn" style="padding:6px 12px; font-size:11px;">HARD</button>
          <button data-tier="nightmare" class="sentinel-btn" style="padding:6px 12px; font-size:11px;">NIGHTMARE</button>
        </div>
      </div>

      <div style="font-size:11px; color:var(--text-muted); line-height:1.5;">
        Autonomous AI driving, symbolic reasoning verification, and high-fidelity vehicle telemetry active.
      </div>
    `;

    this.element.appendChild(card);

    // Event listeners
    card.querySelector('#menu-btn-start').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.callbacks.onStart) this.callbacks.onStart();
    });

    card.querySelector('#menu-btn-garage').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      if (this.callbacks.onOpenGarage) this.callbacks.onOpenGarage();
    });

    const tierBtns = card.querySelectorAll('#difficulty-btn-group button');
    tierBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.audio) this.audio.playClick();
        tierBtns.forEach(b => b.classList.remove('sentinel-btn-primary'));
        btn.classList.add('sentinel-btn-primary');
        const tier = btn.getAttribute('data-tier');
        if (this.callbacks.onSelectTier) this.callbacks.onSelectTier(tier);
      });
    });
  }

  open() {
    this.isOpen = true;
    this.element.style.opacity = '1';
    this.element.style.pointerEvents = 'auto';
  }

  close() {
    this.isOpen = false;
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
  }
}
