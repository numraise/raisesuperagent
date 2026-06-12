import { EntityComponentTypes, system, world } from "@minecraft/server";
import { stepToward, parseGoto } from "./navmath.js";
import { findPath } from "./pathfind.js";

const SUPER_AGENT_ID = "superagent:superagent";
const LEGACY_VISIBLE_MARKER_ID = "minecraft:armor_stand";
const DISPLAY_NAME = "superagent";
const ROOT_TAG = "superagent.managed";
const OWNER_TAG_PREFIX = "superagent.owner.";
const READY_TAG = "superagent.ready.0_1_24";
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

// The single controllable character this player owns. Guards are excluded so
// the dedupe step never deletes a squad guard, and another player's character
// (different owner tag) is never touched either.
function findOwnedSuperagents(player) {
  const tag = ownerTag(player);
  return allNearbySuperagents(player).filter(
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
  for (const duplicate of owned) {
    if (duplicate.id !== superagent.id) {
      removeEntitySafe(duplicate);
    }
  }
  return superagent;
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
    showParticles: true
  });
  target.addEffect("weakness", 80, {
    amplifier: isHighThreat(target) ? 1 : 0,
    showParticles: true
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

function emitPresenceParticles(dimension, location, tick) {
  const angle = tick * 0.28;
  spawnParticleAny(dimension, CUSTOM_PRESENCE_PARTICLES, {
    x: location.x,
    y: location.y + 0.2,
    z: location.z
  });
  spawnParticleAny(dimension, CUSTOM_PRESENCE_PARTICLES, {
    x: location.x,
    y: location.y + 1.35,
    z: location.z
  });
  const offsets = [
    { x: Math.cos(angle) * PRESENCE_RADIUS, y: 0.25, z: Math.sin(angle) * PRESENCE_RADIUS },
    { x: Math.cos(angle + Math.PI) * PRESENCE_RADIUS, y: 0.25, z: Math.sin(angle + Math.PI) * PRESENCE_RADIUS },
    { x: Math.cos(angle + 1.57) * PRESENCE_RADIUS, y: 0.8, z: Math.sin(angle + 1.57) * PRESENCE_RADIUS },
    { x: Math.cos(angle - 1.57) * PRESENCE_RADIUS, y: 0.8, z: Math.sin(angle - 1.57) * PRESENCE_RADIUS },
    { x: Math.cos(angle + 0.8) * 0.55, y: 1.35, z: Math.sin(angle + 0.8) * 0.55 },
    { x: Math.cos(angle + 3.9) * 0.55, y: 1.35, z: Math.sin(angle + 3.9) * 0.55 },
    { x: 0, y: 1.75, z: 0 }
  ];
  for (const offset of offsets) {
    spawnParticleAny(dimension, FALLBACK_PRESENCE_PARTICLES, {
      x: location.x + offset.x,
      y: location.y + offset.y,
      z: location.z + offset.z
    });
  }
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
}

function keepAlive(superagent) {
  if (!superagent) {
    return;
  }
  try {
    const health = superagent.getComponent(EntityComponentTypes.Health);
    if (health) {
      health.resetToMaxValue();
    }
  } catch (error) {
  }
}

function refreshAgentVisibleEffects(agentEntity) {
  addEffectSafe(agentEntity, "strength", 80, {
    amplifier: 1,
    showParticles: true
  });
  addEffectSafe(agentEntity, "resistance", 80, {
    amplifier: 0,
    showParticles: true
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
      player.sendMessage("superagent 0.1.24 script active");
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
  try {
    superagent.teleport({ x: next.x, y: next.y, z: next.z }, { facingLocation: waypoint });
  } catch (error) {
  }
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
  try {
    superagent.teleport({ x: next.x, y: next.y, z: next.z }, { facingLocation: target });
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

function tickSuperagent(player, superagent, tick) {
  configureSuperagent(superagent, player);
  keepAlive(superagent);
  emitPresenceParticles(superagent.dimension, superagent.location, tick);
  navStep(player, superagent);
  const status = currentStatus(superagent);
  applyLabelWithStatus(superagent, status);
  emitStatusParticle(superagent, status);
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
  if (!next.arrived && !isFrozen()) {
    try {
      guard.teleport({ x: next.x, y: next.y, z: next.z }, { facingLocation: target });
    } catch (error) {
    }
  }
  emitPresenceParticles(guard.dimension, guard.location, tick + index);
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

world.beforeEvents.entityHurt.subscribe((event) => {
  if (event.hurtEntity.hasTag(ROOT_TAG) || event.hurtEntity.typeId === SUPER_AGENT_ID) {
    event.cancel = true;
  }
});

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
      superagent.teleport({
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
    owned.setDynamicProperty(FOLLOW_WALK_PROP, false);
    clearNavTarget(owned);
    try {
      owned.setDynamicProperty(LABEL_PROPERTY, undefined);
    } catch (error) {
    }
    applyLabel(owned);
  }
  handleClearHome(player);
}

function isPlayerSource(entity) {
  return entity && entity.typeId === "minecraft:player";
}

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
  if (event.id !== "superagent:burst" || !event.sourceEntity) {
    return;
  }
  // On-demand burst is an explicit command from student/teacher code, so it
  // fires regardless of the auto-combat toggle.
  const anchor = event.sourceEntity;
  const superagent = closestEntity(
    anchor.dimension.getEntities({
      type: SUPER_AGENT_ID,
      location: anchor.location,
      maxDistance: FOLLOW_RADIUS
    }),
    anchor.location
  );
  const attackAnchor = superagent || closestEntity(
    anchor.dimension.getEntities({
      location: anchor.location,
      maxDistance: FOLLOW_RADIUS
    }).filter(isAgent),
    anchor.location
  ) || anchor;
  emitPresenceParticles(attackAnchor.dimension, attackAnchor.location, system.currentTick);
  attackAround(attackAnchor, system.currentTick);
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    try {
      tickPlayer(player, system.currentTick);
    } catch (error) {
    }
  }
}, TICK_RATE);
