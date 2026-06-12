# superagent — Engineering Handoff

**For:** GPT Codex 5.5 (or any engineer/agent picking this up)
**Current version:** v0.1.35 · 54 unit tests passing · v0.1.34 **verified running in-game** (Minecraft Education 1.21.133)
**Last updated:** 2026-06-12

This document is the single source of truth for continuing work. Read it fully before
changing anything — several non-obvious decisions were hard-won during real in-game testing.

**Continuation note (2026-06-12):** v0.1.34 was committed and pushed to
`numraise/raisesuperagent` as `d185b77`, with tag `superagent-0.1.34`. MakeCode's GitHub API
resolves the main import URL as version `0.1.34`. A quick in-game smoke test saw the visible
character, `superagent 0.1.34 script active`, `/scriptevent superagent:label E2E-034`, and
`/scriptevent superagent:burst` returning `hit 0 mob(s)`; the user later confirmed `burst`
also reached `hit > 0` near a mob. The same existing world also printed
"At least one of your resource or behavior packs failed to load"; since the script was alive,
separate world/pack cleanup may be needed before treating that message as a superagent failure.
The GitHub release exists at
`https://github.com/numraise/raisesuperagent/releases/tag/superagent-0.1.34` and includes the
`superagent-0.1.34.mcaddon` asset.
After the user confirmed `burst` reached `hit > 0`, v0.1.35 removes the temporary burst hit-count
chat diagnostic. Re-test the v0.1.35 add-on once installed; the expected script-active message is
`superagent 0.1.35 script active`.

---

## 1. What this is

A **Minecraft Education 1.21.133** project with two halves that ship together:

1. **MakeCode extension** (`superagent.ts`) — the `superagent` block namespace students use
   in Code Builder (Blocks/JavaScript/Python). Imported into Code Builder from GitHub or pasted.
2. **Add-on** (`superagent-addon/`, packaged as `dist/superagent-<ver>.mcaddon`) — a behavior
   pack (BP) + resource pack (RP) that define a visible 1×1×1 entity `superagent:superagent`
   and a behavior-pack **script** (`main.js`) that does all reliable world work via the
   `@minecraft/server` script API.

The product gives students a programmable helper character that is **better than the vanilla
Agent**: sensing that returns values, events, smooth + A\* pathfinding with collision, build/
mine/blueprint, cross-session memory, autonomous squad guards, missions, teacher controls,
hero "special powers", and a primitive command set (control/sense/think/judge/communicate).

**Key audience assumption: students join as Operator** (cheats enabled). Many blocks issue
operator commands (`testfor`, `fill`, `setblock`, `clone`, `scoreboard`, `title`, `scriptevent`).
This was confirmed with the user as the deployment model.

---

## 2. Repository layout

```
superagent.ts                         # MakeCode extension (the block namespace)  ← students import this
test.ts                               # tiny pxt test file (referenced by pxt.json)
pxt.json / package.json               # extension metadata + version
README.md                             # full block reference
HANDOFF.md                            # this file
PHASE_7_PLUS_ROADMAP.md               # phase history + backlog
END_TO_END_TEST_PLAN.md               # manual in-game test checklist
tools/package-superagent-addon.js     # builds dist/superagent-<ver>.mcaddon (zips BP+RP via temp dir)
tests/run-superagent-tests.js         # 54 unit tests (node, no deps) — see §6
archive/                              # old agent-survival.ts (not shipped)
superagent-addon/
  superagent_BP/
    manifest.json                     # BP manifest (deps: @minecraft/server "1.17.0")
    entities/superagent.json          # entity: invincible, persistent, no gravity/collision
    scripts/main.js                   # THE behavior-pack script (single self-contained file)
    scripts/navmath.js                # pure stepToward/parseGoto — KEPT FOR UNIT TESTS ONLY
    scripts/pathfind.js               # pure A* findPath — KEPT FOR UNIT TESTS ONLY
  superagent_RP/
    manifest.json, entity/, models/, render_controllers/, particles/, textures/
dist/superagent-<ver>.mcaddon         # built bundles
```

> ⚠️ `navmath.js` and `pathfind.js` are **inlined into `main.js`** (see §4). The standalone
> files exist only so the unit tests can import and test the pure math. If you change the math,
> change it in BOTH `main.js` (the inline copy) and the standalone file, or the tests will
> diverge from what ships.

---

## 3. Architecture & the MakeCode↔BP bridge

Two execution contexts:

