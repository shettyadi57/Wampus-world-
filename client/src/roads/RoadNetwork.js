/**
 * RoadNetwork.js
 * ─────────────────────────────────────────────────────────────
 * Binds Stage 2's RoadGraph to continuous 3D Catmull-Rom splines,
 * generating natural winding road ribbons, bridges, and tunnels.
 * Never exposes discrete grid cells to the player.
 */

import * as THREE from 'three';

export class RoadNetwork {
  /**
   * @param {import('../../../engine/RoadGraph.js').RoadGraph} roadGraph
   * @param {Object} [options]
   */
  constructor(roadGraph, options = {}) {
    this.graph = roadGraph;
    this.roadWidth = options.roadWidth ?? 6.2; // meters (two-lane)
    this.segments = new Map(); // edgeKey -> { curve, length, isBridge, isTunnel, a, b }
    this.junctions = new Map(); // nodeId -> { x, y, z, adjacentEdges }
    this.bridgeEdgeKeys = new Set();
    this.tunnelEdgeKeys = new Set();

    this.group = new THREE.Group();
    this.group.name = 'RoadNetwork';

    this._buildSplines();
  }

  _buildSplines() {
    if (!this.graph) return;

    // 1. Index node positions in 3D world coordinates
    // graph.x -> world X, graph.elevation -> world Y, graph.y -> world Z
    for (const id of this.graph.nodeIds) {
      const node = this.graph.nodes.get(id);
      const wx = node.x ?? 0;
      const wy = (node.elevation ?? 0) * 0.8; // scaled elevation
      const wz = node.y ?? 0;
      this.junctions.set(id, {
        id,
        position: new THREE.Vector3(wx, wy, wz),
        adjacentEdges: [],
      });
    }

    // 2. Classify at least one edge as Bridge and at least one as Tunnel
    const allEdges = [...this.graph._edges.values()];
    if (allEdges.length > 0) {
      // Find edge with highest elevation difference or highest average elevation for bridge
      allEdges.sort((e1, e2) => {
        const u1 = this.junctions.get(e1.a);
        const v1 = this.junctions.get(e1.b);
        const u2 = this.junctions.get(e2.a);
        const v2 = this.junctions.get(e2.b);
        return Math.max(u2.position.y, v2.position.y) - Math.max(u1.position.y, v1.position.y);
      });

      if (allEdges.length >= 1) {
        const bridgeKey = edgeKey(allEdges[0].a, allEdges[0].b);
        this.bridgeEdgeKeys.add(bridgeKey);
      }

      if (allEdges.length >= 2) {
        // Find another edge crossing mid-elevation for tunnel
        const tunnelKey = edgeKey(allEdges[Math.floor(allEdges.length / 2)].a, allEdges[Math.floor(allEdges.length / 2)].b);
        if (!this.bridgeEdgeKeys.has(tunnelKey)) {
          this.tunnelEdgeKeys.add(tunnelKey);
        }
      }
    }

    // 3. Build organic 3D splines for every edge
    for (const [key, edge] of this.graph._edges) {
      const u = this.junctions.get(edge.a);
      const v = this.junctions.get(edge.b);
      if (!u || !v) continue;

      const p0 = u.position;
      const p3 = v.position;

      const isBridge = this.bridgeEdgeKeys.has(key);
      const isTunnel = this.tunnelEdgeKeys.has(key);

      // Generate natural winding control points between p0 and p3
      const delta = new THREE.Vector3().subVectors(p3, p0);
      const length = delta.length();
      const perp = new THREE.Vector3(-delta.z, 0, delta.x).normalize();

      // Seeded offset for curve winding
      const seedHash = hashString(key);
      const curveMag = isBridge ? 0 : isTunnel ? 1.0 : (Math.sin(seedHash) * 0.16 * length);

      const p1 = new THREE.Vector3()
        .lerpVectors(p0, p3, 0.33)
        .add(perp.clone().multiplyScalar(curveMag));
      const p2 = new THREE.Vector3()
        .lerpVectors(p0, p3, 0.67)
        .add(perp.clone().multiplyScalar(-curveMag * 0.7));

      // Elevation smoothing along spline
      p1.y = THREE.MathUtils.lerp(p0.y, p3.y, 0.33);
      p2.y = THREE.MathUtils.lerp(p0.y, p3.y, 0.67);

      if (isBridge) {
        // Gentle arch on bridge
        p1.y += 1.5;
        p2.y += 1.5;
      }

      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3], false, 'centripetal');
      this.segments.set(key, {
        key,
        a: edge.a,
        b: edge.b,
        curve,
        length,
        isBridge,
        isTunnel,
      });

