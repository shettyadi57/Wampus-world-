/**
 * MountainForestRegion.js
 * ─────────────────────────────────────────────────────────────
 * Atmospheric Mountain/Forest region environment.
 * Generates continuous 3D terrain heightmap, dense pine foliage,
 * boulders, cliff ridges, structures (Ranger Station, Checkpoint Arch,
 * Fuel Depot), road signage, and hazard props.
 */

import * as THREE from 'three';
import { SeededRNG } from '../../../engine/procgen/SeededRNG.js';

export class MountainForestRegion {
  /**
   * @param {import('../roads/RoadNetwork.js').RoadNetwork} roadNetwork
   * @param {Object} worldSpec
   * @param {import('../physics/PhysicsEngine.js').PhysicsEngine} physics
   * @param {Object} [options]
   */
  constructor(roadNetwork, worldSpec, physics, options = {}) {
    this.roadNetwork = roadNetwork;
    this.spec = worldSpec;
    this.physics = physics;
    this.seed = options.seed ?? 42;

    this.group = new THREE.Group();
    this.group.name = 'MountainForestRegion';

    this.rng = new SeededRNG(this.seed);

    // Terrain bounds
    this.size = options.size ?? 160;
    this.segments = options.segments ?? 80;

    this._buildTerrain();
    this._placeFoliageAndRocks();
    this._placeStructures();
    this._placeSignage();
    this._placeHazardMarkers();
  }

  _buildTerrain() {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geo.rotateX(-Math.PI * 0.5);

    const pos = geo.attributes.position;
    const colors = [];

    // Color palette
    const valleyGrass = new THREE.Color(0x283824);
    const cliffStone = new THREE.Color(0x3e4248);
    const mountainSlate = new THREE.Color(0x565c64);
    const roadShoulderDirt = new THREE.Color(0x3c352a);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Base mountain elevation with octave noise
      const n1 = this.rng.octaveNoise2D(x * 0.02, z * 0.02, 4, 0.5, 2.0);
      const n2 = this.rng.noise2D(x * 0.06, z * 0.06);
      let height = (n1 * 26.0) + (n2 * 4.0) - 8.0;

      // Blend smoothly with nearby road splines
      const roadInfo = this.roadNetwork.getRoadElevation(x, z);
      let vertexColor = valleyGrass.clone();

      if (roadInfo !== null) {
        // Carve road terrace into mountain
        height = THREE.MathUtils.lerp(height, roadInfo.y, 0.85);
        vertexColor.lerp(roadShoulderDirt, 0.7);
      } else {
        // Mountain slopes
        if (height > 12) {
          vertexColor.lerp(mountainSlate, Math.min(1, (height - 12) / 10));
        } else if (height > 5) {
          vertexColor.lerp(cliffStone, Math.min(1, (height - 5) / 7));
        }
      }

      pos.setY(i, height);
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.group.add(this.terrainMesh);

    // Save height query function on terrain
    this.getHeight = (x, z) => {
      const n1 = this.rng.octaveNoise2D(x * 0.02, z * 0.02, 4, 0.5, 2.0);
      return (n1 * 26.0) - 8.0;
    };
  }

