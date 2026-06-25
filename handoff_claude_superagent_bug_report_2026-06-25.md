# Handoff to Claude: Superagent Bug Report from Tester

Date: 2026-06-25
Workspace: `/Users/nummac/Documents/minecraft addon`
Source report: `/Users/nummac/Downloads/Find bug super agent.pdf`
Current known release before this handoff: `superagent 0.1.64`

## Context

Tester refers to Superagent as "น้อง". The tester report contains several gameplay and MakeCode block issues. This document is intended for Claude to continue implementation and debugging.

Do not assume the PDF text is fully precise spelling-wise; it was extracted from a PDF and has Thai spacing/OCR artifacts. The meaning is clear enough to triage.

## Extracted Tester Notes

Page 1:

- ใช้คำสั่งได้ แต่ขึ้นตัวแดง
- ใช้ `superagent spawn at agent` และ `superagent recall to agent` แล้วซุปเปอร์เอเจนมาหา Agent ทุกตัว ไม่ใช่แค่ของเรา แต่ไปเอาของคนอื่นมาด้วย
- ให้น้องหัน `Up`, `Down` ไม่ได้

Page 2:

- ใช้คู่กันแล้วน้องไม่ยอมหันหน้าตามทิศที่กำหนด แต่เคลื่อนที่ตามทิศไปเลย
- ใช้คำสั่ง `superagent mine` แต่กลับเป็น Agent เราไปขุดแทน ไม่แน่ใจว่าเป็น bug หรือระบบตั้งใจแบบนี้

Page 3:

- คำสั่งที่ใช้ไม่มีอะไรเกิดขึ้น ไม่เซ็ตค่าบ้านให้ ไปบ้านไม่ได้
- ลบคำสั่ง `superagent attack from character` และปิด `superagent auto guard` แล้ว แต่ยังทำงานต่อ ไม่แน่ใจว่าเป็น bug หรือผู้ทดสอบยังไม่รู้วิธีปิด

## Bug List and Required Fixes

### BUG-001: MakeCode command works but block turns red

Severity: High

Tester symptom:
คำสั่งใช้งานได้ แต่ block หรือ code แสดง error สีแดงใน MakeCode.

Likely meaning:
The generated TypeScript compiles or runs partially, but MakeCode editor marks some block/API call as invalid. This may be caused by stale block definition, type mismatch, enum mismatch, unsupported block socket type, invalid shim/block metadata, or a function signature that changed while old blocks still exist in the workspace.

Files likely involved:

- `/Users/nummac/Documents/minecraft addon/superagent.ts`
- `/Users/nummac/Documents/minecraft addon/pxt.json`
- `/Users/nummac/Documents/minecraft addon/tests/run-superagent-tests.js`

Claude tasks:

1. Reproduce by importing latest extension in MakeCode and placing tester-used blocks.
2. Identify exact red block(s). The PDF does not name which command.
3. Check generated JavaScript/TypeScript error in MakeCode.
4. Fix block annotations/types so all visible toolbox blocks are valid.
5. Add or update tests that scan block definitions for hidden/invalid legacy blocks if possible.

Acceptance criteria:

- No visible Superagent block turns red immediately after being placed.
- Existing tester scenario runs without MakeCode extension error popup.
- Any deprecated/legacy invalid blocks should be hidden, not left visible.

### BUG-002: `spawn at agent` / `recall to agent` affects other players' Agents

Severity: Critical for multiplayer/classroom use

Tester symptom:
Using `superagent spawn at agent` and `superagent recall to agent` makes Superagent come to every Agent, not only the current player's Agent. It can take or follow another person's Agent.

Likely root cause:
Current code may still use broad Agent selectors or nearest Agent lookup in a way that is not owner-scoped. The extension may use the global Minecraft Agent commands (`agent.getPosition()`, `agent.teleportToPlayer()`, or broad entity lookup), while the BP script also has `findPlayerAgent(player)` scanning nearby/all Agents. In multiplayer, Education Agent ownership may not be reliably encoded in the entity itself, so nearest-Agent fallback can attach to another user's Agent.