      u.adjacentEdges.push(key);
      v.adjacentEdges.push(key);
    }
  }

  /**
   * Builds Three.js road meshes and adds them to this.group.
   * @returns {THREE.Group}
   */
  generateMeshes() {
    // Materials
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x22262b,
      roughness: 0.85,
      metalness: 0.1,
    });

    const shoulderMat = new THREE.MeshStandardMaterial({
      color: 0x4a443b,
      roughness: 0.95,
      metalness: 0.05,
    });

    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xd4a017, // Highway yellow
    });

    const bridgeWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5a3d28,
      roughness: 0.8,
    });

    const guardrailMat = new THREE.MeshStandardMaterial({
      color: 0x8a9299,
      roughness: 0.4,
      metalness: 0.8,
    });

    const tunnelConcreteMat = new THREE.MeshStandardMaterial({
      color: 0x333538,
      roughness: 0.9,
    });

    const halfWidth = this.roadWidth * 0.5;

    // 1. Build road ribbons for each segment
    for (const [key, seg] of this.segments) {
      const curve = seg.curve;
      const numSteps = Math.max(12, Math.floor(seg.length * 1.5));
      const points = curve.getSpacedPoints(numSteps);

      // Road Surface Ribbon Geometry
      const roadGeo = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const pt = points[i];
        const tangent = curve.getTangent(t).normalize();
        const normal = new THREE.Vector3(0, 1, 0);
        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

        // Left edge, center, right edge
        const left = pt.clone().add(binormal.clone().multiplyScalar(halfWidth));
        const right = pt.clone().add(binormal.clone().multiplyScalar(-halfWidth));

        positions.push(left.x, left.y + 0.02, left.z);
        positions.push(right.x, right.y + 0.02, right.z);

        normals.push(0, 1, 0, 0, 1, 0);
        uvs.push(0, t * (seg.length / 4), 1, t * (seg.length / 4));

        if (i < numSteps) {
          const row1 = i * 2;
          const row2 = (i + 1) * 2;
          indices.push(row1, row1 + 1, row2);
          indices.push(row1 + 1, row2 + 1, row2);
        }
      }

      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      roadGeo.setIndex(indices);

      const roadMesh = new THREE.Mesh(roadGeo, asphaltMat);
      roadMesh.receiveShadow = true;
      this.group.add(roadMesh);

      // 2. Dashed Yellow Center Line
      const lineGeo = new THREE.BufferGeometry();
      const linePositions = [];
      const lineIndices = [];
      const lineWidth = 0.18;

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const pt = points[i];
        const tangent = curve.getTangent(t).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

        const l1 = pt.clone().add(binormal.clone().multiplyScalar(lineWidth * 0.5));
        const l2 = pt.clone().add(binormal.clone().multiplyScalar(-lineWidth * 0.5));

        linePositions.push(l1.x, l1.y + 0.03, l1.z);
        linePositions.push(l2.x, l2.y + 0.03, l2.z);

        if (i < numSteps && i % 2 === 0) { // dashed pattern
          const r1 = i * 2;
          const r2 = (i + 1) * 2;
          lineIndices.push(r1, r1 + 1, r2);
          lineIndices.push(r1 + 1, r2 + 1, r2);
        }
      }

      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      lineGeo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(linePositions.length).fill(0), 3));
      lineGeo.setIndex(lineIndices);
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      this.group.add(lineMesh);

      // 3. Bridge Structure
      if (seg.isBridge) {
        this._buildBridgeGeometry(points, curve, bridgeWoodMat, guardrailMat);
      }

      // 4. Tunnel Structure
      if (seg.isTunnel) {
        this._buildTunnelGeometry(points, curve, tunnelConcreteMat);
      }
    }

    // 5. Junction Hubs (Intersections)
    for (const [id, junc] of this.junctions) {
      const hubGeo = new THREE.CylinderGeometry(halfWidth * 1.1, halfWidth * 1.1, 0.08, 16);
      const hubMesh = new THREE.Mesh(hubGeo, asphaltMat);
      hubMesh.position.set(junc.position.x, junc.position.y + 0.01, junc.position.z);
      hubMesh.receiveShadow = true;
      this.group.add(hubMesh);
    }

    return this.group;
  }

  _buildBridgeGeometry(points, curve, woodMat, railMat) {
    const halfWidth = this.roadWidth * 0.5;
    // Wooden deck supports & metal guardrails
    for (let i = 0; i < points.length; i += 4) {
      const pt = points[i];
      const t = i / (points.length - 1);
      const tangent = curve.getTangent(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // Left and right support posts & rails
      [-1, 1].forEach(side => {
        const postPos = pt.clone().add(binormal.clone().multiplyScalar(side * (halfWidth + 0.2)));
        const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8);
        const post = new THREE.Mesh(postGeo, railMat);
        post.position.set(postPos.x, postPos.y + 0.6, postPos.z);
        post.castShadow = true;
        this.group.add(post);

        // Vertical bridge pier extending down to canyon floor
        if (i % 8 === 0) {
          const pierHeight = Math.max(4, pt.y + 10);
          const pierGeo = new THREE.BoxGeometry(0.5, pierHeight, 0.5);
          const pier = new THREE.Mesh(pierGeo, woodMat);
          pier.position.set(postPos.x, postPos.y - pierHeight * 0.5, postPos.z);
          pier.castShadow = true;
          this.group.add(pier);
        }
      });
    }
  }

  _buildTunnelGeometry(points, curve, concreteMat) {
    const halfWidth = this.roadWidth * 0.5 + 0.8;
    const tunnelRadius = halfWidth;

    // Tunnel Arch Shell along central section
    const midStart = Math.floor(points.length * 0.25);
    const midEnd = Math.floor(points.length * 0.75);

    // Arch Portals at entrance and exit
    [midStart, midEnd].forEach(idx => {
      const pt = points[idx];
      const t = idx / (points.length - 1);
      const tangent = curve.getTangent(t).normalize();

      const portalGeo = new THREE.TorusGeometry(tunnelRadius, 0.6, 8, 16, Math.PI);
      const portal = new THREE.Mesh(portalGeo, concreteMat);
      portal.position.set(pt.x, pt.y + 0.2, pt.z);
      portal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      portal.rotation.z = Math.PI * 0.5;
      this.group.add(portal);

      // Overhead tunnel lamp
      const lamp = new THREE.PointLight(0xffeedd, 2.0, 12);
      lamp.position.set(pt.x, pt.y + tunnelRadius - 0.5, pt.z);
      this.group.add(lamp);
    });
  }

  /**
   * Compute the minimum lateral distance from point (x, z) to the nearest
   * road spline centreline, and return the drivable ribbon half-width.
   *
   * Used by PhysicsEngine.checkRoadBoundary() to implement the soft-constraint
   * road track-keeping model (R1).  No Three.js geometry is created; this is a
   * pure geometric query over the pre-built CatmullRomCurve3 segment data.
   *
   * @param {number} x
   * @param {number} z
   * @returns {{ distFromCenter: number, halfWidth: number, onRoad: boolean }}
   */
  getDistanceFromCenterline(x, z) {
    let minDist    = Infinity;
    const hw       = this.roadWidth * 0.5;  // half-width of drivable ribbon

    for (const [, seg] of this.segments) {
      // Fast AABB reject using junction endpoints
      const u = this.junctions.get(seg.a)?.position;
      const v = this.junctions.get(seg.b)?.position;
      if (!u || !v) continue;

      const margin = hw + 6;  // generous reject margin
      if (x < Math.min(u.x, v.x) - margin || x > Math.max(u.x, v.x) + margin) continue;
      if (z < Math.min(u.z, v.z) - margin || z > Math.max(u.z, v.z) + margin) continue;

      // Project query point onto the spline by sampling
      const samples = 24;
      for (let i = 0; i <= samples; i++) {
        const pt  = seg.curve.getPoint(i / samples);
        const dx  = x - pt.x;
        const dz  = z - pt.z;
        const dist = Math.hypot(dx, dz);
        if (dist < minDist) minDist = dist;
      }
    }

    if (!isFinite(minDist)) {
      // No road segments found (empty graph) -- treat as on road
      return { distFromCenter: 0, halfWidth: hw, onRoad: true };
    }

    return {
      distFromCenter: minDist,
      halfWidth: hw,
      onRoad: minDist <= hw,
    };
  }

  /**
   * Sample road elevation at world coordinates (x, z).
   * Returns road height info if within road corridor, else null.
   *
   * @param {number} x
   * @param {number} z
   * @returns {{ y: number, surface: 'road'|'bridge'|'tunnel', normal: [number, number, number] } | null}
   */
  getRoadElevation(x, z) {
    const searchRadius = this.roadWidth * 0.7; // ~4.3m

    for (const [key, seg] of this.segments) {
      // Fast bounding box check
      const u = this.junctions.get(seg.a).position;
      const v = this.junctions.get(seg.b).position;
      const minX = Math.min(u.x, v.x) - searchRadius;
      const maxX = Math.max(u.x, v.x) + searchRadius;
      const minZ = Math.min(u.z, v.z) - searchRadius;
      const maxZ = Math.max(u.z, v.z) + searchRadius;

      if (x < minX || x > maxX || z < minZ || z > maxZ) continue;

      // Project onto curve
      const curve = seg.curve;
      const samples = 16;
      let closestDistSq = Infinity;
      let closestT = 0;

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const pt = curve.getPoint(t);
        const dSq = (x - pt.x) ** 2 + (z - pt.z) ** 2;
        if (dSq < closestDistSq) {
          closestDistSq = dSq;
          closestT = t;
        }
      }

      if (closestDistSq <= searchRadius ** 2) {
        const ptOnCurve = curve.getPoint(closestT);
        const surface = seg.isBridge ? 'bridge' : seg.isTunnel ? 'tunnel' : 'road';
        return {
          y: ptOnCurve.y,
          surface,
          normal: [0, 1, 0],
        };
      }
    }

    return null;
  }
}

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {Object} world
 * @returns {Promise<RoadNetwork>}
 */
export async function initRoads(world) {
  const roadGraph = world.graph;
  const network = new RoadNetwork(roadGraph);
  console.log('[roads] RoadNetwork initialised with Catmull-Rom road splines');
  return network;
}