- **Extension (`superagent.ts`)** runs as the student's MakeCode program. It can call native
  MakeCode APIs (`agent.*`, `mobs.execute`, `loops.*`, `positions.*`) and run slash commands
  **as the player** via `runAtAgent(cmd)` / `runAtSuperagent(cmd)` (both wrap `mobs.execute`).
- **Behavior-pack script (`main.js`)** runs server-side with the full `@minecraft/server`
  script API: `dimension.getEntities/getBlock/spawnEntity`, `entity.applyDamage/addEffect/
  teleport/setRotation`, `world/entity dynamic properties`, `system.runInterval`,
  `system.afterEvents.scriptEventReceive`, etc.

**The bridge:** the extension talks to the BP by running `/scriptevent superagent:<id> <msg>`
(via `runAtAgent`). The BP's single `scriptEventReceive` handler dispatches on `event.id`.
This is the reliable channel and is how almost every "real world effect" is done.

**Why delegate to the BP instead of raw commands?** Real in-game testing proved that
command-based world manipulation from MakeCode is fragile on Education:
- `execute unless entity … run summon …` (nested execute) → parser error.
- `@e[…]` selectors combined with relative positions via `mobs.execute`'s positioned wrapper →
  "target selectors don't support relative positions".
So combat/movement/powers were moved to **scriptevent → BP → script API**, which works.

**What still runs as direct commands from the extension (operator):**
- `testfor` / `testforblock` (sensing — boolean comes back via `mobs.execute` return value).
- `fill` / `setblock` / `clone` (build/blueprint — at the character via `runAtSuperagent`).
- `scoreboard` / `title` (memory + missions).
- `agent.*` native (mine, inventory, detect) — Agent's own abilities.

**scriptevent IDs currently handled in `main.js`:** `combat`, `label`, `goto`, `gotoagent`,
`pathto`, `pathtoagent`, `followwalk`, `stop`, `sethome`, `gohome`, `clearhome`, `addguard`,
`clearguards`, `freeze`, `gather`, `reset`, `recall`, `step`, `face`, `burst`, `lightning`,
`blast`, `shield`, `heal`, `magnet`, `blink`, `ally`.

---

## 4. CRITICAL in-game findings (do not regress these)

These were discovered by actually loading the pack in Education 1.21.133. They are the reason
the pack works at all. **Re-introducing any of these will silently break the whole BP script.**

1. **`@minecraft/server` must be `"1.17.0"`** in `superagent_BP/manifest.json`. The original
   `"2.4.0"` is not available in this Education build → "At least one of your resource or
   behavior packs failed to load" and the script never runs.
2. **`main.js` must be a single self-contained file** — do NOT `import` from `./navmath.js` /
   `./pathfind.js`. This Education build failed to load the pack when it imported secondary
   script files. The functions are inlined at the top of `main.js`.
3. **Do NOT reference `world.beforeEvents.entityHurt`** — it doesn't exist in the 1.x stable
   API; referencing it throws at module top-level and kills the entire script (no tick loop,
   no handlers, no "script active" message). Invincibility is handled by the entity's
   `minecraft:damage_sensor` (`deals_damage: no`) in `superagent.json`, not by script.
4. **Do NOT `import { EntityComponentTypes }`** — use the string id, e.g.
   `entity.getComponent("minecraft:health")`.
5. **Selectors cannot use relative coordinates.** `selectSuperagentNear` must not call
   `.atCoordinate(...)` (the stored position can be relative `pos(...)`).
6. The `scriptEventReceive` subscribe is wrapped in `try { … } catch {}` and the
   `system.runInterval` tick loop is registered last, so a handler error can't stop the tick
   loop (character spawn + name tag still work).

**How to confirm the script is alive in-game:** on world join you should see chat
`superagent 0.1.35 script active`, the cube should carry the name tag `superagent [idle]`, and
`/scriptevent superagent:burst` near a hostile should damage the mob without printing the old
temporary hit-count diagnostic.

---

## 5. Verified in-game vs unit-test-only

**Verified working in Minecraft Education 1.21.133 (v0.1.27→0.1.34):**
- BP script loads & runs; one owned character per player (leftover/unowned cubes auto-removed).
- Combat: `run` → `attackFromCharacter` → scriptevent `burst` → BP `applyDamage` kills mobs; the
  cube **spins** during attack (`setRotation`, with teleport-rotation fallback).
- Idle particles removed (clean cube + name tag).
- Collision: glide (`walk to`/`path to`/`follow`) and grid `move` (BP `step`) stop at walls.
- `spawn at player`.

