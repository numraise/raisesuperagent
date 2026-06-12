// Pure navigation helpers for the superagent character.
// No Minecraft imports here so the math can be unit tested in plain Node.

// Move `current` toward `target`, at most `speed` blocks. Returns the next
// position and an `arrived` flag when the remaining distance is within one step.
export function stepToward(current, target, speed) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dz = target.z - current.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist === 0 || dist <= speed) {
    return { x: target.x, y: target.y, z: target.z, arrived: true };
  }
  const k = speed / dist;
  return {
    x: current.x + dx * k,
    y: current.y + dy * k,
    z: current.z + dz * k,
    arrived: false
  };
}

// Parse a "x y z" scriptevent message into a location, or null when invalid.
export function parseGoto(message) {
  if (typeof message !== "string") {
    return null;
  }
  const parts = message.trim().split(/\s+/);
  if (parts.length < 3) {
    return null;
  }
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return { x, y, z };
}
