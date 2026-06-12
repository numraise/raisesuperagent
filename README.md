# superagent

Minecraft Education 1.21.133 add-on and MakeCode extension for a visible one-block character named `superagent`.

## What It Adds

- A custom visible entity `superagent:superagent` named `superagent`, rendered as exactly one block.
- MakeCode blocks that spawn, recall, move, follow, and attack from the `superagent` character position.
- Custom resource-pack aura particles and fallback vanilla particles so students can see the character is active.
- Automatic cleanup for legacy armor stand markers from older builds.
- Persistent, non-monster character designed not to despawn in Peaceful.
- Script behavior that protects and powers MakeCode-controlled `superagent` characters without forcing them back to the Agent.
- Damage cancellation, high health, resistance, fire resistance, no gravity, no collision, and knockback resistance.
- Smart hostile-mob attack aura that prioritizes nearby high-threat mobs, adds slowness/weakness, and emits attack particles.
- Auto-guard combat is **off by default** and is toggled by the teacher (or student code) via `superagent auto guard on/off`; explicit attack blocks always work.
- One owned character per player (owner-tagged), so the script no longer fights MakeCode-driven movement or deletes another player's character.
- A status label above the character, set from code with `superagent label`.
- MakeCode `superagent` blocks intended for Member + Survival use through Code Builder, with position control driven by `agent.getPosition()` and extension state.

## MakeCode Blocks

- `superagent show ready/attack/shield`
- `superagent spawn at agent`
- `superagent recall to agent`
- `superagent move north/east/south/west/up/down blocks`
- `superagent follow agent on`
- `superagent follow agent off`
- `superagent dash direction blocks`
- `superagent scout direction steps`
- `superagent patrol square side rounds`
- `superagent orbit agent radius steps`
- `superagent evade to agent side distance`
- `superagent high ground blocks`
- `superagent zigzag direction steps`
- `superagent spiral search radius rounds`
- `superagent smart move guard/scout/patrol/orbit/evade/high ground/zigzag/spiral steps strength`
- `superagent attack from character radius strength`
- `superagent attack aura`
- `superagent guard agent`
- `superagent power burst`
- `superagent smart sweep`
- `superagent overdrive`
- `superagent keep aura on`
- `superagent last burst count`
- `superagent label %text`
- `superagent auto guard on/off`

### Sensing (returns a value for if / loop)

These blocks report what is around the character or Agent so students can write real
conditionals and loops. They use operator commands (`testfor` / `testforblock`) plus the
Agent's native `detect`, so the world must allow students operator/cheat permission.

- `superagent sense %mob within %radius blocks` → boolean
- `superagent hostiles within %radius blocks` → boolean
- `superagent nearest hostile distance up to %maxRadius` → number (`-1` when none)
- `superagent block %direction of agent` → boolean (Agent-relative)
- `superagent path clear %direction of character` → boolean
- `superagent nearest %block distance up to %maxRadius` → number (scans the 6 axes, `-1` if none)
- `superagent nearest %block direction up to %maxRadius` → number (0=ahead..5=down, `-1` if none)

### Reactive (sense, then act)

- `superagent defend if hostiles within %radius strength %strength` → boolean (true if it attacked)
- `superagent advance %direction up to %maxSteps blocks` → number (blocks actually moved)

### Events (event-driven programming)

Edge-triggered event blocks built on the sensing layer. Register a handler, turn the
watcher on, and the code inside runs once each time the condition becomes true. A background
loop polls about four times a second; `superagent check events` also lets students poll from
inside their own loop.

- `on superagent hostile within %radius blocks` — runs once when a hostile enters range
- `on superagent area clear within %radius blocks` — runs once when the area becomes safe
- `on superagent path blocked %direction` — runs once when that direction becomes blocked
- `superagent watch on` / `superagent watch off` — start / pause the background watcher
- `superagent check events` — evaluate all registered events once now

### Navigation (smooth glide, not teleport)

Instead of jumping a block at a time like the vanilla Agent, the character glides toward a
target. The behavior-pack script moves it a fraction of a block each tick and faces it in the
travel direction, so movement looks continuous.