**Unit-test-only (logic + command strings asserted; NOT yet confirmed in-game):**
- Sensing return values (`testfor`/`testforblock`/`agent.detect`), events, A\* routing visuals,
  build/mine/blueprint block placement & ids, memory/scoreboard, squad guards, missions/title,
  teacher controls, special powers (lightning/blast/shield/heal/magnet/blink/ally), the new
  basic command set (control/sense/think/judge/communicate).
- See `END_TO_END_TEST_PLAN.md` for the manual checklist to verify these.

**Environment note:** the user's world also runs a third-party anti-cheat
("RaiseUAC Education Safe gateway / Script event gateway"). It did **not** end up blocking our
scriptevents, but keep it in mind if scriptevents mysteriously stop arriving.

---

## 6. Build / test / deploy

**Unit tests (run before every commit):**
```bash
node tests/run-superagent-tests.js     # must print 54 "ok -" lines, exit 0
```
The test harness is a hand-rolled transpiler: it reads `superagent.ts`, strips MakeCode
`//%` annotations + type annotations via regex, runs it in a `vm` sandbox with mocked
`agent`/`mobs`/`loops`/`positions`. **Quirks you must respect when adding code:**
- Only these param/return types are stripped: `number|boolean|string|Position|Superagent*`,
  plus `number[]`, `boolean[]`, `string[]`, `(() => void)[]`, `() => void`. Any other type
  annotation (e.g. `Block`) will break the vm parse for the WHOLE file. Avoid `Block`-typed
  params (use a `Superagent*` enum or `string`).
- `let x: T[] = []` array annotations are stripped only for the forms above.
- New private helpers should be added to the `privateNames` set in the test so they aren't
  treated as exported toolkit functions.
- BP `main.js` is **not executed** by tests (it imports `@minecraft/server`); it's checked with
  `node --check` and string-`includes` assertions. Pure math lives in `navmath.js`/`pathfind.js`
  which ARE executed (via `loadNavMath`/`loadPathfind`).
- The sandbox shims `Math.randomRange` (returns min) and `agent.detect`/`getItemCount`/`destroy`/
  `dropAll`/`place` — extend these mocks when you use new native APIs.

**Build the add-on:**
```bash
node tools/package-superagent-addon.js   # → dist/superagent-<ver>.mcaddon
```
(Builds into a temp dir then copies, because synced folders block in-place zip replace.)

**Version bump (keep all in lockstep):** `pxt.json`, `package.json`, both manifests
(`header.version`, all module versions, the BP→RP dependency version, names), `READY_TAG` +
the "script active" message in `main.js`, README pin URL. The test
"extension and visible add-on names use the same release version" enforces consistency.

**Git / publish (extension import URL):**
- Remote `raise` → `https://github.com/numraise/raisesuperagent.git`. Push `main` + a tag.
- `.gitignore` excludes `.github/workflows/` — the push token lacks `workflow` scope, so a
  tracked workflow file gets the push **rejected**. Never re-add `.github/workflows/test.yml`.
```bash
git add -A && git commit -m "superagent v<ver>: …"
git push raise main
git tag -f superagent-<ver> && git push -f raise superagent-<ver>
```
- MakeCode import URL: `https://github.com/numraise/raisesuperagent` (or pinned
  `…#superagent-<ver>`). MakeCode caches by commit — to force-refresh, remove the extension and
  re-add the URL, or paste `superagent.ts` directly into the project.

**Two things must be updated on every change that touches both halves:** re-import the
`.mcaddon` in the world (BP changes) AND update the extension in Code Builder (superagent.ts
changes). Importing a same-version pack often won't update — bump the version or remove+re-add.

---

## 7. Known issues / open items

1. **Dual-state drift (by design, acceptable):** the extension tracks `superagentPosition`
   (a `pos()` used as the execute position for build/sense commands). The BP owns the real
   entity location. They can diverge after a collision-stopped move (`superagentPosition` is
   optimistic; the entity stopped at the wall). Build/sense then act at the intended spot, not
   the entity's actual spot. Fine for teaching; a full fix means making the BP the single source
   of truth for position and reading it back (hard — no clean readback channel).
2. **Burst debug message removed in v0.1.35.** Combat verification is done (`hit > 0` confirmed
   by the user), and the temporary `superagent burst → hit N mob(s)…` chat diagnostic is gone.
