/**
 * MinimalHUD.js
 * ─────────────────────────────────────────────────────────────
 * Minimalistic telemetry cluster:
 *   - Speedometer with large geometric technical numerals
 *   - Physically-responsive sweeping RPM gauge arc
 *   - Segmented Fuel and Hull bars with threshold color shifts
 *   - Gear cluster (P, R, N, D)
 *   - Top horizontal Compass Tape (zero GPS breadcrumbs)
 */

export class MinimalHUD {
  constructor(parent) {
    this.parent = parent;
    this.element = document.createElement('div');
    this.element.id = 'minimal-hud';
    this.element.style.position = 'absolute';
    this.element.style.inset = '0';
    this.element.style.pointerEvents = 'none';

    this._buildCompass();
    this._buildCluster();
    this.parent.appendChild(this.element);

    this.currentRpmNorm = 0;
  }

  _buildCompass() {
    this.compassContainer = document.createElement('div');
    this.compassContainer.className = 'glass-panel';
    this.compassContainer.style.position = 'absolute';
    this.compassContainer.style.top = '16px';
    this.compassContainer.style.left = '50%';
    this.compassContainer.style.transform = 'translateX(-50%)';
    this.compassContainer.style.width = '340px';
    this.compassContainer.style.height = '42px';
    this.compassContainer.style.overflow = 'hidden';
    this.compassContainer.style.display = 'flex';
    this.compassContainer.style.alignItems = 'center';
    this.compassContainer.style.justifyContent = 'center';
    this.compassContainer.style.border = '1px solid var(--border-glass)';

    // Center index reticle
    const reticle = document.createElement('div');
    reticle.style.position = 'absolute';
    reticle.style.top = '0';
    reticle.style.bottom = '0';
    reticle.style.width = '2px';
    reticle.style.background = 'var(--accent-amber)';
    reticle.style.zIndex = '3';
    reticle.style.boxShadow = '0 0 8px var(--accent-amber)';

    // Moving tape track
    this.tapeTrack = document.createElement('div');
    this.tapeTrack.style.display = 'flex';
    this.tapeTrack.style.position = 'absolute';
    this.tapeTrack.style.transition = 'transform 0.05s linear';
    this.tapeTrack.style.fontFamily = 'var(--font-hud)';
    this.tapeTrack.style.fontSize = '13px';
    this.tapeTrack.style.fontWeight = '600';
    this.tapeTrack.style.letterSpacing = '0.08em';
    this.tapeTrack.style.color = 'var(--text-secondary)';

    // Generate repeat tape labels: N, 030, 060, E, 120, 150, S, 210, 240, W, 300, 330
    let tapeHtml = '';
    for (let loop = 0; loop < 3; loop++) {
      for (let deg = 0; deg < 360; deg += 30) {
        let label = deg.toString().padStart(3, '0');
        if (deg === 0) label = '<span style="color:var(--accent-amber);font-weight:700">N</span>';
        if (deg === 90) label = '<span style="color:var(--text-primary);font-weight:700">E</span>';
        if (deg === 180) label = '<span style="color:var(--text-primary);font-weight:700">S</span>';
        if (deg === 270) label = '<span style="color:var(--text-primary);font-weight:700">W</span>';
        tapeHtml += `<div style="width:55px; text-align:center; flex-shrink:0;">${label}</div>`;
      }
    }
    this.tapeTrack.innerHTML = tapeHtml;

    this.compassContainer.appendChild(reticle);
    this.compassContainer.appendChild(this.tapeTrack);
    this.element.appendChild(this.compassContainer);
  }

