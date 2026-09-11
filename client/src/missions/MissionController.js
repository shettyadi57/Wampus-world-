/**
 * MissionController.js
 * ─────────────────────────────────────────────────────────────
 * Interprets and runs missions end-to-end.
 *
 * Implements "The Silent Checkpoint":
 * Start at Ranger Station (startId), navigate through winding mountain roads,
 * bypass or detect real hazards from Stage 1/2, and reach the Remote Checkpoint.
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

    this.activeMission = null;
    this.isComplete = false;
    this.isFailed = false;

    this._initFirstMission();
  }

  _initFirstMission() {
    const startNodeId = this.spec?.startId ?? (this.graph ? this.graph.nodeIds[0] : 'n_0_0');
    // Target is remote checkpoint or objective
    const targetNodeId = this.spec?.objectiveId ?? (this.spec?.checkpoints?.[0] ?? (this.graph ? this.graph.nodeIds[this.graph.nodeIds.length - 1] : 'n_4_4'));

    this.activeMission = {
      id: 'mission_01_silent_checkpoint',
      name: 'The Silent Checkpoint',
      status: 'in_progress', // 'in_progress' | 'completed' | 'failed'
      startNodeId,
      targetNodeId,
      targetDesc: `Remote Checkpoint at Node [${targetNodeId}]`,
      instruction: 'Drive from Ranger Station to Remote Checkpoint. Watch for breeze/stench hazard warnings.',
      distToTarget: Infinity,
      completed: false,
      failed: false,
    };

    console.log(`[missions] Loaded mission: "${this.activeMission.name}" (Target: ${targetNodeId})`);
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
      this.activeMission.instruction = 'CHECKPOINT SECURED! Mission Accomplished.';
      console.log('[missions] Mission "The Silent Checkpoint" COMPLETED!');
    }

    // Failure trigger: fuel exhaustion
    if (vehicle.fuelRemaining <= 0 && vehicle.getSpeedKph() < 0.2) {
      this.isFailed = true;
      this.activeMission.failed = true;
      this.activeMission.status = 'failed';
      this.activeMission.instruction = 'FUEL EXHAUSTED! Vehicle stranded in mountains.';
      console.log('[missions] Mission "The Silent Checkpoint" FAILED (out of fuel)!');
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
  const missions = new MissionController(options.world);
  console.log('[missions] MissionController initialised');
  return missions;
}
