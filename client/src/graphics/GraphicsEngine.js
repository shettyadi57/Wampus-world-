/**
 * GraphicsEngine.js
 * ─────────────────────────────────────────────────────────────
 * Owns all Three.js rendering: WebGLRenderer, scene graph,
 * atmospheric fog, vehicle 3D model, camera controller, and the
 * requestAnimationFrame render loop.
 */

import * as THREE from 'three';
import { CameraController } from './CameraController.js';

export class GraphicsEngine {
  /**
   * @param {Object} context
   */
  constructor({ canvas, vehicle, world, roads, region, physics, sensors, missions, ui, hunter, aiDriver, kb }) {
    this.canvas = canvas;
    this.vehicle = vehicle;
    this.world = world;
    this.roads = roads;
    this.region = region;
    this.physics = physics;
    this.sensors = sensors;
    this.missions = missions;
    this.ui = ui;
    this.hunter = hunter;
    this.aiDriver = aiDriver;
    this.kb = kb;

    this.isRunning = false;
    this.clock = new THREE.Clock();

    this._initThree();
    this._buildLightingAndFog();
    this._buildVehicleMesh();
    this._initScene();
  }

  _initThree() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    this.cameraController = new CameraController(this.camera, this.vehicle, {
      mode: 'chase',
      smoothing: true,
      suspensionMotion: true,
      speedFov: true,
    });

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _buildLightingAndFog() {
    // Atmospheric Mountain Twilight Fog
    const fogColor = 0x16202c;
    this.scene.background = new THREE.Color(fogColor);
    this.scene.fog = new THREE.FogExp2(fogColor, 0.0075);

    // Hemisphere sky/ground ambient
    const hemiLight = new THREE.HemisphereLight(0x7892b0, 0x242820, 0.65);
    this.scene.add(hemiLight);

    // Directional Sun with shadows
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.25);
    this.sunLight.position.set(50, 75, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 250;
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 60;
    this.sunLight.shadow.camera.bottom = -60;
    this.scene.add(this.sunLight);

    const ambient = new THREE.AmbientLight(0x223040, 0.45);
    this.scene.add(ambient);
  }

  _buildVehicleMesh() {
    this.vehicleGroup = new THREE.Group();
    this.vehicleGroup.name = 'VehicleMesh';

    // Main body chassis
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.75, 3.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1c66a6, // Rugged mountain blue
      roughness: 0.35,
      metalness: 0.75,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    this.vehicleGroup.add(body);

    // Cabin / greenhouse with tinted windows
    const cabinGeo = new THREE.BoxGeometry(1.5, 0.65, 2.0);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x15181c,
      roughness: 0.1,
      metalness: 0.9,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.15, -0.2);
    cabin.castShadow = true;
    this.vehicleGroup.add(cabin);

