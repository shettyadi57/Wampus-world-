# 🧭 Wampus World — SENTINEL: The Unknown Road

![Wampus World Banner](file:///C:/Users/Adithya%20s%20shetty/.gemini/antigravity-ide/brain/18e39203-16b7-443a-98a1-ed7574252de4/wampus_world_banner_1789283133022.jpg)

> *"Read the road. Trust the signals."*

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Three.js](https://img.shields.io/badge/graphics-Three.js_r186-blue.svg)](https://threejs.org/)
[![Web Audio API](https://img.shields.io/badge/audio-Web_Audio_API-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Symbolic AI](https://img.shields.io/badge/AI-Symbolic_Horn--Clause_Logic-purple.svg)]()
[![Test Suite](https://img.shields.io/badge/tests-46%2F46_passed-success.svg)]()
[![Zero LLM](https://img.shields.io/badge/reasoning-0%25_LLM_|_100%25_Deterministic-gold.svg)]()

---

## 1. Overview & Concept

**Wampus World / SENTINEL: The Unknown Road** is a 3D open-world driving simulation driven by a **genuine symbolic artificial intelligence reasoning engine**. Built upon the foundational logical agent problem introduced by Stuart Russell and Peter Norvig in *Artificial Intelligence: A Modern Approach*, the game transforms the discrete 2D grid into an immersive, continuous, procedurally generated mountain road network.

Behind the wheel of the **SENTINEL Tactical Recon Vehicle**, the player—or the autonomous AI driver—must navigate unmapped mountain sectors, interpret noisy atmospheric sensor cues, deduce the location of bottomless abyssal pits and a roaming predatory hunter, and secure isolated outpost relays across dynamic procedural expeditions.

---

## 2. Guiding Architectural Principles

| Principle | Enforcement & Implementation |
| :--- | :--- |
| **Pure Symbolic Reasoning** | Zero LLM calls. Zero hardcoded flavor text disguised as AI. The forward-chaining Horn-clause inference engine rigorously derives logical proofs from physical percepts with mathematical certainty. |
| **Strict Agent Opacity** | The AI agent never reads world coordinates, hazard arrays, or internal state directly. It perceives the world **exclusively** through noisy physical `SensorArray` frames. |
| **Authoritative Actuator Bus** | Neither human player nor AI Driver mutates `VehicleController` directly. All throttle, braking, steering, and gear commands flow through the strictly typed `ActuatorBus`. |
| **Provable Procedural Solvability** | Every generated seed passes through an automated mathematical `SolvabilityValidator` before boot. A world is rejected if an objective is unreachable or cannot be resolved deductively. |
| **Read-Only Presentation Layer** | Three.js graphics and DOM UI overlays are pure consumers of simulation state. They never write to `KnowledgeBase`, `GameState`, or `PhysicsEngine`. |

---

## 3. The Sense → Think → Act Agent Loop

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PROCEDURAL 3D WORLD                             │
│       Road Splines · Elevation · Abyssal Pits · Roaming Hunter         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ physical stimuli (wind, heat, contact)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           SENSOR ARRAY                                 │
│    AirWindSensor · ThermalSensor · RadarSensor · RoadScannerSensor     │
│    SignalSensor · VisualCameraSensor (Kalman noise & weather filter)   │
│                                                                        │
│    Output: PerceptFrame { nodeId, breeze, stench, glitter, bump, ... } │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ PerceptFrame per tick
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          KNOWLEDGE BASE                                │
│    Visited nodes · Safe nodes · Proved Pits · Proved Hunter node       │
│    Deductive facts · Closed-world assumptions · Audit trail            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ KB state snapshot
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     FORWARD-CHAINING INFERENCE ENGINE                  │
│    Evaluates Horn clauses:                                             │
│      visited(n) ∧ ¬breeze(n) → ∀ adj(n): ¬pit(adj)                     │
│      visited(n) ∧ ¬stench(n) → ∀ adj(n): ¬hunter(adj)                  │
│      Intersection of positive constraints → Pinpoint hazard location   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Classified safe/hazardous nodes
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             RISK MODEL                                 │
│    Scores candidate actions: Utility = Reward / (1 + Evaluated Risk)   │
│    Produces ranked RankedAction[] vectors for the AI Driver            │
└─────────────────┬──────────────────────────────────────┬───────────────┘
                  │ Ranked target action                 │ Waypoint request
                  ▼                                      ▼
┌───────────────────────────────────┐  ┌─────────────────────────────────┐
│        AUTONOMOUS AI DRIVER       │  │        TACTICAL NAVIGATOR       │
│    Real-time PID steering demand  │◄─┤  A* search over road network    │
│    Cruising & cornering throttle  │  │  weighted by logical KB risk    │
└─────────────────┬─────────────────┘  └─────────────────────────────────┘
                  │ actuator commands
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            ACTUATOR BUS                                │
│    throttle(val) · brake(val) · steer(angle) · reverse() · handbrake() │
│               ▲                                                        │
│               │ (identical actuation path)                             │
│     [Human Player Input via Keyboard / Gamepad]                        │
└─────────────────┬──────────────────────────────────────────────────────┘
                  │ physical forces
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         VEHICLE CONTROLLER                             │
│    Chassis mass (1400kg) · Powertrain torque · Raycast suspension      │
│    Longitudinal grip · Lateral tire slip · Fuel & Hull integrity       │
└─────────────────┬──────────────────────────────────────────────────────┘
                  │ 3D transform & telemetry
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    GRAPHICS & UI PRESENTATION                          │
│    Three.js scene · Minimal HUD · Field Computer · Tactical Audio      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Physical Sensor Suite & Percept Rules

| Sensor Module | Percept | Detection Mechanism | Locality Rule |
| :--- | :--- | :--- | :--- |
| **`AirWindSensor`** | `BREEZE` | Detects barometric pressure differentials caused by nearby chasms. | **Neighbouring nodes only**. A breeze at node $N$ proves a pit exists at some adjacent node, not at $N$. |
| **`ThermalSensor`** | `STENCH` | Detects infrared heat bloom signatures of the roaming Hunter. | **Neighbouring nodes only**. A stench at node $N$ proves the Hunter is adjacent to $N$. |
| **`RadarSensor`** | `BUMP` | Physical contact manifold trigger against boundary geometry. | **Current node**. Indicates impassable terrain or blocked passage. |
| **`RoadScannerSensor`** | `GLITTER` | Spectrographic scan for crystalline mission relays / objective beacons. | **Current node only**. Glitter *never* propagates across neighbours. |
| **`SignalSensor`** | `SCREAM` | Acoustic telemetry broadcast emitted if the Hunter is destroyed. | **Global broadcast**. Heard everywhere across the road graph. |
| **`VisualCameraSensor`** | *Confidence* | Calculates visibility degradation through fog and elevation. | Modulates risk confidence factors without yielding direct percepts. |

### Deductive Inference Logic
```prolog
-- Negative Percepts (Definitive Safety Deduction)
visited(N) ∧ ¬breeze(N)  → ∀ adj(N): ¬pit(adj)
visited(N) ∧ ¬stench(N)  → ∀ adj(N): ¬hunter(adj)

-- Positive Percepts (Constraint Narrowing)
visited(N) ∧ breeze(N)   → ∃ adj(N): pit(adj)
visited(N) ∧ stench(N)   → ∃ adj(N): hunter(adj)

-- Crystalline Relay Fact
glitter(N)               → relay_objective_at(N)
```

---

## 5. Driving Modes

SENTINEL features three seamless operating modes, switchable on the fly with **`[M]`**:

1. **DRIVER [Manual]**  
   Direct manual piloting. Full human control over throttle, braking, and steering. Real-time telemetry, compass tape, and contextual hazard slide-ins assist situational awareness.
2. **CO-PILOT [AI Assist]**  
   Player drives the vehicle while the symbolic inference engine continuously assesses junction routes, projecting non-intrusive advisory cards showing recommended vectors and safety percentages.
3. **AI DRIVER [Autonomous]**  
   Autonomous navigation driven entirely by Stage 1 Horn-clause utility rankings. The AI plans optimal paths via A*, applies proportional steering actuation, brakes into sharp curves, and drives safely without any human intervention.

---

## 6. Dynamic Expeditions & Procedural Sorties

Expeditions are **fully dynamic and infinite**:
- **The Silent Checkpoint**: Initial directive to reach a remote mountain relay outpost.
- **Procedural Sorties**: On checkpoint arrival, the system dynamically generates subsequent missions:
  - *Deep Mountain Reconnaissance*
  - *Hazard Protocol Alpha: Ridge Sweep*
  - *Crystalline Relay Activation*
  - *Alpine Sector Survey & Fuel Run*
  - *Permafrost Sector Infiltration*
- **Live Objective HUD Ribbon**: Real-time sector target, live distance countdown, and approach warning.
- **One-Touch Next Sortie (`[N]`)**: Dispatch dynamic new expeditions immediately from the HUD, Field Computer, or Pause Menu.

---

## 7. Tactical Field Computer (`[TAB]` or `[F]`)

A CRT-filtered, glassmorphic terminal providing full in-depth situational analysis:
1. **Topographic Map**: Real-time road graph with active Fog-of-War, unvisited node status, and vehicle tracking.
2. **5-Stage Reasoning Pipeline**: Live visualization of Sensor Input → Knowledge Assertion → Inference Rules → Risk Evaluation → Actuator Output.
3. **Evidence & Knowledge State**: Complete verifiable audit log of Horn-clause deductions.
4. **Route Comparison Matrix**: Branching vectors evaluated with safety score, slope gradient, and fuel expenditure.
5. **Mission Directives**: Real-time distance countdown, threat analysis, and **Dispatch New Expedition** trigger.
6. **Expedition Telemetry & Achievements**: Persistent distance driven, play time, nodes mapped, and achievement unlocks.

---

## 8. Ranger Garage & Upgrades (`[G]`)

Customise your vehicle at outpost garages with real numeric physics effects:
- **Hybrid Turbine Charger**: $+25\%$ Motor Torque & Instantaneous Throttle Response.
- **Bilstein Rally Coilovers**: $+35\%$ Suspension Dampening / $-35\%$ Body Roll.
- **Auxiliary Titanium Fuel Cell**: Tank capacity expanded from $100\text{L} \to 140\text{L}$.
- **Digital Sensor Bandpass Filter**: $-40\%$ False Positive Atmospheric Sensor Noise.
- **All-Terrain Kevlar Tires**: $+35\%$ Lateral Cornering Traction on loose gravel.

---

## 9. Controls & Keybindings Reference

| Action | Primary Key | Alternate Key | Subsystem |
| :--- | :--- | :--- | :--- |
| **Accelerate / Throttle** | `W` | `Up Arrow` | Vehicle Physics |
| **Brake / Decelerate** | `S` | `Down Arrow` | Vehicle Physics |
| **Steer Left** | `A` | `Left Arrow` | Vehicle Physics |
| **Steer Right** | `D` | `Right Arrow` | Vehicle Physics |
| **Handbrake** | `Space` | — | Vehicle Physics |
| **Toggle Reverse Gear** | `S` (at standstill) | — | Powertrain Interlock |
| **Cycle Driving Mode** | `M` | Click Mode Badge | AI Orchestrator |
| **Toggle Field Computer** | `Tab` | `F` | Terminal Overlay |
| **Quick Analysis View** | `I` | — | Field Computer Reasoning |
| **Ranger Garage** | `G` | — | Vehicle Outfitter |
| **Dispatch New Sortie** | `N` | Pause Menu | Mission Controller |
| **Reset Vehicle to Node** | `R` | — | Physics Recovery |
| **Toggle Headlights** | `L` | — | Graphics Lighting |
| **Acoustic Horn** | `H` | — | Web Audio Engine |
| **Cycle Camera View** | `C` | `V` | Chase / Orbit / Hood |
| **Pause / Resume Menu** | `Escape` | — | Game State |
| **Difficulty Tiers (1–4)** | `1`, `2`, `3`, `4` | Main Menu | Environment Profile |
| **Developer Diagnostics** | `Ctrl + Shift + D` | `` ` `` (Backquote) | Debug Console |

---

## 10. Quickstart & Installation

### Prerequisites
- **Node.js**: `v20.0.0` or higher
- **Modern Browser**: Chrome, Edge, Firefox, or Safari with WebGL 2.0 and Web Audio API support.

### Running the Application Locally
```bash
# 1. Clone repository
git clone https://github.com/shettyadi57/Wampus-world-.git
cd Wampus-world-

# 2. Install dependencies
npm install

# 3. Start static asset server
npm start

# Or start with auto-reload dev mode
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

### Running Test Suite
The project contains 46 comprehensive unit and integration tests verifying graph generation, entity placement, Horn-clause deductive reasoning, actuator contracts, physics math, and end-to-end mission persistence.

```bash
# Run complete test suite
npm test

# Run unit tests only
npm run test:unit

# Run end-to-end integration tests
npm run test:integration
```

---

## 11. Directory Structure

```
Wampus-world-/
├── client/
│   ├── public/
│   │   ├── index.html            # Static HTML boot shell & import maps
│   │   └── styles/
│   │       ├── theme.css         # Glassmorphism & design system tokens
│   │       ├── hud.css           # HUD telemetry & cluster styles
│   │       └── terminal.css      # Field Computer CRT scanline styling
│   └── src/
│       ├── main.js               # Client boot orchestrator
│       ├── actuators/            # Authoritative ActuatorBus implementation
│       ├── ai/
│       │   ├── driver/           # Autonomous PID & utility AI Driver
│       │   ├── inference/        # Horn-clause forward chaining engine
│       │   ├── knowledge/        # Deductive KnowledgeBase
│       │   └── risk/             # Multi-factor utility RiskModel
│       ├── audio/                # Web Audio API procedural synthesizers
│       ├── graphics/             # Three.js render loop, shaders, cameras
│       ├── missions/             # Dynamic expedition controller & generator
│       ├── navigation/           # A* tactical spline navigator
│       ├── persistence/          # LocalStorage save slot manager
│       ├── physics/              # Raycast suspension & drivetrain physics
│       ├── procgen/              # Road network spline & terrain generator
│       ├── roads/                # Junctions and Catmull-Rom splines
│       ├── sensors/              # Thermal, Wind, Radar, Scanner sensors
│       ├── state/                # StateManager, StatsTracker, Achievements
│       ├── ui/                   # UIManager, HUD, Field Computer, Menus
│       └── vehicle/              # VehicleController chassis & fuel dynamics
├── engine/                       # Core procedural world generator & graph algorithms
├── server/
│   └── server.js                 # Express static file server with MIME overrides
├── tests/
│   ├── unit/                     # Unit test suites (logic, procgen, actuators)
│   └── integration/              # End-to-end AI and expedition test suites
├── ARCHITECTURE.md               # Original architectural specifications
├── package.json                  # Dependencies & test scripts
└── README.md                     # Comprehensive project documentation
```

---

## 12. Threat Environments (Difficulty Scaling)

- **EASY**: Calibrated mountain conditions. $+40\%$ fuel cell margin, minimal atmospheric false alarms, slow hunter roaming speed.
- **NORMAL**: Balanced tactical baseline. Standard fuel consumption, authentic sensor noise, dynamic hunter tracking.
- **HARD**: Severe alpine conditions. $2.5\times$ false positive sensor noise, hunter aggressively hunts vehicle sound, tight fuel margins.
- **NIGHTMARE**: Hostile alpine anomaly. Heavy sensor distortion, lethal predator stalking speed, unforgiving fuel constraints.

---

## 13. License

ISC License. Developed as a modern 3D benchmark for verifiable symbolic artificial intelligence.
