# Wampus World — Architecture

> **Stage**: Architecture only. No gameplay logic is implemented yet.  
> **Revision**: 0.1 — initial scaffold  

---

## 1. Project Overview

Wampus World is a symbolic-AI-driven open-world driving game rendered in the browser using **Three.js** (graphics) and the **Web Audio API** (spatial audio), served by a lightweight **Node.js / Express** static server.

The game is a fully 3-D realisation of the classic Wumpus World logical-agent problem: a vehicle drives through a procedurally generated world, perceiving its environment through physical sensors, reasoning about hazards with a symbolic inference engine, and acting through a well-typed actuator API.

---

## 2. Guiding Principles

| Principle | Enforcement |
|-----------|-------------|
| **One concern per module** | Each directory in `client/src/` is owned by exactly one concern. Cross-cutting calls must go through the public API of the target module — never reach into its internals. |
| **No giant main.js** | `main.js` is a boot orchestrator only. It contains zero game logic. |
| **Agent opacity** | The AI agent (KnowledgeBase + InferenceEngine + RiskModel) must never read `WorldManager` directly. It perceives the world exclusively through `SensorArray` percept frames. |
| **Single actuation path** | Both human input and the AI Driver issue vehicle commands exclusively through `ActuatorBus`. No subsystem mutates `VehicleController` directly. |
| **Real symbolic reasoning** | The inference engine is a genuine constraint-based forward-chaining system. There are **no LLM calls**, **no hard-coded flavor text** masquerading as inference, and **no lookup tables** disguised as AI. |
| **Rendering is read-only** | `GraphicsEngine` and `UIManager` are consumers of state. They never write to `GameState`, `KnowledgeBase`, or `VehicleController`. |

---

## 3. Agent Loop

The core architecture follows the **Sense → Think → Act** cycle of a rational agent:

```
┌─────────────────────────────────────────────────────────────────┐
│                         WORLD (black box)                       │
│   Nodes · Hazards (Pit, Wampus) · Items (Gold) · Roads         │
└────────────────────┬────────────────────────────────────────────┘
                     │ physical stimuli
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SENSOR ARRAY                              │
│  ThermalSensor · AirWindSensor · RadarSensor                   │
│  RoadScannerSensor · SignalSensor · VisualCameraSensor          │
│                                                                 │
│  Output: PerceptFrame { nodeId, breeze, stench, glitter,       │
│                         bump, scream, timestamp }               │
└────────────────────┬────────────────────────────────────────────┘
                     │ PerceptFrame (every tick)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE BASE                              │
│  visited · safeNodes · pitNodes · wampusNode                   │
│  breezeNodes · stenchNodes · goldFound · wampusDead            │
│  perceptLog[]                                                   │
│                                                                 │
│  Populated exclusively by SensorArray percepts.                 │
│  Never queries WorldManager.                                    │
└────────────────────┬────────────────────────────────────────────┘
                     │ KB snapshot
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFERENCE ENGINE                              │
│  Forward-chaining Horn-clause rule evaluator.                  │
│  Derives new facts → asserts them back into KnowledgeBase.     │
│  No LLM. No hard-coded flavor text. No statistical ML.         │
└────────────────────┬────────────────────────────────────────────┘
                     │ classified nodes
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RISK MODEL                                 │
│  Scores candidate actions with utility = reward / (1 + risk).  │
│  Produces ranked RankedAction[] for the AI Driver.             │
└──────┬──────────────────────────────────────────────┬──────────┘
       │ best action                                  │ route request
       ▼                                              ▼
┌──────────────┐                           ┌──────────────────────┐
│  AI DRIVER   │                           │     NAVIGATOR        │
│  (planned)   │◄──── Waypoint[] ──────────│  A* over road graph  │
│              │                           │  weighted by KB risk │
└──────┬───────┘                           └──────────────────────┘
       │ actuator calls          ┌─────────────┐
       │ (same API as human) ────►             │
       ▼                        │ ACTUATOR BUS │
┌──────────────┐                │             │◄── Human Input ────┐
│   VEHICLE    │◄───────────────┤             │                    │
│  CONTROLLER  │                └─────────────┘                    │
└──────────────┘                                                   │
       │ state                                                     │
       ▼                                                           │
  PhysicsEngine ──► GraphicsEngine ──► screen                     │
                                                                   │
                    UIManager ─────────────────────────────────────┘
                    (keyboard / gamepad → actuators)
```

---

## 4. Percept Table

### 4.1 Percept Definitions

