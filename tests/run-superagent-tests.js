const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "superagent.ts");
const ADDON = path.join(ROOT, "superagent-addon");
const NAVMATH = path.join(ADDON, "superagent_BP", "scripts", "navmath.js");

function loadNavMath() {
  const source = fs.readFileSync(NAVMATH, "utf8").replace(/export\s+function/g, "function");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    source + "\nglobalThis.stepToward = stepToward; globalThis.parseGoto = parseGoto;",
    sandbox,
    { filename: "navmath.js" }
  );
  return sandbox;
}

const PATHFIND = path.join(ADDON, "superagent_BP", "scripts", "pathfind.js");

function loadPathfind() {
  const source = fs.readFileSync(PATHFIND, "utf8").replace(/export\s+function/g, "function");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(source + "\nglobalThis.findPath = findPath;", sandbox, { filename: "pathfind.js" });
  return sandbox;
}

const Direction = {
  FORWARD: 0,
  BACK: 1,
  LEFT: 2,
  RIGHT: 3,
  UP: 4,
  DOWN: 5,
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function transformEnum(body) {
  let nextValue = 0;
  const pairs = body
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("=");
      const name = parts[0].trim();
      const value = parts[1] === undefined ? nextValue : Number(parts[1].trim());
      nextValue = value + 1;
      return `${JSON.stringify(name)}:${value}`;
    });
  return `{${pairs.join(",")}}`;
}

function transformMakeCodeTs(source) {
  let js = source
    .replace(/\/\/%[^\n]*\n/g, "")
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .replace(/enum\s+(\w+)\s*\{([\s\S]*?)\}/g, (_, name, body) => {
      return `const ${name} = ${transformEnum(body)};`;
    })
    .replace(/namespace\s+superagent\s*\{/, "const superagent = (() => {\n")
    .replace(/export\s+function\s+(\w+)\s*\(/g, "function $1(")
    .replace(/\)\s*:\s*(number|boolean|string|any|Position|Axis|Superagent[A-Za-z0-9_]+)\s*\{/g, ") {")
    .replace(/:\s*\(\(\)\s*=>\s*void\)\[\]/g, "")
    .replace(/:\s*\(\)\s*=>\s*void/g, "")
    .replace(/:\s*number\[\]/g, "")
    .replace(/:\s*boolean\[\]/g, "")
    .replace(/:\s*string\[\]/g, "")
    .replace(/([,(]\s*)([a-z][A-Za-z0-9_]*)\s*:\s*(number|boolean|string|any|Position|Axis|Superagent[A-Za-z0-9_]+)/g, "$1$2");

  const privateNames = new Set([
    "clamp",
    "attackDirection",
    "runAtAgent",
    "runAtSuperagent",
    "textValue",
    "setSuperagentPosition",
    "selectSuperagentNear",
    "teleportCharacterFrom",
    "teleportCharacterTo",
    "directionOffset",
    "ensureCharacter",
    "showCharacterPulse",
    "ensureFollowLoop",
    "smartMoveStep",
    "patrolStep",
    "orbitStep",
    "syncAddonMob",
    "auraPulseCommands",
    "attackCommandBurst",
    "ensureAuraLoop",
    "showRingPulse",
    "showVerticalPulse",
    "showShieldPulse",
    "smartRing",
    "pulse",
    "senseDirection",
    "senseMoveDirection",
    "senseOffset",
    "mobSelector",
    "directionName",
    "assistKind",
    "evaluateWatcher",
    "pollWatchers",
    "ensureWatchLoop",
    "registerWatcher",
    "blockId",
    "axisOffset",
    "blockAt",
    "relativeCoord",
    "plotBlock",
    "isFilledCell",
    "placeTransformed",
  ]);

  const exportNames = [...js.matchAll(/function\s+(\w+)\s*\(/g)]
    .map((match) => match[1])
    .filter((name) => !privateNames.has(name));

  const lastBrace = js.lastIndexOf("}");
  return `${js.slice(0, lastBrace)}
return { ${exportNames.join(", ")} };
})();
globalThis.superagent = superagent;
globalThis.SuperagentBurstStyle = SuperagentBurstStyle;
globalThis.SuperagentStatus = SuperagentStatus;
globalThis.SuperagentSmartMode = SuperagentSmartMode;
${js.slice(lastBrace + 1)}`;
}

function createMockAgent() {
  const calls = [];
  const commandCalls = [];
  const mobCalls = [];
  return {
    calls,
    commandCalls,
    mobCalls,
    attack(direction) {
      calls.push(["attack", direction]);
    },
    turn(direction) {
      calls.push(["turn", direction]);
    },
    move(direction, steps) {
      calls.push(["move", direction, steps]);
    },
    collectAll() {
      calls.push(["collectAll"]);
    },
    collect(item) {
      calls.push(["collect", item]);
    },
    getPosition() {
      calls.push(["getPosition"]);
      return makePosition(10, 20, 30);
    },
    teleportToPlayer() {
      calls.push(["teleportToPlayer"]);
    },
    detect(detection, direction) {
      calls.push(["detect", detection, direction]);
      return true;
    },
    setAssist(assist, on) {
      calls.push(["setAssist", assist, on]);
    },
    inspect(kind, direction) {
      calls.push(["inspect", kind, direction]);
      return kind === 0 ? 42 : 7;
    },
    interact(direction) {
      calls.push(["interact", direction]);
    },
    destroy(direction) {
      calls.push(["destroy", direction]);
    },
    till(direction) {
      calls.push(["till", direction]);
    },
    place(direction) {
      calls.push(["place", direction]);
    },
    setSlot(slot) {
      calls.push(["setSlot", slot]);
    },
    drop(direction, slot, amount) {
      calls.push(["drop", direction, slot, amount]);
    },
    dropAll(direction) {
      calls.push(["dropAll", direction]);
    },
    transfer(fromSlot, amount, toSlot) {
      calls.push(["transfer", fromSlot, amount, toSlot]);
    },
    setItem(item, amount, slot) {
      calls.push(["setItem", item, amount, slot]);
    },
    getItemCount(slot) {
      calls.push(["getItemCount", slot]);
      return 5;
    },
    getItemSpace(slot) {
      calls.push(["getItemSpace", slot]);
      return 59;
    },
    getItemDetail(slot) {
      calls.push(["getItemDetail", slot]);
      return 3;
    },
  };
}

function makePosition(x, y, z) {
  return {
    x,
    y,
    z,
    getValue(axis) {
      if (axis === 0) return x;
      if (axis === 1) return y;
      return z;
    },
  };
}

function loadSuperagent(agent) {
  const source = fs.readFileSync(SOURCE, "utf8");
  const sandbox = {
    agent,
    mobs: {
      target(kind) {
        return {
          kind,
          coordinate: null,
          radius: null,
          rules: [],
          atCoordinate(p) {
            this.coordinate = p;
          },
          withinRadius(radius) {
            this.radius = radius;
          },
          addRule(rule, value) {
            this.rules.push([rule, value]);
          },
        };
      },
      execute(target, position, command) {
        agent.commandCalls.push(["execute", target, position, command]);
        if (typeof agent.commandResponder === "function") {
          return agent.commandResponder(command, target, position);
        }
        return true;
      },
      teleportToPosition(target, destination) {
        agent.mobCalls.push(["teleportToPosition", target, destination]);
        return true;
      },
    },
    loops: {
      forever(callback) {
        agent.calls.push(["forever", typeof callback]);
      },
      pause(ms) {
        agent.calls.push(["pause", ms]);
      },
    },
    positions: {
      add(p1, p2) {
        return makePosition(p1.x + p2.x, p1.y + p2.y, p1.z + p2.z);
      },
    },
    pos(x, y, z) {
      return makePosition(x, y, z);
    },
    Axis: { X: 0, Y: 1, Z: 2 },
    LOCAL_PLAYER: "local_player",
    ALL_ENTITIES: "all_entities",
    AgentDetection: { Block: 0, Redstone: 1 },
    AgentInspection: { Block: 0, Data: 1 },
    PLACE_ON_MOVE: 0,
    PLACE_FROM_ANY_SLOT: 1,
    DESTROY_OBSTACLES: 2,
    Math: (() => {
      const m = Object.create(Math);
      m.randomRange = (min, max) => min;
      return m;
    })(),
    TurnDirection: { Left: 0, Right: 1 },
    FORWARD: Direction.FORWARD,
    BACK: Direction.BACK,
    LEFT: Direction.LEFT,
    RIGHT: Direction.RIGHT,
    UP: Direction.UP,
    DOWN: Direction.DOWN,
    globalThis: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(transformMakeCodeTs(source), sandbox, { filename: "superagent.ts" });
  return sandbox.globalThis.superagent;
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("superagent attack aura delegates damage to the behavior pack and spins (no Agent swing)", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.attackAura(2, 3, 0);
  assert.strictEqual(toolkit.reportLastBurstCount(), 6);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.filter((command) => command.includes("scriptevent superagent:burst")).length >= 2);
  assert(!agent.calls.some((call) => call[0] === "attack")); // the Agent must not swing
});

test("superagent power burst bursts and collects drops without Agent swings", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.powerBurst(1, 2);
  assert.strictEqual(toolkit.reportLastBurstCount(), 2);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:burst")));
  assert(agent.calls.some((call) => call[0] === "collectAll"));
  assert(!agent.calls.some((call) => call[0] === "attack"));
});

test("superagent smart sweep bursts without Agent swings", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.smartSweep(1, 2, 0);
  assert.strictEqual(toolkit.reportLastBurstCount(), 2);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:burst")));
  assert(!agent.calls.some((call) => call[0] === "attack"));
});

test("superagent overdrive uses emergency power and collects drops", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.overdrive(1, 1);
  assert.strictEqual(toolkit.reportLastBurstCount(), 2); // emergency bumps strength 1 -> 2
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:burst")));
  assert(agent.calls.some((call) => call[0] === "collectAll"));
});

test("superagent extension emits visible aura and sync commands at the Agent position", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.keepAuraOn();
  const commands = agent.commandCalls.map((call) => call[3]);
  // Spawning is delegated to the behavior pack; the extension cleans up legacy
  // markers and positions the character without ambient player particles.
  assert(commands.some((command) => command.includes("kill @e[type=minecraft:armor_stand")));
  assert(!commands.some((command) => command.includes("tp @e[type=superagent:superagent")));
  assert(agent.mobCalls.some((call) => call[0] === "teleportToPosition"));
  assert(!commands.some((command) => command.includes("particle superagent:agent_aura")));
  assert(!commands.some((command) => command.includes("particle minecraft:basic_flame_particle")));
  assert(agent.commandCalls.every((call) => call[2].x === 10 && call[2].y === 20 && call[2].z === 30));
});

