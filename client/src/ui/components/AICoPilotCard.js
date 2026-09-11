/**
 * AICoPilotCard.js
 * ─────────────────────────────────────────────────────────────
 * Non-intrusive AI Co-Pilot recommendation card.
 * Slides in from bottom-right only when active advice from the
 * Stage 1 symbolic RiskModel is available. Auto-dismisses after
 * a timeout or when the vehicle clears the decision area.
 */

export class AICoPilotCard {
  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    this.parent = parent;
    this.isVisible = false;
    this.lastRecommendationNode = null;
    this.dismissTimer = null;

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'ai-copilot-card';
    this.element.className = 'glass-panel';
    this.element.style.position = 'absolute';
    this.element.style.bottom = '110px';
    this.element.style.right = '24px';
    this.element.style.width = '320px';
    this.element.style.padding = '14px 18px';
    this.element.style.border = '1px solid var(--border-glass)';
    this.element.style.borderLeft = '4px solid var(--accent-amber)';
    this.element.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6)';
    this.element.style.transform = 'translateX(40px)';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transition = 'opacity var(--dur-panel) var(--ease-shared), transform var(--dur-panel) var(--ease-shared)';
    this.element.style.zIndex = '11';

    this.element.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent-amber); box-shadow:0 0 8px var(--accent-amber-glow);"></span>
          <span style="font-family:var(--font-hud); font-size:12px; font-weight:700; letter-spacing:0.12em; color:var(--accent-amber);">CO-PILOT ADVISORY</span>
        </div>
        <span id="copilot-conf" style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">CONF: 95%</span>
      </div>

      <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px;">
        <div>
          <span style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); display:block; letter-spacing:0.05em;">RECOMMENDED VECTOR</span>
          <span id="copilot-node" style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--text-primary);">NODE --</span>
        </div>
        <div style="text-align:right;">
          <span style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); display:block; letter-spacing:0.05em;">EST. RISK</span>
          <span id="copilot-risk" style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--status-success);">0%</span>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.03); border-radius:3px; padding:6px 10px; border:1px solid rgba(255,255,255,0.05);">
        <div style="font-family:var(--font-hud); font-size:10px; color:var(--text-muted); letter-spacing:0.05em; margin-bottom:2px;">EVIDENCE CHAIN</div>
        <div id="copilot-reason" style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); line-height:1.35; max-height:45px; overflow:hidden; text-overflow:ellipsis;">
          Analyzing local sensory field...
        </div>
      </div>
    `;

    this.confEl = this.element.querySelector('#copilot-conf');
    this.nodeEl = this.element.querySelector('#copilot-node');
    this.riskEl = this.element.querySelector('#copilot-risk');
    this.reasonEl = this.element.querySelector('#copilot-reason');
  }

  /**
   * @param {Object} recommendation - { nodeId, risk, confidence, reason }
   */
  update(recommendation) {
    if (!recommendation || !recommendation.nodeId) {
      if (this.isVisible && !this.dismissTimer) {
        this.dismissTimer = setTimeout(() => this.hide(), 4000);
      }
      return;
    }

    // If recommendation changed or fresh, display it
    if (recommendation.nodeId !== this.lastRecommendationNode) {
      this.lastRecommendationNode = recommendation.nodeId;
      this._render(recommendation);
      this.show();

      // Reset auto-dismiss timer (6 seconds)
      if (this.dismissTimer) clearTimeout(this.dismissTimer);
      this.dismissTimer = setTimeout(() => {
        this.hide();
      }, 6000);
    }
  }

  _render(rec) {
    if (this.confEl) this.confEl.textContent = `CONF: ${rec.confidence ?? 90}%`;
    if (this.nodeEl) this.nodeEl.textContent = rec.nodeId.toUpperCase();

    const riskVal = typeof rec.risk === 'number' ? (rec.risk * 100).toFixed(0) : '0';
    if (this.riskEl) {
      this.riskEl.textContent = `${riskVal}%`;
      const r = rec.risk ?? 0;
      if (r < 0.2) this.riskEl.style.color = 'var(--status-success)';
      else if (r < 0.55) this.riskEl.style.color = 'var(--status-warning)';
      else this.riskEl.style.color = 'var(--status-danger)';
    }

    if (this.reasonEl) {
      this.reasonEl.textContent = rec.reason || 'Evidence verifies optimal clearance.';
    }
  }

  show() {
    this.isVisible = true;
    this.element.style.opacity = '1';
    this.element.style.transform = 'translateX(0)';
  }

  hide() {
    this.isVisible = false;
    this.lastRecommendationNode = null;
    this.element.style.opacity = '0';
    this.element.style.transform = 'translateX(40px)';
  }
}