| Percept | Constant | Producing Sensor | Locality Rule |
|---------|----------|-----------------|---------------|
| **Breeze** | `Percept.BREEZE` | `AirWindSensor` | Perceived when the vehicle is **in a node adjacent to a Pit**. A Breeze does NOT indicate the current node is a Pit. |
| **Stench** | `Percept.STENCH` | `ThermalSensor` | Perceived when the vehicle is **in a node adjacent to the Wampus**. A Stench does NOT indicate the current node contains the Wampus. |
| **Glitter** | `Percept.GLITTER` | `RoadScannerSensor` | Perceived **only when the vehicle is in the SAME node as the Gold**. Glitter does NOT propagate to neighbouring nodes. |
| **Bump** | `Percept.BUMP` | `RadarSensor` | Perceived when the vehicle collides with an impassable boundary (wall, world edge). Indicates the move was blocked. |
| **Scream** | `Percept.SCREAM` | `SignalSensor` | Broadcast **globally** when the Wampus is eliminated. Not localised to any node. |

### 4.2 Critical Locality Distinction

> **BREEZE and STENCH are neighbour-based percepts.**  
> Sensing a Breeze at node `n` tells the agent that *some* neighbour of `n` contains a Pit — not that `n` itself is dangerous.
>
> **GLITTER is a same-node percept.**  
> Sensing Glitter at node `n` tells the agent that the Gold is *at `n`*, not at a neighbour. Treating Glitter like Breeze or Stench would be a logical error and is explicitly forbidden in this codebase.

### 4.3 Inference Rules Using Percepts

```
-- Safe inference (negative percepts are definitive)
visited(n) ∧ ¬breeze(n)  → ∀ adj(n): ¬pit(adj)
visited(n) ∧ ¬stench(n)  → ∀ adj(n): ¬wampus(adj)

-- Possibility inference (positive percepts narrow candidates)
visited(n) ∧ breeze(n)   → ∃ adj(n): pit(adj)     [at least one]
visited(n) ∧ stench(n)   → ∃ adj(n): wampus(adj)  [at least one]

-- Same-node fact (Glitter)
glitter(n)               → gold_at(n)              [current node only]

-- Global broadcast (Scream)
scream()                 → wampus_dead := true
```

All rules are evaluated by `InferenceEngine.js` as pure functions over the KnowledgeBase. The KB is never mutated directly by sensors.

---

## 5. Sensor Catalogue

| Sensor Module | Percept Produced | Mechanism |
|---------------|-----------------|-----------|
| `ThermalSensor` | `STENCH` | Detects thermal signature of the Wampus in adjacent nodes. Threshold: configurable heat bloom radius. |
| `AirWindSensor` | `BREEZE` | Detects air-pressure differential caused by adjacent pit edges. |
| `RadarSensor` | `BUMP` | Detects vehicle collision with impassable geometry via physics contact manifold. |
| `RoadScannerSensor` | `GLITTER` | Active scan of the **current node only** for mission items. Not a neighbour scan. |
| `SignalSensor` | `SCREAM` | Listens for the global elimination event emitted when the Wampus is destroyed. Receives from event bus, not from the world graph. |
| `VisualCameraSensor` | *(auxiliary)* | Feeds the Risk Model's visual uncertainty factor. Does not produce a named percept; output is a confidence map used internally by RiskModel. |

---

## 6. Actuator API Contract

All vehicle commands are issued through `ActuatorBus`. Both the human input handler and the AI Driver call the **exact same functions**. No subsystem bypasses this bus.

```typescript
// Actuator API — function signatures (no implementation)

/**
 * Apply throttle demand.
 * @param amount — normalised ∈ [0, 1]. 0 = idle, 1 = full throttle.
 */
accelerate(amount: number): void

/**
 * Apply brake demand.
 * @param amount — normalised ∈ [0, 1]. 0 = released, 1 = ABS threshold.
 */
brake(amount: number): void

/**
 * Set steering angle.
 * @param angle — normalised ∈ [-1, 1]. -1 = full left, +1 = full right.
 */
steer(angle: number): void

/**
 * Toggle handbrake. Locks rear axle. Toggle semantics.
 */
handbrake(): void

/**
 * Toggle reverse gear. Ignored if speed exceeds reverse-entry threshold.
 */
reverse(): void

/**
 * Trigger an active sensor sweep of the current node.
 * Synchronously wakes RoadScannerSensor to produce a GLITTER check.
 */
scan(): void

/**
 * Interact with the nearest interactable world object
 * (collect gold, activate switch, etc.).
 */
interact(): void

/**
 * Toggle headlights on/off.
 * Side effects: GraphicsEngine updates scene lighting;
 * VisualCameraSensor updates its noise model.
 */
toggleHeadlights(): void

/**
 * Emit horn. Used as a signal in mission trigger conditions.
 * Side effect: AudioEngine plays horn sound.
 */
horn(): void
```