test("superagent extension controls an independent one-block character position", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.moveCharacter(1, 3);
  toolkit.attackFromCharacter(5, 4);
  const commands = agent.commandCalls.map((call) => call[3]);
  const positions = agent.commandCalls.map((call) => call[2]);
  assert(!commands.some((command) => command.includes("particle superagent:attack_burst")));
  assert(!commands.some((command) => command.includes("particle minecraft:critical_hit_emitter")));
  assert(!commands.some((command) => command.includes("particle superagent:agent_aura")));
  // Damage is delegated to the behavior pack via a scriptevent (reliable on Education).
  assert(commands.some((command) => command.includes("scriptevent superagent:burst")));
  assert(!commands.some((command) => command.includes("tp @e[type=superagent:superagent")));
  // Grid move is a collision-aware step handled by the behavior pack.
  assert(commands.some((command) => command.includes("scriptevent superagent:step east 3")));
  assert(agent.mobCalls.some((call) => call[1].rules.some((rule) => rule[0] === "type" && rule[1] === "superagent:superagent")));
  assert(positions.some((position) => position.x === 10 && position.y === 20 && position.z === 30));
});

test("superagent extension can run and stop a follow-agent loop", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.followAgentOn();
  toolkit.followAgentOff();
  assert(agent.calls.some((call) => call[0] === "forever"));
  assert(!agent.commandCalls.some((call) => call[3].includes("particle superagent:agent_aura")));
});

test("superagent extension provides many smart movement commands", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.dash(1, 5);
  toolkit.scoutLine(0, 4);
  toolkit.patrolSquare(3, 2);
  toolkit.orbitAgent(4, 8);
  toolkit.evadeToAgentSide(3);
  toolkit.highGround(4);
  toolkit.zigzag(1, 6);
  toolkit.spiralSearch(2, 3);
  toolkit.smartMove(0, 5, 2);
  // Grid moves are collision-aware steps; orbit/evade still reposition directly.
  assert(agent.commandCalls.some((call) => call[3].includes("scriptevent superagent:step")));
  assert(agent.mobCalls.some((call) => call[0] === "teleportToPosition"));
  assert(!agent.commandCalls.some((call) => call[3].includes("particle superagent:attack_burst")));
});

test("superagent sensing blocks return values for if/loop programming", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  assert.strictEqual(toolkit.senseHostiles(8), true);
  assert.strictEqual(toolkit.senseMob(1, 5), true);
  assert.strictEqual(toolkit.nearestHostileDistance(10), 1);
  assert.strictEqual(toolkit.pathClear(0), true);
  assert.strictEqual(toolkit.detectBlock(0), true);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("testfor @e[family=monster,r=8]")));
  assert(commands.some((command) => command.includes("testfor @e[type=zombie,r=5]")));
  assert(commands.some((command) => command.includes("testforblock ~ ~ ~-1 air")));
  assert(agent.calls.some((call) => call[0] === "detect"));
});

test("superagent reactive helpers sense first then act", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  assert.strictEqual(toolkit.defendIfThreatened(6, 3), true);
  assert.strictEqual(toolkit.advanceUntilBlocked(0, 5), 5);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("testfor @e[family=monster,r=5]")));
  assert(commands.some((command) => command.includes("scriptevent superagent:burst")));
  assert(commands.some((command) => command.includes("testforblock")));
});

test("superagent events fire once on the rising edge", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  let fired = 0;
  toolkit.onHostileNear(8, () => {
    fired += 1;
  });
  // condition (mock testfor) is true, so first poll is a rising edge, second is not
  toolkit.checkEvents();
  toolkit.checkEvents();
  assert.strictEqual(fired, 1);
  assert(agent.calls.some((call) => call[0] === "forever"));
});

test("superagent watch on/off starts the loop and exposes event blocks", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.onAreaClear(6, () => {});
  toolkit.onPathBlocked(0, () => {});
  toolkit.watchOn();
  toolkit.watchOff();
  assert.strictEqual(typeof toolkit.onHostileNear, "function");
  assert.strictEqual(typeof toolkit.checkEvents, "function");
  assert(agent.calls.some((call) => call[0] === "forever"));
});