  _placeFoliageAndRocks() {
    // 1. Pine Trees (conical evergreen)
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.8, 6);
    const foliageGeo = new THREE.ConeGeometry(1.6, 4.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2716, roughness: 0.9 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x1c301c, roughness: 0.85 });

    const treeCount = 180;
    const treeGroup = new THREE.Group();

    for (let i = 0; i < treeCount; i++) {
      const x = this.rng.nextFloat(-this.size * 0.45, this.size * 0.45);
      const z = this.rng.nextFloat(-this.size * 0.45, this.size * 0.45);

      // Avoid placing trees directly on road surface
      if (this.roadNetwork.getRoadElevation(x, z) !== null) continue;

      const ground = this.physics.getGroundHeight(x, z);
      const scale = this.rng.nextFloat(0.75, 1.4);

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.9 * scale;
      trunk.castShadow = true;

      const foliage = new THREE.Mesh(foliageGeo, needleMat);
      foliage.position.y = (1.8 + 1.8) * scale;
      foliage.castShadow = true;

      tree.add(trunk);
      tree.add(foliage);
      tree.scale.set(scale, scale, scale);
      tree.position.set(x, ground.y, z);

      treeGroup.add(tree);

      // Register collision with physics
      this.physics.addObstacle({ x, z, radius: 0.75 * scale, type: 'tree' });
    }
    this.group.add(treeGroup);

    // 2. Boulders & Rocks
    const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x505459, roughness: 0.9, flatShading: true });

    for (let i = 0; i < 90; i++) {
      const x = this.rng.nextFloat(-this.size * 0.44, this.size * 0.44);
      const z = this.rng.nextFloat(-this.size * 0.44, this.size * 0.44);
      if (this.roadNetwork.getRoadElevation(x, z) !== null) continue;

      const ground = this.physics.getGroundHeight(x, z);
      const scale = this.rng.nextFloat(0.6, 2.2);

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, ground.y + scale * 0.4, z);
      rock.rotation.set(this.rng.next() * Math.PI, this.rng.next() * Math.PI, 0);
      rock.scale.set(scale, scale * 0.8, scale * 1.1);
      rock.castShadow = true;
      rock.receiveShadow = true;

      this.group.add(rock);
      this.physics.addObstacle({ x, z, radius: scale * 0.85, type: 'rock' });
    }
  }

  _placeStructures() {
    const startNode = this.roadNetwork.junctions.get(this.spec.startId);
    const objNode = this.roadNetwork.junctions.get(this.spec.objectiveId);

    // ── 1. Ranger Station Depot at Start Node ──
    if (startNode) {
      const p = startNode.position;
      const cabinGroup = new THREE.Group();

      // Log cabin
      const cabinGeo = new THREE.BoxGeometry(6, 3.2, 5);
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x543924, roughness: 0.8 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.6, 0);
      cabin.castShadow = true;
      cabinGroup.add(cabin);

      // Peaked roof
      const roofGeo = new THREE.ConeGeometry(5.2, 2.0, 4);
      roofGeo.rotateY(Math.PI * 0.25);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x223028, roughness: 0.7 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0, 4.2, 0);
      roof.castShadow = true;
      cabinGroup.add(roof);

      // Radio mast tower with blinking beacon light
      const towerGeo = new THREE.CylinderGeometry(0.1, 0.4, 10, 4);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x889098, metalness: 0.7 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(4.0, 5.0, 0);
      cabinGroup.add(tower);

      const beaconLight = new THREE.PointLight(0xff3322, 1.5, 20);
      beaconLight.position.set(4.0, 10.2, 0);
      cabinGroup.add(beaconLight);

      cabinGroup.position.set(p.x + 7.5, p.y, p.z - 3.5);
      this.group.add(cabinGroup);

      this.physics.addObstacle({ x: p.x + 7.5, z: p.z - 3.5, radius: 4.0, type: 'building' });
    }

    // ── 2. The Remote Checkpoint Arch at Objective Node ──
    if (objNode) {
      const p = objNode.position;
      const archGroup = new THREE.Group();

      // Dual steel support pylons
      const pylonGeo = new THREE.BoxGeometry(0.8, 5.5, 0.8);
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x778088, metalness: 0.7 });

      const pylonL = new THREE.Mesh(pylonGeo, pylonMat);
      pylonL.position.set(-4.2, 2.75, 0);
      pylonL.castShadow = true;
      archGroup.add(pylonL);

      const pylonR = new THREE.Mesh(pylonGeo, pylonMat);
      pylonR.position.set(4.2, 2.75, 0);
      pylonR.castShadow = true;
      archGroup.add(pylonR);

      // Overhead crossbeam with checkpoint banner
      const beamGeo = new THREE.BoxGeometry(9.2, 1.2, 0.8);
      const beamMat = new THREE.MeshStandardMaterial({ color: 0xcc8800 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 5.0, 0);
      beam.castShadow = true;
      archGroup.add(beam);

      // Objective beacon light (glowing green/amber)
      const objLight = new THREE.PointLight(0x00ff88, 3.5, 25);
      objLight.position.set(0, 5.8, 0);
      archGroup.add(objLight);

      archGroup.position.set(p.x, p.y, p.z);
      this.group.add(archGroup);
    }

    // ── 3. Fuel Depot Station ──
    if (this.spec.fuelNodes && this.spec.fuelNodes.length > 0) {
      const fuelJunc = this.roadNetwork.junctions.get(this.spec.fuelNodes[0]);
      if (fuelJunc) {
        const p = fuelJunc.position;
        const fuelGroup = new THREE.Group();

        // Canopy roof
        const canopyGeo = new THREE.BoxGeometry(6, 0.4, 4);
        const canopyMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.set(0, 4.0, 0);
        fuelGroup.add(canopy);

        // Canopy pillars
        const pillarGeo = new THREE.CylinderGeometry(0.15, 0.15, 4, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        [-2.5, 2.5].forEach(sx => {
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(sx, 2.0, 0);
          fuelGroup.add(pillar);
        });

        // Fuel Pump
        const pumpGeo = new THREE.BoxGeometry(0.8, 1.6, 0.8);
        const pumpMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
        const pump = new THREE.Mesh(pumpGeo, pumpMat);
        pump.position.set(0, 0.8, 0);
        fuelGroup.add(pump);

        const pumpLight = new THREE.PointLight(0xffaa22, 1.8, 15);
        pumpLight.position.set(0, 3.6, 0);
        fuelGroup.add(pumpLight);

        fuelGroup.position.set(p.x - 5.5, p.y, p.z + 2.0);
        this.group.add(fuelGroup);

        this.physics.addObstacle({ x: p.x - 5.5, z: p.z + 2.0, radius: 2.2, type: 'fuel_depot' });
      }
    }
  }

  _placeSignage() {
    const signGeo = new THREE.BoxGeometry(1.2, 0.8, 0.08);
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xd4a017 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3020 });

    for (const [id, junc] of this.roadNetwork.junctions) {
      const p = junc.position;
      const signGroup = new THREE.Group();

      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 0.9;
      signGroup.add(post);

      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.y = 1.5;
      sign.rotation.y = this.rng.next() * Math.PI;
      signGroup.add(sign);

      signGroup.position.set(p.x + 3.4, p.y, p.z + 3.4);
      this.group.add(signGroup);
    }
  }

  _placeHazardMarkers() {
    // Visual sinkhole / rockfall markers for Pit nodes
    const pitMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xe66000 });

    if (this.spec.pitNodes) {
      for (const pitId of this.spec.pitNodes) {
        const junc = this.roadNetwork.junctions.get(pitId);
        if (!junc) continue;
        const p = junc.position;

        // Broken road barrier / hazard barrels
        [-2.0, 0, 2.0].forEach(offset => {
          const barrelGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.0, 8);
          const barrel = new THREE.Mesh(barrelGeo, barrelMat);
          barrel.position.set(p.x + offset, p.y + 0.5, p.z + (offset % 2 === 0 ? 1.5 : -1.5));
          this.group.add(barrel);
        });

        // Warning light pulse
        const warnLight = new THREE.PointLight(0xff4400, 1.5, 12);
        warnLight.position.set(p.x, p.y + 1.2, p.z);
        this.group.add(warnLight);
      }
    }
  }
}
