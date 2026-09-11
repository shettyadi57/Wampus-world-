/**
 * HunterEntity.js
 * ─────────────────────────────────────────────────────────────
 * Autonomous roaming Hunter (Wampus) entity.
 * Maintains actual graph position and movement over time across road edges,
 * radiating thermal signature (Stench) to all adjacent nodes.
 */

import * as THREE from 'three';

export class HunterEntity {
  /**
   * @param {import('../../../engine/RoadGraph.js').RoadGraph} graph
   * @param {import('../roads/RoadNetwork.js').RoadNetwork} roadNetwork
   * @param {Object} [options]
   */
  constructor(graph, roadNetwork, options = {}) {
    this.graph = graph;
    this.roadNetwork = roadNetwork;

    this.currentNodeId = options.initialNodeId ?? (graph?.nodeIds ? graph.nodeIds[graph.nodeIds.length - 2] : 'n_4_4');
    this.targetNodeId = this.currentNodeId;

    this.moveInterval = options.moveInterval ?? 8.0; // seconds per hop
    this.aggression = options.aggression ?? 0.35; // probability to hunt vs random patrol
    this._timer = 0;

    this.position = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.speed = 4.5; // m/s

    this._syncInitialPosition();
    this._buildMesh();
  }

  _syncInitialPosition() {
    const junc = this.roadNetwork?.junctions.get(this.currentNodeId);
    if (junc) {
      this.position.copy(junc.position);
      this.position.y += 0.4;
      this.targetPosition.copy(this.position);
    }
  }

  _buildMesh() {
    this.meshGroup = new THREE.Group();
    this.meshGroup.name = 'HunterEntityMesh';

    // Dark sinister metallic chassis
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.9, 3.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111418,
      roughness: 0.4,
      metalness: 0.9,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    this.meshGroup.add(body);

    // Glowing thermal eye / core (pulsing crimson)
    const coreGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.7, 1.6);
    this.meshGroup.add(core);

    this.thermalLight = new THREE.PointLight(0xff0044, 2.5, 15);
    this.thermalLight.position.set(0, 0.9, 1.6);
    this.meshGroup.add(this.thermalLight);

    this.meshGroup.position.copy(this.position);
  }

  setDifficulty(tier) {
    if (!tier) return;
    this.moveInterval = tier.hunterMoveInterval ?? this.moveInterval;
    this.aggression = tier.hunterAggression ?? this.aggression;
    console.log(`[hunter] Hunter difficulty updated: interval=${this.moveInterval}s, aggression=${(this.aggression * 100).toFixed(0)}%`);
  }

  /**
   * Advances Hunter state over time.
   * @param {number} dt
   * @param {string|null} playerNodeId
   */
  tick(dt, playerNodeId = null) {
    if (!this.graph) return;

    this._timer += dt;

    // Pulse thermal light
    if (this.thermalLight) {
      this.thermalLight.intensity = 2.0 + Math.sin(Date.now() * 0.006) * 0.8;
    }

    // Move selection timer expired: choose next adjacent node
    if (this._timer >= this.moveInterval) {
      this._timer = 0;
      this._chooseNextNode(playerNodeId);
    }

    // Smooth 3D interpolation along ground toward target junction
    const distToTarget = this.position.distanceTo(this.targetPosition);
    if (distToTarget > 0.1) {
      const dir = new THREE.Vector3().subVectors(this.targetPosition, this.position).normalize();
      this.position.addScaledVector(dir, this.speed * dt);
      this.meshGroup.position.copy(this.position);
      this.meshGroup.lookAt(this.targetPosition);
    } else {
      this.currentNodeId = this.targetNodeId;
    }
  }

  _chooseNextNode(playerNodeId) {
    const neighbors = this.graph.getNeighbors(this.currentNodeId);
    if (!neighbors || neighbors.length === 0) return;

    let nextNode = null;

    // Stalking behavior: move toward player
    if (playerNodeId && playerNodeId !== this.currentNodeId && Math.random() < this.aggression) {
      let bestHop = Infinity;
      for (const n of neighbors) {
        const hops = this._bfsHops(n, playerNodeId);
        if (hops < bestHop) {
          bestHop = hops;
          nextNode = n;
        }
      }
    }

    // Fallback: random adjacent patrol
    if (!nextNode) {
      nextNode = neighbors[Math.floor(Math.random() * neighbors.length)];
    }

    this.targetNodeId = nextNode;
    const junc = this.roadNetwork?.junctions.get(nextNode);
    if (junc) {
      this.targetPosition.set(junc.position.x, junc.position.y + 0.4, junc.position.z);
    }
    console.log(`[hunter] Roaming: moved from ${this.currentNodeId} → ${this.targetNodeId}`);
  }

  _bfsHops(from, to) {
    if (from === to) return 0;
    const queue = [[from, 0]];
    const visited = new Set([from]);

    while (queue.length > 0) {
      const [curr, d] = queue.shift();
      for (const n of this.graph.getNeighbors(curr)) {
        if (n === to) return d + 1;
        if (!visited.has(n)) {
          visited.add(n);
          queue.push([n, d + 1]);
        }
      }
    }
    return Infinity;
  }
}
