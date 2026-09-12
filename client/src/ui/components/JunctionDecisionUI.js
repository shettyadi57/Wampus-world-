/**
 * JunctionDecisionUI.js
 * ─────────────────────────────────────────────────────────────
 * Tactical junction indicator displaying risk % per direction.
 * Interactively responds to real-time steering wheel angle
 * (steer left -> highlights left branch, steer right -> highlights right branch).
 * Settles naturally on commit — NEVER pauses the game or forces a modal popup.
 */

export class JunctionDecisionUI {
  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    this.parent = parent;
    this.isVisible = false;
    this.currentNodeId = null;
    this.branches = [];

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'junction-decision-ui';
    this.element.className = 'glass-panel';
    this.element.style.position = 'absolute';
    this.element.style.top = '70px';
    this.element.style.left = '50%';
    this.element.style.transform = 'translateX(-50%) translateY(-10px)';
    this.element.style.padding = '12px 20px';
    this.element.style.border = '1px solid var(--border-glass)';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transition = 'opacity var(--dur-panel) var(--ease-shared), transform var(--dur-panel) var(--ease-shared)';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.alignItems = 'center';
    this.element.style.gap = '8px';
    this.element.style.zIndex = '10';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    header.innerHTML = `
      <span style="font-family:var(--font-hud); font-size:11px; font-weight:700; letter-spacing:0.12em; color:var(--text-muted);">JUNCTION APPROACH // SELECT VECTOR</span>
    `;

    // Branch cards container
    this.branchesContainer = document.createElement('div');
    this.branchesContainer.style.display = 'flex';
    this.branchesContainer.style.gap = '12px';

    this.element.appendChild(header);
    this.element.appendChild(this.branchesContainer);
  }

  /**
   * Update branches and interactive steering commitment.
   * @param {string} nodeId - Current junction node
   * @param {Array<{nodeId: string, risk: number, relativeBearing?: number}>} rankedBranches
   * @param {number} steerAngle - Current vehicle steer angle in radians (-0.6 to 0.6)
   */
  update(nodeId, rankedBranches, steerAngle = 0) {
    // Only show when there are 2 or more branching options
    if (!nodeId || !rankedBranches || rankedBranches.length < 2) {
      this.hide();
      return;
    }

    if (nodeId !== this.currentNodeId || rankedBranches.length !== this.branches.length) {
      this.currentNodeId = nodeId;
      this.branches = rankedBranches;
      this._renderCards();
      this.show();
    }

    // Determine committed branch based on steering input
    // steerAngle < -0.15 => Leftmost; steerAngle > 0.15 => Rightmost; else center
    const numCards = this.cards?.length ?? 0;
    if (numCards > 0) {
      let activeIndex = 0;
      if (numCards === 2) {
        activeIndex = steerAngle < 0 ? 0 : 1;
      } else if (numCards >= 3) {
        if (steerAngle < -0.15) activeIndex = 0; // Left
        else if (steerAngle > 0.15) activeIndex = numCards - 1; // Right
        else activeIndex = Math.floor(numCards / 2); // Straight
      }

      this.cards.forEach((card, idx) => {
        const isSelected = idx === activeIndex && Math.abs(steerAngle) > 0.05;
        if (isSelected) {
          card.style.borderColor = 'var(--accent-amber)';
          card.style.background = 'var(--accent-amber-dim)';
          card.style.transform = 'scale(1.05)';
          card.querySelector('.commit-tag').style.opacity = '1';
        } else {
          card.style.borderColor = 'var(--border-glass)';
          card.style.background = 'rgba(255,255,255,0.04)';
          card.style.transform = 'scale(1.0)';
          card.querySelector('.commit-tag').style.opacity = '0';
        }
      });
    }
  }

  _renderCards() {
    this.branchesContainer.innerHTML = '';
    this.cards = [];

    this.branches.forEach((b, idx) => {
      const card = document.createElement('div');
      card.className = 'junction-branch-card';
      card.style.padding = '8px 14px';
      card.style.borderRadius = '4px';
      card.style.border = '1px solid var(--border-glass)';
      card.style.background = 'rgba(255,255,255,0.04)';
      card.style.minWidth = '90px';
      card.style.textAlign = 'center';
      card.style.transition = 'all var(--dur-micro) var(--ease-shared)';

      const riskPct = (b.risk * 100).toFixed(0);
      let riskColor = 'var(--status-success)';
      let riskGlyph = '✓ SAFE';
      if (b.risk > 0.5) {
        riskColor = 'var(--status-danger)';
        riskGlyph = '■ DANGER';
      } else if (b.risk > 0.2) {
        riskColor = 'var(--status-warning)';
        riskGlyph = '▲ CAUTION';
      }

      let dirLabel = 'ROUTE ' + (idx + 1);
      if (this.branches.length === 2) {
        dirLabel = idx === 0 ? '← LEFT' : 'RIGHT →';
      } else if (this.branches.length === 3) {
        dirLabel = idx === 0 ? '← LEFT' : idx === 1 ? '↑ STRAIGHT' : 'RIGHT →';
      }

      card.innerHTML = `
        <div style="font-family:var(--font-hud); font-size:10px; font-weight:700; color:var(--accent-amber); letter-spacing:0.08em; margin-bottom:2px;">
          ${dirLabel}
        </div>
        <div style="font-family:var(--font-hud); font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:2px;">
          ${b.nodeId.toUpperCase()}
        </div>
        <div style="font-family:var(--font-hud); font-size:11px; font-weight:600; color:${riskColor};">
          <span style="font-weight:bold;">${riskGlyph}</span> (${riskPct}%)
        </div>
        <div class="commit-tag" style="font-family:var(--font-mono); font-size:9px; color:var(--accent-amber); font-weight:700; opacity:0; transition:opacity var(--dur-micro) var(--ease-shared); margin-top:2px;">
          STEER TO COMMIT
        </div>
      `;

      this.branchesContainer.appendChild(card);
      this.cards.push(card);
    });
  }

  show() {
    this.isVisible = true;
    this.element.style.opacity = '1';
    this.element.style.transform = 'translateX(-50%) translateY(0)';
  }

  hide() {
    if (this.isVisible) {
      this.isVisible = false;
      this.currentNodeId = null;
      this.element.style.opacity = '0';
      this.element.style.transform = 'translateX(-50%) translateY(-10px)';
    }
  }
}
