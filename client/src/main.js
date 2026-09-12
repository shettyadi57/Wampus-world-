/**
 * main.js — Client boot sequence
 * ─────────────────────────────────────────────────────────────
 * Wires together the Three.js graphics, vehicle physics, ActuatorBus,
 * physical noisy sensors, roaming Hunter entity, Stage 1 reasoning engine,
 * autonomous AI Driver, Co-Pilot Analysis Mode, and the Final Integration Suite
 * (Audio, Persistence, Stats, Achievements, Tutorial, Accessibility).
 */

import { initState }          from './state/StateManager.js';
import { initPersistence }    from './persistence/PersistenceManager.js';
import { StatsTracker }       from './state/StatsTracker.js';
import { AchievementManager } from './state/AchievementManager.js';
import { initWorld }          from './world/WorldManager.js';
import { initRoads }          from './roads/RoadNetwork.js';
import { initProcgen }        from './procgen/ProcgenEngine.js';
import { initVehicle }        from './vehicle/VehicleController.js';
import { initPhysics }        from './physics/PhysicsEngine.js';
import { initSensors }        from './sensors/SensorArray.js';
import { initActuators }      from './actuators/ActuatorBus.js';
import { initKnowledge }      from './ai/knowledge/KnowledgeBase.js';
import { initInference }      from './ai/inference/InferenceEngine.js';
import { initRisk }           from './ai/risk/RiskModel.js';
import { initNavigation }     from './navigation/Navigator.js';
import { initMissions }       from './missions/MissionController.js';
import { initAudio }          from './audio/AudioEngine.js';
import { initGraphics }       from './graphics/GraphicsEngine.js';
import { initUI }             from './ui/UIManager.js';
import { HunterEntity }       from './world/HunterEntity.js';
import { AIDriver }           from './ai/driver/AIDriver.js';

async function boot() {
  console.log('[boot] Starting Wampus World / SENTINEL: Final Integration Pass...');

  // 1. Audio Engine
  const audio = await initAudio();

  // 2. Core State & Persistence
  const state       = await initState();
  const persistence = await initPersistence(state);

  // Attempt to load existing save from Slot 0
  const loaded = persistence.load(0);
  if (loaded.success) {
    console.log('[boot] Successfully restored persistent save session');
  }

  // 3. Telemetry Stats & Achievements
  const statsTracker       = new StatsTracker(state);
  const achievementManager = new AchievementManager(state, audio);

  // 4. World generation & Road splines
  const world = await initWorld(state.get());
  const roads = await initRoads(world);

  // 5. Physics & Environment
  const physics = await initPhysics(world);
  const region  = await initProcgen(world, roads, physics);

  // 6. Vehicle Controller (spawned at Ranger Station start node)
  const vehicle = await initVehicle(physics, state.get());
  const startJunc = roads.junctions.get(world.spec.startId);
  if (startJunc) {
    vehicle.spawnPosition = {
      x: startJunc.position.x,
      y: startJunc.position.y + 0.5,
      z: startJunc.position.z,
    };
    vehicle.resetTo();
  }

  // 7. Roaming Hunter Entity
  const initialHunterNode = world.spec.hunterNodes?.[0] ?? 'n_4_4';
  const hunter = new HunterEntity(world.graph, roads, {
    initialNodeId: initialHunterNode,
  });

  // 8. Physical SensorArray (Thermal, Wind, Radar, Scanner, Signal, Camera)
  const sensors = await initSensors(vehicle, world, {
    hunter,
    difficulty: state.get()?.difficulty ?? 'normal',
  });

  // 9. Actuation layer (Authoritative ActuatorBus)
  const actuators = await initActuators(vehicle);

  // 10. Stage 1 Symbolic Reasoning Engine
  const kb        = await initKnowledge(world.graph);
  const inference = await initInference(kb, world.graph);
  const risk      = await initRisk(kb, inference, world.graph);

  // Initial arrival at start node
  inference.processArrival(world.spec.startId, {
    breeze: false,
    stench: false,
    glitter: false,
  });

  // 11. Autonomous AI Driver
  const aiDriver = new AIDriver({
    graph: world.graph,
    kb,
    riskModel: risk,
    actuators,
    vehicle,
    roads,
  });

  // 12. Navigation & Mission System ("The Silent Checkpoint")
  const navigator = await initNavigation(kb, world, roads);
  const missions  = await initMissions(state, navigator, {
    world,
    statsTracker,
    achievementManager,
  });

  // 13. Presentation Layer (Three.js Graphics)
  const graphics = await initGraphics(vehicle, world, {
    roads,
    region,
    physics,
    sensors,
    missions,
    hunter,
    aiDriver,
    kb,
    audio,
  });

  // 14. UI Manager with Full Stage 5 UI/UX Suite
  const ui = await initUI(state, vehicle, actuators, {
    graphics,
    aiDriver,
    riskModel: risk,
    kb,
    sensors,
    hunter,
    world,
    audio,
    physics,
    missions,
    roads,
    statsTracker,
    achievementManager,
  });
  graphics.ui = ui;

  // 15. Start the render and physics loop
  graphics.startLoop();

  console.log('[boot] Final Integration Pass fully operational.');
}

boot().catch((err) => {
  console.error('[boot] Fatal initialisation error:', err);
});