Known related code areas:

- `superagent.ts`
  - `spawnAtAgent()`
  - `recallToAgent()`
  - `syncAddonMob()`
  - `ensureFollowLoop()`
  - any use of `agent.getPosition()`
  - any use of `agent.teleportToPlayer()`
- `superagent-addon/superagent_BP/scripts/main.js`
  - `findPlayerAgent(player)`
  - `navStep(player, superagent)`
  - `handleFollowWalk(player, message)`

Important design decision:
If reliable per-player Agent ownership cannot be detected from the BP script, do not use a BP-side "find any Agent" fallback for follow/recall. Prefer MakeCode-side coordinates sent explicitly by the player's own MakeCode execution context.

Recommended fix direction:

1. For `spawn at agent`, MakeCode should read the current player's own Agent position and send explicit coordinates via `scriptevent superagent:spawnat x y z`.
2. For `recall to agent`, do the same: send explicit coordinates to BP, do not let BP search for Agents.
3. Avoid BP-side `findPlayerAgent()` fallbacks that scan all Agents in dimension for player-specific movement.
4. If `follow walk` or follow-agent behavior remains visible, either hide it or make it coordinate-poll from MakeCode only.

Acceptance criteria:

- In a multiplayer world with at least two players and two Agents, Player A using `spawn at agent` moves only Player A's Superagent to Player A's Agent.
- Player A's action must not move, claim, delete, or retarget Player B's Superagent.
- Player A's action must not use Player B's Agent position.

### BUG-003: Remove `Up` and `Down` from Superagent face direction

Severity: Medium

Tester symptom:
ให้น้องหัน `Up`, `Down` ไม่ได้.

User explicitly requested:
Remove `up` and `down` from the direction options for Agent/Superagent facing direction. Minecraft Education Agent/Superagent cannot meaningfully face up/down like a normal block direction; it produces confusing behavior.

Files likely involved:

- `/Users/nummac/Documents/minecraft addon/superagent.ts`
- `/Users/nummac/Documents/minecraft addon/superagent-addon/superagent_BP/scripts/main.js`
- `/Users/nummac/Documents/minecraft addon/tests/run-superagent-tests.js`

Likely code areas:

- Direction enum used by face command.
- `faceDirection(...)`
- `directionName(...)`
- `handleFace(...)`
- Any toolbox block exposing `up/down` in a dropdown for face direction.

Important:
Do not remove `up/down` from movement/building/mining direction if those commands need vertical movement. Only remove from face/turn direction dropdowns.

Acceptance criteria:

- Face-direction blocks show only horizontal directions:
  - `north`
  - `east`
  - `south`
  - `west`
- Existing movement blocks may still include `up/down` if required.
- Generated code should not offer `SuperagentMoveDirection.Up` / `Down` for face-only blocks.

### BUG-004: Face + move used together causes movement instead of only facing

Severity: High

Tester symptom:
When using blocks together, Superagent does not face the specified direction. Instead it moves in that direction.

Likely root cause:
The face command may share the same enum/function path as movement commands, or the generated BP event uses `step`/movement instead of `face`. Another possibility is that `faceDirection()` changes tracked position or triggers movement because it calls a move helper or wrong direction mapping.

Files likely involved:

- `superagent.ts`
  - `faceDirection(...)`
  - `moveCharacter(...)`
  - `directionName(...)`
- `superagent-addon/superagent_BP/scripts/main.js`
  - `handleFace(player, message)`
  - `setGridAlignedRotation(...)`
  - `cardinalRotationFromDirection` or equivalent logic

Acceptance criteria:

- Calling face north/east/south/west changes only rotation/yaw.
- Position X/Y/Z remains unchanged after face command.
- Combining face then move should first rotate, then move only when move block runs.
- Add test asserting no `superagent:step` or movement command is emitted by face-only block.

### BUG-005: `superagent mine` uses the normal Minecraft Agent to mine

