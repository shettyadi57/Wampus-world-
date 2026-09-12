/**
 * Navigator.js
 * ─────────────────────────────────────────────────────────────
 * A* Path Planner and Waypoint Management over RoadGraph.
 *
 * Algorithm: A* with edge weights incorporating physical distance
 * and KnowledgeBase deductive risk penalties (avoiding proven pits & hunters).
 */

export class Navigator {
  /**
   * @param {Object} kb KnowledgeBase adapter
   * @param {Object} world WorldContext
   * @param {Object} roads RoadNetworkContext
   */
  constructor(kb, world, roads) {
    this.kb = kb;
    this.world = world;
    this.graph = world?.graph ?? null;
    this.roads = roads;

    this.destinationId = null;
    this.waypoints = [];
    this.currentIndex = 0;
  }

  /**
   * Plans an optimal path from start to destination using A*.
   * @param {string} fromNodeId
   * @param {string} toNodeId
   * @returns {Array<{ nodeId: string, position: [number, number, number] }>}
   */
  planPath(fromNodeId, toNodeId) {
    if (!this.graph || !fromNodeId || !toNodeId) return [];
    if (fromNodeId === toNodeId) {
      const pos = this._getNodePosition(toNodeId);
      return [{ nodeId: toNodeId, position: pos }];
    }

    const openSet = new Set([fromNodeId]);
    const cameFrom = new Map();

    const gScore = new Map();
    gScore.set(fromNodeId, 0);

    const fScore = new Map();
    fScore.set(fromNodeId, this._heuristic(fromNodeId, toNodeId));

    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
      let current = null;
      let lowestF = Infinity;
      for (const node of openSet) {
        const f = fScore.get(node) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = node;
        }
      }

      if (current === toNodeId) {
        return this._reconstructPath(cameFrom, current);
      }

      openSet.delete(current);

      const neighbors = this.graph.getNeighbors(current);
      for (const neighbor of neighbors) {
        const dist = this.graph.getDistance(current, neighbor);
        if (!Number.isFinite(dist)) continue;

        // Penalty based on KnowledgeBase risk
        let riskPenalty = 0;
        if (this.kb) {
          const isSafe = this.kb.isSafe ? this.kb.isSafe(neighbor) : false;
          const pitProb = this.kb.getPitProbability ? this.kb.getPitProbability(neighbor) : 0;
          const hunterProb = this.kb.getHunterProbability ? this.kb.getHunterProbability(neighbor) : 0;

          if (isSafe) {
            riskPenalty = 0;
          } else {
            riskPenalty = (pitProb + hunterProb) * 200;
          }
        }

        const tentativeG = (gScore.get(current) ?? Infinity) + dist + riskPenalty;
        if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
          cameFrom.set(neighbor, current);
          gScore.set(neighbor, tentativeG);
          fScore.set(neighbor, tentativeG + this._heuristic(neighbor, toNodeId));
          openSet.add(neighbor);
        }
      }
    }

    // Fallback if no safe path found: direct shortest path without risk penalty
    return this._planShortestPath(fromNodeId, toNodeId);
  }

  _planShortestPath(fromNodeId, toNodeId) {
    const queue = [[fromNodeId]];
    const visited = new Set([fromNodeId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const curr = path[path.length - 1];

      if (curr === toNodeId) {
        return path.map(id => ({
          nodeId: id,
          position: this._getNodePosition(id),
        }));
      }

      for (const next of this.graph.getNeighbors(curr)) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...path, next]);
        }
      }
    }

    return [];
  }

  _heuristic(aId, bId) {
    const aPos = this._getNodePosition(aId);
    const bPos = this._getNodePosition(bId);
    return Math.hypot(aPos[0] - bPos[0], aPos[2] - bPos[2]);
  }

  _getNodePosition(nodeId) {
    const junc = this.roads?.junctions?.get(nodeId);
    if (junc && junc.position) {
      return [junc.position.x, junc.position.y ?? 0.5, junc.position.z];
    }
    const node = this.graph?.nodes?.get(nodeId);
    return [node?.x ?? 0, 0.5, node?.y ?? 0];
  }

  _reconstructPath(cameFrom, current) {
    const totalPath = [current];
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      totalPath.unshift(current);
    }
    return totalPath.map(id => ({
      nodeId: id,
      position: this._getNodePosition(id),
    }));
  }

  setDestination(toNodeId, fromNodeId = null) {
    this.destinationId = toNodeId;
    const start = fromNodeId || (this.waypoints[this.currentIndex]?.nodeId) || (this.world?.spec?.startId ?? 'n_0_0');
    this.waypoints = this.planPath(start, toNodeId);
    this.currentIndex = 0;
    console.log(`[navigation] Destination set to "${toNodeId}" — planned ${this.waypoints.length} waypoints`);
  }

  nextWaypoint() {
    return this.waypoints[this.currentIndex] || null;
  }

  advanceWaypoint() {
    if (this.currentIndex < this.waypoints.length - 1) {
      this.currentIndex++;
      return this.waypoints[this.currentIndex];
    }
    return null;
  }

  reroute(fromNodeId) {
    if (!this.destinationId) return;
    console.log(`[navigation] Rerouting from ${fromNodeId} to ${this.destinationId}...`);
    this.waypoints = this.planPath(fromNodeId, this.destinationId);
    this.currentIndex = 0;
  }
}

/**
 * @param {Object} kb
 * @param {Object} world
 * @param {Object} roads
 * @returns {Promise<Navigator>}
 */
export async function initNavigation(kb, world, roads) {
  const nav = new Navigator(kb, world, roads);
  console.log('[navigation] Real A* Navigator fully operational');
  return nav;
}
