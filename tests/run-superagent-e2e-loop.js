const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "superagent.ts");

const REPEATS = Math.max(1, Number(process.env.E2E_LOOP_REPEATS || 1));

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
    .replace(/\/\/%.+$/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
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
    "plotBlock",
    "isFilledCell",
    "placeTransformed",
    "positionText",
    "setTrackedPosition",
    "moveTrackedPosition",
    "memoryObjective",
  ]);

  const exportNames = [...js.matchAll(/function\s+(\w+)\(/g)]
    .map((match) => match[1])
    .filter((name) => !privateNames.has(name));

  const lastBrace = js.lastIndexOf("}");
  return `${js.slice(0, lastBrace)}
return { ${exportNames.join(", ")} };
})();
globalThis.superagent = superagent;
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
    FORWARD: 0,
    BACK: 1,
    LEFT: 2,
    RIGHT: 3,
    UP: 4,
    DOWN: 5,
    globalThis: {},
  };

  vm.createContext(sandbox);
  vm.runInContext(transformMakeCodeTs(source), sandbox, { filename: "superagent.ts" });
  return sandbox.globalThis.superagent;
}

function extractFunctionSignatures() {
  const source = fs.readFileSync(SOURCE, "utf8");
  const signatures = [];
  const re = /export function\s+(\w+)\s*\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(source))) {
    const name = match[1];
    const args = match[2]
      .split(",")
      .map((arg) => arg.trim())
      .filter(Boolean)
      .map((arg) => arg.split(":")[0].trim())
      .filter(Boolean);
    signatures.push({ name, args });
  }
  return signatures;
}

const explicitArgs = {
  showStatus: [0],
  guardAgent: [2, 1],
  spawnAtPlayer: [],
  recallToAgent: [],
  moveDirectionValue: [0],
  senseDirectionValue: [0],
  mobValue: [1],
  blockValue: [0],
  transformValue: [3],
  buildWall: [0, 4, 3],
  buildLayer: [0, ["X.", "XX"]],
  buildBlueprint: [0, ["XX", "-", "X."]],
  buildLayerTransformed: [0, ["X."], 2],
  copyRegion: [10, 64, 10, 12, 66, 12],
  worldPositionAtText: [4, 70, -2],
  countUp: ["e2e-count"],
  report: ["e2e loop"],
  summonAlly: [20],
  lightningStrike: [],
  forceBlast: [6],
  shieldPlayer: [15],
  missionStart: ["E2E mission"],
  missionAward: [5],
  missionComplete: [],
  showScoreboard: [],
  summonGuard: [],
  dismissGuards: [],
  resetSquad: [],
  freezeAll: [],
  unfreezeAll: [],
  gatherAll: [],
  reportWorldPosition: [],
  attackAura: [1, 1, 0],
  smartSweep: [1, 2, 0],
  overdrive: [1, 2],
  setHome: [],
  clearHome: [],
  goHome: [],
  walkTo: [-8, 137, 377],
  pathTo: [-8, 137, 377],
  reached: [-8, 137, 377],
  buildFloor: [0, 3, 3],
  buildPillar: [0, 6],
  buildPyramid: [0, 4],
  buildCircle: [0, 4],
  buildDisc: [0, 3],
  copyRegion: [10, 64, 10, 12, 66, 12],
  replaceArea: [2, 0, 3, 2, 3],
  dropItems: [0],
  collectItems: [],
  mineForward: [3],
  mineDown: [2],
  stripMine: [4, 2, 1],
  setFlag: ["e2e-flag", true],
  flagIsOn: ["e2e-flag"],
  remember: ["e2e", 5],
  forget: ["e2e"],
  memoryEquals: ["e2e", 5],
  memoryAtLeast: ["e2e", 3],
  memoryValue: ["e2e", 10],
  agentMove: [0, 2],
  agentSetAssist: [1, true],
  agentPlace: [0],
  agentDestroy: [0],
  agentTill: [0],
  agentAttack: [0],
  agentInteract: [0],
  agentSetSlot: [2],
  agentDetectBlock: [0],
  agentDetectRedstone: [0],
  agentInspectBlock: [0],
  agentInspectData: [0],
  agentCollectItem: [1],
  agentDrop: [1, 2, 0],
  agentTransfer: [1, 2, 3],
  agentSetItem: [1, 8, 2],
  agentItemSpace: [1],
  agentItemDetail: [1],
  followWalk: [true],
  walkStop: [],
};

function argFor(paramName, fnName, idx, args, paramCount) {
  if (explicitArgs[fnName] && idx < explicitArgs[fnName].length) {
    return explicitArgs[fnName][idx];
  }

  const key = paramName.toLowerCase();

  if (key === "direction") return 0;
  if (key === "rows") return ["X.X", "XX"];
  if (key === "pattern") return "X.X";
  if (key === "mode" || key.endsWith("mode")) return 0;
  if (key === "status" || key.endsWith("status")) return 0;
  if (key.includes("transform")) return 0;
  if (key.includes("assist")) return 1;
  if (key.includes("mob")) return 1;
  if (key.includes("block")) return 0;
  if (key === "text" || key === "title" || key === "key") return "e2e";
  if (key === "fromblock") return 2;
  if (key === "toblock") return 4;
  if (key.includes("fromslot")) return 1;
  if (key.includes("toslot")) return 2;
  if (key === "x" || key === "x1" || key === "x2") return -8;
  if (key === "y" || key === "y1" || key === "y2") return 64;
  if (key === "z" || key === "z1" || key === "z2") return 4;
  if (key === "item") return 1;
  if (key === "slot") return 1;
  if (key === "from" || key === "to") return 1;
  if (key.includes("amount")) return 2;
  if (
    key.includes("length") ||
    key.includes("steps") ||
    key.includes("rounds") ||
    key.includes("radius") ||
    key.includes("width") ||
    key.includes("height") ||
    key.includes("depth") ||
    key.includes("hits") ||
    key.includes("strength") ||
    key.includes("distance") ||
    key.includes("tunnels") ||
    key.includes("gap") ||
    key.includes("max") ||
    key.includes("count") ||
    key.includes("seconds") ||
    key.includes("points") ||
    key.includes("height")
  ) {
    return Math.max(1, paramCount > 2 ? 2 : 1);
  }

  if (key.includes("on") && key.length < 6) return true;
  return 1;
}

function buildArgs(signature) {
  return signature.args.map((param, idx) => argFor(param, signature.name, idx, signature.args.length, signature.args.length));
}

function runE2ECanary() {
  console.log("Running node unit tests baseline for e2e loop...");
  try {
    execSync("node tests/run-superagent-tests.js", { stdio: "pipe" });
  } catch (error) {
    console.error("Baseline unit tests failed:\n", error.stdout?.toString(), error.stderr?.toString());
    process.exitCode = 1;
    return;
  }

  console.log(`Baseline unit tests passed. Starting command-loop canary (${REPEATS} round(s)).`);

  const signatures = extractFunctionSignatures();
  const report = {
    pass: 0,
    fail: 0,
    byName: {},
  };

  for (let round = 1; round <= REPEATS; round++) {
    console.log(`\nE2E canary round ${round}/${REPEATS}`);

    for (const signature of signatures) {
      const agent = createMockAgent();
      const toolkit = loadSuperagent(agent);
      const name = signature.name;
      const fn = toolkit[name];
      if (typeof fn !== "function") {
        const err = `Missing function in runtime object: ${name}`;
        report.fail += 1;
        report.byName[name] = err;
        console.error(`FAIL ${name}: ${err}`);
        continue;
      }

      const args = buildArgs(signature);
      const before = agent.commandCalls.length + agent.calls.length + agent.mobCalls.length;
      try {
        fn(...args);
        const after = agent.commandCalls.length + agent.calls.length + agent.mobCalls.length;
        if (after === before && fn.length === 0 && args.length === 0 && signature.args.length === 0 && !fn.toString().includes("return")) {
          // Keep compatibility for lightweight status-like methods.
          report.byName[name] = "ok";
          report.pass += 1;
          continue;
        }
        report.byName[name] = `ok (${Math.max(0, after - before)} side-effect call(s))`;
        report.pass += 1;
      } catch (error) {
        const message = `${error && error.message ? error.message : String(error)}`;
        report.byName[name] = `error: ${message}`;
        report.fail += 1;
        console.error(`FAIL ${name}: ${message}`);
      }
    }
  }

  console.log(`\nE2E canary done. pass=${report.pass} fail=${report.fail}`);
  const lines = [
    "# superagent E2E canary report",
    `Date: ${new Date().toISOString()}`,
    `Rounds: ${REPEATS}`,
    "",
    `- Total: ${report.pass + report.fail}`,
    `- Pass: ${report.pass}`,
    `- Fail: ${report.fail}`,
    "",
    "## Function loop results",
  ];

  Object.keys(report.byName)
    .sort()
    .forEach((name) => {
      const status = report.byName[name];
      lines.push(`- ${name}: ${status}`);
    });

  const outPath = path.join(ROOT, "evidence", "superagent_e2e_loop_report.md");
  fs.writeFileSync(outPath, lines.join("\n"));
  console.log(`Saved report: ${outPath}`);

  if (report.fail > 0) {
    process.exitCode = 1;
  }
}

runE2ECanary();