    // Wheels (4 wheels with rims)
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16);
    wheelGeo.rotateZ(Math.PI * 0.5);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

    this.wheels = [];
    const wheelOffsets = [
      { x: -0.95, z: 1.25, isFront: true },   // front left
      { x: 0.95, z: 1.25, isFront: true },    // front right
      { x: -0.95, z: -1.25, isFront: false }, // rear left
      { x: 0.95, z: -1.25, isFront: false },  // rear right
    ];

    for (const off of wheelOffsets) {
      const wheelHolder = new THREE.Group();
      wheelHolder.position.set(off.x, 0.38, off.z);

      const wheelMesh = new THREE.Mesh(wheelGeo, tireMat);
      wheelMesh.castShadow = true;
      wheelHolder.add(wheelMesh);

      this.vehicleGroup.add(wheelHolder);
      this.wheels.push({ holder: wheelHolder, mesh: wheelMesh, isFront: off.isFront });
    }

    // Front Headlights (Spotlights)
    this.headlights = [];
    [-0.6, 0.6].forEach(hx => {
      const spot = new THREE.SpotLight(0xfff5e6, 3.5, 45, Math.PI * 0.22, 0.35, 1.5);
      spot.position.set(hx, 0.6, 1.9);
      spot.target.position.set(hx, 0.2, 12);
      this.vehicleGroup.add(spot);
      this.vehicleGroup.add(spot.target);
      this.headlights.push(spot);
    });

    // Rear Taillights
    this.taillights = [];
    const tailGeo = new THREE.BoxGeometry(0.25, 0.12, 0.05);
    const tailMat = new THREE.MeshBasicMaterial({ color: 0x660000 });
    [-0.65, 0.65].forEach(tx => {
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(tx, 0.65, -1.92);
      this.vehicleGroup.add(tail);
      this.taillights.push(tail);
    });

    this.scene.add(this.vehicleGroup);
  }

  _initScene() {
    if (this.roads) {
      const roadMeshes = this.roads.generateMeshes();
      this.scene.add(roadMeshes);
    }
    if (this.region) {
      this.scene.add(this.region.group);
    }
    if (this.hunter && this.hunter.meshGroup) {
      this.scene.add(this.hunter.meshGroup);
    }
  }

  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    const animate = () => {
      if (!this.isRunning) return;
      requestAnimationFrame(animate);

      const dt = Math.min(this.clock.getDelta(), 0.05);

      // 1. Hunter Roaming Update
      if (this.hunter) {
        const rawNode = this.sensors?.sampleGroundTruth?.()?.nodeId;
        this.hunter.tick(dt, rawNode);
      }

      // 2. Autonomous AI Driver Update
      if (this.aiDriver && this.aiDriver.enabled) {
        this.aiDriver.tick(dt);
      }

      // 3. Physics Step
      if (this.physics && this.vehicle) {
        this.physics.step(this.vehicle, dt);
      }

      // 4. Sensor Sampling & KB Ingestion
      let perceptFrame = null;
      if (this.sensors) {
        perceptFrame = this.sensors.sample();
        if (this.kb && perceptFrame && perceptFrame.nodeId) {
          this.kb.ingest(perceptFrame);
        }
      }

      // 5. Mission Logic Tick
      if (this.missions) {
        this.missions.tick(dt, this.vehicle, perceptFrame);
      }

      // 6. Update Vehicle Visual Mesh
      if (this.vehicle && this.vehicleGroup) {
        const vp = this.vehicle.position;
        this.vehicleGroup.position.set(vp.x, vp.y, vp.z);
        this.vehicleGroup.rotation.set(this.vehicle.pitch, this.vehicle.yaw, this.vehicle.roll, 'YXZ');

        // Steer front wheels
        for (const w of this.wheels) {
          if (w.isFront) {
            w.holder.rotation.y = this.vehicle.steerAngle;
          }
        }

        // Headlights toggle
        const hlState = this.vehicle.headlightsOn;
        for (const hl of this.headlights) {
          hl.visible = hlState;
        }

        // Taillights brake glow
        const isBraking = this.vehicle.brakeDemand > 0.05 || this.vehicle.handbrakeEngaged;
        for (const tl of this.taillights) {
          tl.material.color.setHex(isBraking ? 0xff1100 : hlState ? 0x881100 : 0x440000);
        }
      }

      // 7. Update Camera
      if (this.cameraController) {
        this.cameraController.update(dt);
      }

      // 8. Update HUD Overlay
      if (this.ui && typeof this.ui.updateHUD === 'function') {
        this.ui.updateHUD({
          speedKph: this.vehicle.getSpeedKph(),
          fuelRemaining: this.vehicle.fuelRemaining,
          tankCapacity: this.vehicle.tankCapacity,
          reverse: this.vehicle.reverseEngaged,
          handbrake: this.vehicle.handbrakeEngaged,
          headlights: this.vehicle.headlightsOn,
          cameraMode: this.cameraController?.mode ?? 'chase',
          percepts: perceptFrame,
          mission: this.missions?.getActiveMissionSummary ? this.missions.getActiveMissionSummary() : null,
        });
      }

      // 9. Render Scene
      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(animate);
    console.log('[graphics] Render loop started');
  }

  stopLoop() {
    this.isRunning = false;
  }
}

/**
 * @param {import('../vehicle/VehicleController.js').VehicleController} vehicle
 * @param {Object} world
 * @param {Object} options
 * @returns {Promise<GraphicsEngine>}
 */
export async function initGraphics(vehicle, world, options = {}) {
  const canvas = document.getElementById('game-canvas');
  const engine = new GraphicsEngine({
    canvas,
    vehicle,
    world,
    roads: options.roads,
    region: options.region,
    physics: options.physics,
    sensors: options.sensors,
    missions: options.missions,
    ui: options.ui,
  });

  console.log('[graphics] GraphicsEngine initialised');
  return engine;
}
