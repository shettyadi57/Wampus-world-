/**
 * main.js — Client boot sequence (architecture scaffold only)
 * ─────────────────────────────────────────────────────────────
 * This file is the ONLY allowed entry point for the browser client.
 * Its sole job is to import each top-level module and wire the
 * agent loop. No game logic lives here.
 *
 * Agent loop (expanded in ARCHITECTURE.md):
 *   World → Sensors → KnowledgeBase → Inference → Risk → Actuators
 *                                    ↕
 *                              Navigation / Missions
 *
 * Import order reflects dependency graph (leaves first).
 */

// ── Subsystem imports (stubs until each module is implemented) ──
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

async function boot() {
  // 1. Core state & persistence (no deps)
  const state       = await initState();
  const persistence = await initPersistence(state);

  // 2. World geometry & generated content
  const world    = await initWorld(state);
  const roads    = await initRoads(world);
  await initProcgen(world, roads);

  // 3. Physics & vehicle (depend on world)
  const physics = await initPhysics(world);
  const vehicle = await initVehicle(physics, state);

  // 4. Perception layer
  const sensors = await initSensors(vehicle, world);

  // 5. Actuation layer (both human input and AI share this bus)
  const actuators = await initActuators(vehicle);

  // 6. AI agent stack: Knowledge → Inference → Risk
  const kb        = await initKnowledge();
  const inference = await initInference(kb);
  const risk      = await initRisk(kb, inference);

  // 7. Higher-level reasoning
  const navigator = await initNavigation(kb, world, roads);
  await initMissions(state, navigator);

  // 8. Presentation layer
  await initAudio();
  await initGraphics(vehicle, world);
  await initUI(state, vehicle, actuators);

  console.log('[boot] All subsystems initialised — ready.');
}

boot().catch((err) => {
  console.error('[boot] Fatal initialisation error:', err);
});
