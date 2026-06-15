import { system, world } from "@minecraft/server";

// ---- inlined nav + pathfinding helpers ------------------------------------
// These are kept inline (rather than imported from navmath.js / pathfind.js) so
// the behavior pack is a single self-contained script module. Some Education
// builds fail to load packs that import secondary script files. The standalone
// files remain for unit testing only.

function stepToward(current, target, speed) {
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

function parseGoto(message) {
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

function pathKey(x, y, z) {
  return x + "," + y + "," + z;
}

function pathHeuristic(x, y, z, gx, gy, gz) {
  return Math.abs(x - gx) + Math.abs(y - gy) + Math.abs(z - gz);
}

function pathReconstruct(cameFrom, nodePos, goalKey, startKey) {
  const path = [];
  let k = goalKey;
  while (k !== undefined && k !== startKey) {
    path.unshift(nodePos[k]);
    k = cameFrom[k];
  }
  return path;
}

function findPath(start, goal, isBlocked, maxNodes, maxRange) {
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
  const startKey = pathKey(sx, sy, sz);
  const goalKey = pathKey(gx, gy, gz);
  const open = [{ x: sx, y: sy, z: sz, g: 0, f: pathHeuristic(sx, sy, sz, gx, gy, gz), k: startKey }];
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
      return pathReconstruct(cameFrom, nodePos, goalKey, startKey);
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
      const nk = pathKey(nx, ny, nz);
      if (closed[nk]) {
        continue;
      }
      const tentative = current.g + 1;
      if (gScore[nk] === undefined || tentative < gScore[nk]) {
        gScore[nk] = tentative;
        cameFrom[nk] = current.k;
        nodePos[nk] = { x: nx, y: ny, z: nz };
        open.push({ x: nx, y: ny, z: nz, g: tentative, f: tentative + pathHeuristic(nx, ny, nz, gx, gy, gz), k: nk });
      }
    }
  }
  return [];
}

const SUPER_AGENT_ID = "superagent:superagent";
const LEGACY_VISIBLE_MARKER_ID = "minecraft:armor_stand";
const DISPLAY_NAME = "superagent";
const ROOT_TAG = "superagent.managed";
const OWNER_TAG_PREFIX = "superagent.owner.";
const READY_TAG = "superagent.ready.0_1_35";
const LABEL_PROPERTY = "superagent:label";
const COMBAT_FLAG = "superagent:combat_enabled";
const FREEZE_FLAG = "superagent:frozen";
const TARGET_X_PROP = "superagent:tx";
const TARGET_Y_PROP = "superagent:ty";
const TARGET_Z_PROP = "superagent:tz";
const FOLLOW_WALK_PROP = "superagent:follow_walk";
const PATH_PROP = "superagent:path";
const PATH_INDEX_PROP = "superagent:path_i";
const PATH_GOAL_X_PROP = "superagent:goal_x";
const PATH_GOAL_Y_PROP = "superagent:goal_y";
const PATH_GOAL_Z_PROP = "superagent:goal_z";
const MAX_PATH_NODES = 300;
const MAX_PATH_RANGE = 24;
const GUARD_TAG = "superagent.guard";
const HOME_X_PROP = "superagent:home_x";
const HOME_Y_PROP = "superagent:home_y";
const HOME_Z_PROP = "superagent:home_z";
const SPIN_PROP = "superagent:spin_until";
const SPIN_TICKS = 18;
const MAX_GUARDS = 4;
const ATTACK_RADIUS = 8;
const ATTACK_DAMAGE = 14;
const MAX_ATTACK_TARGETS = 12;
const FOLLOW_RADIUS = 128;
const TICK_RATE = 2;
const PRESENCE_RADIUS = 1.35;
const MOVE_SPEED = 0.45;
const GUARD_SPEED = 0.6;

const CUSTOM_PRESENCE_PARTICLES = [
  "superagent:agent_aura",
  "superagent:agent_spark"
];

const FALLBACK_PRESENCE_PARTICLES = [
  "minecraft:totem_particle",
  "minecraft:heart_particle",
  "minecraft:villager_happy",
  "minecraft:basic_flame_particle",
  "minecraft:basic_smoke_particle",
  "minecraft:critical_hit_emitter"
];

const ATTACK_PARTICLES = [
  "superagent:attack_burst",
  "minecraft:critical_hit_emitter",
  "minecraft:basic_flame_particle"
];

const HOSTILE_TYPES = [
  "minecraft:blaze",
  "minecraft:breeze",
  "minecraft:cave_spider",
  "minecraft:creeper",
  "minecraft:drowned",
  "minecraft:elder_guardian",
  "minecraft:enderman",
  "minecraft:endermite",
  "minecraft:evocation_illager",
  "minecraft:ghast",
  "minecraft:guardian",
  "minecraft:hoglin",
  "minecraft:husk",
  "minecraft:magma_cube",
  "minecraft:phantom",
  "minecraft:piglin_brute",
  "minecraft:pillager",
  "minecraft:ravager",
  "minecraft:shulker",
  "minecraft:silverfish",
  "minecraft:skeleton",
  "minecraft:slime",
  "minecraft:spider",
  "minecraft:stray",
  "minecraft:vex",
  "minecraft:vindicator",
  "minecraft:warden",
  "minecraft:witch",
  "minecraft:wither_skeleton",
  "minecraft:zoglin",
  "minecraft:zombie",
  "minecraft:zombie_pigman",
  "minecraft:zombie_villager",
  "minecraft:zombified_piglin"
];

const HIGH_THREAT_TYPES = [
  "minecraft:blaze",
  "minecraft:breeze",
  "minecraft:cave_spider",
  "minecraft:creeper",
  "minecraft:elder_guardian",
  "minecraft:evocation_illager",
  "minecraft:ghast",
  "minecraft:guardian",
  "minecraft:hoglin",
  "minecraft:phantom",
  "minecraft:piglin_brute",
  "minecraft:pillager",
  "minecraft:ravager",
  "minecraft:vex",
  "minecraft:vindicator",
  "minecraft:warden",
  "minecraft:witch",
  "minecraft:wither_skeleton"
];

