/**
 * ContextualSensorHUD.js
 * ─────────────────────────────────────────────────────────────
 * Contextual sensor alert interface that slides in ONLY when
 * anomalies are detected (Breeze, Stench, Glitter, Bump, Hunter).
 *
 * Design constraints:
 *   - Cyan (#4FD1FF) reserved for active sensor signals
 *   - Danger (#FF4D4D) for high-threat signatures
 *   - Shared motion easing & durations (var(--transition-panel))
 *   - Auto-dismisses when clear of anomaly zones
 */

export class ContextualSensorHUD {
  /**
   * @param {HTMLElement} parent
   * @param {import('../../audio/AudioEngine.js').AudioEngine} [audio]
   */
  constructor(parent, audio = null) {
    this.parent = parent;
    this.audio = audio;
    this.isVisible = false;
    this.lastPerceptHash = '';
    this.dismissTimeout = null;

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'contextual-sensor-hud';
    this.element.className = 'glass-panel';
    this.element.style.position = 'absolute';
    this.element.style.top = '72px';
    this.element.style.left = '50%';
    this.element.style.transform = 'translateX(-50%) translateY(-20px)';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.padding = '10px 18px';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.gap = '16px';
    this.element.style.borderRadius = '4px';
    this.element.style.border = '1px solid var(--border-glass)';
    this.element.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';
    this.element.style.transition = 'opacity var(--dur-panel) var(--ease-shared), transform var(--dur-panel) var(--ease-shared), border-color var(--dur-panel) var(--ease-shared)';
    this.element.style.zIndex = '12';

    // Header label
    this.badge = document.createElement('div');
    this.badge.style.display = 'flex';
    this.badge.style.alignItems = 'center';
    this.badge.style.gap = '6px';
    this.badge.style.fontFamily = 'var(--font-hud)';
    this.badge.style.fontSize = '12px';
    this.badge.style.fontWeight = '700';
    this.badge.style.letterSpacing = '0.12em';
    this.badge.style.color = 'var(--accent-cyan)';
    this.badge.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent-cyan); box-shadow:0 0 8px var(--accent-cyan);"></span>
      <span>ANOMALY DETECTED</span>
    `;

    // Sensor feeds container
    this.feeds = document.createElement('div');
    this.feeds.style.display = 'flex';
    this.feeds.style.alignItems = 'center';
    this.feeds.style.gap = '12px';
    this.feeds.style.fontFamily = 'var(--font-mono)';
    this.feeds.style.fontSize = '11px';

    this.element.appendChild(this.badge);
    this.element.appendChild(this.feeds);
  }

  /**
   * @param {Object} percepts
   */
  update(percepts) {
    if (!percepts) {
      this.hide();
      return;
    }

    const { breeze, stench, glitter, bump } = percepts;
    const hasAnomaly = breeze || stench || glitter || bump;

    if (!hasAnomaly) {
      this.hide();
      return;
    }

    // Build unique anomaly signature
    const hash = `${breeze ? 'B' : ''}${stench ? 'S' : ''}${glitter ? 'G' : ''}${bump ? 'X' : ''}`;
    if (hash !== this.lastPerceptHash) {
      this.lastPerceptHash = hash;
      this._renderFeeds(percepts);
      this.show(stench || bump);
    }
  }

  _renderFeeds(p) {
    this.feeds.innerHTML = '';
    const isCritical = p.stench || p.bump;

    // Shift styling on threat level
    if (isCritical) {
      this.element.style.borderColor = 'var(--status-danger)';
      this.badge.querySelector('span:first-child').style.background = 'var(--status-danger)';
      this.badge.querySelector('span:first-child').style.boxShadow = '0 0 10px var(--status-danger)';
      this.badge.querySelector('span:last-child').style.color = 'var(--status-danger)';
      this.badge.querySelector('span:last-child').textContent = 'HAZARD PROXIMITY';
    } else {
      this.element.style.borderColor = 'var(--accent-cyan)';
      this.badge.querySelector('span:first-child').style.background = 'var(--accent-cyan)';
      this.badge.querySelector('span:first-child').style.boxShadow = '0 0 8px var(--accent-cyan)';
      this.badge.querySelector('span:last-child').style.color = 'var(--accent-cyan)';
      this.badge.querySelector('span:last-child').textContent = 'ANOMALY DETECTED';
    }

    const items = [];
    if (p.breeze) {
      items.push({
        label: 'WIND / BARO',
        val: 'BREEZE (PIT VICINITY)',
        color: 'var(--accent-cyan)',
      });
    }
    if (p.stench) {
      items.push({
        label: 'THERMAL / AIR',
        val: 'STENCH (HUNTER SIGNATURE)',
        color: 'var(--status-danger)',
      });
    }
    if (p.glitter) {
      items.push({
        label: 'ROAD SCANNER',
        val: 'GLITTER (OBJECTIVE RESONANCE)',
        color: 'var(--accent-amber)',
      });
    }
    if (p.bump) {
      items.push({
        label: 'RADAR COLLISION',
        val: 'OBSTACLE CONTACT',
        color: 'var(--status-danger)',
      });
    }

    items.forEach(item => {
      const pill = document.createElement('div');
      pill.style.background = 'rgba(255,255,255,0.05)';
      pill.style.padding = '4px 8px';
      pill.style.borderRadius = '3px';
      pill.style.borderLeft = `3px solid ${item.color}`;
      pill.innerHTML = `
        <span style="color:var(--text-muted); font-size:9px; display:block; letter-spacing:0.05em;">${item.label}</span>
        <span style="color:${item.color}; font-weight:700;">${item.val}</span>
      `;
      this.feeds.appendChild(pill);
    });
  }

  show(isCritical = false) {
    if (!this.isVisible) {
      this.isVisible = true;
      this.element.style.opacity = '1';
      this.element.style.transform = 'translateX(-50%) translateY(0)';
      if (this.audio) {
        if (isCritical) this.audio.playStench();
        else this.audio.playBreeze();
      }
    }
  }

  hide() {
    if (this.isVisible) {
      this.isVisible = false;
      this.lastPerceptHash = '';
      this.element.style.opacity = '0';
      this.element.style.transform = 'translateX(-50%) translateY(-20px)';
    }
  }
}