Severity: Medium

Tester symptom:
Using `superagent mine` makes the normal Agent mine, not Superagent.

Important product decision:
The tester is confused because command wording says Superagent, but actual implementation delegates mining to the built-in Minecraft Education Agent. If this is intentional, rename/hide the block. If Superagent should mine visually, implement BP-side block breaking at Superagent position.

Likely current behavior:
Some "superagent mine" functions may call `agent.destroy(...)`, `agent.move(...)`, or `agent.collectAll()` internally.

Files likely involved:

- `superagent.ts`
  - mining functions:
    - mine forward
    - mine down
    - collect after mine
    - any `agent.destroy`, `agent.move`, `agent.collectAll`

Fix options:

Option A: Product clarity fix
Rename or hide these blocks because they are Agent-backed, not Superagent-backed.

Option B: True Superagent behavior
Move mining to BP script using `dimension.getBlock(...).setType("minecraft:air")` or command execution from Superagent position, then optionally spawn drops if required. This may need permission/cheats and careful survival behavior.

Recommended:
If goal is "Superagent is the actor", implement true Superagent mining or hide the misleading blocks. Do not keep blocks named `superagent mine` if the visible actor is normal Agent.

Acceptance criteria:

- Either:
  - Visible Superagent removes blocks from its own position/direction, and normal Agent does not move/mine.
- Or:
  - Misleading `superagent mine` blocks are hidden/renamed to make Agent delegation explicit.

### BUG-006: Home commands do nothing

Severity: High

Tester symptom:
Commands do nothing. Home is not set. Go home does not work.

Likely impacted commands:

- `superagent set home`
- `superagent go home`
- possibly `clear home`

Likely root cause:
After recent changes, BP script no longer auto-creates/auto-claims Superagent in tick loop. Home handlers call `ownedSuperagentForEvent(player)` and return if no owned Superagent exists. If the event source is missing or player ownership is not set, nothing happens. Another possible issue is that `handleGoHome(player, message)` parses message position in code but event handler calls `handleGoHome(event.sourceEntity)` without passing `event.message`.

Files likely involved:

- `superagent.ts`
  - `setHome()`
  - `goHome()`
  - `clearHome()`
- `superagent-addon/superagent_BP/scripts/main.js`
  - `handleSetHome(player, message)`
  - `handleGoHome(player, message)`
  - `handleClearHome(player)`
  - script event routing for `superagent:sethome`, `superagent:gohome`, `superagent:clearhome`
  - `playersForEvent(event)` fallback

Specific thing to check:
Ensure event router passes `event.message` into `handleGoHome(player, event.message)` if message coordinates are supported.

Recommended fix direction:

1. Apply `playersForEvent(event)` fallback to home handlers, not only spawn/recall.
2. For `sethome`, if no Superagent exists, either create one or store home from message/known MakeCode position.
3. For `gohome`, pass `event.message` to handler and ensure coordinates are parsed.
4. Emit user-visible feedback if no home is set, instead of silently doing nothing.

Acceptance criteria:

- `set home` stores the current Superagent position.
- `go home` moves Superagent back to saved home.
- Works even when MakeCode `scriptevent` does not provide `sourceEntity`.
- No silent failure if no Superagent exists or no home is set.

### BUG-007: Combat keeps running after removing `attack from character` and turning off auto guard

Severity: High

Tester symptom:
After deleting `superagent attack from character` and turning off `superagent auto guard`, combat still continues.

Possible explanations:

1. Global combat flag remains enabled in BP dynamic property.
2. Existing spin/combat loop continues for some ticks.
3. `attackFromCharacter` calls one-shot burst, but BP `combatEnabled()` or auto guard remains on globally.
4. `auto guard off` block may not send the correct event or `handleCombatToggle` may not receive it due to sourceEntity/event issue.
5. There may be multiple Superagents/guards, and one guard still has combat behavior.

Files likely involved:

- `superagent.ts`
  - `autoGuard(...)`
  - `attackFromCharacter(...)`
  - `defendIfThreatened(...)`
  - any combat toggle helpers
