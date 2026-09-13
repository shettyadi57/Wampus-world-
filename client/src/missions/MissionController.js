/**
 * MissionController.js
 * ─────────────────────────────────────────────────────────────
 * Dynamic Expedition and Mission Controller.
 *
 * Capabilities:
 *   - Orchestrates multi-phase mountain expeditions ("The Silent Checkpoint",
 *     "Deep Mountain Recon", "Hazard Protocol Alpha").
 *   - Hooks into Navigator to update route waypoints to targets.
 *   - Emits completion events to StateManager, StatsTracker, and AchievementManager.
 *   - Supports generating new procedural expeditions dynamically.
 */

export class MissionController {
  /**
   * @param {Object} world
   * @param {Object} [options]
   */
  constructor(world, options = {}) {
    this.world = world;
    this.graph = world?.graph ?? null;
    this.spec = world?.spec ?? null;
    this.state = options.state ?? null;
    this.navigator = options.navigator ?? null;
    this.statsTracker = options.statsTracker ?? null;
    this.achievementManager = options.achievementManager ?? null;

    this.activeMission = null;
    this.isComplete = false;
    this.sortieTemplates = [
      {
        name: 'Deep Mountain Reconnaissance',
        instruction: 'Traverse unmapped mountain sectors to designated tactical outpost. Trust sensor verification.',
        threat: 'Abyssal Pits & Thermal Signatures',
      },
      {
        name: 'Hazard Protocol Alpha: Ridge Sweep',
        instruction: 'High-altitude barometric survey across treacherous mountain passes. Watch wind differentials.',
        threat: 'Atmospheric Shear & Crevasse Hazards',
      },
      {
        name: 'Crystalline Relay Activation',
        instruction: 'Deploy emergency telemetry transponder at isolated sector node. Avoid active predator patrol.',
        threat: 'Roaming Prowler & Unstable Edges',
      },
      {
        name: 'Alpine Sector Survey & Fuel Run',
        instruction: 'Verify mountain sector integrity before pass closes. Conserve engine fuel.',
        threat: 'Deep Fissures & Dense Atmospheric Fog',
      },
      {
        name: 'Permafrost Sector Infiltration',
        instruction: 'Execute stealth survey of hazardous terrain. Maintain continuous situational awareness.',
        threat: 'Pits & Dynamic Predator Heat Bloom',
      },
    ];
    this.onMissionComplete = options.onMissionComplete ?? null;

    this._initFirstMission();
  }

  _initFirstMission() {
    const startNodeId = this.spec?.startId ?? (this.graph ? this.graph.nodeIds[0] : 'n_0_0');
    const targetNodeId = this.spec?.objectiveId ?? (this.spec?.checkpoints?.[0] ?? (this.graph ? this.graph.nodeIds[this.graph.nodeIds.length - 1] : 'n_4_4'));

    this.activeMission = {
      id: 'mission_01_silent_checkpoint',
      name: 'The Silent Checkpoint',
      status: 'in_progress', // 'in_progress' | 'completed' | 'failed'
      startNodeId,
      targetNodeId,
      targetDesc: `Remote Checkpoint at Sector [${targetNodeId.toUpperCase()}]`,
      instruction: 'Drive from Ranger Station to Remote Checkpoint. Watch for breeze/stench hazard warnings.',
      distToTarget: Infinity,
      completed: false,
      failed: false,
    };

    if (this.navigator && typeof this.navigator.setDestination === 'function') {
      this.navigator.setDestination(targetNodeId, startNodeId);
    }

    if (this.statsTracker) {
      this.statsTracker.recordExpeditionStart();
    }

    console.log(`[missions] Loaded mission: "${this.activeMission.name}" (Target: ${targetNodeId})`);
  }