  _buildCluster() {
    this.cluster = document.createElement('div');
    this.cluster.className = 'glass-panel';
    this.cluster.style.position = 'absolute';
    this.cluster.style.bottom = '20px';
    this.cluster.style.left = '50%';
    this.cluster.style.transform = 'translateX(-50%)';
    this.cluster.style.padding = '14px 24px';
    this.cluster.style.display = 'flex';
    this.cluster.style.alignItems = 'center';
    this.cluster.style.gap = '24px';
    this.cluster.style.border = '1px solid var(--border-glass)';

    // 1. Gear Cluster
    this.gearContainer = document.createElement('div');
    this.gearContainer.style.display = 'flex';
    this.gearContainer.style.flexDirection = 'column';
    this.gearContainer.style.gap = '2px';
    this.gearContainer.style.fontFamily = 'var(--font-hud)';
    this.gearContainer.style.fontSize = '12px';
    this.gearContainer.style.fontWeight = '700';
    this.gearContainer.style.color = 'var(--text-disabled)';
    this.gearContainer.innerHTML = `
      <div id="gear-P">P</div>
      <div id="gear-R">R</div>
      <div id="gear-N">N</div>
      <div id="gear-D">D</div>
    `;

    // 2. Speed Readout & RPM Arc Gauge
    const gaugeWrapper = document.createElement('div');
    gaugeWrapper.style.position = 'relative';
    gaugeWrapper.style.width = '120px';
    gaugeWrapper.style.height = '70px';
    gaugeWrapper.style.display = 'flex';
    gaugeWrapper.style.flexDirection = 'column';
    gaugeWrapper.style.alignItems = 'center';
    gaugeWrapper.style.justifyContent = 'flex-end';

    // SVG RPM Arc
    gaugeWrapper.innerHTML = `
      <svg viewBox="0 0 120 70" style="position:absolute; inset:0; width:100%; height:100%;">
        <path d="M 15 65 A 50 50 0 0 1 105 65" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="6" stroke-linecap="round"/>
        <path id="rpm-arc-bar" d="M 15 65 A 50 50 0 0 1 105 65" fill="none" stroke="var(--accent-amber)" stroke-width="6" stroke-linecap="round" stroke-dasharray="142" stroke-dashoffset="142" style="transition: stroke-dashoffset 0.08s linear;"/>
      </svg>
      <div id="speed-num" style="font-family:var(--font-hud); font-size:42px; font-weight:700; line-height:1; color:var(--text-primary); letter-spacing:-0.03em;">0</div>
      <div style="font-family:var(--font-hud); font-size:11px; font-weight:600; letter-spacing:0.12em; color:var(--text-muted); margin-bottom:2px;">KM/H</div>
    `;

    // 3. Segmented Fuel & Hull Bars
    this.barsContainer = document.createElement('div');
    this.barsContainer.style.display = 'flex';
    this.barsContainer.style.flexDirection = 'column';
    this.barsContainer.style.gap = '8px';
    this.barsContainer.style.width = '110px';
    this.barsContainer.style.fontFamily = 'var(--font-hud)';
    this.barsContainer.style.fontSize = '11px';
    this.barsContainer.style.fontWeight = '600';

    this.barsContainer.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span style="color:var(--text-muted); letter-spacing:0.08em;">FUEL</span>
          <span id="fuel-pct" style="color:var(--accent-amber);">100%</span>
        </div>
        <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden;">
          <div id="fuel-bar-fill" style="width:100%; height:100%; background:var(--accent-amber); transition: width 0.2s var(--ease-shared), background 0.3s;"></div>
        </div>
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span style="color:var(--text-muted); letter-spacing:0.08em;">HULL</span>
          <span id="hull-pct" style="color:var(--status-success);">100%</span>
        </div>
        <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden;">
          <div id="hull-bar-fill" style="width:100%; height:100%; background:var(--status-success); transition: width 0.2s var(--ease-shared);"></div>
        </div>
      </div>
    `;

    this.cluster.appendChild(this.gearContainer);
    this.cluster.appendChild(gaugeWrapper);
    this.cluster.appendChild(this.barsContainer);
    this.element.appendChild(this.cluster);

    // Cached elements
    this.speedNum = gaugeWrapper.querySelector('#speed-num');
    this.rpmArc = gaugeWrapper.querySelector('#rpm-arc-bar');
    this.fuelPct = this.barsContainer.querySelector('#fuel-pct');
    this.fuelBar = this.barsContainer.querySelector('#fuel-bar-fill');
    this.hullPct = this.barsContainer.querySelector('#hull-pct');
    this.hullBar = this.barsContainer.querySelector('#hull-bar-fill');
    this.gearP = this.gearContainer.querySelector('#gear-P');
    this.gearR = this.gearContainer.querySelector('#gear-R');
    this.gearN = this.gearContainer.querySelector('#gear-N');
    this.gearD = this.gearContainer.querySelector('#gear-D');
  }

  update(telemetry, vehicle) {
    if (!telemetry || !vehicle) return;

    // 1. Speedometer
    const speed = telemetry.speedKph;
    if (this.speedNum) {
      this.speedNum.textContent = Math.round(speed).toString();
    }

    // 2. RPM Arc Sweep (physically responsive to throttle & speed)
    const throttle = vehicle.throttleDemand ?? 0;
    const targetRpmNorm = Math.min(1.0, (speed / 120.0) * 0.7 + throttle * 0.35);
    this.currentRpmNorm += (targetRpmNorm - this.currentRpmNorm) * 0.2;

    if (this.rpmArc) {
      // SVG stroke-dasharray = 142 (half-circle arc length)
      const offset = 142 - (this.currentRpmNorm * 142);
      this.rpmArc.style.strokeDashoffset = offset.toFixed(1);
      this.rpmArc.style.stroke = this.currentRpmNorm > 0.85 ? 'var(--status-danger)' : 'var(--accent-amber)';
    }

    // 3. Fuel with threshold color shifts
    const fuelPctVal = Math.max(0, Math.min(100, (vehicle.fuelRemaining / vehicle.tankCapacity) * 100));
    if (this.fuelPct) this.fuelPct.textContent = `${fuelPctVal.toFixed(0)}%`;
    if (this.fuelBar) {
      this.fuelBar.style.width = `${fuelPctVal}%`;
      if (fuelPctVal < 15) {
        this.fuelBar.style.background = 'var(--status-danger)';
        if (this.fuelPct) this.fuelPct.style.color = 'var(--status-danger)';
      } else if (fuelPctVal < 35) {
        this.fuelBar.style.background = 'var(--status-warning)';
        if (this.fuelPct) this.fuelPct.style.color = 'var(--status-warning)';
      } else {
        this.fuelBar.style.background = 'var(--accent-amber)';
        if (this.fuelPct) this.fuelPct.style.color = 'var(--accent-amber)';
      }
    }

    // 4. Hull Integrity bar
    const hullVal = Math.max(0, Math.min(100, vehicle.hullIntegrity ?? 100));
    if (this.hullPct) this.hullPct.textContent = `${Math.round(hullVal)}%`;
    if (this.hullBar) {
      this.hullBar.style.width = `${hullVal}%`;
      if (hullVal < 25) {
        this.hullBar.style.background = 'var(--status-danger)';
        if (this.hullPct) this.hullPct.style.color = 'var(--status-danger)';
      } else if (hullVal < 50) {
        this.hullBar.style.background = 'var(--status-warning)';
        if (this.hullPct) this.hullPct.style.color = 'var(--status-warning)';
      } else {
        this.hullBar.style.background = 'var(--status-success)';
        if (this.hullPct) this.hullPct.style.color = 'var(--status-success)';
      }
    }

    // 4. Gears
    const isReverse = vehicle.reverseEngaged;
    const isHandbrake = vehicle.handbrakeEngaged;
    const isMoving = speed > 0.5;

    this.gearP.style.color = isHandbrake ? 'var(--status-danger)' : 'var(--text-disabled)';
    this.gearR.style.color = isReverse ? 'var(--accent-amber)' : 'var(--text-disabled)';
    this.gearN.style.color = (!isReverse && !isHandbrake && !isMoving) ? 'var(--text-primary)' : 'var(--text-disabled)';
    this.gearD.style.color = (!isReverse && !isHandbrake && isMoving) ? 'var(--accent-amber)' : 'var(--text-disabled)';

    // 5. Compass Tape
    // yaw is in radians (0 to 2*PI). 55px per 30 degrees = 1.833px per degree
    const deg = ((vehicle.yaw * (180 / Math.PI)) % 360 + 360) % 360;
    const tapeX = -(deg * (55 / 30)) - (360 * (55 / 30));
    if (this.tapeTrack) {
      this.tapeTrack.style.transform = `translateX(${tapeX}px)`;
    }
  }

  show() { this.element.style.display = 'block'; }
  hide() { this.element.style.display = 'none'; }
}