function ownerTag(player) {
  return OWNER_TAG_PREFIX + player.name.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 32);
}

// Strict Agent check. The previous version matched any typeId containing
// "agent", which wrongly classified superagent:superagent as the Agent.
function isAgent(entity) {
  if (!entity) {
    return false;
  }
  if (entity.typeId === SUPER_AGENT_ID) {
    return false;
  }
  const typeId = (entity.typeId || "").toLowerCase();
  return typeId === "minecraft:agent" || typeId === "agent" || typeId.endsWith(":agent");
}

function isOwnedByAnyone(entity) {
  try {
    return entity.getTags().some((tag) => tag.indexOf(OWNER_TAG_PREFIX) === 0);
  } catch (error) {
    return false;
  }
}

// ---- combat toggle (teacher controlled, off by default) -------------------

function combatEnabled() {
  return world.getDynamicProperty(COMBAT_FLAG) === true;
}

function setCombatEnabled(on) {
  try {
    world.setDynamicProperty(COMBAT_FLAG, on === true);
  } catch (error) {
  }
}

// ---- freeze toggle (teacher control) --------------------------------------

function isFrozen() {
  return world.getDynamicProperty(FREEZE_FLAG) === true;
}

function setFrozen(on) {
  try {
    world.setDynamicProperty(FREEZE_FLAG, on === true);
  } catch (error) {
  }
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function closestEntity(entities, location) {
  let closest;
  let closestDistance = Number.MAX_VALUE;
  for (const entity of entities) {
    const nextDistance = distanceSquared(entity.location, location);
    if (nextDistance < closestDistance) {
      closest = entity;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function findPlayerAgent(player) {
  const nearby = player.dimension.getEntities({
    location: player.location,
    maxDistance: FOLLOW_RADIUS
  });
  return closestEntity(nearby.filter(isAgent), player.location);
}

function allNearbySuperagents(player) {
  return player.dimension.getEntities({
    type: SUPER_AGENT_ID,
    location: player.location,
    maxDistance: FOLLOW_RADIUS
  });
}

function allDimensionSuperagents(player) {
  return player.dimension.getEntities({
    type: SUPER_AGENT_ID
  });
}

// The single controllable character this player owns. Guards are excluded so
// the dedupe step never deletes a squad guard, and another player's character
// (different owner tag) is never touched either.
function findOwnedSuperagents(player) {
  const tag = ownerTag(player);
  return allNearbySuperagents(player).filter(
    (entity) => entity.hasTag(tag) && !entity.hasTag(GUARD_TAG)
  );
}

function findOwnedSuperagentsInDimension(player) {
  const tag = ownerTag(player);
  return allDimensionSuperagents(player).filter(
    (entity) => entity.hasTag(tag) && !entity.hasTag(GUARD_TAG)
  );
}

// Autonomous squad guards owned by this player.
function findGuards(player) {
  const tag = ownerTag(player);
  return allNearbySuperagents(player).filter(
    (entity) => entity.hasTag(tag) && entity.hasTag(GUARD_TAG)
  );
}

function addEffectSafe(entity, effect, duration, options) {
  if (!entity) {
    return;
  }
  try {
    entity.addEffect(effect, duration, options);
  } catch (error) {
  }
}

function applyLabel(superagent) {
  let label;
  try {
    label = superagent.getDynamicProperty(LABEL_PROPERTY);
  } catch (error) {
    label = undefined;
  }
  superagent.nameTag = (typeof label === "string" && label.length > 0) ? label : DISPLAY_NAME;
}

function configureSuperagent(superagent, player) {
  if (!superagent) {
    return;
  }
  applyLabel(superagent);
  superagent.addTag(ROOT_TAG);
  superagent.addTag(ownerTag(player));
  addEffectSafe(superagent, "resistance", 200, {
    amplifier: 255,
    showParticles: false
  });
  addEffectSafe(superagent, "fire_resistance", 200, {
    amplifier: 1,
    showParticles: false
  });
}

function removeEntitySafe(entity) {
  try {
    entity.remove();
  } catch (error) {
  }
}

function clearMovementState(superagent) {
  if (!superagent) {
    return;
  }
  try {
    superagent.setDynamicProperty(FOLLOW_WALK_PROP, false);
  } catch (error) {
  }
  clearNavTarget(superagent);
  clearPath(superagent);
}

// Ensure this player owns exactly one character. Adopts a nearby unowned
// character (e.g. one summoned by the MakeCode extension) instead of spawning
// a competing duplicate, then removes only this player's surplus copies.
function ensureOwnedSuperagent(player) {
  const owned = findOwnedSuperagents(player);
  let superagent = owned.length > 0 ? closestEntity(owned, player.location) : undefined;
  if (!superagent) {
    const unowned = allNearbySuperagents(player).filter((entity) => !isOwnedByAnyone(entity));
    superagent = closestEntity(unowned, player.location);
  }
  if (!superagent) {
    try {
      superagent = player.dimension.spawnEntity(SUPER_AGENT_ID, player.location);
    } catch (error) {
      return undefined;
    }
  }
  configureSuperagent(superagent, player);
  // Remove every other nearby character that is mine or has no owner (leftovers
  // from older summon-based builds). Guards and other players' characters stay.
  const tag = ownerTag(player);
  for (const other of allNearbySuperagents(player)) {
    if (other.id === superagent.id || other.hasTag(GUARD_TAG)) {
      continue;
    }
    if (other.hasTag(tag) || !isOwnedByAnyone(other)) {
      removeEntitySafe(other);
    }
  }
  return superagent;
}

function nearestPlayerTo(entity) {
  if (!entity) {
    return undefined;
  }
  return closestEntity(world.getPlayers().filter((player) => player.dimension === entity.dimension), entity.location);
}

function transportSuperagentToEgg(spawned) {
  if (!spawned || spawned.typeId !== SUPER_AGENT_ID) {
    return;
  }
  const player = nearestPlayerTo(spawned);
  if (!player) {
    return;
  }
  const target = {
    x: spawned.location.x,
    y: spawned.location.y,
    z: spawned.location.z
  };
  const owned = closestEntity(findOwnedSuperagentsInDimension(player), spawned.location);
  if (owned && owned.id !== spawned.id) {
    configureSuperagent(owned, player);
    clearMovementState(owned);
    try {
      teleportEntityOpen(owned, target);
    } catch (error) {
    }
    removeEntitySafe(spawned);
    return;
  }
  configureSuperagent(spawned, player);
  clearMovementState(spawned);
  const tag = ownerTag(player);
  for (const other of allNearbySuperagents(player)) {
    if (other.id === spawned.id || other.hasTag(GUARD_TAG)) {
      continue;
    }
    if (other.hasTag(tag) || !isOwnedByAnyone(other)) {
      removeEntitySafe(other);
    }
  }
}

function isAttackTarget(entity) {
  if (!entity || entity.hasTag(ROOT_TAG) || entity.typeId === SUPER_AGENT_ID || entity.typeId === LEGACY_VISIBLE_MARKER_ID || isAgent(entity)) {
    return false;
  }
  if (entity.typeId === "minecraft:player" || entity.typeId === "minecraft:item") {
    return false;
  }
  return HOSTILE_TYPES.indexOf(entity.typeId) >= 0;
}

function isHighThreat(entity) {
  return HIGH_THREAT_TYPES.indexOf(entity.typeId) >= 0;
}

function threatScore(entity, origin) {
  let score = 100 - distanceSquared(entity.location, origin);
  if (isHighThreat(entity)) {
    score += 80;
  }
  if (entity.typeId === "minecraft:creeper" || entity.typeId === "minecraft:warden") {
    score += 120;
  }
  return score;
}

function smartAttackTargets(superagent) {
  return superagent.dimension.getEntities({
    location: superagent.location,
    maxDistance: ATTACK_RADIUS
  })
    .filter(isAttackTarget)
    .sort((a, b) => threatScore(b, superagent.location) - threatScore(a, superagent.location))
    .slice(0, MAX_ATTACK_TARGETS);
}

function weakenTarget(target) {
  target.addEffect("slowness", 80, {
    amplifier: isHighThreat(target) ? 2 : 1,
    showParticles: false
  });
  target.addEffect("weakness", 80, {
    amplifier: isHighThreat(target) ? 1 : 0,
    showParticles: false
  });
}

function emitAuraParticles(dimension, location, tick) {
  const angle = tick * 0.45;
  const ring = [
    { x: Math.cos(angle) * 1.4, y: 0.3, z: Math.sin(angle) * 1.4 },
    { x: Math.cos(angle + 2.1) * 1.4, y: 0.9, z: Math.sin(angle + 2.1) * 1.4 },
    { x: Math.cos(angle + 4.2) * 1.4, y: 1.5, z: Math.sin(angle + 4.2) * 1.4 }
  ];
  for (const offset of ring) {
    spawnParticleAny(dimension, ATTACK_PARTICLES, {
      x: location.x + offset.x,
      y: location.y + offset.y,
      z: location.z + offset.z
    });
  }
}

function formatCoord(value) {
  return Math.round(value * 100) / 100;
}

function formatWholeCoord(value) {
  return Math.round(value);
}

function formatLocationText(location) {
  return `x=${formatWholeCoord(location.x)} y=${formatWholeCoord(location.y)} z=${formatWholeCoord(location.z)}`;
}

function runCommandSafe(dimension, command) {
  try {
    if (typeof dimension.runCommandAsync === "function") {
      dimension.runCommandAsync(command);
      return true;
    }
  } catch (error) {
  }
  try {
    if (typeof dimension.runCommand === "function") {
      dimension.runCommand(command);
      return true;
    }
  } catch (error) {
  }
  return false;
}

function spawnParticleCommand(dimension, name, location) {
  return runCommandSafe(dimension, `particle ${name} ${formatCoord(location.x)} ${formatCoord(location.y)} ${formatCoord(location.z)}`);
}

function spawnParticleAny(dimension, names, location) {
  for (const name of names) {
    try {
      dimension.spawnParticle(name, location);
      return true;
    } catch (error) {
    }
  }
  for (const name of names) {
    if (spawnParticleCommand(dimension, name, location)) {
      return true;
    }
  }
  return false;
}

function attackAround(superagent, tick) {
  const targets = smartAttackTargets(superagent);
  for (const target of targets) {
    try {
      weakenTarget(target);
      target.applyDamage(ATTACK_DAMAGE + (isHighThreat(target) ? 4 : 0));
    } catch (error) {
    }
  }
  emitAuraParticles(superagent.dimension, superagent.location, tick);
  return targets.length;
}

function keepAlive(superagent) {
  if (!superagent) {
    return;
  }
  try {
    const health = superagent.getComponent("minecraft:health");
    if (health) {
      health.resetToMaxValue();
    }
  } catch (error) {
  }
}

function refreshAgentVisibleEffects(agentEntity) {
  addEffectSafe(agentEntity, "strength", 80, {
    amplifier: 1,
    showParticles: false
  });
  addEffectSafe(agentEntity, "resistance", 80, {
    amplifier: 0,
    showParticles: false
  });
}

function markerNameMatches(entity) {
  const nameTag = (entity.nameTag || "").toLowerCase();
  return nameTag === "superagent" || nameTag === "superaagent";
}

function cleanupLegacyVisibleMarkers(player, anchorLocation) {
  const legacyMarkers = player.dimension.getEntities({
    type: LEGACY_VISIBLE_MARKER_ID,
    location: anchorLocation,
    maxDistance: FOLLOW_RADIUS
  });
  for (const marker of legacyMarkers) {
    if (marker.hasTag(ROOT_TAG) || markerNameMatches(marker)) {
      removeEntitySafe(marker);
    }
  }
  runCommandSafe(player.dimension, `kill @e[type=${LEGACY_VISIBLE_MARKER_ID},tag=${ROOT_TAG}]`);
  runCommandSafe(player.dimension, `kill @e[type=${LEGACY_VISIBLE_MARKER_ID},name=superagent]`);
  runCommandSafe(player.dimension, `kill @e[type=${LEGACY_VISIBLE_MARKER_ID},name=superaagent]`);
}

function announceReady(player) {
  try {
    if (!player.hasTag(READY_TAG)) {
      player.addTag(READY_TAG);
      player.sendMessage("superagent 0.1.46 script active");
    }
  } catch (error) {
  }
}

// ---- smooth glide navigation ----------------------------------------------

function clearNavTarget(superagent) {
  try {
    superagent.setDynamicProperty(TARGET_X_PROP, undefined);
    superagent.setDynamicProperty(TARGET_Y_PROP, undefined);
    superagent.setDynamicProperty(TARGET_Z_PROP, undefined);
  } catch (error) {
  }
}

function setNavTarget(superagent, location) {
  try {
    superagent.setDynamicProperty(TARGET_X_PROP, location.x);
    superagent.setDynamicProperty(TARGET_Y_PROP, location.y);
    superagent.setDynamicProperty(TARGET_Z_PROP, location.z);
  } catch (error) {
  }
}

function readNavTarget(superagent) {
  const x = superagent.getDynamicProperty(TARGET_X_PROP);
  const y = superagent.getDynamicProperty(TARGET_Y_PROP);
  const z = superagent.getDynamicProperty(TARGET_Z_PROP);
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
    return undefined;
  }
  return { x, y, z };
}

// A cell blocks the path if it holds a solid (non-air, non-liquid) block.
// Unloaded chunks return undefined and are treated as passable.

function passableBlock(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) {
      return true;
    }
    return block.isAir || block.isLiquid;
  } catch (error) {
    return true;
  }
}

function locationIsOpen(dimension, location) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  return passableBlock(dimension, x, y, z) && passableBlock(dimension, x, y + 1, z);
}