  /**
   * Generates a new procedural expedition target on the graph.
   * @param {string} [targetNodeId]
   * @param {string} [startNodeId]
   */
  generateNewExpedition(targetNodeId = null, startNodeId = null) {
    if (!this.graph) return null;

    const availableNodes = this.graph.nodeIds.filter(id => {
      const node = this.graph.nodes.get(id);
      return node && node.hazard !== 'pit' && node.hazard !== 'hunter';
    });

    const chosenTarget = targetNodeId || availableNodes[Math.floor(Math.random() * availableNodes.length)] || 'n_4_4';
    const startNode = startNodeId || (this.spec?.startId ?? 'n_0_0');

    this.isComplete = false;
    this.isFailed = false;

    // Pick a procedural sortie template
    const template = this.sortieTemplates[Math.floor(Math.random() * this.sortieTemplates.length)];

    this.activeMission = {
      id: `expedition_${Date.now().toString(36)}`,
      name: template.name,
      status: 'in_progress',
      startNodeId: startNode,
      targetNodeId: chosenTarget,
      targetDesc: `Tactical Outpost Sector [${chosenTarget.toUpperCase()}]`,
      instruction: template.instruction,
      threatDesc: template.threat,
      distToTarget: Infinity,
      completed: false,
      failed: false,
    };

    if (this.navigator && typeof this.navigator.setDestination === 'function') {
      this.navigator.setDestination(chosenTarget, startNode);
    }

    if (this.statsTracker) {
      this.statsTracker.recordExpeditionStart();
    }

    if (this.state && typeof this.state.mutate === 'function') {
      this.state.mutate({
        missions: {
          activeId: this.activeMission.id,
          currentObjectiveId: chosenTarget,
        },
      });
    }

    console.log(`[missions] Generated new dynamic expedition: "${this.activeMission.name}" to Sector [${chosenTarget}]`);
    return this.activeMission;
  }

  /**
   * Called every physics / render tick.
   * @param {number} dt
   * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
   * @param {Object} percepts
   */
  tick(dt, vehicle, percepts) {
    if (!this.activeMission || this.isComplete || this.isFailed || !vehicle || !this.graph) return;

    const targetNode = this.graph.nodes.get(this.activeMission.targetNodeId);
    if (!targetNode) return;

    const tx = targetNode.x ?? 0;
    const tz = targetNode.y ?? 0;
    const dist = Math.hypot(vehicle.position.x - tx, vehicle.position.z - tz);
    this.activeMission.distToTarget = dist;

    // Checkpoint arrival trigger (within 8.5m of target node)
    if (dist < 8.5) {
      this.isComplete = true;
      this.activeMission.completed = true;
      this.activeMission.status = 'completed';
      this.activeMission.instruction = 'CHECKPOINT SECURED! Press [N] for Next Sortie.';
      console.log(`[missions] Mission "${this.activeMission.name}" COMPLETED!`);

      // Update persistent state
      if (this.state && typeof this.state.mutate === 'function') {
        const prevCompleted = this.state.get()?.missions?.completed || [];
        this.state.mutate({
          missions: {
            activeId: this.activeMission.id,
            completed: [...new Set([...prevCompleted, this.activeMission.id])],
          },
        });
      }

      // Record stats
      if (this.statsTracker) {
        this.statsTracker.recordExpeditionComplete();
      }

      // Trigger achievement
      if (this.achievementManager) {
        this.achievementManager.notifyExpeditionMilestone(true);
      }

      // Callback
      if (typeof this.onMissionComplete === 'function') {
        this.onMissionComplete(this.activeMission);
      }
    }

    // Failure trigger: fuel exhaustion
    if (vehicle.fuelRemaining <= 0 && vehicle.getSpeedKph() < 0.2) {
      this.isFailed = true;
      this.activeMission.failed = true;
      this.activeMission.status = 'failed';
      this.activeMission.instruction = 'FUEL EXHAUSTED! Vehicle stranded in mountains.';
      console.log(`[missions] Mission "${this.activeMission.name}" FAILED (out of fuel)!`);
    }
  }

  getActiveMissionSummary() {
    return this.activeMission;
  }
}

/**
 * @param {Object} state
 * @param {Object} navigator
 * @param {Object} [options]
 * @returns {Promise<MissionController>}
 */
export async function initMissions(state, navigator, options = {}) {
  const missions = new MissionController(options.world, {
    state,
    navigator,
    statsTracker: options.statsTracker,
    achievementManager: options.achievementManager,
  });
  console.log('[missions] MissionController fully initialized');
  return missions;
}