test("navmath stepToward glides toward target and reports arrival", () => {
  const nav = loadNavMath();
  const partial = nav.stepToward({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 2);
  assert.strictEqual(partial.arrived, false);
  assert(Math.abs(partial.x - 2) < 1e-9);
  assert.strictEqual(partial.y, 0);
  const arrive = nav.stepToward({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 2);
  assert.strictEqual(arrive.arrived, true);
  assert.strictEqual(arrive.x, 1);
  const diagonal = nav.stepToward({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }, 5);
  assert.strictEqual(diagonal.arrived, true);
});

test("navmath parseGoto reads coordinates and rejects junk", () => {
  const nav = loadNavMath();
  const a = nav.parseGoto("10 64 -5");
  assert(a && a.x === 10 && a.y === 64 && a.z === -5);
  const b = nav.parseGoto("  1.5  2   3.25 ");
  assert(b && b.x === 1.5 && b.y === 2 && b.z === 3.25);
  assert.strictEqual(nav.parseGoto("10 64"), null);
  assert.strictEqual(nav.parseGoto("a b c"), null);
  assert.strictEqual(nav.parseGoto(""), null);
});

test("superagent script wires smooth glide navigation", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function stepToward"));
  assert(script.includes("function parseGoto"));
  assert(script.includes("function navStep"));
  assert(script.includes("stepToward(superagent.location, target, MOVE_SPEED)"));
  assert(script.includes("function gridAlignedTeleportOptions"));
  assert(script.includes("cardinalRotationFromTo"));
  assert(script.includes("rotation: cardinalRotationFromTo(superagent.location, target)"));
  assert(script.includes("rotation: cardinalRotationFromTo(superagent.location, waypoint)"));
  assert(script.includes("rotation: cardinalRotationFromTo(guard.location, target)"));
  assert(script.includes('event.id === "superagent:goto"'));
  assert(!script.includes('event.id === "superagent:gotoagent"'));
  assert(script.includes('event.id === "superagent:followwalk"'));
  assert(script.includes('event.id === "superagent:stop"'));
  assert(script.includes("navStep(player, superagent)"));
});

test("superagent extension sends walk commands and reads arrival", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.walkTo(10, 64, -5);
  toolkit.followWalk(true);
  toolkit.walkStop();
  assert.strictEqual(toolkit.reached(10, 64, -5), true);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:goto 10 64 -5")));
  assert(commands.some((command) => command.includes("scriptevent superagent:followwalk on")));
  assert(commands.some((command) => command.includes("scriptevent superagent:stop")));
  assert(commands.some((command) => command.includes("testfor @e[type=superagent:superagent,x=10,y=64,z=-5,r=2]")));
});

test("superagent build blocks emit fill and setblock commands", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.buildBox(0, 3, 3, 3);
  toolkit.buildHollowBox(4, 5, 4, 5);
  toolkit.buildFloor(2, 4, 4);
  toolkit.buildPillar(4, 6);
  const placed = toolkit.buildRowPattern(0, "X.X#");
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("fill ~ ~ ~ ~2 ~2 ~2 stone")));
  assert(commands.some((command) => command.includes("fill ~ ~ ~ ~4 ~3 ~4 glass hollow")));
  assert(commands.some((command) => command.includes("fill ~ ~ ~ ~3 ~ ~3 dirt")));
  assert(commands.some((command) => command.includes("fill ~ ~ ~ ~ ~5 ~ glass")));
  assert(commands.some((command) => command.includes("setblock ~0 ~ ~ stone")));
  assert(commands.some((command) => command.includes("setblock ~2 ~ ~ stone")));
  assert(commands.some((command) => command.includes("setblock ~3 ~ ~ stone")));
  assert.strictEqual(placed, 3);
});

// clear area runs behavior-pack side at the REAL superagent entity (the tracked
// MakeCode position is unreliable now that spawning is server-side).
test("superagent clear area fills air at the real superagent (BP-side)", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.clearArea(8, 9, 7);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:clear 8 9 7")));
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function handleClear"));
  assert(script.includes('event.id === "superagent:clear"'));
  assert(/handleClear[\s\S]*?fill \$\{x1\} \$\{y1\} \$\{z1\} \$\{x2\} \$\{y2\} \$\{z2\} air/.test(script));
});

test("superagent mining is performed by the visible superagent, not the Agent", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.mineForward(3);
  toolkit.mineDown(2);
  toolkit.stripMine(2, 2, 1);
  const commands = agent.commandCalls.map((call) => call[3]);
  // The behavior pack breaks the blocks at the superagent position.
  assert(commands.some((command) => command.includes("scriptevent superagent:mine forward 3")));
  assert(commands.some((command) => command.includes("scriptevent superagent:mine down 2")));
  assert(commands.some((command) => command.includes("scriptevent superagent:mine strip 2 2 1")));
  // The normal Minecraft Agent must NOT do the mining anymore.
  assert(!agent.calls.some((call) => call[0] === "destroy"));
  assert(!agent.calls.some((call) => call[0] === "teleportToPlayer"));
});

test("superagent memory stores and reads scoreboard-backed values", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.remember("ore", 5);
  toolkit.forget("old");
  assert.strictEqual(toolkit.memoryEquals("ore", 5), true);
  assert.strictEqual(toolkit.memoryAtLeast("ore", 3), true);
  assert.strictEqual(toolkit.memoryValue("ore", 10), 0); // mock execute returns true at v=0
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scoreboard objectives add sa_ore dummy")));
  assert(commands.some((command) => command.includes("scoreboard players set @s sa_ore 5")));
  assert(commands.some((command) => command.includes("scoreboard players reset @s sa_old")));
  assert(commands.some((command) => command.includes("scoreboard players test @s sa_ore 5 5")));
  assert(commands.some((command) => command.includes("scoreboard players test @s sa_ore 3 2147483647")));
});

test("superagent home and squad blocks emit the right scriptevents", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.setHome();
  toolkit.goHome();
  toolkit.clearHome();
  toolkit.summonGuard();
  toolkit.dismissGuards();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:sethome 10 20 30")));
  assert(commands.some((command) => command.includes("scriptevent superagent:gohome 10 20 30")));
  assert(commands.some((command) => command.includes("scriptevent superagent:clearhome")));
  assert(commands.some((command) => command.includes("scriptevent superagent:addguard")));
  assert(commands.some((command) => command.includes("scriptevent superagent:clearguards")));
});

test("superagent script supports persistent home and squad guards", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes('const GUARD_TAG = "superagent.guard"'));
  assert(script.includes("function findGuards"));
  assert(script.includes("function spawnGuard"));
  assert(script.includes("function tickGuards"));
  assert(script.includes("MAX_GUARDS"));
  assert(script.includes("function handleSetHome"));
  assert(script.includes("function handleGoHome"));
  assert(script.includes('event.id === "superagent:sethome"'));
  assert(script.includes('event.id === "superagent:addguard"'));
  // guards must be excluded from the single-character dedupe
  assert(script.includes("!entity.hasTag(GUARD_TAG)"));
});

test("superagent can find the nearest block by distance and direction", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  assert.strictEqual(toolkit.nearestBlockDistance(0, 8), 1); // mock testforblock true at r=1
  assert.strictEqual(toolkit.nearestBlockDirection(0, 8), 0); // first direction checked
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("testforblock ~ ~ ~-1 stone")));
});

test("superagent shape library emits geometry build commands", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.buildPyramid(0, 3);
  toolkit.buildStaircase(0, 1, 3);
  toolkit.buildCircle(0, 2);
  toolkit.buildDisc(0, 2);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("fill ~0 ~0 ~0 ~2 ~0 ~2 stone")));
  assert(commands.some((command) => command.includes("fill ~1 ~1 ~1 ~1 ~1 ~1 stone")));
  assert(commands.some((command) => command.includes("setblock ~2 ~2 ~ stone")));
  assert(commands.some((command) => command.includes("setblock ~2 ~ ~0 stone")));
  assert(commands.some((command) => command.startsWith("fill ~-2 ~ ~-")));
});

test("superagent mission mode tracks score and shows a leaderboard", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.missionStart("Find Diamonds");
  toolkit.missionAward(5);
  assert.strictEqual(toolkit.missionScore(10), 0); // mock execute true at v=0
  toolkit.missionComplete();
  toolkit.showScoreboard();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("title @s title Find Diamonds")));
  assert(commands.some((command) => command.includes("scoreboard players add @s sa_score 5")));
  assert(commands.some((command) => command.includes("title @s actionbar +5")));
  assert(commands.some((command) => command.includes("title @s title Complete!")));
  assert(commands.some((command) => command.includes("scoreboard objectives setdisplay sidebar sa_score")));
});

test("superagent script shows auto status on the character", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function currentStatus"));
  assert(script.includes("function applyLabelWithStatus"));
  assert(script.includes("function emitStatusParticle"));
  assert(script.includes('"superagent [" + status + "]"'));
  assert(script.includes("applyLabelWithStatus(superagent, status)"));
});