- `superagent walk to x %x y %y z %z` — glide to a world position
- `superagent walk to agent` — glide to the Agent's current spot once
- `superagent follow walk %on` — keep gliding after the Agent
- `superagent walk stop` — stop and clear the current target
- `superagent reached x %x y %y z %z` → boolean (within 2 blocks of that spot)

Use the walk blocks **or** the instant grid-move blocks for a given character, not both at the
same time — they are two different movement modes.

**Pathfinding (A\*)** — `walk to` glides in a straight line; `path to` routes *around*
obstacles. The behavior pack runs an A\* search over the surrounding blocks (treating solid
non-air, non-liquid blocks as walls), stores the waypoint list, and glides along it. Search is
bounded (about 300 nodes / 24 blocks); if no route is found it falls back to a straight glide.
The path is **adaptive**: it stores the goal, and if a waypoint becomes blocked mid-journey
(e.g. someone builds a wall in front of it), it recomputes the route automatically.

- `superagent path to x %x y %y z %z` — pathfind around obstacles to a position
- `superagent path to agent` — pathfind around obstacles to the Agent

### Build (data-structure practice)

Build blocks place structures with `/fill` and `/setblock` from the character corner, so they
need operator/cheat permission. `superagent build row` reads a text pattern, which is a nice
way to teach string and array iteration.

- `superagent build box %block width %w height %h depth %d` — solid box
- `superagent build hollow box %block ...` — outer shell only
- `superagent build floor %block width %w depth %d`
- `superagent build wall %block length %l height %h`
- `superagent build pillar %block height %h`
- `superagent build row %block pattern %pattern` → number placed (`X`, `#` or `1` = block, else gap)
- `superagent clear area width %w height %h depth %d` — fill with air
- `superagent build pyramid %block size %size` — stepped pyramid
- `superagent build staircase %block steps %steps` — diagonal stairs
- `superagent build circle %block radius %radius` — circle outline (midpoint algorithm)
- `superagent build disc %block radius %radius` — filled round floor

### Blueprint & copy (nested arrays, coordinates)

Build whole structures from text arrays, or copy a region of the world. Great for teaching 2D
and 3D arrays and coordinate math. These use `/setblock`, `/clone` and `/fill ... replace`.

- `superagent build layer %block rows` → number — 2D layer from an array of row strings
  (`X`/`#`/`1` = block, anything else = gap)
- `superagent build blueprint %block rows` → number — 3D build; a row of `-` starts the next layer up
- `superagent build layer %block rows %transform` → number — 2D layer mirrored or rotated (none / mirror X / mirror Z / rotate 180)
- `superagent copy region from %x1 %y1 %z1 to %x2 %y2 %z2` — remember two world corners
- `superagent paste here` — clone the copied region at the character
- `superagent replace %fromBlock with %toBlock width %w height %h depth %d` — swap one block type for another

### Mine (Agent-driven, collects drops)

Mining uses the Agent's own destroy/move/collect so blocks drop into the Agent inventory. The
strip-mine block is a clean nested-loop example.

- `superagent mine forward %length` — dig a 2-high tunnel and collect
- `superagent mine down %depth` — dig straight down and collect
- `superagent strip mine length %l tunnels %t gap %g` — parallel tunnels

### Memory (survives world reloads)

Memory is stored per player in scoreboards, so values persist when the world is closed and
reopened. Because the value comes back as a comparison, students read it with boolean checks or
a small scan. Home is stored on the player and reuses the glide navigation to return.

- `superagent remember %key = %value` — store a number under a key
- `superagent forget %key` — remove a stored key
- `superagent memory %key = %value` → boolean (equals)
- `superagent memory %key >= %value` → boolean (at least)
- `superagent memory %key value up to %max` → number (scans 0..max, `-1` if not found)
- `superagent set home` / `superagent go home` / `superagent clear home`

### Squad (autonomous guards)