- `superagent-addon/superagent_BP/scripts/main.js`
  - `COMBAT_FLAG`
  - `combatEnabled()`
  - `setCombatEnabled(...)`
  - `handleCombatToggle(message)`
  - `attackAround(...)`
  - `tickSuperagent(...)`
  - `tickGuards(...)`

Important:
One-shot `attack from character` should not enable permanent combat. It should only trigger one burst. Auto guard should be the only persistent combat toggle.

Recommended fix direction:

1. Verify `attackFromCharacter()` only sends `superagent:burst` and does not set `COMBAT_FLAG`.
2. Ensure `auto guard off` sends `scriptevent superagent:combat off`.
3. Ensure `handleCombatToggle("off")` clears the flag reliably.
4. Add optional `superagent stop combat` behavior to clear combat flag, spin flag, and guard attack state.
5. Consider changing `COMBAT_FLAG` to per-player or per-owned-superagent instead of global world dynamic property if multiplayer isolation is required.

Acceptance criteria:

- With auto guard off, Superagent does not continuously attack.
- Running `attack from character` once creates only one combat burst/window.
- Removing the attack block and running a program with auto guard off stops ongoing combat after a short, bounded duration.
- Combat state should not leak across players/world sessions unexpectedly.

## Cross-Cutting Requirements

### Multiplayer safety

Avoid broad selectors or dimension-wide nearest searches for player-owned behavior unless ownership is guaranteed. Classroom worlds often have many students and many Agents.

Critical tags:

- `superagent.managed`
- `superagent.owner.<player>`
- `superagent.guard`

Any command that moves, removes, claims, or attacks from a Superagent should be scoped to the current player's owned Superagent.

### Source entity fallback

Recent real-world testing showed MakeCode `scriptevent` may not always provide `event.sourceEntity` as a player. Any important event handler should either:

- use `playersForEvent(event)`, or
- receive explicit coordinates/context in `event.message`, or
- fail visibly instead of silently doing nothing.

Handlers to audit:

- label
- labelpos/reportpos
- goto/pathto
- followwalk
- stop
- sethome/gohome/clearhome
- addguard/clearguards
- gather/reset/recall/spawnat
- step/face
- lightning/blast/shield/heal/magnet/blink/ally

### Avoid player-centered effects

Previous fix in `0.1.64` removed MakeCode-side combat particles so particles anchor on Superagent via BP script. Preserve this behavior.

Do not reintroduce:

- `runAtSuperagent("particle superagent:attack_burst ...")` in `superagent.ts`
- `runAtSuperagent("particle minecraft:critical_hit_emitter ...")` in `superagent.ts`

## Suggested Implementation Order

1. Fix visible face direction enum/dropdown by removing `up/down` only for face commands.
2. Fix face command so it rotates only and never emits movement/step.
3. Fix home event routing and message passing.
4. Fix combat toggle persistence/leak.
5. Fix multiplayer Agent ownership for `spawn at agent` / `recall to agent`.
6. Decide whether `superagent mine` should be true Superagent mining or hidden/renamed Agent delegation.
7. Reproduce and fix "command works but red block" once exact block is identified.

## Suggested Tests to Add or Update

- Face direction toolbox test:
  - face block dropdown does not contain `up` or `down`
  - movement direction dropdown may still contain `up/down`

- Face behavior test:
  - `faceDirection(north)` emits only `scriptevent superagent:face north`
  - no `superagent:step`, no teleport/move call from face-only block

- Home routing test:
  - event handler for `superagent:gohome` passes `event.message`
  - home handlers use `playersForEvent(event)` or explicit fallback

- Combat off test:
  - `autoGuard(false)` sends `superagent:combat off`
  - `handleCombatToggle("off")` clears combat flag
  - `attackFromCharacter` does not enable persistent combat

- Multiplayer ownership test:
  - ensure code does not scan all Agents and pick another player's Agent for player-specific recall/follow