function openLocationNear(dimension, location) {
  if (locationIsOpen(dimension, location)) {
    return location;
  }
  const baseX = Math.floor(location.x);
  const baseY = Math.floor(location.y);
  const baseZ = Math.floor(location.z);
  for (let radius = 1; radius <= 4; radius++) {
    for (let dy = 0 - radius; dy <= radius; dy++) {
      for (let dx = 0 - radius; dx <= radius; dx++) {
        for (let dz = 0 - radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== radius) {
            continue;
          }
          const candidate = {
            x: baseX + dx + 0.5,
            y: baseY + dy,
            z: baseZ + dz + 0.5
          };
          if (locationIsOpen(dimension, candidate)) {
            return candidate;
          }
        }
      }
    }
  }
  return undefined;
}

function teleportEntityOpen(entity, location, options) {
  if (!entity) {
    return false;
  }
  const target = openLocationNear(entity.dimension, location);
  if (!target) {
    return false;
  }
  try {
    entity.teleport(target, options || {});
    return true;
  } catch (error) {
    return false;
  }
}

function blockIsObstacle(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) {
      return false;
    }
    if (block.isAir || block.isLiquid) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

function clearPath(superagent) {
  try {
    superagent.setDynamicProperty(PATH_PROP, undefined);
    superagent.setDynamicProperty(PATH_INDEX_PROP, undefined);
    superagent.setDynamicProperty(PATH_GOAL_X_PROP, undefined);
    superagent.setDynamicProperty(PATH_GOAL_Y_PROP, undefined);
    superagent.setDynamicProperty(PATH_GOAL_Z_PROP, undefined);
  } catch (error) {
  }
}

