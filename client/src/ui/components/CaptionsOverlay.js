/**
 * CaptionsOverlay.js
 * ─────────────────────────────────────────────────────────────
 * Real-time audio cue accessibility captions.
 *
 * Displays high-contrast, non-obtrusive subtitles for all audio cues:
 *   - Engine roar / gear shift
 *   - Tire skid & braking lockup
 *   - Collision impact contact
 *   - Barometric breeze (Pit)
 *   - Thermal stench (Hunter)
 *   - Hunter dread drone proximity
 *   - Objective glitter chime
 *   - AI tactical calculation alerts
 */

export class CaptionsOverlay {
  /**
   * @param {HTMLElement} parent
   * @param {import('../../audio/AudioEngine.js').AudioEngine} [audio]
   * @param {boolean} [enabled=true]
   */
  constructor(parent, audio = null, enabled = true) {
    this.parent = parent;
    this.audio = audio;
    this.enabled = enabled;
    this.activeToasts = [];

    this._build();
    this.parent.appendChild(this.element);

    if (this.audio) {
      this.audio.onCaption((text, type) => this.show(text, type));
    }
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'audio-captions-overlay';
    this.element.style.position = 'fixed';
    this.element.style.bottom = '96px';
    this.element.style.left = '50%';
    this.element.style.transform = 'translateX(-50%)';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column-reverse';
    this.element.style.alignItems = 'center';
    this.element.style.gap = '6px';
    this.element.style.pointerEvents = 'none';
    this.element.style.zIndex = '35';
    this.element.style.maxWidth = '600px';
    this.element.style.width = '90%';
  }

  setEnabled(val) {
    this.enabled = !!val;
    if (!this.enabled) {
      this.element.innerHTML = '';
    }
  }

  /**
   * Display an audio cue caption.
   * @param {string} text
   * @param {'sfx'|'hazard'|'vehicle'|'sensor'|'ai'|'system'} [category='sfx']
   */
  show(text, category = 'sfx') {
    if (!this.enabled || !text) return;

    const colors = {
      hazard: 'var(--status-danger)',
      sensor: 'var(--accent-cyan)',
      ai: 'var(--accent-amber)',
      vehicle: 'var(--text-primary)',
      system: 'var(--status-success)',
      sfx: 'var(--text-secondary)',
    };

    const borderColor = colors[category] || 'var(--border-glass)';

    const toast = document.createElement('div');
    toast.className = 'glass-panel';
    toast.style.padding = '5px 14px';
    toast.style.borderRadius = '4px';
    toast.style.border = `1px solid ${borderColor}`;
    toast.style.background = 'rgba(10, 12, 16, 0.88)';
    toast.style.backdropFilter = 'blur(8px)';
    toast.style.fontFamily = 'var(--font-mono)';
    toast.style.fontSize = '12px';
    toast.style.fontWeight = '600';
    toast.style.letterSpacing = '0.04em';
    toast.style.color = '#FFFFFF';
    toast.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.6)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    toast.textContent = text;

    this.element.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Limit active toasts to 3
    while (this.element.children.length > 3) {
      this.element.removeChild(this.element.firstChild);
    }

    // Auto dismiss after 2.6s
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        if (toast.parentNode === this.element) {
          this.element.removeChild(toast);
        }
      }, 250);
    }, 2600);
  }
}