- Mining clarity test:
  - if mining remains Agent-backed, visible blocks should be hidden or text should explicitly say Agent-backed
  - if Superagent-backed, assert no `agent.destroy`/`agent.move` is used for Superagent mining blocks

## Open Questions for Product Owner

1. Should `superagent mine` be implemented as real Superagent block breaking, or should the block be hidden because it delegates to normal Agent?
2. Should persistent auto guard be per-player, per-Superagent, or global world setting?
3. Should `spawn at agent` / `recall to agent` remain visible in multiplayer if Education Agent ownership cannot be reliably detected?
4. For red MakeCode blocks, which exact block(s) turned red in tester's project?

## Definition of Done

- Latest release version should be bumped after fixes, likely `0.1.65` or later.
- Build `.mcaddon` locally but do not push `.mcaddon` to repo.
- Push source/tag to `https://github.com/numraise/raisesuperagent`.
- Run `npm test`.
- Verify in Minecraft Education:
  - `allowmobs = true`
  - Superagent BP/RP active
  - MakeCode import points to the matching tag
  - screen shows matching `superagent X.Y.Z script active`

## Development History for Claude

This section summarizes how the addon reached its current state so Claude does not repeat old assumptions or undo intentional changes.

### Original Direction

The project started as an attempt to make a more advanced Minecraft Education MakeCode extension for controlling the built-in Education Agent. After discussion, the direction changed to a combined system:

- MakeCode extension exposes blocks under `Superagent`.
- Behavior Pack adds a visible custom entity: `superagent:superagent`.
- Resource Pack renders the visible Superagent character as a one-block cube, later styled like a Minecraft dog.
- MakeCode blocks should feel like they control the visible Superagent, not only the invisible/normal Education Agent.

The product language used by the tester/user is that Superagent is "น้อง".

### Core Design Decisions Already Made

- Superagent should work in Minecraft Education 1.21.133.
- Superagent must be usable in Survival/classroom-style worlds.
- `.mcaddon` files must not be pushed to GitHub.
- Source code and tags are pushed to:
  - `https://github.com/numraise/raisesuperagent`
- Local build artifacts are generated under:
  - `/Users/nummac/Documents/minecraft addon/dist/`
- Latest known local addon before this handoff:
  - `/Users/nummac/Documents/minecraft addon/dist/superagent-0.1.64.mcaddon`
- Latest known MakeCode import link before this handoff:
  - `https://github.com/numraise/raisesuperagent#superagent-0.1.64`

### Important User Preferences

- User does not want weak/duplicated/confusing blocks visible in the Superagent toolbox.
- If a block does not clearly work for the visible Superagent, hide it or rename it.
- User repeatedly asked to hide legacy Agent mirror blocks, inventory blocks, memory/flag blocks, confusing enum value helpers, follow/watch/manual check blocks, and other blocks that are not useful or not reliable.
- User wants the visible block shape to match MakeCode conventions:
  - action/statement blocks should be normal statement blocks
  - value/report blocks should be rounded/capsule and fit into value sockets
- Text/value reporter blocks must fit into text sockets such as `set label`.
- Position values should be integer/no decimal in visible output.
- Combat strength/radius should remain bounded:
  - strength max `3`
  - radius max `5`
- Combat particles should not appear around the player.

### Releases and Major Fixes

#### Around `0.1.36` to `0.1.37`

The addon became shareable/importable through GitHub and visible in Minecraft Education MakeCode. A user guide was also created and later updated in Canva/manual form.

Main focus:

- MakeCode extension import/install flow.
- First working custom Superagent addon.
- Initial guide and examples.
- Early E2E checks in Minecraft Education.

#### `0.1.45`

Position reporters were added and refined.

Important fixes:

- Added blocks for Superagent position/world position.
- Allowed position text/value reporter blocks to plug into label/text sockets.
- Fixed decimal output so displayed position can be integer-based.
- User had to install matching `.mcaddon` for BP behavior to match MakeCode blocks.

#### `0.1.57` to `0.1.60`

