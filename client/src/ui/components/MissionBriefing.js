/**
 * MissionBriefing.js
 * ─────────────────────────────────────────────────────────────
 * Tactical Mission Briefing screen: "THE SILENT CHECKPOINT".
 * Displays sector parameters, known terrain risks, objective coordinates,
 * and the primary "ENGAGE MISSION" action trigger.
 */

export class MissionBriefing {
  /**
   * @param {HTMLElement} parent
   * @param {Object} context - { world, missions }
   * @param {Function} onEngage
   * @param {import('../../audio/AudioEngine.js').AudioEngine} [audio]
   */
  constructor(parent, context = {}, onEngage = null, audio = null) {
    this.parent = parent;
    this.context = context;
    this.onEngage = onEngage;
    this.audio = audio;
    this.isOpen = false;

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'mission-briefing';
    this.element.className = 'interactive-panel';
    this.element.style.position = 'fixed';
    this.element.style.inset = '0';
    this.element.style.background = 'radial-gradient(circle at 50% 50%, rgba(20, 22, 26, 0.6) 0%, rgba(10, 11, 14, 0.92) 100%)';
    this.element.style.backdropFilter = 'blur(16px)';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';
    this.element.style.zIndex = '85';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transition = 'opacity var(--dur-scene) var(--ease-shared)';

    const card = document.createElement('div');
    card.className = 'glass-panel-heavy';
    card.style.width = '640px';
    card.style.padding = '36px 44px';
    card.style.borderRadius = '10px';
    card.style.border = '1px solid var(--border-glass-hover)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '20px';

    card.innerHTML = `
      <div style="border-bottom:1px solid var(--border-glass); padding-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-family:var(--font-hud); font-size:12px; font-weight:700; letter-spacing:0.2em; color:var(--accent-amber);">
            OPERATION DIRECTIVE // BRIEFING
          </span>
          <span style="font-family:var(--font-mono); font-size:11px; color:var(--status-success); background:rgba(61,220,132,0.15); padding:2px 8px; border-radius:3px;">
            AUTHORISED
          </span>
        </div>
        <div style="font-family:var(--font-hud); font-size:28px; font-weight:700; color:var(--text-primary); margin-top:4px;">
          THE SILENT CHECKPOINT
        </div>
      </div>

      <div style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
        A remote mountain relay outpost has ceased scheduled transmissions. Dense atmospheric anomalies obstruct satellite telemetry. You are tasked with navigating the procedural road network, discovering the objective beacon, and avoiding known geological fissures and roaming predator signatures.
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="glass-panel" style="padding:12px 16px;">
          <div style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); letter-spacing:0.08em;">STARTING SECTOR</div>
          <div style="font-family:var(--font-hud); font-size:16px; font-weight:700; color:var(--text-primary); margin-top:2px;">
            RANGER STATION (NODE 0)
          </div>
        </div>
        <div class="glass-panel" style="padding:12px 16px;">
          <div style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); letter-spacing:0.08em;">OBJECTIVE TARGET</div>
          <div style="font-family:var(--font-hud); font-size:16px; font-weight:700; color:var(--accent-amber); margin-top:2px;">
            RELAY BEACON (CRYSTALLINE)
          </div>
        </div>
        <div class="glass-panel" style="padding:12px 16px;">
          <div style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); letter-spacing:0.08em;">KNOWN THREATS</div>
          <div style="font-family:var(--font-hud); font-size:14px; font-weight:600; color:var(--status-danger); margin-top:2px;">
            ABYSSAL PITS & PROWLER
          </div>
        </div>
        <div class="glass-panel" style="padding:12px 16px;">
          <div style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); letter-spacing:0.08em;">PRIMARY SENSORS</div>
          <div style="font-family:var(--font-hud); font-size:14px; font-weight:600; color:var(--accent-cyan); margin-top:2px;">
            THERMAL / WIND / RADAR
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
        <button id="briefing-engage-btn" class="sentinel-btn sentinel-btn-primary" style="padding:12px 32px; font-size:15px;">
          ENGAGE MISSION
        </button>
      </div>
    `;

    this.element.appendChild(card);

    card.querySelector('#briefing-engage-btn').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.onEngage) this.onEngage();
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
