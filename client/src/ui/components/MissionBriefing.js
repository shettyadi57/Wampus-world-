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

    this.card = document.createElement('div');
    this.card.className = 'glass-panel-heavy';
    this.card.style.width = '640px';
    this.card.style.padding = '36px 44px';
    this.card.style.borderRadius = '10px';
    this.card.style.border = '1px solid var(--border-glass-hover)';
    this.card.style.display = 'flex';
    this.card.style.flexDirection = 'column';
    this.card.style.gap = '20px';

    this.element.appendChild(this.card);
    this._renderMission();
  }

  _renderMission(customMission = null) {
    const active = customMission || this.context.missions?.getActiveMissionSummary?.() || {};
    const name = active.name || 'THE SILENT CHECKPOINT';
    const instruction = active.instruction || 'Traverse the procedural road network to designated tactical sector. Verify hazard signals with on-board telemetry.';
    const startId = (active.startNodeId || this.context.world?.spec?.startId || 'n_0_0').toUpperCase();
    const targetId = (active.targetNodeId || this.context.world?.spec?.objectiveId || 'n_4_4').toUpperCase();
    const threat = active.threatDesc || 'Abyssal Pits & Thermal Heat Signatures';

    this.card.innerHTML = `
      <div style="border-bottom:1px solid var(--border-glass); padding-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-family:var(--font-hud); font-size:12px; font-weight:700; letter-spacing:0.2em; color:var(--accent-amber);">
            OPERATION DIRECTIVE // TACTICAL BRIEFING
          </span>
          <span style="font-family:var(--font-mono); font-size:11px; color:var(--status-success); background:rgba(61,220,132,0.15); padding:2px 8px; border-radius:3px;">
            AUTHORISED
          </span>
        </div>
        <div style="font-family:var(--font-hud); font-size:28px; font-weight:700; color:var(--text-primary); margin-top:4px;">
          ${name}
        </div>
      </div>

      <div style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
        ${instruction}
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="glass-panel" style="padding:12px 16px;">
          <div style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); letter-spacing:0.08em;">STARTING SECTOR</div>
          <div style="font-family:var(--font-hud); font-size:16px; font-weight:700; color:var(--text-primary); margin-top:2px;">
            SECTOR [${startId}]
          </div>
        </div>
        <div class="glass-panel" style="padding:12px 16px;">
          <div style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); letter-spacing:0.08em;">OBJECTIVE TARGET</div>
          <div style="font-family:var(--font-hud); font-size:16px; font-weight:700; color:var(--accent-amber); margin-top:2px;">
            SECTOR [${targetId}]
          </div>
        </div>
        <div class="glass-panel" style="padding:12px 16px;">
          <div style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); letter-spacing:0.08em;">KNOWN THREATS</div>
          <div style="font-family:var(--font-hud); font-size:14px; font-weight:600; color:var(--status-danger); margin-top:2px;">
            ${threat}
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
          ENGAGE EXPEDITION
        </button>
      </div>
    `;

    this.card.querySelector('#briefing-engage-btn').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
      if (this.onEngage) this.onEngage();
    });
  }

  open(customMission = null) {
    this._renderMission(customMission);
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