Several toolbox cleanup and compilation fixes happened.

Important fixes:

- Hidden many weak or confusing blocks from toolbox.
- Removed or hid blocks that depended on normal Agent inventory because Superagent does not have its own inventory.
- Fixed MakeCode compile errors caused by `Position.x`, `Position.y`, `Position.z`; MakeCode `Position` does not expose `.x/.y/.z`. Correct pattern is `position.getValue(Axis.X/Y/Z)`.
- `0.1.60` was pushed after fixing those MakeCode extension errors.

Important caution:

- Do not reintroduce direct `Position.x/y/z` usage in `superagent.ts`.

#### `0.1.61`

Fixed unwanted idle auto-spawn/auto-follow behavior.

Problem:

- Without writing any MakeCode program, Superagent blinked and kept moving onto the player.
- Root cause was BP tick loop calling `ensureOwnedSuperagent(player)` every tick, which auto-created/adopted a Superagent even when the user had not requested one.

Fix:

- BP tick loop no longer auto-spawns Superagent.
- Tick loop only maintains an already-owned Superagent.
- `spawn at player` and spawn egg should be the explicit ways to create/claim Superagent.

Important caution:

- Do not restore per-tick auto-creation of Superagent.

#### `0.1.62`

Fixed MakeCode `scriptevent` source fallback.

Problem:

- `spawn at player` sometimes did nothing.
- `scriptevent` from MakeCode may not provide `event.sourceEntity` as a player.

Fix:

- Added fallback routing using `playersForEvent(event)` for important events.
- If source player is missing, handlers can fall back to `world.getPlayers()`.

Important caution:

- Some event handlers still may not use this fallback. Claude should audit the handlers listed earlier in this report.

#### `0.1.63`

Fixed spawn egg disappearing and made spawn more reliable.

Problem:

- Placing a Superagent egg caused the entity to appear briefly, then disappear.
- Earlier logic tried to move the old owned Superagent to the newly placed egg position and remove the newly spawned entity. In real testing this looked like the new entity vanished.

Fix:

- The newly spawned egg entity becomes the main Superagent.
- Old owned Superagent entities are removed instead.
- `spawn at player` gained a `summon superagent:superagent ~ ~ ~` fallback.
- `spawn at agent` gained a coordinate `summon superagent:superagent x y z` fallback.

Important environmental discovery:

- The issue was not caused by `RaiseUAC` alone.
- The real blocker for one test world was `allowmobs = false`.
- Once `allowmobs = true`, Superagent spawning worked.

Important caution:

- Any future spawn debugging must first confirm:
  - `allowmobs = true`
  - Superagent BP/RP active
  - matching MakeCode extension tag
  - `superagent X.Y.Z script active` appears in game

#### `0.1.64`

Fixed combat particles appearing around both Superagent and player.

Problem:

- Combat particles appeared around Superagent and also around the player.
- MakeCode extension was emitting particle commands using tracked/command position while BP script also emitted particles from the real Superagent entity.

Fix:

- Removed MakeCode-side combat particle commands:
  - `particle superagent:attack_burst`
  - `particle minecraft:critical_hit_emitter`
- MakeCode now only sends:
  - `scriptevent superagent:burst`
- BP script owns combat visual effects and anchors them on the real Superagent entity.

Important caution:

- Do not re-add combat particle commands in `superagent.ts`; keep particles in BP script only.

### Current Architecture Summary

The current addon has two cooperating layers:

#### MakeCode Extension Layer

Main file:

- `/Users/nummac/Documents/minecraft addon/superagent.ts`

Responsibilities:

- Expose MakeCode blocks.
- Track intended Superagent position for some block calculations.
- Send `scriptevent superagent:*` commands to BP script.
- For spawn reliability, may also send direct `summon superagent:superagent ...` fallback commands.

Known risk:

- Some blocks still delegate to the normal Minecraft Agent, especially older Agent mirror/mining behavior. If visible block text says `superagent`, this can confuse testers.