---

## 7. Module Dependency Graph

```
                        main.js (boot only)
                            │
          ┌─────────────────┼───────────────────────┐
          │                 │                       │
      StateManager    PersistenceManager         (all others)
          │
    ┌─────┴──────┐
    │            │
  World       Physics
    │            │
  Roads       Vehicle ◄────── ActuatorBus ◄──── HumanInput
    │                                     ◄──── AIDriver
  Procgen
    │
  Graphics (read-only)
    │
  (scene)
          ┌──────────────────────────────────┐
          │           Agent Stack            │
          │  Sensors → KB → Inference        │
          │              → Risk → AIDriver   │
          └──────────────────────────────────┘
          ┌───────────────┐
          │   Navigation  │◄── KB + Roads + World
          └───────────────┘
          ┌───────────────┐
          │   Missions    │◄── State + Navigator
          └───────────────┘
          ┌──────────────────────────┐
          │  Audio · UI  (output)   │◄── Events / State
          └──────────────────────────┘
```

---

## 8. Folder Structure

```
wampus-world/
│
├── server/
│   └── server.js              # Static file server (Express). No game logic.
│
├── client/
│   ├── public/
│   │   ├── index.html         # SPA shell, mounts #game-canvas and #ui-overlay
│   │   └── assets/
│   │       ├── models/        # GLTF/GLB 3-D models
│   │       ├── audio/         # OGG/MP3 audio assets
│   │       └── textures/      # KTX2/basis/PNG textures
│   │
│   └── src/
│       ├── main.js            # Boot only — wires subsystems, no logic
│       │
│       ├── vehicle/
│       │   └── VehicleController.js
│       ├── physics/
│       │   └── PhysicsEngine.js
│       ├── world/
│       │   └── WorldManager.js
│       ├── roads/
│       │   └── RoadNetwork.js
│       ├── procgen/
│       │   └── ProcgenEngine.js
│       ├── sensors/
│       │   └── SensorArray.js      # + individual sensor files (TBD)
│       ├── actuators/
│       │   └── ActuatorBus.js
│       ├── ai/
│       │   ├── knowledge/
│       │   │   └── KnowledgeBase.js
│       │   ├── inference/
│       │   │   └── InferenceEngine.js
│       │   └── risk/
│       │       └── RiskModel.js
│       ├── navigation/
│       │   └── Navigator.js
│       ├── missions/
│       │   └── MissionController.js
│       ├── audio/
│       │   └── AudioEngine.js
│       ├── graphics/
│       │   └── GraphicsEngine.js
│       ├── ui/
│       │   └── UIManager.js
│       ├── state/
│       │   └── StateManager.js
│       └── persistence/
│           └── PersistenceManager.js
│
└── tests/
    ├── unit/
    │   ├── knowledgeBase.test.js
    │   └── actuatorBus.test.js
    ├── integration/
    └── fixtures/
        └── percept.fixture.js
```

---

## 9. Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Server | Node.js + Express | Static file server only. Correct MIME types for JS modules, GLTF, audio. COOP/COEP headers for SharedArrayBuffer. |
| Rendering | Three.js r165+ | WebGLRenderer (WebGPU opt-in). Post-processing: Bloom → FXAA → Vignette → LUT. |
| Audio | Web Audio API + Three.js PositionalAudio | 3-D spatial audio for diegetic sounds. OGG primary, MP3 fallback. |
| Physics | Rapier (WASM) *(planned)* | Back-end agnostic; PhysicsEngine exposes neutral API. |
| AI Reasoning | Custom forward-chaining engine | Pure JS, no external AI libraries, no LLM. |
| Persistence | localStorage (versioned JSON) | Slot-based saves with schema migration. |
| Tests | Node.js native test runner or Jest | ES-module compatible. |

---

## 10. Reasoning Engine Mandate

The agent's reasoning is implemented as a **real symbolic / constraint-based system**:

- Rules are encoded as pure Horn clauses evaluated by `InferenceEngine.js`.
- New facts are derived by forward chaining over the KnowledgeBase.
- The RiskModel scores actions using utility theory over constraint satisfaction.
- **There are no LLM API calls.**
- **There is no hard-coded flavor text standing in for inference.**
- **There are no lookup tables disguised as AI decisions.**

Every agent decision must be traceable to a chain of percept observations and logical deductions. The full percept log stored in KnowledgeBase guarantees this auditability.

---

*End of ARCHITECTURE.md — v0.1*