function readPathGoal(superagent) {
  const x = superagent.getDynamicProperty(PATH_GOAL_X_PROP);
  const y = superagent.getDynamicProperty(PATH_GOAL_Y_PROP);
  const z = superagent.getDynamicProperty(PATH_GOAL_Z_PROP);
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
    return undefined;
  }
  return { x, y, z };
}

// Run A* from the character to the goal and store the waypoint list. Falls back
// to a straight glide when no path is found within budget.
function computeAndStorePath(superagent, goal) {
  const dimension = superagent.dimension;
  const path = findPath(
    superagent.location,
    goal,
    (x, y, z) => blockIsObstacle(dimension, x, y, z),
    MAX_PATH_NODES,
    MAX_PATH_RANGE
  );
  superagent.setDynamicProperty(FOLLOW_WALK_PROP, false);
  if (!path || path.length === 0) {
    clearPath(superagent);
    setNavTarget(superagent, goal);
    return;
  }
  clearNavTarget(superagent);
  try {
    superagent.setDynamicProperty(PATH_PROP, JSON.stringify(path));
    superagent.setDynamicProperty(PATH_INDEX_PROP, 0);
    superagent.setDynamicProperty(PATH_GOAL_X_PROP, goal.x);
    superagent.setDynamicProperty(PATH_GOAL_Y_PROP, goal.y);
    superagent.setDynamicProperty(PATH_GOAL_Z_PROP, goal.z);
  } catch (error) {
    setNavTarget(superagent, goal);
  }
}

