// Pure A* pathfinding on an integer block grid. No Minecraft imports, so the
// search can be unit tested in plain Node. `isBlocked(x, y, z)` returns true for
// a solid cell the character cannot pass through.

function key(x, y, z) {
  return x + "," + y + "," + z;
}

function heuristic(x, y, z, gx, gy, gz) {
  return Math.abs(x - gx) + Math.abs(y - gy) + Math.abs(z - gz);
}

function reconstruct(cameFrom, nodePos, goalKey, startKey) {
  const path = [];
  let k = goalKey;
  while (k !== undefined && k !== startKey) {
    path.unshift(nodePos[k]);
    k = cameFrom[k];
  }
  return path;
}

// Returns an array of {x,y,z} waypoints from just after start through goal,
// or [] when no path is found within the node/range budget.
export function findPath(start, goal, isBlocked, maxNodes, maxRange) {
  maxNodes = maxNodes || 400;
  maxRange = maxRange || 24;

  const sx = Math.round(start.x);
  const sy = Math.round(start.y);
  const sz = Math.round(start.z);
  const gx = Math.round(goal.x);
  const gy = Math.round(goal.y);
  const gz = Math.round(goal.z);

  if (Math.abs(gx - sx) > maxRange || Math.abs(gy - sy) > maxRange || Math.abs(gz - sz) > maxRange) {
    return [];
  }
  if (isBlocked(gx, gy, gz)) {
    return [];
  }

  const startKey = key(sx, sy, sz);
  const goalKey = key(gx, gy, gz);
  const open = [{ x: sx, y: sy, z: sz, g: 0, f: heuristic(sx, sy, sz, gx, gy, gz), k: startKey }];
  const cameFrom = {};
  const gScore = {};
  const closed = {};
  const nodePos = {};
  gScore[startKey] = 0;
  nodePos[startKey] = { x: sx, y: sy, z: sz };

  const dirs = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
  ];

  let expanded = 0;
  while (open.length > 0 && expanded < maxNodes) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[best].f) {
        best = i;
      }
    }
    const current = open.splice(best, 1)[0];
    if (current.k === goalKey) {
      return reconstruct(cameFrom, nodePos, goalKey, startKey);
    }
    if (closed[current.k]) {
      continue;
    }
    closed[current.k] = true;
    expanded++;

    for (const d of dirs) {
      const nx = current.x + d[0];
      const ny = current.y + d[1];
      const nz = current.z + d[2];
      if (Math.abs(nx - sx) > maxRange || Math.abs(ny - sy) > maxRange || Math.abs(nz - sz) > maxRange) {
        continue;
      }
      if (isBlocked(nx, ny, nz)) {
        continue;
      }
      const nk = key(nx, ny, nz);
      if (closed[nk]) {
        continue;
      }
      const tentative = current.g + 1;
      if (gScore[nk] === undefined || tentative < gScore[nk]) {
        gScore[nk] = tentative;
        cameFrom[nk] = current.k;
        nodePos[nk] = { x: nx, y: ny, z: nz };
        open.push({ x: nx, y: ny, z: nz, g: tentative, f: tentative + heuristic(nx, ny, nz, gx, gy, gz), k: nk });
      }
    }
  }
  return [];
}