#### Behavior Pack Script Layer

Main file:

- `/Users/nummac/Documents/minecraft addon/superagent-addon/superagent_BP/scripts/main.js`

Responsibilities:

- Own/claim visible `superagent:superagent` entity.
- Maintain entity label, rotation, health/resistance, movement/pathing, combat bursts, home/guard behavior.
- Receive `scriptevent superagent:*`.
- Emit combat particles from the real Superagent entity.

Known risk:

- Some handlers may silently return if no owned Superagent exists.
- Some handlers may still depend too much on `event.sourceEntity`.
- Some multiplayer behavior may scan for Agents too broadly.

#### Resource Pack Layer

Important files:

- `/Users/nummac/Documents/minecraft addon/superagent-addon/superagent_RP/`

Responsibilities:

- Render Superagent as a visible one-block cube/dog-like style.
- Particle definitions.

### Known Environment Requirement

`allowmobs` must be enabled.

If `allowmobs = false`, custom mob/entity spawning can fail or behave as if Superagent appears briefly then disappears or never appears. This was confirmed by user after multiple false leads about pack order/cache/Add-on conflicts.

### Known Non-Causes / Resolved Misdiagnoses

The following were suspected but later weakened by user testing:

- `RaiseUAC [2.8.26]` alone is not the cause.
- Behavior Pack order alone is not the cause.
- Having other addons alone is not sufficient to reproduce, because another machine/world with the same visible addon set worked.

Still possible but lower priority:

- stale Minecraft Education cache
- mismatched `.mcaddon` vs MakeCode extension version
- old world state with duplicate Superagents

### Commands/Blocks That Have Been Problematic Historically

Claude should be careful around these:

- `superagent spawn at player`
- `superagent spawn at agent`
- `superagent recall to agent`
- `superagent follow walk`
- `superagent path to agent`
- `superagent walk to agent`
- `superagent check events`
- `superagent watch on/off`
- `superagent attack from character`
- `superagent auto guard`
- `superagent set home`
- `superagent go home`
- `superagent mine forward/down`
- normal Agent mirror commands copied into Superagent toolbox
- inventory/slot/item commands
- memory/flag/count commands
- enum helper reporter blocks such as `superagent block stone`, `superagent direction north`, `superagent sense direction ahead`

Many of the above were already hidden from toolbox, but code may still exist for compatibility/tests.

### Current Tester Bug Priority

For the next implementation pass, prioritize in this order:

1. Remove `up/down` from face-direction options only.
2. Fix face command so it rotates only and never moves.
3. Fix `set home` / `go home`.
4. Fix combat off / auto guard persistence.
5. Fix multiplayer ownership for `spawn at agent` / `recall to agent`.
6. Decide whether mining blocks should be real Superagent mining or hidden/renamed.
7. Identify exact red MakeCode blocks and fix annotations/types.

### Release Procedure Used So Far

Standard workflow:

1. Edit source.
2. Bump versions in:
   - `pxt.json`
   - `package.json`
   - `superagent-addon/superagent_BP/manifest.json`
   - `superagent-addon/superagent_RP/manifest.json`
   - script active message in `superagent-addon/superagent_BP/scripts/main.js`
   - README install/link references
3. Run:
   - `npm test`
4. Build local addon:
   - `node tools/package-superagent-addon.js`
5. Commit source only.
6. Tag:
   - `superagent-X.Y.Z`
7. Push source/tag to remote `raise`.
8. Do not push `.mcaddon`.

Latest known generated artifact:

- `/Users/nummac/Documents/minecraft addon/dist/superagent-0.1.64.mcaddon`

### Git/Workspace Caution

The working tree may contain unrelated user/generated changes. Do not revert them.

Known unrelated files have appeared repeatedly:

- `.DS_Store`
- `HANDOFF.md`
- `PHASE_7_PLUS_ROADMAP.md`
- `คู่มือการใช้งาน.md`
- `.serena/`
- `evidence/`

When committing, stage only files relevant to the Superagent source/version/test change.