// Glide along the stored A* waypoints. Returns true while a path is active.
function stepAlongPath(superagent) {
  const raw = superagent.getDynamicProperty(PATH_PROP);
  if (typeof raw !== "string" || raw.length === 0) {
    return false;
  }
  let path;
  try {
    path = JSON.parse(raw);
  } catch (error) {
    clearPath(superagent);
    return false;
  }
  let index = superagent.getDynamicProperty(PATH_INDEX_PROP);
  if (typeof index !== "number") {
    index = 0;
  }
  if (index >= path.length) {
    clearPath(superagent);
    return false;
  }
  const waypoint = path[index];
  // Adaptive: if the next waypoint is now blocked (terrain changed), recompute.
  if (blockIsObstacle(superagent.dimension, Math.round(waypoint.x), Math.round(waypoint.y), Math.round(waypoint.z))) {
    const goal = readPathGoal(superagent);
    if (goal) {
      computeAndStorePath(superagent, goal);
    } else {
      clearPath(superagent);
    }
    return true;
  }
  const next = stepToward(superagent.location, waypoint, MOVE_SPEED);
  if (next.arrived) {
    superagent.setDynamicProperty(PATH_INDEX_PROP, index + 1);
    if (index + 1 >= path.length) {
      clearPath(superagent);
    }
    return true;
  }
  teleportEntityOpen(superagent, { x: next.x, y: next.y, z: next.z }, { facingLocation: waypoint });
  return true;
}

function navStep(player, superagent) {
  if (isFrozen()) {
    return;
  }
  if (stepAlongPath(superagent)) {
    return;
  }
  const follow = superagent.getDynamicProperty(FOLLOW_WALK_PROP) === true;
  let target;
  if (follow) {
    const agentEntity = findPlayerAgent(player);
    if (agentEntity) {
      target = agentEntity.location;
    }
  } else {
    target = readNavTarget(superagent);
  }
  if (!target) {
    return;
  }
  const next = stepToward(superagent.location, target, MOVE_SPEED);
  if (next.arrived) {
    if (!follow) {
      clearNavTarget(superagent);
    }
    return;
  }
  // Collision: never glide into a solid block — stop at the wall instead.
  if (blockIsObstacle(superagent.dimension, Math.round(next.x), Math.round(next.y), Math.round(next.z))) {
    if (!follow) {
      clearNavTarget(superagent);
    }
    return;
  }
  try {
    teleportEntityOpen(superagent, { x: next.x, y: next.y, z: next.z }, { facingLocation: target });
  } catch (error) {
  }
}

// ---- auto status (nameTag + particle reflect what the character is doing) --

function currentStatus(superagent) {
  if (readNavTarget(superagent) || superagent.getDynamicProperty(FOLLOW_WALK_PROP) === true) {
    return "moving";
  }
  if (combatEnabled()) {
    return "guard";
  }
  return "idle";
}

// A custom label (set via superagent:label) always wins; otherwise show status.
function applyLabelWithStatus(superagent, status) {
  let label;
  try {
    label = superagent.getDynamicProperty(LABEL_PROPERTY);
  } catch (error) {
    label = undefined;
  }
  if (typeof label === "string" && label.length > 0) {
    superagent.nameTag = label;
  } else {
    superagent.nameTag = "superagent [" + status + "]";
  }
}

function emitStatusParticle(superagent, status) {
  let particle = "minecraft:villager_happy";
  if (status === "moving") {
    particle = "minecraft:totem_particle";
  } else if (status === "guard") {
    particle = "minecraft:basic_flame_particle";
  }
  spawnParticleAny(superagent.dimension, [particle], {
    x: superagent.location.x,
    y: superagent.location.y + 1.9,
    z: superagent.location.z
  });
}

// Spin the character fast for a short window to show an attack.
function startSpin(superagent) {
  if (!superagent) {
    return;
  }
  try {
    superagent.setDynamicProperty(SPIN_PROP, system.currentTick + SPIN_TICKS);
  } catch (error) {
  }
}

function spinIfActive(superagent, tick) {
  let until;
  try {
    until = superagent.getDynamicProperty(SPIN_PROP);
  } catch (error) {
    return;
  }
  if (typeof until !== "number" || tick > until) {
    return;
  }
  const yaw = (tick * 100) % 360 - 180;
  try {
    superagent.setRotation({ x: 0, y: yaw });
    return;
  } catch (error) {
  }
  try {
    superagent.teleport(superagent.location, { rotation: { x: 0, y: yaw } });
  } catch (error) {
  }
}

function tickSuperagent(player, superagent, tick) {
  configureSuperagent(superagent, player);
  keepAlive(superagent);
  navStep(player, superagent);
  spinIfActive(superagent, tick);
  const status = currentStatus(superagent);
  applyLabelWithStatus(superagent, status);
  // No idle particles: the character is shown by its model + name tag only.
  if (combatEnabled()) {
    attackAround(superagent, tick);
  }
}

// ---- squad guards ---------------------------------------------------------

function spawnGuard(player) {
  if (findGuards(player).length >= MAX_GUARDS) {
    return undefined;
  }
  let guard;
  try {
    guard = player.dimension.spawnEntity(SUPER_AGENT_ID, player.location);
  } catch (error) {
    return undefined;
  }
  guard.addTag(GUARD_TAG);
  configureSuperagent(guard, player);
  return guard;
}

function removeGuards(player) {
  for (const guard of findGuards(player)) {
    removeEntitySafe(guard);
  }
}

// Guards glide to a ring around the player and fight when combat is enabled.
function guardStep(player, guard, index, tick) {
  const angle = index * 1.7;
  const target = {
    x: player.location.x + Math.cos(angle) * 2.5,
    y: player.location.y,
    z: player.location.z + Math.sin(angle) * 2.5
  };
  const next = stepToward(guard.location, target, GUARD_SPEED);
  const guardBlocked = blockIsObstacle(guard.dimension, Math.round(next.x), Math.round(next.y), Math.round(next.z));
  if (!next.arrived && !isFrozen() && !guardBlocked) {
    try {
      teleportEntityOpen(guard, { x: next.x, y: next.y, z: next.z }, { facingLocation: target });
    } catch (error) {
    }
  }
  if (combatEnabled()) {
    attackAround(guard, tick);
  }
}

