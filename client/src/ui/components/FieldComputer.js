/**
 * FieldComputer.js
 * ─────────────────────────────────────────────────────────────
 * Full-screen tactical Field Computer terminal (Toggled via TAB or F key).
 * Smoked glass aesthetic with CRT scanline filter.
 *
 * Core subsystems:
 *   1. Topographical Map with active Fog-of-War
 *   2. Live Animated 5-Stage Reasoning Pipeline
 *   3. Evidence Audit Log & Symbolic Knowledge State Table
 *   4. Multi-Route Risk & Fuel Comparison
 *   5. Mission Directives & Telemetry
 */

export class FieldComputer {
  /**
   * @param {HTMLElement} parent
   * @param {Object} context - { world, kb, inference, riskModel, missions, vehicle }
   * @param {import('../../audio/AudioEngine.js').AudioEngine} [audio]
   */
  constructor(parent, context = {}, audio = null) {
    this.parent = parent;
    this.context = context;
    this.audio = audio;
    this.isOpen = false;
    this.activeTab = 'map'; // 'map' | 'reasoning' | 'evidence' | 'routes' | 'missions'

    this._build();
    this.parent.appendChild(this.element);
  }

  _build() {
    this.element = document.createElement('div');
    this.element.id = 'field-computer-terminal';
    this.element.className = 'glass-panel-heavy scanlines interactive-panel';
    this.element.style.position = 'fixed';
    this.element.style.inset = '24px';
    this.element.style.borderRadius = '8px';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.zIndex = '100';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transform = 'scale(0.98)';
    this.element.style.transition = 'opacity var(--dur-panel) var(--ease-shared), transform var(--dur-panel) var(--ease-shared)';

    // Top Header Bar
    this.header = document.createElement('div');
    this.header.style.display = 'flex';
    this.header.style.justifyContent = 'space-between';
    this.header.style.alignItems = 'center';
    this.header.style.padding = '14px 24px';
    this.header.style.borderBottom = '1px solid var(--border-glass)';
    this.header.style.background = 'rgba(0, 0, 0, 0.3)';

    this.header.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px;">
        <span style="font-family:var(--font-hud); font-size:18px; font-weight:700; letter-spacing:0.15em; color:var(--accent-amber);">
          FIELD COMPUTER // SENTINEL OS v4.8
        </span>
        <span style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan); background:var(--accent-cyan-dim); padding:3px 8px; border-radius:3px;">
          SYS: NOMINAL
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
          [TAB / F] CLOSE
        </span>
        <button id="fc-close-btn" class="sentinel-btn" style="padding:4px 12px; font-size:12px;">✕</button>
      </div>
    `;

    // Navigation Tabs Bar
    this.navBar = document.createElement('div');
    this.navBar.style.display = 'flex';
    this.navBar.style.gap = '8px';
    this.navBar.style.padding = '10px 24px';
    this.navBar.style.borderBottom = '1px solid var(--border-glass)';
    this.navBar.style.background = 'rgba(0, 0, 0, 0.2)';

    const tabs = [
      { id: 'map', label: '1. TOPOGRAPHIC MAP' },
      { id: 'reasoning', label: '2. REASONING PIPELINE' },
      { id: 'evidence', label: '3. EVIDENCE & KNOWLEDGE' },
      { id: 'routes', label: '4. ROUTE COMPARISON' },
      { id: 'missions', label: '5. MISSION DIRECTIVES' },
      { id: 'stats', label: '6. STATS & ACHIEVEMENTS' },
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.id = `fc-tab-${tab.id}`;
      btn.className = 'sentinel-btn';
      btn.style.fontSize = '12px';
      btn.style.padding = '8px 14px';
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        if (this.audio) this.audio.playClick();
        this.switchTab(tab.id);
      });
      this.navBar.appendChild(btn);
    });

    // Main Content Area
    this.contentArea = document.createElement('div');
    this.contentArea.style.flex = '1';
    this.contentArea.style.padding = '20px 24px';
    this.contentArea.style.overflowY = 'auto';
    this.contentArea.style.fontFamily = 'var(--font-mono)';

    this.element.appendChild(this.header);
    this.element.appendChild(this.navBar);
    this.element.appendChild(this.contentArea);

    this.element.querySelector('#fc-close-btn').addEventListener('click', () => {
      if (this.audio) this.audio.playClick();
      this.close();
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
    this.element.style.transform = 'scale(1.0)';
    if (this.audio) this.audio.playClick();
    this.switchTab(this.activeTab);
  }

  close() {
    this.isOpen = false;
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.transform = 'scale(0.98)';
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update active tab button styles
    const buttons = this.navBar.querySelectorAll('.sentinel-btn');
    buttons.forEach(btn => {
      if (btn.id === `fc-tab-${tabId}`) {
        btn.classList.add('sentinel-btn-primary');
      } else {
        btn.classList.remove('sentinel-btn-primary');
      }
    });

    // Render corresponding view
    switch (tabId) {
      case 'map':
        this._renderMap();
        break;
      case 'reasoning':
        this._renderReasoning();
        break;
      case 'evidence':
        this._renderEvidence();
        break;
      case 'routes':
        this._renderRoutes();
        break;
      case 'missions':
        this._renderMissions();
        break;
      case 'stats':
        this._renderStats();
        break;
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 1. TOPOGRAPHICAL MAP WITH FOG-OF-WAR
   * ───────────────────────────────────────────────────────────── */
  _renderMap() {
    const world = this.context.world;
    const kb = this.context.kb?.engineKB ?? this.context.kb;
    const vehicle = this.context.vehicle;
    const graph = world?.graph;

    if (!graph || !graph.nodes) {
      this.contentArea.innerHTML = '<div style="color:var(--text-muted)">Topographical satellite link unavailable.</div>';
      return;
    }

    const visitedNodes = kb?.visitedNodes ?? new Set();
    const currentNodeId = vehicle?.currentNodeId ?? world?.spec?.startId ?? 'n_0_0';

    // Calculate bounding box for SVG viewBox
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    graph.nodes.forEach(n => {
      const x = n.position?.x ?? 0;
      const z = n.position?.z ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    });

    const padding = 40;
    const width = (maxX - minX) + padding * 2;
    const height = (maxZ - minZ) + padding * 2;

    const toSvgX = (x) => (x - minX) + padding;
    const toSvgY = (z) => (z - minZ) + padding;

    // Build SVG Edges
    let edgesSvg = '';
    const edgesDrawn = new Set();
    graph.edges?.forEach(e => {
      const u = graph.getNode(e.from);
      const v = graph.getNode(e.to);
      if (!u || !v) return;

      const key = [e.from, e.to].sort().join('--');
      if (edgesDrawn.has(key)) return;
      edgesDrawn.add(key);

      const uVisited = visitedNodes.has(e.from);
      const vVisited = visitedNodes.has(e.to);
      const isKnown = uVisited || vVisited;

      const stroke = isKnown ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)';
      const dash = isKnown ? 'none' : '4,4';

      edgesSvg += `
        <line x1="${toSvgX(u.position.x)}" y1="${toSvgY(u.position.z)}"
              x2="${toSvgX(v.position.x)}" y2="${toSvgY(v.position.z)}"
              stroke="${stroke}" stroke-width="2" stroke-dasharray="${dash}" />
      `;
    });

    // Build SVG Nodes
    let nodesSvg = '';
    graph.nodes.forEach(n => {
      const sx = toSvgX(n.position.x);
      const sy = toSvgY(n.position.z);
      const isVisited = visitedNodes.has(n.id);
      const isCurrent = n.id === currentNodeId;
      const belief = kb?.getBelief(n.id);

      let fill = 'rgba(255, 255, 255, 0.1)';
      let stroke = 'rgba(255, 255, 255, 0.2)';
      let r = 5;

      if (isVisited) {
        fill = 'var(--status-success)';
        stroke = 'var(--status-success)';
      } else if (belief?.safe === true) {
        fill = 'rgba(61, 220, 132, 0.4)';
        stroke = 'var(--status-success)';
      } else if (belief?.safe === false) {
        fill = 'var(--status-danger)';
        stroke = 'var(--status-danger)';
      }

      if (isCurrent) {
        fill = 'var(--accent-amber)';
        stroke = '#fff';
        r = 8;
      }

      // Objective indicator if found or discovered
      const isObjective = n.id === world?.spec?.objectiveId && (isVisited || belief?.safe === true);
      const objRing = isObjective
        ? `<circle cx="${sx}" cy="${sy}" r="12" fill="none" stroke="var(--accent-amber)" stroke-width="2" stroke-dasharray="3,3" />`
        : '';

      nodesSvg += `
        <g style="cursor:pointer;">
          ${objRing}
          <circle cx="${sx}" cy="${sy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2" />
          <text x="${sx}" y="${sy + 14}" fill="var(--text-muted)" font-size="9" font-family="var(--font-hud)" text-anchor="middle">
            ${isVisited || isCurrent ? n.id : '?'}
          </text>
        </g>
      `;
    });

    this.contentArea.innerHTML = `
      <div style="display:flex; height:100%; gap:20px;">
        <div style="flex:1; background:rgba(0,0,0,0.4); border-radius:6px; border:1px solid var(--border-glass); overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center;">
          <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; max-height:540px;">
            ${edgesSvg}
            ${nodesSvg}
          </svg>
          <div style="position:absolute; bottom:12px; left:12px; background:rgba(0,0,0,0.6); padding:6px 12px; border-radius:4px; font-size:11px; display:flex; gap:16px;">
            <span style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--accent-amber); display:inline-block;"></span> CURRENT VEHICLE</span>
            <span style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--status-success); display:inline-block;"></span> EXPLORED / SAFE</span>
            <span style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--status-danger); display:inline-block;"></span> HAZARD SUSPECT</span>
            <span style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.2); display:inline-block;"></span> UNEXPLORED (FOG)</span>
          </div>
        </div>
        <div style="width:280px; display:flex; flex-direction:column; gap:12px;">
          <div class="glass-panel" style="padding:14px;">
            <div style="font-family:var(--font-hud); font-size:13px; font-weight:700; color:var(--accent-amber); margin-bottom:8px;">
              SECTOR TELEMETRY
            </div>
            <div style="font-size:11px; line-height:1.6; color:var(--text-secondary);">
              <div>CURRENT NODE: <strong style="color:#fff">${currentNodeId}</strong></div>
              <div>EXPLORED NODES: <strong style="color:var(--status-success)">${visitedNodes.size} / ${graph.nodes.length}</strong></div>
              <div>OBJECTIVE: <strong style="color:var(--accent-amber)">${world?.spec?.objectiveId ?? 'UNKNOWN'}</strong></div>
              <div>FUEL REMAINING: <strong>${(vehicle?.fuelRemaining ?? 100).toFixed(1)}L</strong></div>
            </div>
          </div>
          <div class="glass-panel" style="padding:14px; flex:1;">
            <div style="font-family:var(--font-hud); font-size:13px; font-weight:700; color:var(--accent-cyan); margin-bottom:8px;">
              FOG OF WAR SENSORS
            </div>
            <div style="font-size:11px; line-height:1.5; color:var(--text-muted);">
              Distant nodes remain occluded by atmospheric particulate and mountain topology until traversed or resolved via Horn-clause deductive reasoning.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. LIVE ANIMATED 5-STAGE REASONING PIPELINE
   * ───────────────────────────────────────────────────────────── */
  _renderReasoning() {
    const kb = this.context.kb?.engineKB ?? this.context.kb;
    const vehicle = this.context.vehicle;
    const riskModel = this.context.riskModel;
    const currentNodeId = vehicle?.currentNodeId ?? 'n_0_0';
    const belief = kb?.getBelief(currentNodeId);

    const ranked = riskModel?.rankNeighbors ? riskModel.rankNeighbors(currentNodeId, { fuelRemaining: vehicle?.fuelRemaining ?? 100 }) : [];
    const top = ranked[0];

    const stages = [
      {
        step: '1. OBSERVATION',
        title: 'Raw Sensor Ingestion',
        color: 'var(--accent-cyan)',
        content: `Thermal Stench: ${belief?.evidence?.includes('stench') ? 'TRUE' : 'FALSE'}<br/>Wind Breeze: ${belief?.evidence?.includes('breeze') ? 'TRUE' : 'FALSE'}<br/>Road Glitter: ${belief?.evidence?.includes('glitter') ? 'TRUE' : 'FALSE'}<br/>Radar Contact: ${belief?.evidence?.includes('bump') ? 'TRUE' : 'FALSE'}`,
      },
      {
        step: '2. EVIDENCE',
        title: 'Knowledge Tokens',
        color: 'var(--accent-amber)',
        content: `Ingested tokens at ${currentNodeId}:<br/><strong>${belief?.evidence?.length ? belief.evidence.join(', ') : 'none'}</strong>`,
      },
      {
        step: '3. INFERENCE',
        title: 'Horn-Clause Resolution',
        color: '#ff88aa',
        content: `Safety State: <strong>${belief?.safe === true ? 'PROVEN SAFE' : belief?.safe === false ? 'CONFIRMED HAZARD' : 'UNCERTAIN'}</strong><br/>Active Pit OR-Clauses: ${kb?._pitClauses?.size ?? 0}<br/>Active Hunter OR-Clauses: ${kb?._hunterClauses?.size ?? 0}`,
      },
      {
        step: '4. RISK',
        title: 'Composite Risk Surface',
        color: 'var(--status-warning)',
        content: top ? `Candidate: <strong>${top.nodeId}</strong><br/>Risk Factor: <strong>${(top.risk * 100).toFixed(1)}%</strong><br/>Confidence: <strong>${top.confidence}%</strong>` : 'Calculating risk topology...',
      },
      {
        step: '5. DECISION',
        title: 'Utility Maximization',
        color: 'var(--status-success)',
        content: top ? `Selected Vector: <strong>${top.nodeId}</strong><br/>Utility: <strong>${top.utility.toFixed(2)}</strong><br/>Reason: "${top.reason}"` : 'Awaiting traversal inputs...',
      },
    ];

    let stagesHtml = '';
    stages.forEach((s, idx) => {
      stagesHtml += `
        <div class="glass-panel" style="flex:1; padding:16px; border-top:3px solid ${s.color}; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-family:var(--font-hud); font-size:12px; font-weight:700; color:${s.color}; letter-spacing:0.08em;">${s.step}</span>
            <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">STAGE 0${idx + 1}</span>
          </div>
          <div style="font-family:var(--font-hud); font-size:15px; font-weight:600; color:var(--text-primary);">${s.title}</div>
          <div style="font-size:11px; line-height:1.5; color:var(--text-secondary); background:rgba(0,0,0,0.25); padding:10px; border-radius:4px; flex:1;">
            ${s.content}
          </div>
        </div>
      `;
    });

    this.contentArea.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%; gap:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-family:var(--font-hud); font-size:20px; font-weight:700; color:var(--text-primary);">
              SYMBOLIC REASONING PIPELINE ARCHITECTURE
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Direct Stage 1 Engine Integration — Authoritative verification of observations to decision matrices.
            </div>
          </div>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan);">
            CYCLE: REAL-TIME (50Hz)
          </div>
        </div>

        <div style="display:flex; gap:12px; flex:1;">
          ${stagesHtml}
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. EVIDENCE AUDIT LOG & KNOWLEDGE STATE
   * ───────────────────────────────────────────────────────────── */
  _renderEvidence() {
    const kb = this.context.kb?.engineKB ?? this.context.kb;
    const graph = this.context.world?.graph;

    let rowsHtml = '';
    graph?.nodes?.forEach(n => {
      const belief = kb?.getBelief(n.id);
      const isSafe = belief?.safe === true ? '<span style="color:var(--status-success);font-weight:700">SAFE</span>' : belief?.safe === false ? '<span style="color:var(--status-danger);font-weight:700">HAZARD</span>' : '<span style="color:var(--text-muted)">UNKNOWN</span>';
      const evidence = belief?.evidence?.length ? belief.evidence.join(', ') : '---';
      const pitProb = belief?.pitSuspect ? 'HIGH' : 'LOW';
      const hunterProb = belief?.hunterSuspect ? 'HIGH' : 'LOW';

      rowsHtml += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05); font-size:11px;">
          <td style="padding:8px 12px; font-weight:700; color:var(--accent-amber);">${n.id}</td>
          <td style="padding:8px 12px;">${isSafe}</td>
          <td style="padding:8px 12px; color:var(--accent-cyan);">${evidence}</td>
          <td style="padding:8px 12px;">${pitProb}</td>
          <td style="padding:8px 12px;">${hunterProb}</td>
        </tr>
      `;
    });

    this.contentArea.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%; gap:14px;">
        <div style="font-family:var(--font-hud); font-size:18px; font-weight:700; color:var(--text-primary);">
          PROPOSITIONAL KNOWLEDGE BASE AUDIT MATRIX
        </div>
        <div class="glass-panel" style="flex:1; overflow-y:auto;">
          <table style="width:100%; border-collapse:collapse; text-align:left;">
            <thead>
              <tr style="background:rgba(255,255,255,0.04); font-family:var(--font-hud); font-size:12px; color:var(--text-muted); letter-spacing:0.08em; border-bottom:1px solid var(--border-glass);">
                <th style="padding:10px 12px;">NODE IDENTIFIER</th>
                <th style="padding:10px 12px;">DEDUCTIVE STATE</th>
                <th style="padding:10px 12px;">INGESTED SENSOR TOKENS</th>
                <th style="padding:10px 12px;">PIT RISK</th>
                <th style="padding:10px 12px;">HUNTER PROWLER</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────────
   * 4. ROUTE COMPARISON
   * ───────────────────────────────────────────────────────────── */
  _renderRoutes() {
    const riskModel = this.context.riskModel;
    const vehicle = this.context.vehicle;
    const currentNodeId = vehicle?.currentNodeId ?? 'n_0_0';
    const ranked = riskModel?.rankNeighbors ? riskModel.rankNeighbors(currentNodeId, { fuelRemaining: vehicle?.fuelRemaining ?? 100 }) : [];

    let routesHtml = '';
    ranked.forEach((r, idx) => {
      const riskColor = r.risk < 0.2 ? 'var(--status-success)' : r.risk < 0.6 ? 'var(--status-warning)' : 'var(--status-danger)';
      routesHtml += `
        <div class="glass-panel" style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-family:var(--font-hud); font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
              OPTION ${idx + 1}: TRAVERSE TO ${r.nodeId.toUpperCase()}
            </div>
            <div style="font-size:11px; color:var(--text-secondary); max-width:500px;">
              "${r.reason}"
            </div>
          </div>
          <div style="display:flex; gap:24px; text-align:right;">
            <div>
              <div style="font-family:var(--font-hud); font-size:10px; color:var(--text-muted);">RISK INDEX</div>
              <div style="font-family:var(--font-hud); font-size:20px; font-weight:700; color:${riskColor};">${(r.risk * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div style="font-family:var(--font-hud); font-size:10px; color:var(--text-muted);">CONFIDENCE</div>
              <div style="font-family:var(--font-hud); font-size:20px; font-weight:700; color:var(--accent-cyan);">${r.confidence}%</div>
            </div>
            <div>
              <div style="font-family:var(--font-hud); font-size:10px; color:var(--text-muted);">UTILITY RATING</div>
              <div style="font-family:var(--font-hud); font-size:20px; font-weight:700; color:var(--accent-amber);">${r.utility.toFixed(2)}</div>
            </div>
          </div>
        </div>
      `;
    });

    this.contentArea.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%; gap:14px;">
        <div style="font-family:var(--font-hud); font-size:18px; font-weight:700; color:var(--text-primary);">
          ACTIVE TACTICAL ROUTE EVALUATION MATRIX
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; flex:1; overflow-y:auto;">
          ${routesHtml || '<div style="color:var(--text-muted)">No outgoing road segments from current sector.</div>'}
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────────
   * 5. MISSION DIRECTIVES
   * ───────────────────────────────────────────────────────────── */
  _renderMissions() {
    const missions = this.context.missions;
    const summary = missions?.getActiveMissionSummary ? missions.getActiveMissionSummary() : null;
    const distStr = summary?.distToTarget && isFinite(summary.distToTarget) ? `${Math.round(summary.distToTarget)} meters` : 'Acquiring GPS / Spline telemetry...';
    const statusColor = summary?.completed ? 'var(--status-success)' : summary?.failed ? 'var(--status-danger)' : 'var(--accent-cyan)';

    this.contentArea.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%; gap:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-family:var(--font-hud); font-size:20px; font-weight:700; color:var(--accent-amber);">
            PRIMARY DIRECTIVE: ${summary?.name ?? 'THE SILENT CHECKPOINT'}
          </div>
          <button id="fc-btn-new-sortie" class="sentinel-btn sentinel-btn-primary" style="padding:8px 18px; font-size:11px;">
            DISPATCH NEW PROCEDURAL EXPEDITION [N]
          </button>
        </div>

        <div class="glass-panel" style="padding:20px; display:flex; flex-direction:column; gap:12px;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div>
              <span style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); display:block; letter-spacing:0.08em;">MISSION STATUS</span>
              <span style="font-family:var(--font-hud); font-size:18px; font-weight:700; color:${statusColor};">${summary?.status?.toUpperCase() ?? 'IN PROGRESS'}</span>
            </div>
            <div>
              <span style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); display:block; letter-spacing:0.08em;">DISTANCE TO CHECKPOINT</span>
              <span style="font-family:var(--font-mono); font-size:18px; font-weight:700; color:var(--accent-amber);">${distStr}</span>
            </div>
          </div>

          <div>
            <span style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); display:block; letter-spacing:0.08em;">TARGET OBJECTIVE</span>
            <span style="font-size:14px; color:var(--text-primary); font-weight:600;">${summary?.targetDesc ?? 'Ranger Outpost Sector'}</span>
          </div>

          <div>
            <span style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); display:block; letter-spacing:0.08em;">TACTICAL INSTRUCTION</span>
            <div style="font-size:13px; line-height:1.6; color:var(--text-primary); margin-top:2px;">
              ${summary?.instruction ?? 'Drive safely through mountain road network to remote checkpoint.'}
            </div>
          </div>

          <div>
            <span style="font-family:var(--font-hud); font-size:11px; color:var(--text-muted); display:block; letter-spacing:0.08em;">IDENTIFIED SECTOR HAZARDS</span>
            <div style="font-size:12px; color:var(--status-danger); font-weight:600; margin-top:2px;">
              ${summary?.threatDesc ?? 'Uncharted Pits, Dynamic Roaming Prowler, and High-Altitude Crevasses'}
            </div>
          </div>
        </div>
      </div>
    `;

    const dispatchBtn = this.contentArea.querySelector('#fc-btn-new-sortie');
    if (dispatchBtn) {
      dispatchBtn.addEventListener('click', () => {
        if (this.audio) this.audio.playClick();
        if (missions && typeof missions.generateNewExpedition === 'function') {
          missions.generateNewExpedition();
          this._renderMissions();
        }
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 6. EXPEDITION TELEMETRY & ACHIEVEMENTS MATRIX
   * ───────────────────────────────────────────────────────────── */
  _renderStats() {
    const state = this.context.state?.get ? this.context.state.get() : {};
    const stats = this.context.statsTracker?.getSummary ? this.context.statsTracker.getSummary() : (state.stats || {});
    const achievements = state.achievements || {};

    const achList = Object.entries(achievements).map(([id, ach]) => {
      const isUnlocked = !!ach.unlocked;
      const statusColor = isUnlocked ? 'var(--status-success)' : 'var(--text-disabled)';
      const badgeText = isUnlocked ? 'UNLOCKED' : 'LOCKED';
      const dateStr = ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleTimeString() : 'Pending';

      return `
        <div class="glass-panel" style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center; border-left:3px solid ${statusColor};">
          <div>
            <div style="font-family:var(--font-hud); font-size:13px; font-weight:700; color:${isUnlocked ? 'var(--text-primary)' : 'var(--text-muted)'};">
              ${ach.name}
            </div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
              ${ach.desc}
            </div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <span style="font-family:var(--font-hud); font-size:11px; font-weight:700; color:${statusColor}; background:rgba(255,255,255,0.04); padding:2px 8px; border-radius:3px; display:inline-block;">
              ${badgeText}
            </span>
            <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">${dateStr}</div>
          </div>
        </div>
      `;
    }).join('');

    this.contentArea.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%; gap:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-family:var(--font-hud); font-size:20px; font-weight:700; color:var(--accent-amber);">
            EXPEDITION TELEMETRY & ACHIEVEMENTS MATRIX
          </div>
          <div style="font-size:11px; color:var(--accent-cyan); font-family:var(--font-mono);">
            DATA ENGINE: VERIFIED REAL-TIME LOGGING
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; flex:1; overflow-y:auto;">
          <!-- Left Column: Genuine Live Telemetry Metrics -->
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="font-family:var(--font-hud); font-size:12px; font-weight:700; color:var(--text-muted); letter-spacing:0.1em;">
              AUTHENTIC EXPEDITION TELEMETRY
            </div>

            <div class="glass-panel" style="padding:14px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <div>
                <span style="font-size:10px; color:var(--text-muted); display:block;">DISTANCE DRIVEN</span>
                <span style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--accent-amber);">${stats.distanceDrivenKm ?? '0.00'} KM</span>
                <span style="font-size:9px; color:var(--text-muted); display:block;">(${stats.distanceDrivenMeters ?? 0} meters)</span>
              </div>
              <div>
                <span style="font-size:10px; color:var(--text-muted); display:block;">FUEL CONSUMED</span>
                <span style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--accent-cyan);">${stats.fuelConsumedLiters ?? 0} L</span>
                <span style="font-size:9px; color:var(--text-muted); display:block;">Direct powertrain burn</span>
              </div>
              <div>
                <span style="font-size:10px; color:var(--text-muted); display:block;">SECTORS EXPLORED</span>
                <span style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--text-primary);">${stats.nodesExploredCount ?? 0}</span>
                <span style="font-size:9px; color:var(--text-muted); display:block;">Unique road nodes</span>
              </div>
              <div>
                <span style="font-size:10px; color:var(--text-muted); display:block;">HAZARDS SENSED</span>
                <span style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--status-warning);">${stats.hazardsDetected ?? 0}</span>
                <span style="font-size:9px; color:var(--text-muted); display:block;">Pits / Stench / Bumps</span>
              </div>
              <div>
                <span style="font-size:10px; color:var(--text-muted); display:block;">JUNCTION DECISIONS</span>
                <span style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--text-primary);">${stats.decisionsMade ?? 0}</span>
                <span style="font-size:9px; color:var(--text-muted); display:block;">${stats.aiDecisionsFollowed ?? 0} followed AI advice</span>
              </div>
              <div>
                <span style="font-size:10px; color:var(--text-muted); display:block;">HUNTER ENCOUNTERS</span>
                <span style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--status-danger);">${stats.hunterEncounters ?? 0}</span>
                <span style="font-size:9px; color:var(--text-muted); display:block;">Within 40m perimeter</span>
              </div>
              <div>
                <span style="font-size:10px; color:var(--text-muted); display:block;">REBEL VECTOR CHOICES</span>
                <span style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--accent-amber);">${stats.rebelDecisionsCount ?? 0}</span>
                <span style="font-size:9px; color:var(--text-muted); display:block;">Defied AI warnings</span>
              </div>
              <div>
                <span style="font-size:10px; color:var(--text-muted); display:block;">CLEAN RUN JUNCTIONS</span>
                <span style="font-family:var(--font-hud); font-size:22px; font-weight:700; color:var(--status-success);">${stats.cleanJunctionsCount ?? 0}</span>
                <span style="font-size:9px; color:var(--text-muted); display:block;">Zero anomaly passes</span>
              </div>
            </div>
          </div>

          <!-- Right Column: All 7 Operational Achievements -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-family:var(--font-hud); font-size:12px; font-weight:700; color:var(--text-muted); letter-spacing:0.1em;">
              DIRECTIVES & ACHIEVEMENTS (7 CONDITIONAL GOALS)
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; overflow-y:auto;">
              ${achList}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