test("superagent agent-work blocks read inventory and superagent builds bridge and stairs", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  assert.strictEqual(toolkit.inventoryCount(1), 5);
  assert.strictEqual(toolkit.hasItems(1, 3), true);
  assert.strictEqual(toolkit.hasItems(1, 9), false);
  toolkit.dropItems(0);
  toolkit.collectItems();
  toolkit.bridgeForward(3);
  toolkit.stairUp(2);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(agent.calls.some((call) => call[0] === "dropAll"));
  assert(agent.calls.some((call) => call[0] === "collectAll"));
  assert(!agent.calls.some((call) => call[0] === "place"));
  assert(!agent.calls.some((call) => call[0] === "move"));
  assert(commands.some((command) => command.includes("setblock ~ ~-1 ~-1 stone")));
  assert(commands.some((command) => command.includes("setblock ~ ~ ~-1 stone")));
  assert(commands.some((command) => command.includes("setblock ~ ~1 ~-2 stone")));
});

test("superagent mirrors core MakeCode Agent command blocks", () => {
  const agent = createMockAgent();
  agent.commandResponder = (command) => !command.includes(" air");
  const toolkit = loadSuperagent(agent);
  toolkit.agentMove(0, 2);
  toolkit.agentTurn(1);
  toolkit.agentSetAssist(2, true);
  toolkit.agentTeleportToPlayer();
  toolkit.agentPlace(0);
  toolkit.agentDestroy(0);
  toolkit.agentTill(0);
  toolkit.agentAttack(0);
  toolkit.agentInteract(0);
  toolkit.agentSetSlot(2);
  assert.strictEqual(toolkit.agentDetectBlock(0), true);
  assert.strictEqual(toolkit.agentDetectRedstone(0), true);
  assert.strictEqual(toolkit.agentInspectBlock(0), 0);
  assert.strictEqual(toolkit.agentInspectData(0), 7);
  toolkit.agentCollectItem(1);
  toolkit.agentDrop(2, 3, 0);
  toolkit.agentTransfer(2, 3, 4);
  toolkit.agentSetItem(1, 8, 2);
  assert.strictEqual(toolkit.agentItemSpace(2), 59);
  assert.strictEqual(toolkit.agentItemDetail(2), 3);

  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.FORWARD && call[2] === 2));
  assert(agent.calls.some((call) => call[0] === "turn" && call[1] === 1));
  assert(agent.calls.some((call) => call[0] === "setAssist" && call[1] === 2 && call[2] === true));
  assert(agent.calls.some((call) => call[0] === "teleportToPlayer"));
  assert(agent.calls.some((call) => call[0] === "place" && call[1] === Direction.FORWARD));
  assert(agent.calls.some((call) => call[0] === "destroy" && call[1] === Direction.FORWARD));
  assert(agent.calls.some((call) => call[0] === "till" && call[1] === Direction.FORWARD));
  assert(agent.calls.some((call) => call[0] === "attack" && call[1] === Direction.FORWARD));
  assert(agent.calls.some((call) => call[0] === "interact" && call[1] === Direction.FORWARD));
  assert(agent.calls.some((call) => call[0] === "setSlot" && call[1] === 2));
  assert(agent.calls.some((call) => call[0] === "detect" && call[1] === 1 && call[2] === Direction.FORWARD));
  assert(agent.calls.some((call) => call[0] === "inspect" && call[1] === 1 && call[2] === Direction.FORWARD));
  assert(!agent.calls.some((call) => call[0] === "detect" && call[1] === 0));
  assert(!agent.calls.some((call) => call[0] === "inspect" && call[1] === 0));
  assert(agent.commandCalls.some((call) => call[3].includes("testforblock ~ ~ ~-1 air")));
  assert(agent.commandCalls.some((call) => call[3].includes("testforblock ~ ~ ~-1 stone")));
  assert(agent.calls.some((call) => call[0] === "collect" && call[1] === 1));
  assert(agent.calls.some((call) => call[0] === "drop" && call[1] === Direction.FORWARD && call[2] === 2 && call[3] === 3));
  assert(agent.calls.some((call) => call[0] === "transfer" && call[1] === 2 && call[2] === 3 && call[3] === 4));
  assert(agent.calls.some((call) => call[0] === "setItem" && call[1] === 1 && call[2] === 8 && call[3] === 2));
  assert(agent.calls.some((call) => call[0] === "getItemSpace" && call[1] === 2));
  assert(agent.calls.some((call) => call[0] === "getItemDetail" && call[1] === 2));
});

test("superagent teacher controls emit freeze, gather and reset scriptevents", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.freezeAll();
  toolkit.unfreezeAll();
  toolkit.gatherAll();
  toolkit.resetSquad();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:freeze on")));
  assert(commands.some((command) => command.includes("scriptevent superagent:freeze off")));
  assert(commands.some((command) => command.includes("scriptevent superagent:gather")));
  assert(commands.some((command) => command.includes("scriptevent superagent:reset")));
});

test("superagent script supports freeze gating and teacher handlers", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes('const FREEZE_FLAG = "superagent:frozen"'));
  assert(script.includes("function isFrozen"));
  assert(script.includes("function handleGather"));
  assert(script.includes("function handleReset"));
  assert(script.includes('event.id === "superagent:freeze"'));
  assert(script.includes('event.id === "superagent:gather"'));
  // movement must be skipped while frozen
  assert(script.includes("if (isFrozen()) {"));
});

test("pathfind A* finds a straight route across open space", () => {
  const nav = loadPathfind();
  const path = nav.findPath({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, () => false, 400, 24);
  assert.strictEqual(path.length, 3);
  assert.strictEqual(path[2].x, 3);
  assert.strictEqual(path[2].z, 0);
});

test("pathfind A* routes around a blocking wall", () => {
  const nav = loadPathfind();
  // block the single cell directly between start and goal
  const isBlocked = (x, y, z) => x === 1 && y === 0 && z === 0;
  const path = nav.findPath({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, isBlocked, 400, 24);
  assert(path.length > 2); // detour is longer than the straight line
  assert(path.every((p) => !(p.x === 1 && p.y === 0 && p.z === 0))); // never enters the wall
  const last = path[path.length - 1];
  assert(last.x === 2 && last.y === 0 && last.z === 0);
});

test("pathfind A* returns no path when the goal is sealed off", () => {
  const nav = loadPathfind();
  // goal at (5,0,0); block all six neighbours so it cannot be reached
  const sealed = (x, y, z) => {
    const dx = Math.abs(x - 5);
    const dy = Math.abs(y - 0);
    const dz = Math.abs(z - 0);
    return dx + dy + dz === 1;
  };
  const path = nav.findPath({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, sealed, 400, 24);
  assert.strictEqual(path.length, 0);
});

test("superagent script wires A* pathfinding navigation", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function findPath"));
  assert(script.includes("function blockIsObstacle"));
  assert(script.includes("function computeAndStorePath"));
  assert(script.includes("function stepAlongPath"));
  assert(script.includes("dimension.getBlock"));
  assert(script.includes("if (stepAlongPath(superagent)) {"));
  assert(script.includes('event.id === "superagent:pathto"'));
  assert(!script.includes('event.id === "superagent:pathtoagent"'));
});

test("superagent extension sends pathfinding scriptevents", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.pathTo(20, 64, -8);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:pathto 20 64 -8")));
});

test("superagent builds a 2D layer from row text", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  const placed = toolkit.buildLayer(0, ["X.X", "XXX"]);
  assert.strictEqual(placed, 5);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("setblock ~0 ~ ~0 stone")));
  assert(commands.some((command) => command.includes("setblock ~2 ~ ~0 stone")));
  assert(commands.some((command) => command.includes("setblock ~1 ~ ~1 stone")));
  assert(!commands.some((command) => command.includes("setblock ~1 ~ ~0 stone"))); // the gap
});