3. **`applyKnockback` signature** uses the 1.x 4-arg form
   `applyKnockback(dirX, dirZ, hStrength, vStrength)` with an `applyImpulse` fallback. If
   knockback doesn't land in-game, that's the place to adjust.
4. **Block ids** in build/blueprint (`oak_planks`, `glowstone`, `sandstone`, …) and `/fill …
   hollow`, `/fill … replace`, `/clone`, `title`, `scoreboard … setdisplay` are unit-tested as
   strings only — verify in 1.21.133.
5. **Spin visibility:** `setRotation` may or may not exist in 1.17.0; there's a teleport-rotation
   fallback. Confirmed "หมุน" (spins) by the user, so it works in their build.
6. **Grid collision is partial:** `move`/`dash`/`scout`/`patrol`/`zigzag`/`spiral` (via
   `moveCharacter` → BP `step`) collide. `orbit`/`evade`/`highGround` paths that still call
   `setSuperagentPosition` teleport without collision. Unify if needed.
7. Idle particles were intentionally removed per user request; `emitPresenceParticles` is now a
   single subtle sparkle and is no longer called per tick. Don't reintroduce per-tick particle
   spam.

---

## 8. Phase history (what each delivered)

| Phase | Delivered |
|---|---|
| 1 | Fix `isAgent()` self-match; owner-scoped single character; combat toggle (off by default); status label |
| 2 | Sensing that returns values (`senseMob`/`Hostiles`/`nearestHostileDistance`/`detectBlock`/`pathClear`) |
| 3 | Edge-triggered events (`onHostileNear`/`onAreaClear`/`onPathBlocked`/`watch`/`checkEvents`) |
| 4 | Smooth glide nav (`walkTo`/`walkToAgent`/`followWalk`/`reached`) via BP `navmath` |
| 5 | Build (`/fill`,`/setblock`,pattern) + mine (Agent native) + shapes |
| 6 | Cross-session memory (scoreboard) + home point + autonomous squad guards |
| 7 | find-nearest-block, shape library, auto-status, mission/leaderboard |
| 8 | Agent inventory/fetch, auto-bridge/stair, teacher controls (freeze/gather/reset) |
| 9 | A\* pathfinding (`pathTo`/`pathToAgent`) — pure module + BP getBlock |
| 10 | 3D blueprint from arrays, copy/paste clone, fill-replace |
| 11 | Blueprint mirror/rotate; A\* recompute mid-path |
| 12 | Collision-aware grid move (BP `step`); `ensureCharacter` stops force-teleporting |
| 13 | Special powers: lightning, force blast, shield, heal, magnet, blink, summon ally |
| — | In-game hardening (v0.1.27–0.1.34): server 1.17.0, single-file, remove entityHurt, dedup, combat→BP, collision, particle cleanup |
| — | Basic command set: Control/Sensing/Thinking/Judging/Communicate primitives |

---

## 9. Backlog (Phase 14+ candidates)

- 🔴 **Squad you command individually** — name members, select an "active" member; needs the
  movement model reworked to track multiple per-member positions (the big one).
- 🟡 **A\* extensions** — chunked/partial paths beyond the 24-block range; gravity/ground-walking.
- 🟡 **Make all movement BP-owned** to fully remove the dual-state drift and give every move
   collision (orbit/evade/highGround included).
- 🟡 **auto-farm** (`agent.till`/plant/`collect`) — verify the exact Agent API names first.
- 🟢 **threat memory / aggro**, **sound + animation controllers**, **energy system**,
   **Python lesson templates**, **path record & replay**, **mini-games** (maze/tower-defense).

---

## 10. How to add a new "power"/action (the standard recipe)

1. **BP (`main.js`):** write `handleX(player, message)` using the script API; add a branch
   `if (event.id === "superagent:x") { if (isPlayerSource(event.sourceEntity)) handleX(...); return; }`
   inside the `scriptEventReceive` subscribe.
2. **Extension (`superagent.ts`):** add an exported block in the right `//% group=…` that calls
   `runAtAgent("scriptevent superagent:x " + arg)`. Keep param types to `number/boolean/string/
   Superagent*` only.
3. **Tests:** add a MakeCode test (asserts the command string) + a BP string-check test (asserts
   `function handleX` and `event.id === "superagent:x"`). Add any new private helper to
   `privateNames`; add native-API mocks to `createMockAgent`/sandbox if used.
4. Bump version everywhere (§6), `node tests/run-superagent-tests.js`, repackage, README.

That's the whole loop. Welcome aboard.