- `superagent summon guard` — add an autonomous guard (up to 4) that follows the player in a
  ring and fights nearby hostiles when auto-guard is on
- `superagent dismiss guards` — remove all guards

Guards are managed entirely by the behavior pack: they keep themselves alive, circle the
player, and defend. They are separate from your single programmable character, so commanding
the main character never disturbs the squad.

### Mission / leaderboard (goal-driven coding)

Build classroom challenges with on-screen titles and a persistent score sidebar. Score is a
scoreboard value, so it survives world reloads and can rank a whole class.

- `superagent mission start %title` — announce a title and label the character
- `superagent award %points points` — add to the player's score
- `superagent score up to %max` → number (reads the saved score)
- `superagent mission complete` — celebratory finish
- `superagent show scoreboard` — display the score leaderboard on the sidebar

### Auto status

The character's name tag and a small particle over its head update automatically to show what
it is doing: `idle`, `moving`, or `guard`. Setting a custom `superagent label` overrides this.

### Agent work (inventory & auto-build moves)

These use the Agent's native abilities (Member-safe). Bridge and stair need a block equipped in
the Agent's hotbar first.

- `superagent items in slot %slot` → number
- `superagent slot %slot has at least %amount` → boolean
- `superagent drop items %direction` — drop the whole inventory
- `superagent collect items` — pick up nearby drops
- `superagent bridge forward %steps` — place a block under each step across a gap
- `superagent stair up %steps` — build climbing stairs forward and up

### Teacher controls

Quick classroom commands that affect every character (operator/cheat permission):

- `superagent freeze all` / `superagent unfreeze all` — stop or resume all movement
- `superagent gather all` — bring every nearby character to you
- `superagent reset squad` — dismiss your guards and clear your character's targets, label and home

### Special powers

Hero-style abilities, each handled by the behavior pack's script API.

- `superagent lightning strike` — strike the nearest hostile with lightning
- `superagent force blast radius %r` — knock nearby hostiles away
- `superagent shield player for %s` — give the player resistance + absorption
- `superagent heal player` — heal to full and grant regeneration
- `superagent magnet items radius %r` — pull dropped items to the player
- `superagent blink player to character` — teleport the player to the character
- `superagent summon ally for %s` — summon a temporary iron golem helper

### Basic command set (compose your own behaviour)

Primitive blocks grouped so students can build their own logic, organised as
**Control · Sensing · Thinking · Judging · Communicate**.

- Control: `superagent stop`, `superagent face %direction`
- Sensing: `superagent distance to agent up to %max` → number, `superagent ground below agent` → boolean
- Thinking: `superagent random 1 to %max` → number, `superagent count up %key`, `superagent set flag %key %on`, `superagent flag %key is on` → boolean
- Judging: `superagent should attack within %radius` → boolean, `superagent is safe within %radius` → boolean, `superagent danger close within %radius` → boolean
- Communicate: `superagent report %text` (on-screen message), `superagent meet agent` (pathfind to the Agent)

## Install

Import the add-on bundle:

```sh
node tools/package-superagent-addon.js
```

Then open `dist/superagent-0.1.35.mcaddon` with Minecraft Education and activate both the behavior pack and resource pack in the world. A world owner or teacher must activate the pack first. For the full block set, the world must have Cheats enabled and students should run as Operator in Survival.

Release download:
`https://github.com/numraise/raisesuperagent/releases/download/superagent-0.1.35/superagent-0.1.35.mcaddon`

Auto-guard combat starts **off**. Turn it on from code with the `superagent auto guard on` block (or `/scriptevent superagent:combat on`) when you want the character to fight nearby hostiles automatically. Explicit attack blocks work at any time.

Use this GitHub URL in MakeCode Extensions:

```text
https://github.com/numraise/raisesuperagent
```

For a pinned classroom build, use:

```text
https://github.com/numraise/raisesuperagent#superagent-0.1.35
```

## Test

```sh
node tests/run-superagent-tests.js
node tools/package-superagent-addon.js
```

In-game verification is still required because Minecraft world state, Agent availability, and permissions are runtime conditions.