function tickGuards(player, tick) {
  const guards = findGuards(player);
  for (let i = 0; i < guards.length; i++) {
    const guard = guards[i];
    guard.addTag(GUARD_TAG);
    configureSuperagent(guard, player);
    keepAlive(guard);
    guardStep(player, guard, i, tick);
  }
}

function tickPlayer(player, tick) {
  announceReady(player);
  cleanupLegacyVisibleMarkers(player, player.location);
  const ownedSuperagent = ensureOwnedSuperagent(player);
  if (ownedSuperagent) {
    tickSuperagent(player, ownedSuperagent, tick);
  }
  tickGuards(player, tick);
}

// Note: the character's invincibility is handled by the entity's damage_sensor
// (deals_damage: no) in superagent.json. We deliberately do NOT subscribe to a
// damage before-event here because `world.beforeEvents.entityHurt` does not exist
// in the 1.x stable API and referencing it throws at module load.

function applyLabelFromEvent(player, message) {
  const owned = closestEntity(findOwnedSuperagents(player), player.location);
  if (!owned) {
    return;
  }
  try {
    const text = (message || "").trim();
    owned.setDynamicProperty(LABEL_PROPERTY, text.length > 0 ? text.slice(0, 48) : undefined);
    applyLabel(owned);
  } catch (error) {
  }
}

function applyWorldPositionLabel(player) {
  const owned = closestEntity(findOwnedSuperagents(player), player.location);
  if (!owned) {
    return;
  }
  try {
    owned.setDynamicProperty(LABEL_PROPERTY, formatLocationText(owned.location).slice(0, 48));
    applyLabel(owned);
  } catch (error) {
  }
}

function reportWorldPosition(player) {
  const owned = closestEntity(findOwnedSuperagents(player), player.location);
  if (!owned) {
    return;
  }
  try {
    player.onScreenDisplay.setActionBar(formatLocationText(owned.location));
  } catch (error) {
    try {
      player.sendMessage(formatLocationText(owned.location));
    } catch (sendError) {
    }
  }
}

function handleCombatToggle(message) {
  const msg = (message || "").trim().toLowerCase();
  if (msg === "on" || msg === "enable" || msg === "true" || msg === "1") {
    setCombatEnabled(true);
  } else if (msg === "off" || msg === "disable" || msg === "false" || msg === "0") {
    setCombatEnabled(false);
  }
}

function ownedSuperagentForEvent(player) {
  return closestEntity(findOwnedSuperagents(player), player.location);
}

function handleGoto(player, message) {
  const owned = ownedSuperagentForEvent(player);
  const target = parseGoto(message);
  if (!owned || !target) {
    return;
  }
  owned.setDynamicProperty(FOLLOW_WALK_PROP, false);
  clearPath(owned);
  setNavTarget(owned, target);
}

function stepDirOffset(dir) {
  if (dir === "north") return { x: 0, y: 0, z: -1 };
  if (dir === "south") return { x: 0, y: 0, z: 1 };
  if (dir === "east") return { x: 1, y: 0, z: 0 };
  if (dir === "west") return { x: -1, y: 0, z: 0 };
  if (dir === "up") return { x: 0, y: 1, z: 0 };
  if (dir === "down") return { x: 0, y: -1, z: 0 };
  return { x: 0, y: 0, z: 0 };
}

// Grid step with collision: walk one block at a time and stop at the first
// solid block so the character cannot pass through walls.
function handleStep(player, message) {
  const owned = ownedSuperagentForEvent(player);
  if (!owned) {
    return;
  }
  const parts = (message || "").trim().split(/\s+/);
  const off = stepDirOffset(parts[0]);
  let count = Number(parts[1]);
  if (!Number.isFinite(count)) {
    count = 1;
  }
  count = Math.max(1, Math.min(64, Math.round(count)));
  owned.setDynamicProperty(FOLLOW_WALK_PROP, false);
  clearNavTarget(owned);
  clearPath(owned);
  let cx = Math.floor(owned.location.x);
  let cy = Math.floor(owned.location.y);
  let cz = Math.floor(owned.location.z);
  for (let i = 0; i < count; i++) {
    const nx = cx + off.x;
    const ny = cy + off.y;
    const nz = cz + off.z;
    if (blockIsObstacle(owned.dimension, nx, ny, nz)) {
      break;
    }
    cx = nx;
    cy = ny;
    cz = nz;
  }
  try {
    teleportEntityOpen(owned, { x: cx + 0.5, y: cy, z: cz + 0.5 });
  } catch (error) {
  }
}

// Turn the character to face a cardinal direction.
function handleFace(player, message) {
  const owned = ownedSuperagentForEvent(player);
  if (!owned) {
    return;
  }
  const dir = (message || "").trim();
  const rot = { x: 0, y: 0 };
  if (dir === "north") rot.y = 180;
  else if (dir === "south") rot.y = 0;
  else if (dir === "east") rot.y = -90;
  else if (dir === "west") rot.y = 90;
  else if (dir === "up") rot.x = -90;
  else if (dir === "down") rot.x = 90;
  try {
    owned.setRotation(rot);
  } catch (error) {
    try {
      owned.teleport(owned.location, { rotation: rot });
    } catch (error2) {
    }
  }
}

// ---- Phase 13 special powers ----------------------------------------------

function parseNumberArg(message, def, min, max) {
  let n = Number((message || "").trim());
  if (!Number.isFinite(n)) {
    n = def;
  }
  return Math.max(min, Math.min(max, Math.round(n)));
}

