/**
 * main.js — Client boot sequence
 * ─────────────────────────────────────────────────────────────
 * Wires together the Three.js graphics, vehicle physics, ActuatorBus,
 * physical noisy sensors, roaming Hunter entity, Stage 1 reasoning engine,
 * autonomous AI Driver, and Co-Pilot Analysis Mode.
 */

import { initState }       from './state/StateManager.js';
import { initPersistence } from './persistence/PersistenceManager.js';
import { initWorld }       from './world/WorldManager.js';
import { initRoads }       from './roads/RoadNetwork.js';
import { initProcgen }     from './procgen/ProcgenEngine.js';
import { initVehicle }     from './vehicle/VehicleController.js';
import { initPhysics }     from './physics/PhysicsEngine.js';
import { initSensors }     from './sensors/SensorArray.js';
import { initActuators }   from './actuators/ActuatorBus.js';
import { initKnowledge }   from './ai/knowledge/KnowledgeBase.js';
import { initInference }   from './ai/inference/InferenceEngine.js';
import { initRisk }        from './ai/risk/RiskModel.js';
import { initNavigation }  from './navigation/Navigator.js';
import { initMissions }    from './missions/MissionController.js';
import { initAudio }       from './audio/AudioEngine.js';
import { initGraphics }    from './graphics/GraphicsEngine.js';
import { initUI }          from './ui/UIManager.js';
import { HunterEntity }    from './world/HunterEntity.js';
import { AIDriver }        from './ai/driver/AIDriver.js';

async function boot() {
  console.log('[boot] Starting Wampus World Stage 4 AI Systems Integration...');

  // 1. Core state & persistence
  const state       = await initState();
  const persistence = await initPersistence(state);

  // 2. World generation & Road splines
  const world    = await initWorld(state);
  const roads    = await initRoads(world);

  // 3. Physics & Mountain/Forest Environment
  const physics = await initPhysics(world);
  const region  = await initProcgen(world, roads, physics);

  // 4. Vehicle Controller (spawned at Ranger Station start node)
  const vehicle = await initVehicle(physics, state);
  const startJunc = roads.junctions.get(world.spec.startId);
  if (startJunc) {
    vehicle.spawnPosition = {
      x: startJunc.position.x,
      y: startJunc.position.y + 0.5,
      z: startJunc.position.z,
    };
    vehicle.resetTo();
  }

  // 5. Roaming Hunter Entity
  const initialHunterNode = world.spec.hunterNodes?.[0] ?? 'n_4_4';
  const hunter = new HunterEntity(world.graph, roads, {
    initialNodeId: initialHunterNode,
  });

  // 6. Physical SensorArray (Thermal, Wind, Radar, Scanner, Signal, Camera)
  const sensors = await initSensors(vehicle, world, {
    hunter,
    difficulty: state.difficulty ?? 'normal',
  });

  // 7. Actuation layer (Authoritative ActuatorBus)
  const actuators = await initActuators(vehicle);

  // 8. Stage 1 Symbolic Reasoning Engine
  const kb        = await initKnowledge(world.graph);
  const inference = await initInference(kb, world.graph);
  const risk      = await initRisk(kb, inference, world.graph);

  // Initial arrival at start node
  inference.processArrival(world.spec.startId, {
    breeze: false,
    stench: false,
    glitter: false,
  });

  // 9. Autonomous AI Driver
  const aiDriver = new AIDriver({
    graph: world.graph,
    kb,
    riskModel: risk,
    actuators,
    vehicle,
    roads,
  });

  // 10. Navigation & Mission System ("The Silent Checkpoint")
  const navigator = await initNavigation(kb, world, roads);
  const missions  = await initMissions(state, navigator, { world });

  // 11. Presentation Layer (Audio & Three.js Graphics)
  const audio = await initAudio();

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

  // 12. UI Manager with DRIVER / AI DRIVER / CO-PILOT modes and Stage 5 UI/UX Suite
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
  });
  graphics.ui = ui;

  // 13. Start the render and physics loop
  graphics.startLoop();

  console.log('[boot] Stage 4 AI Systems Integration fully operational.');
}

boot().catch((err) => {
  console.error('[boot] Fatal initialisation error:', err);
});