test("superagent builds a 3D blueprint with layer breaks", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  const placed = toolkit.buildBlueprint(0, ["XX", "-", "X."]);
  assert.strictEqual(placed, 3);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("setblock ~0 ~0 ~0 stone")));
  assert(commands.some((command) => command.includes("setblock ~1 ~0 ~0 stone")));
  assert(commands.some((command) => command.includes("setblock ~0 ~1 ~0 stone"))); // second layer up
});

test("superagent copy/paste and replace emit clone and fill-replace", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.copyRegion(10, 64, 10, 12, 66, 12);
  toolkit.pasteHere();
  toolkit.replaceArea(2, 0, 3, 1, 3); // dirt -> stone
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("clone 10 64 10 12 66 12 ~ ~ ~")));
  assert(commands.some((command) => command.includes("fill ~ ~ ~ ~2 ~0 ~2 stone replace dirt")));
});

test("superagent builds a layer with mirror and rotate transforms", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  // SuperagentTransform: 0=None, 1=MirrorX, 2=MirrorZ, 3=Rotate180
  toolkit.buildLayerTransformed(0, ["X."], 0); // none -> x=0
  toolkit.buildLayerTransformed(0, ["X."], 1); // mirrorX -> x=1 (maxX 1)
  toolkit.buildLayerTransformed(0, ["X.", ".."], 2); // mirrorZ -> z=1 (maxZ 1)
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("setblock ~0 ~ ~0 stone")));
  assert(commands.some((command) => command.includes("setblock ~1 ~ ~0 stone")));
  assert(commands.some((command) => command.includes("setblock ~0 ~ ~1 stone")));
});

test("superagent script recomputes its A* path when terrain changes", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function readPathGoal"));
  assert(script.includes("PATH_GOAL_X_PROP"));
  // stepAlongPath rechecks the next waypoint and recomputes when blocked
  assert(script.includes("if (blockIsObstacle(superagent.dimension, Math.floor(waypoint.x)"));
  assert(script.includes("computeAndStorePath(superagent, goal)"));
});

test("superagent basic command set covers control, sensing, thinking, judging, communicate", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  // Control
  toolkit.stop();
  toolkit.face(0); // north
  // Sensing
  assert.strictEqual(toolkit.distanceToAgent(10), 1); // mock testfor true at r=1
  assert.strictEqual(toolkit.groundBelow(), true);
  // Thinking
  assert.strictEqual(toolkit.randomUpTo(6), 1); // shimmed randomRange returns min
  toolkit.countUp("kills");
  toolkit.setFlag("armed", true);
  assert.strictEqual(toolkit.flagIsOn("armed"), true);
  // Judging
  assert.strictEqual(toolkit.shouldAttack(8), true);
  assert.strictEqual(toolkit.isSafe(8), false);
  assert.strictEqual(toolkit.dangerClose(8), true); // nearest hostile distance 1 <= 3
  // Communicate
  toolkit.report("hello");
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:stop")));
  assert(commands.some((command) => command.includes("scriptevent superagent:face north")));
  assert(commands.some((command) => command.includes("testfor @e[type=minecraft:agent,r=1]")));
  assert(commands.some((command) => command.includes("scoreboard players set @s sa_kills 1")));
  assert(commands.some((command) => command.includes("scoreboard players set @s sa_armed 1")));
  assert(commands.some((command) => command.includes("title @s actionbar hello")));
  assert(agent.calls.some((call) => call[0] === "detect"));
});

test("superagent script faces a direction on command", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function handleFace"));
  assert(script.includes('event.id === "superagent:face"'));
  assert(script.includes("setGridAlignedRotation(owned, rot)"));
  assert(!script.includes("rot.x = -90"));
  assert(!script.includes("rot.x = 90"));
});

// BUG-003: face direction dropdown must offer only the four horizontal
// directions. Movement direction may still include up/down.
test("superagent face dropdown has no up/down (movement keeps them)", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  // The face block uses the dedicated face enum, not the movement enum.
  assert(source.includes("export function face(direction: SuperagentFaceDirection)"));
  const faceEnum = source.match(/enum SuperagentFaceDirection\s*\{([\s\S]*?)\}/);
  assert(faceEnum, "SuperagentFaceDirection enum should exist");
  assert(!/block="up"/.test(faceEnum[1]));
  assert(!/block="down"/.test(faceEnum[1]));
  assert(/North/.test(faceEnum[1]) && /East/.test(faceEnum[1]) && /South/.test(faceEnum[1]) && /West/.test(faceEnum[1]));
  // Movement direction enum still supports vertical movement.
  const moveEnum = source.match(/enum SuperagentMoveDirection\s*\{([\s\S]*?)\}/);
  assert(/block="up"/.test(moveEnum[1]) && /block="down"/.test(moveEnum[1]));
});

// BUG-004: a face-only block must rotate and never emit a movement/step event.
test("superagent face emits only a face scriptevent (no step/move)", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  agent.commandCalls.length = 0;
  toolkit.face(1); // east
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:face east")));
  assert(!commands.some((command) => command.includes("scriptevent superagent:step")));
  assert(!agent.calls.some((call) => call[0] === "move"));
});

// BUG-004 + source fallback: face/step act on every player's own superagent when
// the scriptevent did not carry a source player, so they never fail silently.
test("superagent script routes face/step through a player fallback", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("for (const player of playersForEvent(event)) {\n      handleFace(player, event.message);"));
  assert(script.includes("for (const player of playersForEvent(event)) {\n      handleStep(player, event.message);"));
});

// BUG-006: go home must forward event.message, and home handlers must resolve an
// owner instead of silently returning when no source player is present.
test("superagent script routes home events with message + owner fallback", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("handleGoHome(player, event.message)"));
  assert(script.includes("handleSetHome(player, event.message)"));
  assert(script.includes("function ownerPlayersForEvent"));
  assert(script.includes("ownerPlayersForEvent(event, target)"));
  // No silent failure: handlers give feedback when there is no home/superagent.
  assert(script.includes("sendFeedback"));
});

// BUG-002: spawn/recall-at-agent carries explicit own-Agent coordinates and is
// scoped to the owner, never the whole world.
// BUG-001/BUG-002: spawn at player must not emit the brittle "execute as @s ..."
// form (red "Unexpected '@s'" in some worlds) and must not raw-summon (which lets
// the BP claim ownership by proximity in multiplayer). Only the scriptevent.
test("superagent spawn at player uses only a scriptevent (no execute-as, no summon)", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  assert(!source.includes("execute as @s"));
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtPlayer();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:recall")));
  assert(!commands.some((command) => command.includes("execute as")));
  assert(!commands.some((command) => command.includes("summon superagent")));
});

// BUG-002 (root cause): MakeCode's agent.getPosition() returns the HOST's shared
// Agent in Education multiplayer, so spawn/recall-at-agent must NOT send agent
// coordinates from MakeCode. They send a coordinate-free event and the behavior
// pack resolves each calling player's OWN Agent server-side.
test("superagent spawn/recall at agent send a coordinate-free per-player event", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.recallToAgent();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.filter((command) => command.includes("scriptevent superagent:spawnatagent")).length >= 2);
  // Must NOT leak host-shared agent coordinates or raw summons.
  assert(!commands.some((command) => command.includes("scriptevent superagent:spawnat ")));
  assert(!commands.some((command) => command.includes("summon superagent")));
});

// The multiplayer-fragile blocks are hidden from the toolbox (Agent is shared
// with the host in Education), while "spawn at player" stays as the reliable one.
test("superagent hides spawn/recall at agent blocks, keeps spawn at player", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  assert(!source.includes("blockId=superagent_spawn_at_agent"));
  assert(!source.includes("blockId=superagent_recall_to_agent"));
  assert(!source.includes('block="superagent spawn at agent"'));
  assert(!source.includes('block="superagent recall to agent"'));
  assert(source.includes('blockId=superagent_spawn_at_player block="superagent spawn at player"'));
});