function powerAnchor(player) {
  return ownedSuperagentForEvent(player);
}

// Strike the nearest hostile with a lightning bolt.
function handleLightning(player) {
  const anchor = powerAnchor(player);
  if (!anchor) {
    return;
  }
  const dimension = anchor.dimension;
  const hostiles = dimension.getEntities({ location: anchor.location, maxDistance: 14 }).filter(isAttackTarget);
  const target = closestEntity(hostiles, anchor.location);
  if (!target) {
    return;
  }
  try {
    dimension.spawnEntity("minecraft:lightning_bolt", target.location);
  } catch (error) {
  }
}

// Knock every nearby hostile away from the character.
function handleBlast(player, message) {
  const anchor = powerAnchor(player);
  if (!anchor) {
    return;
  }
  const radius = parseNumberArg(message, 6, 1, 16);
  const origin = anchor.location;
  for (const mob of anchor.dimension.getEntities({ location: origin, maxDistance: radius }).filter(isAttackTarget)) {
    const dx = mob.location.x - origin.x;
    const dz = mob.location.z - origin.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    try {
      mob.applyKnockback(dx / len, dz / len, 2.5, 0.6);
    } catch (error) {
      try {
        mob.applyImpulse({ x: (dx / len) * 2, y: 0.5, z: (dz / len) * 2 });
      } catch (error2) {
      }
    }
  }
}

// Give the player a protective shield.
function handleShield(player, message) {
  const seconds = parseNumberArg(message, 15, 1, 120);
  addEffectSafe(player, "resistance", seconds * 20, { amplifier: 2, showParticles: false });
  addEffectSafe(player, "absorption", seconds * 20, { amplifier: 1, showParticles: false });
}

// Heal the player to full and grant regeneration.
function handleHeal(player) {
  addEffectSafe(player, "regeneration", 100, { amplifier: 2, showParticles: false });
  try {
    const health = player.getComponent("minecraft:health");
    if (health) {
      health.resetToMaxValue();
    }
  } catch (error) {
  }
}

// Pull nearby dropped items to the player.
function handleMagnet(player, message) {
  const radius = parseNumberArg(message, 8, 1, 24);
  for (const item of player.dimension.getEntities({ type: "minecraft:item", location: player.location, maxDistance: radius })) {
    try {
      item.teleport(player.location);
    } catch (error) {
    }
  }
}

// Blink the player to the character (escape / travel).
function handleBlink(player) {
  const owned = ownedSuperagentForEvent(player);
  if (!owned) {
    return;
  }
  try {
    player.teleport(owned.location);
  } catch (error) {
  }
}

// Summon a temporary iron golem ally that despawns after a while.
function handleAlly(player, message) {
  const seconds = parseNumberArg(message, 20, 5, 120);
  let golem;
  try {
    golem = player.dimension.spawnEntity("minecraft:iron_golem", player.location);
  } catch (error) {
    return;
  }
  try {
    golem.addTag("superagent.ally");
  } catch (error) {
  }
  system.runTimeout(() => {
    try {
      golem.remove();
    } catch (error) {
    }
  }, seconds * 20);
}

function handleGotoAgent(player) {
  const owned = ownedSuperagentForEvent(player);
  const agentEntity = findPlayerAgent(player);
  if (!owned || !agentEntity) {
    return;
  }
  owned.setDynamicProperty(FOLLOW_WALK_PROP, false);
  clearPath(owned);
  setNavTarget(owned, agentEntity.location);
}

// Pathfinding: route around obstacles instead of gliding straight.
function handlePathTo(player, message) {
  const owned = ownedSuperagentForEvent(player);
  const goal = parseGoto(message);
  if (!owned || !goal) {
    return;
  }
  computeAndStorePath(owned, goal);
}

function handlePathToAgent(player) {
  const owned = ownedSuperagentForEvent(player);
  const agentEntity = findPlayerAgent(player);
  if (!owned || !agentEntity) {
    return;
  }
  computeAndStorePath(owned, agentEntity.location);
}

function handleFollowWalk(player, message) {
  const owned = ownedSuperagentForEvent(player);
  if (!owned) {
    return;
  }
  const msg = (message || "").trim().toLowerCase();
  const on = msg === "on" || msg === "enable" || msg === "true" || msg === "1";
  owned.setDynamicProperty(FOLLOW_WALK_PROP, on);
  clearPath(owned);
  if (!on) {
    clearNavTarget(owned);
  }
}

function handleStop(player) {
  const owned = ownedSuperagentForEvent(player);
  if (!owned) {
    return;
  }
  owned.setDynamicProperty(FOLLOW_WALK_PROP, false);
  clearNavTarget(owned);
  clearPath(owned);
}

// Home is stored on the player, which persists across world reloads.
function handleSetHome(player) {
  const owned = ownedSuperagentForEvent(player);
  if (!owned) {
    return;
  }
  try {
    player.setDynamicProperty(HOME_X_PROP, owned.location.x);
    player.setDynamicProperty(HOME_Y_PROP, owned.location.y);
    player.setDynamicProperty(HOME_Z_PROP, owned.location.z);
  } catch (error) {
  }
}

function handleGoHome(player) {
  const owned = ownedSuperagentForEvent(player);
  if (!owned) {
    return;
  }
  const x = player.getDynamicProperty(HOME_X_PROP);
  const y = player.getDynamicProperty(HOME_Y_PROP);
  const z = player.getDynamicProperty(HOME_Z_PROP);
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
    return;
  }
  owned.setDynamicProperty(FOLLOW_WALK_PROP, false);
  setNavTarget(owned, { x, y, z });
}

function handleClearHome(player) {
  try {
    player.setDynamicProperty(HOME_X_PROP, undefined);
    player.setDynamicProperty(HOME_Y_PROP, undefined);
    player.setDynamicProperty(HOME_Z_PROP, undefined);
  } catch (error) {
  }
}

