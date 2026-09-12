/**
 * GarageMenu.js
 * ─────────────────────────────────────────────────────────────
 * Outpost Garage Outfitter with REAL numeric telemetry effects:
 *   - Turbine Charger: +25% Max Motor Torque (acceleration)
 *   - Bilstein Rally Suspension: +35% Suspension Damping (roll reduction)
 *   - Extended Cell: Tank capacity 100L -> 140L
 *   - Signal Noise Filter: -40% False Positive Sensor Noise
 *   - All-Terrain Compound: +35% Lateral Tire Grip
 */

export class GarageMenu {
  /**
   * @param {HTMLElement} parent
   * @param {Object} context - { vehicle, physics, sensors }
   * @param {import('../../audio/AudioEngine.js').AudioEngine} [audio]
   */
  constructor(parent, context = {}, audio = null) {
    this.parent = parent;
    this.context = context;
    this.audio = audio;
    this.isOpen = false;

    // Installed upgrades set
    const savedUpgrades = this.context.state?.get ? (this.context.state.get().upgrades || []) : [];
    this.installed = new Set(savedUpgrades);

    this.upgrades = [
      {
        id: 'turbine',
        name: 'HYBRID TURBINE CHARGER',
        stat: '+25% Motor Torque & Throttle Response',
        desc: 'Spools instantaneous electric-turbo boost for mountain grades.',
        apply: (v) => { if (v) v.maxMotorTorque = (v.maxMotorTorque || 3500) * 1.25; },
        revert: (v) => { if (v) v.maxMotorTorque = (v.maxMotorTorque || 3500) / 1.25; },
      },
      {
        id: 'suspension',
        name: 'BILSTEIN RALLY COILOVERS',
        stat: '-35% Body Roll / +35% Dampening',
        desc: 'Stabilizes chassis pitch and roll dynamics through washboard gravel.',
        apply: (v) => { if (v) v.suspensionDamping = (v.suspensionDamping || 2.5) * 1.35; },
        revert: (v) => { if (v) v.suspensionDamping = (v.suspensionDamping || 2.5) / 1.35; },
      },
      {
        id: 'fuelcell',
        name: 'AUXILIARY TITANIUM FUEL CELL',
        stat: 'Capacity: 100L → 140L (+40%)',
        desc: 'Pressurized dual auxiliary bladders for prolonged autonomous sorties.',
        apply: (v) => {
          if (v) {
            v.tankCapacity = 140;
            v.fuelRemaining = Math.max(v.fuelRemaining, 140);
          }
        },
        revert: (v) => {
          if (v) {
            v.tankCapacity = 100;
            v.fuelRemaining = Math.min(v.fuelRemaining, 100);
          }
        },
      },
      {
        id: 'filter',
        name: 'DIGITAL SENSOR BANDPASS FILTER',
        stat: '-40% False Positive Noise',
        desc: 'Kalman filtering algorithm scrubs atmospheric false alarms.',
        apply: (v, s) => {
          if (s?.tier?.sensorNoise) {
            s.tier.sensorNoise.falsePositiveRate *= 0.6;
          }
        },
        revert: (v, s) => {
          if (s?.tier?.sensorNoise) {
            s.tier.sensorNoise.falsePositiveRate /= 0.6;
          }
        },
      },
      {
        id: 'tires',
        name: 'ALL-TERRAIN KEVLAR TIRES',
        stat: '+35% Cornering Grip & Traction',
        desc: 'Siped tread compound prevents lateral skidding on loose dirt roads.',
        apply: (v) => { if (v) v.tireGrip = (v.tireGrip || 1.0) * 1.35; },
        revert: (v) => { if (v) v.tireGrip = (v.tireGrip || 1.0) / 1.35; },
      },
    ];

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'garage-menu';
    this.element.className = 'glass-panel-heavy interactive-panel';
    this.element.style.position = 'fixed';
    this.element.style.inset = '40px auto 40px 50%';
    this.element.style.transform = 'translateX(-50%) scale(0.96)';
    this.element.style.width = '680px';
    this.element.style.borderRadius = '8px';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.zIndex = '90';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transition = 'opacity var(--dur-panel) var(--ease-shared), transform var(--dur-panel) var(--ease-shared)';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '18px 24px';
    header.style.borderBottom = '1px solid var(--border-glass)';
    header.innerHTML = `
      <div>
        <div style="font-family:var(--font-hud); font-size:20px; font-weight:700; letter-spacing:0.12em; color:var(--accent-amber);">
          RANGER OUTFITTER // VEHICLE TUNING
        </div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
          Direct mechanical telemetry modifications. All enhancements provide real numerical dynamics.
        </div>
      </div>
      <button id="garage-close-btn" class="sentinel-btn" style="padding:4px 12px; font-size:12px;">✕</button>
    `;

    // Upgrades List
    this.list = document.createElement('div');
    this.list.style.flex = '1';
    this.list.style.padding = '20px 24px';
    this.list.style.display = 'flex';
    this.list.style.flexDirection = 'column';
    this.list.style.gap = '12px';
    this.list.style.overflowY = 'auto';

    this.element.appendChild(header);
    this.element.appendChild(this.list);

    this.element.querySelector('#garage-close-btn').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
    });

    this._renderCards();
  }

  _renderCards() {
    this.list.innerHTML = '';
    this.upgrades.forEach(up => {
      const isEquipped = this.installed.has(up.id);
      const card = document.createElement('div');
      card.className = 'glass-panel';
      card.style.padding = '14px 18px';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      card.style.border = isEquipped ? '1px solid var(--accent-amber)' : '1px solid var(--border-glass)';
      card.style.background = isEquipped ? 'var(--accent-amber-dim)' : 'rgba(255,255,255,0.03)';

      card.innerHTML = `
        <div style="max-width:440px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-family:var(--font-hud); font-size:15px; font-weight:700; color:var(--text-primary); letter-spacing:0.06em;">
              ${up.name}
            </span>
            ${isEquipped ? '<span style="font-family:var(--font-mono); font-size:9px; font-weight:700; color:var(--accent-amber); background:rgba(255,184,77,0.2); padding:2px 6px; border-radius:3px;">INSTALLED</span>' : ''}
          </div>
          <div style="font-family:var(--font-mono); font-size:11px; font-weight:700; color:var(--accent-cyan); margin:3px 0;">
            ${up.stat}
          </div>
          <div style="font-size:11px; color:var(--text-muted); line-height:1.4;">
            ${up.desc}
          </div>
        </div>
        <div>
          <button class="sentinel-btn ${isEquipped ? 'sentinel-btn-primary' : ''}" style="font-size:11px; padding:6px 14px;">
            ${isEquipped ? 'UNINSTALL' : 'INSTALL'}
          </button>
        </div>
      `;

      card.querySelector('button').addEventListener('click', () => {
        if (this.audio) this.audio.playClick();
        this.toggleUpgrade(up.id);
      });

      this.list.appendChild(card);
    });
  }

  toggleUpgrade(id) {
    const up = this.upgrades.find(u => u.id === id);
    if (!up) return;

    if (this.installed.has(id)) {
      this.installed.delete(id);
      up.revert(this.context.vehicle, this.context.sensors);
    } else {
      this.installed.add(id);
      up.apply(this.context.vehicle, this.context.sensors);
    }

    // Persist upgrades in game state
    if (this.context.state && typeof this.context.state.mutate === 'function') {
      this.context.state.mutate({ upgrades: [...this.installed] });
    }

    // Notify stats and achievements
    if (this.context.statsTracker) {
      this.context.statsTracker.recordUpgradeInstalled(this.installed.size);
    }
    if (this.context.achievementManager) {
      this.context.achievementManager.notifyUpgradesChanged(this.installed.size);
    }

    this._renderCards();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.element.style.opacity = '1';
    this.element.style.pointerEvents = 'auto';
    this.element.style.transform = 'translateX(-50%) scale(1.0)';
    if (this.audio) this.audio.playClick();
    this._renderCards();
  }

  close() {
    this.isOpen = false;
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transform = 'translateX(-50%) scale(0.96)';
  }
}