test("superagent spawn/recall place ONLY the typing player at their own spot", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  // All three events route to the single caller-at-self placer.
  assert(script.includes('event.id === "superagent:spawnatagent"'));
  assert(script.includes('event.id === "superagent:recall"'));
  assert(script.includes('event.id === "superagent:spawnat"'));
  assert(script.includes("function placeCallerSuperagentAtSelf"));
  assert(/superagent:spawnat[\s\S]{0,80}placeCallerSuperagentAtSelf\(event\)/.test(script));
  // The placer uses the event source (typing player) and its OWN location, never
  // world.getPlayers() and never the message coordinates (host-shared agent).
  const fn = script.match(/function placeCallerSuperagentAtSelf[\s\S]*?\n}/)[0];
  assert(fn.includes("event.sourceEntity"));
  assert(fn.includes("isPlayerSource"));
  assert(fn.includes("player.location"));
  assert(!fn.includes("world.getPlayers()"));
  assert(!fn.includes("parseGoto"));
  assert(!script.includes("function bringEachPlayersSuperagentHome"));
  // Single-owner tagging prevents stale multi-owner tags accumulating.
  assert(script.includes("function setSingleOwnerTag"));
  assert(script.includes("setSingleOwnerTag(superagent, player)"));
});

// BUG-002 (definitive): spawn/recall ignore MakeCode coordinates entirely and
// place the typing player's character at their own location, so one player's
// command can never move another player's character.
test("superagent spawn/recall act only on characters at the target", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function placeOwnedSuperagentAt"));
  // The dead coordinate-based handlers are gone; placement is caller-at-self.
  assert(!script.includes("function resolveSingleOwner"));
  assert(!script.includes("function handleSpawnAt"));
  assert(!script.includes("function handleRecall"));
  // The placer searches a TIGHT radius around the target (not 128 blocks).
  const fn = script.match(/function placeOwnedSuperagentAt[\s\S]*?\n}/)[0];
  assert(fn.includes("maxDistance: 8"));
  // It only ever removes this player's own or unowned characters, never others'.
  assert(fn.includes("if (other.hasTag(tag) || !isOwnedByAnyone(other))"));
  // Selection must NOT reach out to a far-away character (no dimension-wide fetch
  // in the character-selection expression) — that was the residual leak.
  assert(!fn.includes("findOwnedSuperagentsInDimension(player), target"));
  // Stray cleanup only removes characters that NO player is standing near.
  assert(script.includes("function removeStrayOwnedSuperagents"));
  const stray = script.match(/function removeStrayOwnedSuperagents[\s\S]*?\n}/)[0];
  assert(stray.includes("someoneNear") && /if \(!someoneNear\)/.test(stray));
});

// BUG-005: the visible superagent breaks blocks itself (BP-side), no Agent.
// The dig direction follows the player's view (predictable) and the travel
// distance always equals the requested count (no random direction/amount).
test("superagent script mines deterministically along the player's view", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function handleMine"));
  assert(script.includes('event.id === "superagent:mine"'));
  assert(script.includes("function playerForwardOffset"));
  assert(script.includes("player.getViewDirection()"));
  assert(script.includes("air destroy"));
  // Forward travel is exactly `count` blocks (geometric, not collision-stopped).
  assert(script.includes("off.x * count"));
  assert(script.includes("by - count"));
  // The mover does not search for a nearby open spot (that caused random jumps).
  assert(script.includes("function placeMiner"));
  assert(!/function mineTunnelForward/.test(script));
});

// BUG-007: turning the guard off (or stop combat) clears the flag + visuals and
// combat does not leak across world sessions.
test("superagent script stops combat reliably and resets on load", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function clearAllCombatVisuals"));
  assert(script.includes("function handleStopCombat"));
  assert(script.includes('event.id === "superagent:stopcombat"'));
  // off path clears visuals immediately
  assert(/setCombatEnabled\(false\);[\s\S]{0,240}clearAllCombatVisuals\(\);/.test(script));
  // combat flag is reset to off on script load (no cross-session leak)
  assert(/Combat is off by default[\s\S]*setCombatEnabled\(false\);/.test(script));
});

// Cleanup tool that works even when a command add-on (RaiseUAC) rewrites
// "/kill @e[type=...]" selectors: the BP removes characters via the script API.
test("superagent remove all purges characters via the script API", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  assert(source.includes('blockId=superagent_remove_all block="superagent remove all characters"'));
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.removeAll();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:purge")));
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function handlePurge"));
  assert(script.includes('event.id === "superagent:purge"'));
  assert(script.includes("getEntities({ type: SUPER_AGENT_ID })"));
  assert(script.includes("removeEntitySafe(entity)"));
});

// Diagnostics + self-healing dedupe so piles of characters can never accumulate.
test("superagent debug report and duplicate cleanup exist", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  assert(source.includes('blockId=superagent_debug block="superagent debug report"'));
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.debugReport();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:debug")));
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function handleDebug"));
  assert(script.includes('event.id === "superagent:debug"'));
  // Hard one-per-connected-player rule runs periodically.
  assert(script.includes("function enforceSuperagentLimits"));
  assert(script.includes("enforceSuperagentLimits(system.currentTick)"));
  const fn = script.match(/function enforceSuperagentLimits[\s\S]*?\n}\n/)[0];
  // Keeps each connected player's nearest character; removes everything else
  // (unowned strays + characters owned by a non-connected identity like kru_game).
  assert(fn.includes("ownerToPlayer"));
  assert(fn.includes("removeEntitySafe(entity)"));
});

test("superagent stop combat block clears combat", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.stopCombat();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:combat off")));
  assert(commands.some((command) => command.includes("scriptevent superagent:stopcombat")));
});

test("superagent script keeps idle and spawned cubes grid aligned", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function snapEntityToGridAlignment"));
  assert(script.includes("snapEntityToGridAlignment(superagent);"));
  assert(script.includes("snapEntityToGridAlignment(superagent, true);"));
  assert(script.includes("snapEntityToGridAlignment(guard);"));
  assert(script.includes("const MAINTENANCE_TICKS = 10;"));
});

test("superagent special powers send the right scriptevents", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.lightningStrike();
  toolkit.forceBlast(6);
  toolkit.shieldPlayer(15);
  toolkit.healPlayer();
  toolkit.magnetItems(8);
  toolkit.blinkPlayer();
  toolkit.summonAlly(20);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:lightning")));
  assert(commands.some((command) => command.includes("scriptevent superagent:blast 6")));
  assert(commands.some((command) => command.includes("scriptevent superagent:shield 15")));
  assert(commands.some((command) => command.includes("scriptevent superagent:heal")));
  assert(commands.some((command) => command.includes("scriptevent superagent:magnet 8")));
  assert(commands.some((command) => command.includes("scriptevent superagent:blink")));
  assert(commands.some((command) => command.includes("scriptevent superagent:ally 20")));
});

test("superagent script implements the special power handlers", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function handleLightning"));
  assert(script.includes('spawnEntity("minecraft:lightning_bolt"'));
  assert(script.includes("function handleBlast"));
  assert(script.includes("applyKnockback"));
  assert(script.includes("function handleShield"));
  assert(script.includes("function handleHeal"));
  assert(script.includes("function handleMagnet"));
  assert(script.includes("function handleBlink"));
  assert(script.includes("function handleAlly"));
  assert(script.includes('spawnEntity("minecraft:iron_golem"'));
  assert(script.includes('event.id === "superagent:lightning"'));
  assert(script.includes('event.id === "superagent:ally"'));
  assert(script.includes('event.id !== "superagent:burst"'));
  assert(!script.includes("superagent burst"));
});

test("superagent extension can label the character and toggle auto guard", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.setLabel("Scout");
  toolkit.labelWorldPosition();
  toolkit.autoGuard(true);
  toolkit.autoGuard(false);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:label Scout")));
  assert(commands.some((command) => command.includes("scriptevent superagent:labelpos")));
  assert(commands.some((command) => command.includes("scriptevent superagent:combat on")));
  assert(commands.some((command) => command.includes("scriptevent superagent:combat off")));
});