function handleFreeze(message) {
  const msg = (message || "").trim().toLowerCase();
  if (msg === "on" || msg === "enable" || msg === "true" || msg === "1") {
    setFrozen(true);
  } else if (msg === "off" || msg === "disable" || msg === "false" || msg === "0") {
    setFrozen(false);
  }
}

// Teacher: bring every nearby character to the caller.
function handleGather(player) {
  for (const superagent of allNearbySuperagents(player)) {
    try {
      teleportEntityOpen(superagent, {
        x: player.location.x,
        y: player.location.y,
        z: player.location.z
      });
    } catch (error) {
    }
  }
}

// Teacher: dismiss this player's guards and clear their main character state.
function handleReset(player) {
  removeGuards(player);
  const owned = ownedSuperagentForEvent(player);
  if (owned) {
    clearMovementState(owned);
    try {
      owned.setDynamicProperty(LABEL_PROPERTY, undefined);
    } catch (error) {
    }
    applyLabel(owned);
  }
  handleClearHome(player);
}

// Bring the player's character to the player's own position.
function handleRecall(player) {
  const owned = ownedSuperagentForEvent(player);
  if (!owned) {
    return;
  }
  clearMovementState(owned);
  try {
    teleportEntityOpen(owned, { x: player.location.x, y: player.location.y, z: player.location.z });
  } catch (error) {
  }
}

function isPlayerSource(entity) {
  return entity && entity.typeId === "minecraft:player";
}

try {
  if (world.afterEvents && world.afterEvents.entitySpawn) {
    world.afterEvents.entitySpawn.subscribe((event) => {
      transportSuperagentToEgg(event.entity);
    });
  }
} catch (entitySpawnError) {
}

try {
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "superagent:combat") {
    handleCombatToggle(event.message);
    return;
  }
  if (event.id === "superagent:label") {
    const player = event.sourceEntity;
    if (isPlayerSource(player)) {
      applyLabelFromEvent(player, event.message);
    }
    return;
  }
  if (event.id === "superagent:labelpos") {
    const player = event.sourceEntity;
    if (isPlayerSource(player)) {
      applyWorldPositionLabel(player);
    }
    return;
  }
  if (event.id === "superagent:reportpos") {
    const player = event.sourceEntity;
    if (isPlayerSource(player)) {
      reportWorldPosition(player);
    }
    return;
  }
  if (event.id === "superagent:goto") {
    if (isPlayerSource(event.sourceEntity)) {
      handleGoto(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id === "superagent:gotoagent") {
    if (isPlayerSource(event.sourceEntity)) {
      handleGotoAgent(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:pathto") {
    if (isPlayerSource(event.sourceEntity)) {
      handlePathTo(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id === "superagent:pathtoagent") {
    if (isPlayerSource(event.sourceEntity)) {
      handlePathToAgent(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:followwalk") {
    if (isPlayerSource(event.sourceEntity)) {
      handleFollowWalk(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id === "superagent:stop") {
    if (isPlayerSource(event.sourceEntity)) {
      handleStop(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:sethome") {
    if (isPlayerSource(event.sourceEntity)) {
      handleSetHome(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:gohome") {
    if (isPlayerSource(event.sourceEntity)) {
      handleGoHome(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:clearhome") {
    if (isPlayerSource(event.sourceEntity)) {
      handleClearHome(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:addguard") {
    if (isPlayerSource(event.sourceEntity)) {
      spawnGuard(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:clearguards") {
    if (isPlayerSource(event.sourceEntity)) {
      removeGuards(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:freeze") {
    handleFreeze(event.message);
    return;
  }
  if (event.id === "superagent:gather") {
    if (isPlayerSource(event.sourceEntity)) {
      handleGather(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:reset") {
    if (isPlayerSource(event.sourceEntity)) {
      handleReset(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:recall") {
    if (isPlayerSource(event.sourceEntity)) {
      handleRecall(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:step") {
    if (isPlayerSource(event.sourceEntity)) {
      handleStep(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id === "superagent:face") {
    if (isPlayerSource(event.sourceEntity)) {
      handleFace(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id === "superagent:lightning") {
    if (isPlayerSource(event.sourceEntity)) {
      handleLightning(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:blast") {
    if (isPlayerSource(event.sourceEntity)) {
      handleBlast(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id === "superagent:shield") {
    if (isPlayerSource(event.sourceEntity)) {
      handleShield(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id === "superagent:heal") {
    if (isPlayerSource(event.sourceEntity)) {
      handleHeal(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:magnet") {
    if (isPlayerSource(event.sourceEntity)) {
      handleMagnet(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id === "superagent:blink") {
    if (isPlayerSource(event.sourceEntity)) {
      handleBlink(event.sourceEntity);
    }
    return;
  }
  if (event.id === "superagent:ally") {
    if (isPlayerSource(event.sourceEntity)) {
      handleAlly(event.sourceEntity, event.message);
    }
    return;
  }
  if (event.id !== "superagent:burst") {
    return;
  }
  // On-demand burst fires regardless of the auto-combat toggle. The source
  // entity can be undefined depending on how the scriptevent was issued, so fall
  // back to every player's own character.
  const anchors = event.sourceEntity ? [event.sourceEntity] : world.getPlayers();
  for (const anchor of anchors) {
    const superagent = closestEntity(
      anchor.dimension.getEntities({
        type: SUPER_AGENT_ID,
        location: anchor.location,
        maxDistance: FOLLOW_RADIUS
      }),
      anchor.location
    );
    if (!superagent) {
      continue;
    }
    attackAround(superagent, system.currentTick);
    startSpin(superagent);
  }
});
} catch (scriptEventError) {
}

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    try {
      tickPlayer(player, system.currentTick);
    } catch (error) {
    }
  }
}, TICK_RATE);