test("superagent extension exposes position reporters that plug into label text", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.moveCharacter(1, 3);
  assert.strictEqual(toolkit.positionX(), 13);
  assert.strictEqual(toolkit.positionY(), 20);
  assert.strictEqual(toolkit.positionZ(), 30);
  assert.strictEqual(toolkit.positionXYZ(), "x=13 y=20 z=30");
  toolkit.setLabel(toolkit.positionXYZ());
  assert(agent.commandCalls.some((call) => call[3].includes("scriptevent superagent:label x=13 y=20 z=30")));
  toolkit.pathTo(-8, 137, 377);
  assert.strictEqual(toolkit.positionXYZ(), "x=-8 y=137 z=377");
});

test("superagent text sockets accept value reporters such as numbers and booleans", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.pathTo(-8, 137, 377);
  toolkit.setLabel(toolkit.worldZ());
  toolkit.report(toolkit.hasItems(1, 10));
  toolkit.missionStart(toolkit.worldX());
  toolkit.remember(toolkit.worldY(), 2);
  toolkit.countUp(toolkit.worldZ());
  toolkit.buildRowPattern(0, 10101);
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("scriptevent superagent:label 377")));
  assert(commands.some((command) => command.includes("title @s actionbar false")));
  assert(commands.some((command) => command.includes("title @s title -8")));
  assert(commands.some((command) => command.includes("scoreboard objectives add sa_137 dummy")));
  assert(commands.some((command) => command.includes("scoreboard objectives add sa_377 dummy")));
  assert(commands.some((command) => command.includes("setblock ~0 ~ ~ stone")));
});

test("superagent extension exposes world position text/number and world direction value blocks", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.pathTo(-8, 137, 377);
  assert.strictEqual(toolkit.worldPositionText(), "x=-8 y=137 z=377");
  assert.strictEqual(toolkit.worldX(), -8);
  assert.strictEqual(toolkit.worldY(), 137);
  assert.strictEqual(toolkit.worldZ(), 377);
  assert.strictEqual(toolkit.worldPositionAtText(4, 70, -2), "x=4 y=70 z=-2");
  assert.strictEqual(toolkit.worldDirectionValue(1), 1);
});

test("superagent toolbox exposes position reporter blocks for labels", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  assert(source.includes('blockId=superagent_position_text block="superagent position x y z"'));
  assert(source.includes('blockId=superagent_position_x block="superagent x"'));
  assert(source.includes('blockId=superagent_position_y block="superagent y"'));
  assert(source.includes('blockId=superagent_position_z block="superagent z"'));
  assert(source.includes('blockId=superagent_label_world_position block="superagent label world position"'));
  assert(source.includes('blockId=superagent_report_world_position block="superagent report world position"'));
  assert(source.includes('blockId=superagent_world_position_text block="superagent world position text"'));
  assert(source.includes('blockId=superagent_world_x block="superagent world x"'));
  assert(source.includes('blockId=superagent_world_y block="superagent world y"'));
  assert(source.includes('blockId=superagent_world_z block="superagent world z"'));
  assert(source.includes('blockId=superagent_world_position_at_text block="superagent world position text x %x y %y z %z"'));
  assert(source.includes('blockId=superagent_value_world_direction block="superagent world direction %direction"'));
});

test("superagent add-on can label and report its real entity world position", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function formatLocationText"));
  assert(script.includes("function formatWholeCoord"));
  assert(script.includes("x=${formatWholeCoord(location.x)} y=${formatWholeCoord(location.y)} z=${formatWholeCoord(location.z)}"));
  assert(script.includes("function applyWorldPositionLabel"));
  assert(script.includes("function reportWorldPosition"));
  assert(script.includes('event.id === "superagent:labelpos"'));
  assert(script.includes('event.id === "superagent:reportpos"'));
});

test("add-on manifests target Minecraft Education 1.21.133 compatible engine and stable script API", () => {
  const bp = readJson(path.join(ADDON, "superagent_BP", "manifest.json"));
  const rp = readJson(path.join(ADDON, "superagent_RP", "manifest.json"));
  assert.deepStrictEqual(bp.header.min_engine_version, [1, 21, 100]);
  assert.deepStrictEqual(rp.header.min_engine_version, [1, 21, 100]);
  assert(bp.modules.some((module) => module.type === "script" && module.entry === "scripts/main.js"));
  assert(bp.dependencies.some((dependency) => dependency.module_name === "@minecraft/server" && dependency.version === "1.17.0"));
  assert(bp.dependencies.some((dependency) => dependency.uuid === rp.header.uuid));
});

test("extension and visible add-on names use the same release version", () => {
  const packageJson = readJson(path.join(ROOT, "package.json"));
  const pxtJson = readJson(path.join(ROOT, "pxt.json"));
  const bp = readJson(path.join(ADDON, "superagent_BP", "manifest.json"));
  const rp = readJson(path.join(ADDON, "superagent_RP", "manifest.json"));
  assert.strictEqual(packageJson.version, pxtJson.version);
  assert(bp.header.name.includes(packageJson.version));
  assert(rp.header.name.includes(packageJson.version));
});

test("superagent entity is a visible one-block programmable character", () => {
  const entity = readJson(path.join(ADDON, "superagent_BP", "entities", "superagent.json"));
  const components = entity["minecraft:entity"].components;
  assert.strictEqual(entity["minecraft:entity"].description.identifier, "superagent:superagent");
  assert(!components["minecraft:type_family"].family.includes("monster"));
  assert(components["minecraft:type_family"].family.includes("superagent"));
  assert.deepStrictEqual(components["minecraft:damage_sensor"].triggers, {
    cause: "all",
    deals_damage: "no",
  });
  assert(components["minecraft:persistent"]);
  assert.strictEqual(components["minecraft:physics"].has_collision, true);
  assert.strictEqual(components["minecraft:physics"].has_gravity, false);
  assert.strictEqual(components["minecraft:nameable"].always_show, true);
  assert.strictEqual(components["minecraft:scale"].value, 1.0);
  assert.strictEqual(components["minecraft:collision_box"].width, 1.0);
  assert.strictEqual(components["minecraft:collision_box"].height, 1.0);
});

test("superagent resource pack renders the character as exactly one block cube", () => {
  const geometry = readJson(path.join(ADDON, "superagent_RP", "models", "entity", "superagent.geo.json"));
  const description = geometry["minecraft:geometry"][0].description;
  const cubes = geometry["minecraft:geometry"][0].bones[0].cubes;
  assert.strictEqual(description.visible_bounds_width, 1);
  assert.strictEqual(description.visible_bounds_height, 1);
  assert.strictEqual(cubes.length, 1);
  assert.deepStrictEqual(cubes[0].origin, [-8, 0, -8]);
  assert.deepStrictEqual(cubes[0].size, [16, 16, 16]);
});

test("superagent resource pack defines visible aura and attack particles", () => {
  const aura = readJson(path.join(ADDON, "superagent_RP", "particles", "superagent_agent_aura.json"));
  const spark = readJson(path.join(ADDON, "superagent_RP", "particles", "superagent_agent_spark.json"));
  const attack = readJson(path.join(ADDON, "superagent_RP", "particles", "superagent_attack_burst.json"));
  assert.strictEqual(aura.particle_effect.description.identifier, "superagent:agent_aura");
  assert.strictEqual(spark.particle_effect.description.identifier, "superagent:agent_spark");
  assert.strictEqual(attack.particle_effect.description.identifier, "superagent:attack_burst");
  assert(aura.particle_effect.components["minecraft:emitter_shape_disc"]);
  assert(spark.particle_effect.components["minecraft:emitter_shape_sphere"]);
  assert(attack.particle_effect.components["minecraft:emitter_rate_instant"].num_particles >= 20);
});

test("superagent script protects and powers MakeCode-controlled character without auto-following Agent", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes('const SUPER_AGENT_ID = "superagent:superagent"'));
  assert(script.includes('const LEGACY_VISIBLE_MARKER_ID = "minecraft:armor_stand"'));
  // Invincibility is handled by the entity's damage_sensor, not a before-event
  // (world.beforeEvents.entityHurt does not exist in the 1.x stable API).
  assert(!script.includes("world.beforeEvents.entityHurt.subscribe"));
  assert(script.includes("target.applyDamage(ATTACK_DAMAGE"));
  assert(script.includes("dimension.spawnParticle"));
  assert(script.includes("function tickSuperagent"));
  assert(script.includes("closestEntity(findOwnedSuperagentsInDimension(player), player.location)"));
  assert(script.includes('event.id === "superagent:spawnat"'));
  assert(script.includes("function playersForEvent"));
  assert(script.includes("for (const player of playersForEvent(event))"));
  assert(!script.includes("function followAgent"));
  assert(!script.includes("superagent.teleport(agentEntity.location"));
});

test("superagent script keeps one owner-scoped character and does not self-match the Agent", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function ensureOwnedSuperagent"));
  assert(script.includes("function findOwnedSuperagents"));
  assert(script.includes("function isOwnedByAnyone"));
  // dedupe removes this player's extra characters and unowned leftovers,
  // but never guards or another player's character
  assert(script.includes("if (other.hasTag(tag) || !isOwnedByAnyone(other))"));
  // isAgent must no longer match by substring (which caught superagent:superagent)
  assert(!script.includes('typeId.indexOf("agent")'));
  assert(script.includes("if (entity.typeId === SUPER_AGENT_ID) {"));
  assert(script.includes('typeId.endsWith(":agent")'));
});

// An egg placed at a player's feet is claimed for THAT player and dedupes their
// other characters (no "army"). A character that appears far from every player
// is left unowned — never proximity-claimed from afar (multiplayer safety).
test("superagent egg claim is gated to a player right next to it, and dedupes", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function transportSuperagentToEgg"));
  assert(script.includes("world.afterEvents.entitySpawn.subscribe"));
  assert(script.includes("transportSuperagentToEgg(event.entity)"));
  const egg = script.match(/function transportSuperagentToEgg[\s\S]*?\n}/)[0];
  // Claim only when a player is within ~3 blocks (distanceSquared <= 9).
  assert(egg.includes("distanceSquared(player.location, spawned.location) > 9"));
  assert(egg.includes("configureSuperagent(spawned, player)"));
  // Dedupe the placing player's other characters (kills the egg "army"), but
  // only ones tagged as theirs — never another player's character.
  assert(egg.includes("if (other.hasTag(tag))"));
  assert(egg.includes("removeEntitySafe(other)"));
  // Periodic enforcement keeps exactly one character per connected player.
  assert(script.includes("function enforceSuperagentLimits"));
});

test("superagent auto-combat is teacher-toggleable and off by default", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function combatEnabled"));
  assert(script.includes("function setCombatEnabled"));
  assert(script.includes('event.id === "superagent:combat"'));
  // the per-tick attack is gated behind the toggle
  assert(script.includes("if (combatEnabled()) {"));
  // a custom label can be set on the owned character from code
  assert(script.includes('event.id === "superagent:label"'));
  assert(script.includes("function applyLabel"));
});

test("superagent script prioritizes dangerous nearby targets with stronger debuffs", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("const ATTACK_RADIUS = 8"));
  assert(script.includes("const MAX_ATTACK_TARGETS = 12"));
  assert(script.includes("HIGH_THREAT_TYPES"));
  assert(script.includes("function threatScore"));
  assert(script.includes("function smartAttackTargets"));
  assert(script.includes('target.addEffect("weakness"'));
  assert(script.includes("target.applyDamage(ATTACK_DAMAGE + (isHighThreat(target) ? 4 : 0))"));
});

test("superagent script keeps the idle character clean (no per-tick particles)", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("function cleanupLegacyVisibleMarkers"));
  assert(script.includes("function spawnParticleAny"));
  assert(script.includes("function spawnParticleCommand"));
  assert(!script.includes('addEffectSafe(superagent, "invisibility"'));
  assert(script.includes("function tickSuperagent"));
  assert(script.includes("return ownedSuperagentForEvent(player);"));
  assert(!script.includes("ownedSuperagentForEvent(player) || player"));
  assert(!script.includes("const attackAnchor = superagent || anchor"));
  // The idle character must NOT spew presence/status particles every tick.
  assert(!script.includes("emitPresenceParticles(superagent.dimension, superagent.location, tick)"));
});

test("superagent script does not depend on command selectors finding Education Agent", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(!script.includes('return `${player.name}.Agent`;'));
  assert(!script.includes("function agentSelector"));
  assert(!script.includes("function runAtNamedAgent"));
  assert(!script.includes("commandPresenceOnAgent"));
  assert(!script.includes("commandFollowSuperagent"));
  assert(!script.includes("commandAttackAroundAgent"));
});

test("superagent toolbox hides duplicate or weakly verified legacy blocks", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  [
    "superagent_show_status",
    "superagent_last_burst_count",
    "superagent_keep_aura_on",
    "superagent_follow_agent_on",
    "superagent_follow_agent_off",
    "superagent_attack_aura",
    "superagent_guard_agent",
    "superagent_power_burst",
    "superagent_smart_sweep",
    "superagent_overdrive",
    "superagent_dash",
    "superagent_scout_line",
    "superagent_patrol_square",
    "superagent_orbit_agent",
    "superagent_evade_to_agent_side",
    "superagent_high_ground",
    "superagent_zigzag",
    "superagent_spiral_search",
    "superagent_smart_move",
    "superagent_detect_block",
    "superagent_walk_stop",
    "superagent_summon_guard",
    "superagent_dismiss_guards",
    "superagent_mission_start",
    "superagent_mission_award",
    "superagent_mission_score",
    "superagent_mission_complete",
    "superagent_show_scoreboard",
    "superagent_freeze_all",
    "superagent_unfreeze_all",
    "superagent_gather_all",
    "superagent_reset_squad",
    "superagent_ground_below",
    "superagent_meet_agent",
    "superagent_remember",
    "superagent_forget",
    "superagent_memory_equals",
    "superagent_memory_at_least",
    "superagent_memory_value",
    "superagent_collect_items",
    "superagent_drop_items",
    "superagent_has_items",
    "superagent_inventory_count",
    "superagent_agent_set_slot",
    "superagent_agent_collect_item",
    "superagent_agent_drop",
    "superagent_agent_transfer",
    "superagent_agent_set_item",
    "superagent_agent_item_space",
    "superagent_agent_item_detail",
    "superagent_agent_place",
    "superagent_agent_destroy",
    "superagent_agent_till",
    "superagent_agent_attack",
    "superagent_agent_interact",
    "superagent_agent_detect_block",
    "superagent_agent_detect_redstone",
    "superagent_agent_inspect_block",
    "superagent_agent_inspect_data",
    "superagent_agent_move",
    "superagent_agent_turn",
    "superagent_agent_set_assist",
    "superagent_agent_teleport_to_player",
    "superagent_copy_region",
    "superagent_build_layer",
    "superagent_build_blueprint",
    "superagent_build_layer_transformed",
    "superagent_magnet",
    "superagent_count_up",
    "superagent_set_flag",
    "superagent_flag_is_on",
  ].forEach((blockId) => {
    assert(!source.includes(`blockId=${blockId} `), blockId);
  });
});

test("superagent toolbox hides confusing enum value helper blocks", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  assert(source.includes('blockId=superagent_value_mob block="superagent mob %mob"'));
  assert(source.includes('blockId=superagent_value_world_direction block="superagent world direction %direction"'));
  assert(!source.includes('blockId=superagent_value_move_direction block="superagent direction %direction"'));
  assert(!source.includes('blockId=superagent_value_sense_direction block="superagent sense direction %direction"'));
  assert(!source.includes('blockId=superagent_value_block block="superagent block %block"'));
  assert(!source.includes('blockId=superagent_value_transform block="superagent transform %transform"'));
  assert(source.includes('group="Values"'));
});

test("superagent toolbox hides legacy Agent command mirrors", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  assert(!source.includes('block="superagent agent '));
});
