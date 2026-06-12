enum SuperagentBurstStyle {
    //% block="ring"
    Ring = 0,
    //% block="vertical"
    Vertical = 1,
    //% block="sphere"
    Sphere = 2
}

enum SuperagentStatus {
    //% block="ready"
    Ready = 0,
    //% block="attack"
    Attack = 1,
    //% block="shield"
    Shield = 2
}

enum SuperagentSmartMode {
    //% block="guard"
    Guard = 0,
    //% block="chase"
    Chase = 1,
    //% block="emergency"
    Emergency = 2
}

enum SuperagentMoveDirection {
    //% block="north"
    North = 0,
    //% block="east"
    East = 1,
    //% block="south"
    South = 2,
    //% block="west"
    West = 3,
    //% block="up"
    Up = 4,
    //% block="down"
    Down = 5
}

enum SuperagentSmartMoveMode {
    //% block="guard"
    Guard = 0,
    //% block="scout"
    Scout = 1,
    //% block="patrol"
    Patrol = 2,
    //% block="orbit"
    Orbit = 3,
    //% block="evade"
    Evade = 4,
    //% block="high ground"
    HighGround = 5,
    //% block="zigzag"
    Zigzag = 6,
    //% block="spiral"
    Spiral = 7
}

enum SuperagentSense {
    //% block="ahead"
    Ahead = 0,
    //% block="behind"
    Behind = 1,
    //% block="left"
    Left = 2,
    //% block="right"
    Right = 3,
    //% block="up"
    Up = 4,
    //% block="down"
    Down = 5
}

enum SuperagentMobType {
    //% block="any hostile"
    AnyHostile = 0,
    //% block="zombie"
    Zombie = 1,
    //% block="skeleton"
    Skeleton = 2,
    //% block="creeper"
    Creeper = 3,
    //% block="spider"
    Spider = 4,
    //% block="player"
    Player = 5
}

enum SuperagentTransform {
    //% block="none"
    None = 0,
    //% block="mirror X"
    MirrorX = 1,
    //% block="mirror Z"
    MirrorZ = 2,
    //% block="rotate 180"
    Rotate180 = 3
}

enum SuperagentBlock {
    //% block="stone"
    Stone = 0,
    //% block="cobblestone"
    Cobblestone = 1,
    //% block="dirt"
    Dirt = 2,
    //% block="oak planks"
    OakPlanks = 3,
    //% block="glass"
    Glass = 4,
    //% block="glowstone"
    Glowstone = 5,
    //% block="sandstone"
    Sandstone = 6,
    //% block="air"
    Air = 7
}

/**
 * Member-safe control blocks for the one-block superagent character.
 */
//% weight=96 color=#5a43b5 icon="\uf21e" block="superagent"
namespace superagent {
    let lastBurstCount = 0
    let followLoopStarted = false
    let followingAgent = false
    let superagentPosition = pos(0, 0, 0)
    let watchLoopStarted = false
    let watching = false
    let watcherKinds: number[] = []
    let watcherParams: number[] = []
    let watcherDirs: number[] = []
    let watcherLast: boolean[] = []
    let watcherHandlers: (() => void)[] = []
    let copyX1 = 0
    let copyY1 = 0
    let copyZ1 = 0
    let copyX2 = 0
    let copyY2 = 0
    let copyZ2 = 0

    function clamp(value: number, min: number, max: number): number {
        if (value < min) {
            return min
        }
        if (value > max) {
            return max
        }
        return value
    }

    function attackDirection(direction: number, hits: number) {
        for (let i = 0; i < hits; i++) {
            agent.attack(direction)
            lastBurstCount++
        }
    }

    function runAtAgent(command: string): boolean {
        return mobs.execute(mobs.target(LOCAL_PLAYER), agent.getPosition(), command)
    }

    function runAtSuperagent(command: string): boolean {
        return mobs.execute(mobs.target(LOCAL_PLAYER), superagentPosition, command)
    }

    function selectSuperagentNear(position, radius: number) {
        let selected = mobs.target(ALL_ENTITIES)
        selected.atCoordinate(position)
        selected.withinRadius(clamp(radius, 1, 256))
        selected.addRule("type", "superagent:superagent")
        return selected
    }

    function teleportCharacterFrom(oldPosition, newPosition) {
        mobs.teleportToPosition(selectSuperagentNear(oldPosition, 256), newPosition)
        mobs.teleportToPosition(selectSuperagentNear(newPosition, 32), newPosition)
    }

    function teleportCharacterTo(position) {
        let oldPosition = superagentPosition
        superagentPosition = position
        teleportCharacterFrom(oldPosition, superagentPosition)
    }

    function setSuperagentPosition(position) {
        teleportCharacterTo(position)
        ensureCharacter()
    }

    function directionOffset(direction: SuperagentMoveDirection, blocks: number) {
        blocks = clamp(blocks, 1, 32)
        if (direction == SuperagentMoveDirection.East) {
            return pos(blocks, 0, 0)
        }
        if (direction == SuperagentMoveDirection.South) {
            return pos(0, 0, blocks)
        }
        if (direction == SuperagentMoveDirection.West) {
            return pos(0 - blocks, 0, 0)
        }
        if (direction == SuperagentMoveDirection.Up) {
            return pos(0, blocks, 0)
        }
        if (direction == SuperagentMoveDirection.Down) {
            return pos(0, 0 - blocks, 0)
        }
        return pos(0, 0, 0 - blocks)
    }

    function ensureCharacter() {
        runAtSuperagent("execute unless entity @e[type=superagent:superagent,r=2] run summon superagent:superagent ~ ~ ~")
        mobs.teleportToPosition(selectSuperagentNear(superagentPosition, 256), superagentPosition)
        runAtSuperagent("effect @e[type=superagent:superagent,r=2,c=1] resistance 10 255 true")
        runAtSuperagent("effect @e[type=superagent:superagent,r=2,c=1] fire_resistance 10 1 true")
        showCharacterPulse()
    }

    function showCharacterPulse() {
        runAtSuperagent("particle superagent:agent_aura ~ ~0.5 ~")
        runAtSuperagent("particle superagent:agent_spark ~ ~1.1 ~")
        runAtSuperagent("particle minecraft:basic_flame_particle ~0.65 ~0.2 ~")
        runAtSuperagent("particle minecraft:basic_flame_particle ~-0.65 ~0.2 ~")
        runAtSuperagent("particle minecraft:basic_flame_particle ~ ~0.2 ~0.65")
        runAtSuperagent("particle minecraft:basic_flame_particle ~ ~0.2 ~-0.65")
    }

    function ensureFollowLoop() {
        if (followLoopStarted) {
            return
        }
        followLoopStarted = true
        loops.forever(function () {
            if (followingAgent) {
                superagentPosition = agent.getPosition()
                ensureCharacter()
                attackCommandBurst(2)
            }
            loops.pause(300)
        })
    }

    function syncAddonMob() {
        runAtAgent("kill @e[type=minecraft:armor_stand,name=superagent,r=64]")
        runAtAgent("kill @e[type=minecraft:armor_stand,name=superaagent,r=64]")
        setSuperagentPosition(agent.getPosition())
    }

    function auraPulseCommands() {
        showCharacterPulse()
        runAtSuperagent("particle minecraft:totem_particle ~ ~1.25 ~")
        runAtSuperagent("particle minecraft:villager_happy ~ ~1.6 ~")
    }

    function attackCommandBurst(strength: number) {
        let damage = 8 + strength * 3
        runAtSuperagent("particle superagent:attack_burst ~ ~0.8 ~")
        runAtSuperagent("particle minecraft:critical_hit_emitter ~ ~1 ~")
        runAtSuperagent("effect @e[family=monster,r=8] slowness 3 1 false")
        runAtSuperagent("effect @e[family=monster,r=8] weakness 3 0 false")
        runAtSuperagent("damage @e[family=monster,r=8] " + damage + " entity_attack")
    }

    function ensureAuraLoop() {
        ensureFollowLoop()
    }

    function smartMoveStep(mode: SuperagentSmartMoveMode, step: number, strength: number) {
        if (mode == SuperagentSmartMoveMode.Scout) {
            moveCharacter(SuperagentMoveDirection.North, 1)
        } else if (mode == SuperagentSmartMoveMode.Patrol) {
            patrolStep(4, step)
        } else if (mode == SuperagentSmartMoveMode.Orbit) {
            orbitStep(3 + strength, step)
        } else if (mode == SuperagentSmartMoveMode.Evade) {
            moveCharacter(step % 2 == 0 ? SuperagentMoveDirection.West : SuperagentMoveDirection.East, strength)
        } else if (mode == SuperagentSmartMoveMode.HighGround) {
            moveCharacter(SuperagentMoveDirection.Up, 1)
        } else if (mode == SuperagentSmartMoveMode.Zigzag) {
            moveCharacter(SuperagentMoveDirection.North, 1)
            moveCharacter(step % 2 == 0 ? SuperagentMoveDirection.East : SuperagentMoveDirection.West, 1)
        } else if (mode == SuperagentSmartMoveMode.Spiral) {
            spiralSearch(1 + strength, 1)
        } else {
            showCharacterPulse()
        }
        attackFromCharacter(6, strength)
    }

    function patrolStep(side: number, step: number) {
        let phase = step % 4
        if (phase == 0) {
            moveCharacter(SuperagentMoveDirection.East, side)
        } else if (phase == 1) {
            moveCharacter(SuperagentMoveDirection.South, side)
        } else if (phase == 2) {
            moveCharacter(SuperagentMoveDirection.West, side)
        } else {
            moveCharacter(SuperagentMoveDirection.North, side)
        }
    }

    function orbitStep(radius: number, step: number) {
        radius = clamp(radius, 1, 16)
        let center = agent.getPosition()
        let phase = step % 8
        let target = center
        if (phase == 0) {
            target = positions.add(center, pos(radius, 0, 0))
        } else if (phase == 1) {
            target = positions.add(center, pos(radius, 0, radius))
        } else if (phase == 2) {
            target = positions.add(center, pos(0, 0, radius))
        } else if (phase == 3) {
            target = positions.add(center, pos(0 - radius, 0, radius))
        } else if (phase == 4) {
            target = positions.add(center, pos(0 - radius, 0, 0))
        } else if (phase == 5) {
            target = positions.add(center, pos(0 - radius, 0, 0 - radius))
        } else if (phase == 6) {
            target = positions.add(center, pos(0, 0, 0 - radius))
        } else {
            target = positions.add(center, pos(radius, 0, 0 - radius))
        }
        setSuperagentPosition(target)
    }

    function smartRing(strength: number, includeVertical: boolean, emergency: boolean) {
        attackDirection(FORWARD, strength + 1)
        attackDirection(RIGHT, strength)
        attackDirection(LEFT, strength)
        if (emergency) {
            attackDirection(BACK, strength)
        } else {
            attackDirection(BACK, 1)
        }
        if (includeVertical) {
            attackDirection(UP, strength)
            attackDirection(DOWN, strength)
        }
    }

    function showRingPulse() {
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Right)
    }

    function showVerticalPulse() {
        agent.move(UP, 1)
        agent.move(DOWN, 1)
    }

    function showShieldPulse() {
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Right)
    }

    function pulse(style: SuperagentBurstStyle) {
        ensureAuraLoop()
        ensureCharacter()
        auraPulseCommands()
        if (style == SuperagentBurstStyle.Vertical) {
            showVerticalPulse()
            return
        }
        if (style == SuperagentBurstStyle.Sphere) {
            showRingPulse()
            showVerticalPulse()
            return
        }
        showRingPulse()
    }

    /**
     * Get the number of Agent attacks performed by the last superagent burst.
     */
    //% blockId=superagent_last_burst_count block="superagent last burst count"
    //% group="Status"
    export function reportLastBurstCount(): number {
        return lastBurstCount
    }

    /**
     * Show a status label above the superagent character.
     */
    //% blockId=superagent_set_label block="superagent label %text"
    //% group="Status"
    export function setLabel(text: string) {
        ensureCharacter()
        runAtAgent("scriptevent superagent:label " + text)
    }

    /**
     * Turn the automatic guard (teacher-controlled combat) on or off.
     */
    //% blockId=superagent_auto_guard block="superagent auto guard %on"
    //% group="Combat"
    export function autoGuard(on: boolean) {
        runAtAgent("scriptevent superagent:combat " + (on ? "on" : "off"))
    }

    /**
     * Show a small Agent status gesture that does not require commands.
     */
    //% blockId=superagent_show_status block="superagent show %status"
    //% group="Status"
    export function showStatus(status: SuperagentStatus) {
        lastBurstCount = 0
        ensureAuraLoop()
        ensureCharacter()
        auraPulseCommands()
        if (status == SuperagentStatus.Attack) {
            showRingPulse()
            return
        }
        if (status == SuperagentStatus.Shield) {
            showShieldPulse()
            return
        }
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Left)
    }

    /**
     * Make the Agent perform a superagent-style area attack around itself.
     */
    //% blockId=superagent_attack_aura block="superagent attack aura rounds %rounds hits %hits style %style"
    //% rounds.min=1 rounds.max=32 hits.min=1 hits.max=8
    //% group="Combat"
    export function attackAura(rounds: number, hits: number, style: SuperagentBurstStyle) {
        lastBurstCount = 0
        ensureAuraLoop()
        rounds = clamp(rounds, 1, 32)
        hits = clamp(hits, 1, 8)
        for (let i = 0; i < rounds; i++) {
            ensureCharacter()
            auraPulseCommands()
            attackDirection(FORWARD, hits)
            attackDirection(RIGHT, hits)
            attackDirection(BACK, hits)
            attackDirection(LEFT, hits)
            if (style == SuperagentBurstStyle.Vertical || style == SuperagentBurstStyle.Sphere) {
                attackDirection(UP, hits)
                attackDirection(DOWN, hits)
            }
            attackCommandBurst(hits)
            pulse(style)
        }
    }

    /**
     * Keep guarding the Agent's space with repeated horizontal bursts.
     */
    //% blockId=superagent_guard_agent block="superagent guard agent rounds %rounds hits %hits"
    //% rounds.min=1 rounds.max=64 hits.min=1 hits.max=8
    //% group="Combat"
    export function guardAgent(rounds: number, hits: number) {
        attackAura(rounds, hits, SuperagentBurstStyle.Ring)
    }

    /**
     * Perform a full six-direction burst and collect any nearby drops.
     */
    //% blockId=superagent_power_burst block="superagent power burst rounds %rounds hits %hits"
    //% rounds.min=1 rounds.max=32 hits.min=1 hits.max=8
    //% group="Combat"
    export function powerBurst(rounds: number, hits: number) {
        attackAura(rounds, hits, SuperagentBurstStyle.Sphere)
        agent.collectAll()
    }

    /**
     * Sweep threats with a smarter pattern that prioritizes the front, sides, then vertical danger when needed.
     */
    //% blockId=superagent_smart_sweep block="superagent smart sweep rounds %rounds strength %strength mode %mode"
    //% rounds.min=1 rounds.max=16 strength.min=1 strength.max=5
    //% group="Combat"
    export function smartSweep(rounds: number, strength: number, mode: SuperagentSmartMode) {
        lastBurstCount = 0
        ensureAuraLoop()
        rounds = clamp(rounds, 1, 16)
        strength = clamp(strength, 1, 5)
        for (let i = 0; i < rounds; i++) {
            ensureCharacter()
            auraPulseCommands()
            if (mode == SuperagentSmartMode.Emergency) {
                smartRing(strength + 1, true, true)
                showShieldPulse()
            } else if (mode == SuperagentSmartMode.Chase) {
                attackDirection(FORWARD, strength + 2)
                smartRing(strength, false, false)
                showRingPulse()
            } else {
                smartRing(strength, true, false)
                showShieldPulse()
            }
            attackCommandBurst(strength)
        }
    }

    /**
     * Use the strongest member-safe superagent attack pattern and collect nearby drops.
     */
    //% blockId=superagent_overdrive block="superagent overdrive rounds %rounds strength %strength"
    //% rounds.min=1 rounds.max=16 strength.min=1 strength.max=5
    //% group="Combat"
    export function overdrive(rounds: number, strength: number) {
        smartSweep(rounds, strength, SuperagentSmartMode.Emergency)
        agent.collectAll()
    }

    /**
     * Start and refresh the visible superagent aura at the Agent's current position.
     */
    //% blockId=superagent_keep_aura_on block="superagent keep aura on"
    //% group="Status"
    export function keepAuraOn() {
        ensureAuraLoop()
        syncAddonMob()
        auraPulseCommands()
    }

    /**
     * Spawn the visible one-block superagent character at the Agent.
     */
    //% blockId=superagent_spawn_at_agent block="superagent spawn at agent"
    //% group="Control"
    export function spawnAtAgent() {
        followingAgent = false
        setSuperagentPosition(agent.getPosition())
    }

    /**
     * Recall the visible superagent character back to the Agent.
     */
    //% blockId=superagent_recall_to_agent block="superagent recall to agent"
    //% group="Control"
    export function recallToAgent() {
        setSuperagentPosition(agent.getPosition())
    }

    /**
     * Move the visible superagent character on the world grid.
     */
    //% blockId=superagent_move_character block="superagent move %direction blocks %blocks"
    //% blocks.min=1 blocks.max=32
    //% group="Control"
    export function moveCharacter(direction: SuperagentMoveDirection, blocks: number) {
        followingAgent = false
        setSuperagentPosition(positions.add(superagentPosition, directionOffset(direction, blocks)))
    }

    /**
     * Keep the visible superagent character following the Agent.
     */
    //% blockId=superagent_follow_agent_on block="superagent follow agent on"
    //% group="Control"
    export function followAgentOn() {
        followingAgent = true
        ensureFollowLoop()
        recallToAgent()
    }

    /**
     * Stop automatic follow mode for the visible superagent character.
     */
    //% blockId=superagent_follow_agent_off block="superagent follow agent off"
    //% group="Control"
    export function followAgentOff() {
        followingAgent = false
        showCharacterPulse()
    }

    /**
     * Attack hostile mobs around the visible superagent character.
     */
    //% blockId=superagent_attack_from_character block="superagent attack from character radius %radius strength %strength"
    //% radius.min=1 radius.max=16 strength.min=1 strength.max=8
    //% group="Combat"
    export function attackFromCharacter(radius: number, strength: number) {
        radius = clamp(radius, 1, 16)
        strength = clamp(strength, 1, 8)
        let damage = 8 + strength * 3
        ensureCharacter()
        runAtSuperagent("particle superagent:attack_burst ~ ~0.8 ~")
        runAtSuperagent("particle minecraft:critical_hit_emitter ~ ~1 ~")
        runAtSuperagent("effect @e[family=monster,r=" + radius + "] slowness 3 1 false")
        runAtSuperagent("effect @e[family=monster,r=" + radius + "] weakness 3 0 false")
        runAtSuperagent("damage @e[family=monster,r=" + radius + "] " + damage + " entity_attack")
    }

    /**
     * Dash the visible superagent character quickly in one direction.
     */
    //% blockId=superagent_dash block="superagent dash %direction blocks %blocks"
    //% blocks.min=1 blocks.max=32
    //% group="Smart Move"
    export function dash(direction: SuperagentMoveDirection, blocks: number) {
        followingAgent = false
        blocks = clamp(blocks, 1, 32)
        for (let i = 0; i < blocks; i++) {
            moveCharacter(direction, 1)
        }
        attackFromCharacter(6, 2)
    }

    /**
     * Scout in a straight line while pulsing and attacking nearby threats.
     */
    //% blockId=superagent_scout_line block="superagent scout %direction steps %steps"
    //% steps.min=1 steps.max=32
    //% group="Smart Move"
    export function scoutLine(direction: SuperagentMoveDirection, steps: number) {
        followingAgent = false
        steps = clamp(steps, 1, 32)
        for (let i = 0; i < steps; i++) {
            moveCharacter(direction, 1)
            attackFromCharacter(5, 2)
        }
    }

    /**
     * Patrol a square path around the current superagent position.
     */
    //% blockId=superagent_patrol_square block="superagent patrol square side %side rounds %rounds"
    //% side.min=1 side.max=16 rounds.min=1 rounds.max=8
    //% group="Smart Move"
    export function patrolSquare(side: number, rounds: number) {
        followingAgent = false
        side = clamp(side, 1, 16)
        rounds = clamp(rounds, 1, 8)
        for (let round = 0; round < rounds; round++) {
            for (let phase = 0; phase < 4; phase++) {
                patrolStep(side, phase)
                attackFromCharacter(6, 2)
            }
        }
    }

    /**
     * Orbit around the Agent while attacking from the superagent position.
     */
    //% blockId=superagent_orbit_agent block="superagent orbit agent radius %radius steps %steps"
    //% radius.min=1 radius.max=16 steps.min=1 steps.max=32
    //% group="Smart Move"
    export function orbitAgent(radius: number, steps: number) {
        followingAgent = false
        radius = clamp(radius, 1, 16)
        steps = clamp(steps, 1, 32)
        for (let i = 0; i < steps; i++) {
            orbitStep(radius, i)
            attackFromCharacter(7, 3)
        }
    }

    /**
     * Evade to the Agent's side and counterattack.
     */
    //% blockId=superagent_evade_to_agent_side block="superagent evade to agent side distance %distance"
    //% distance.min=1 distance.max=16
    //% group="Smart Move"
    export function evadeToAgentSide(distance: number) {
        followingAgent = false
        distance = clamp(distance, 1, 16)
        setSuperagentPosition(positions.add(agent.getPosition(), pos(distance, 0, distance)))
        attackFromCharacter(8, 3)
    }

    /**
     * Move the superagent upward for a high-ground guard position.
     */
    //% blockId=superagent_high_ground block="superagent high ground blocks %blocks"
    //% blocks.min=1 blocks.max=16
    //% group="Smart Move"
    export function highGround(blocks: number) {
        followingAgent = false
        blocks = clamp(blocks, 1, 16)
        moveCharacter(SuperagentMoveDirection.Up, blocks)
        attackFromCharacter(8, 3)
    }

    /**
     * Advance with alternating side steps to cover more area.
     */
    //% blockId=superagent_zigzag block="superagent zigzag %direction steps %steps"
    //% steps.min=1 steps.max=32
    //% group="Smart Move"
    export function zigzag(direction: SuperagentMoveDirection, steps: number) {
        followingAgent = false
        steps = clamp(steps, 1, 32)
        for (let i = 0; i < steps; i++) {
            moveCharacter(direction, 1)
            moveCharacter(i % 2 == 0 ? SuperagentMoveDirection.East : SuperagentMoveDirection.West, 1)
            attackFromCharacter(5, 2)
        }
    }

    /**
     * Search outward in a spiral from the current superagent position.
     */
    //% blockId=superagent_spiral_search block="superagent spiral search radius %radius rounds %rounds"
    //% radius.min=1 radius.max=8 rounds.min=1 rounds.max=8
    //% group="Smart Move"
    export function spiralSearch(radius: number, rounds: number) {
        followingAgent = false
        radius = clamp(radius, 1, 8)
        rounds = clamp(rounds, 1, 8)
        for (let round = 1; round <= rounds; round++) {
            moveCharacter(SuperagentMoveDirection.East, radius * round)
            moveCharacter(SuperagentMoveDirection.South, radius * round)
            moveCharacter(SuperagentMoveDirection.West, radius * round + 1)
            moveCharacter(SuperagentMoveDirection.North, radius * round + 1)
            attackFromCharacter(6, 2)
        }
    }

    /**
     * Choose a smart movement pattern and attack from the superagent character.
     */
    //% blockId=superagent_smart_move block="superagent smart move %mode steps %steps strength %strength"
    //% steps.min=1 steps.max=32 strength.min=1 strength.max=8
    //% group="Smart Move"
    export function smartMove(mode: SuperagentSmartMoveMode, steps: number, strength: number) {
        followingAgent = false
        steps = clamp(steps, 1, 32)
        strength = clamp(strength, 1, 8)
        for (let i = 0; i < steps; i++) {
            smartMoveStep(mode, i, strength)
        }
    }

    function senseDirection(direction: SuperagentSense): number {
        if (direction == SuperagentSense.Ahead) {
            return FORWARD
        }
        if (direction == SuperagentSense.Behind) {
            return BACK
        }
        if (direction == SuperagentSense.Left) {
            return LEFT
        }
        if (direction == SuperagentSense.Right) {
            return RIGHT
        }
        if (direction == SuperagentSense.Up) {
            return UP
        }
        return DOWN
    }

    function senseMoveDirection(direction: SuperagentSense): SuperagentMoveDirection {
        if (direction == SuperagentSense.Ahead) {
            return SuperagentMoveDirection.North
        }
        if (direction == SuperagentSense.Behind) {
            return SuperagentMoveDirection.South
        }
        if (direction == SuperagentSense.Left) {
            return SuperagentMoveDirection.West
        }
        if (direction == SuperagentSense.Right) {
            return SuperagentMoveDirection.East
        }
        if (direction == SuperagentSense.Up) {
            return SuperagentMoveDirection.Up
        }
        return SuperagentMoveDirection.Down
    }

    function senseOffset(direction: SuperagentSense): string {
        if (direction == SuperagentSense.Ahead) {
            return "~ ~ ~-1"
        }
        if (direction == SuperagentSense.Behind) {
            return "~ ~ ~1"
        }
        if (direction == SuperagentSense.Left) {
            return "~-1 ~ ~"
        }
        if (direction == SuperagentSense.Right) {
            return "~1 ~ ~"
        }
        if (direction == SuperagentSense.Up) {
            return "~ ~1 ~"
        }
        return "~ ~-1 ~"
    }

    function mobSelector(mob: SuperagentMobType): string {
        if (mob == SuperagentMobType.Zombie) {
            return "type=zombie"
        }
        if (mob == SuperagentMobType.Skeleton) {
            return "type=skeleton"
        }
        if (mob == SuperagentMobType.Creeper) {
            return "type=creeper"
        }
        if (mob == SuperagentMobType.Spider) {
            return "type=spider"
        }
        if (mob == SuperagentMobType.Player) {
            return "type=player"
        }
        return "family=monster"
    }

    /**
     * True when a mob of the chosen kind is within range of the superagent character.
     */
    //% blockId=superagent_sense_mob block="superagent sense %mob within %radius blocks"
    //% radius.min=1 radius.max=32
    //% group="Sensing"
    export function senseMob(mob: SuperagentMobType, radius: number): boolean {
        radius = clamp(radius, 1, 32)
        ensureCharacter()
        return runAtSuperagent("testfor @e[" + mobSelector(mob) + ",r=" + radius + "]")
    }

    /**
     * True when any hostile mob is within range of the superagent character.
     */
    //% blockId=superagent_sense_hostiles block="superagent hostiles within %radius blocks"
    //% radius.min=1 radius.max=32
    //% group="Sensing"
    export function senseHostiles(radius: number): boolean {
        return senseMob(SuperagentMobType.AnyHostile, radius)
    }

    /**
     * Distance in blocks to the nearest hostile, or -1 when none is found within range.
     */
    //% blockId=superagent_nearest_hostile block="superagent nearest hostile distance up to %maxRadius"
    //% maxRadius.min=1 maxRadius.max=32
    //% group="Sensing"
    export function nearestHostileDistance(maxRadius: number): number {
        maxRadius = clamp(maxRadius, 1, 32)
        ensureCharacter()
        for (let r = 1; r <= maxRadius; r++) {
            if (runAtSuperagent("testfor @e[family=monster,r=" + r + "]")) {
                return r
            }
        }
        return -1
    }

    /**
     * True when the Agent senses a block in the chosen direction (Agent-relative).
     */
    //% blockId=superagent_detect_block block="superagent block %direction of agent"
    //% group="Sensing"
    export function detectBlock(direction: SuperagentSense): boolean {
        return agent.detect(AgentDetection.Block, senseDirection(direction))
    }

    /**
     * True when the space next to the superagent character in that direction is air.
     */
    //% blockId=superagent_path_clear block="superagent path clear %direction of character"
    //% group="Sensing"
    export function pathClear(direction: SuperagentSense): boolean {
        ensureCharacter()
        return runAtSuperagent("testforblock " + senseOffset(direction) + " air")
    }

    function axisOffset(direction: SuperagentSense, distance: number): string {
        if (direction == SuperagentSense.Ahead) {
            return "~ ~ ~-" + distance
        }
        if (direction == SuperagentSense.Behind) {
            return "~ ~ ~" + distance
        }
        if (direction == SuperagentSense.Left) {
            return "~-" + distance + " ~ ~"
        }
        if (direction == SuperagentSense.Right) {
            return "~" + distance + " ~ ~"
        }
        if (direction == SuperagentSense.Up) {
            return "~ ~" + distance + " ~"
        }
        return "~ ~-" + distance + " ~"
    }

    function blockAt(direction: SuperagentSense, distance: number, id: string): boolean {
        return runAtSuperagent("testforblock " + axisOffset(direction, distance) + " " + id)
    }

    /**
     * Distance to the nearest matching block along the 6 axes, or -1 if none.
     */
    //% blockId=superagent_nearest_block_distance block="superagent nearest %block distance up to %maxRadius"
    //% maxRadius.min=1 maxRadius.max=32
    //% group="Sensing"
    export function nearestBlockDistance(block: SuperagentBlock, maxRadius: number): number {
        maxRadius = clamp(maxRadius, 1, 32)
        ensureCharacter()
        let id = blockId(block)
        for (let r = 1; r <= maxRadius; r++) {
            for (let d = 0; d <= 5; d++) {
                if (blockAt(d, r, id)) {
                    return r
                }
            }
        }
        return -1
    }

    /**
     * Direction (0=ahead..5=down) to the nearest matching block, or -1 if none.
     */
    //% blockId=superagent_nearest_block_direction block="superagent nearest %block direction up to %maxRadius"
    //% maxRadius.min=1 maxRadius.max=32
    //% group="Sensing"
    export function nearestBlockDirection(block: SuperagentBlock, maxRadius: number): number {
        maxRadius = clamp(maxRadius, 1, 32)
        ensureCharacter()
        let id = blockId(block)
        for (let r = 1; r <= maxRadius; r++) {
            for (let d = 0; d <= 5; d++) {
                if (blockAt(d, r, id)) {
                    return d
                }
            }
        }
        return -1
    }

    /**
     * Attack only when a hostile is sensed. Returns true if the character acted.
     */
    //% blockId=superagent_defend_if_threatened block="superagent defend if hostiles within %radius strength %strength"
    //% radius.min=1 radius.max=16 strength.min=1 strength.max=8
    //% group="Reactive"
    export function defendIfThreatened(radius: number, strength: number): boolean {
        radius = clamp(radius, 1, 16)
        strength = clamp(strength, 1, 8)
        if (senseHostiles(radius)) {
            attackFromCharacter(radius, strength)
            return true
        }
        return false
    }

    /**
     * Move the character forward until a block blocks it. Returns how many blocks it moved.
     */
    //% blockId=superagent_advance_until_blocked block="superagent advance %direction up to %maxSteps blocks"
    //% maxSteps.min=1 maxSteps.max=32
    //% group="Reactive"
    export function advanceUntilBlocked(direction: SuperagentSense, maxSteps: number): number {
        followingAgent = false
        maxSteps = clamp(maxSteps, 1, 32)
        let moved = 0
        for (let i = 0; i < maxSteps; i++) {
            if (!pathClear(direction)) {
                break
            }
            moveCharacter(senseMoveDirection(direction), 1)
            moved++
        }
        return moved
    }

    function evaluateWatcher(index: number): boolean {
        let kind = watcherKinds[index]
        if (kind == 0) {
            return senseHostiles(watcherParams[index])
        }
        if (kind == 1) {
            return !senseHostiles(watcherParams[index])
        }
        return !pathClear(watcherDirs[index])
    }

    function pollWatchers() {
        for (let i = 0; i < watcherKinds.length; i++) {
            let current = evaluateWatcher(i)
            if (current && !watcherLast[i]) {
                watcherHandlers[i]()
            }
            watcherLast[i] = current
        }
    }

    function ensureWatchLoop() {
        if (watchLoopStarted) {
            return
        }
        watchLoopStarted = true
        loops.forever(function () {
            if (watching) {
                pollWatchers()
            }
            loops.pause(250)
        })
    }

    function registerWatcher(kind: number, param: number, direction: number, handler: () => void) {
        watcherKinds.push(kind)
        watcherParams.push(param)
        watcherDirs.push(direction)
        watcherLast.push(false)
        watcherHandlers.push(handler)
        watching = true
        ensureWatchLoop()
    }

    /**
     * Run code once each time a hostile mob enters the radius (rising edge).
     */
    //% blockId=superagent_on_hostile block="on superagent hostile within %radius blocks"
    //% radius.min=1 radius.max=32
    //% group="Events"
    export function onHostileNear(radius: number, handler: () => void) {
        registerWatcher(0, clamp(radius, 1, 32), 0, handler)
    }

    /**
     * Run code once each time the area around the character becomes clear of hostiles.
     */
    //% blockId=superagent_on_area_clear block="on superagent area clear within %radius blocks"
    //% radius.min=1 radius.max=32
    //% group="Events"
    export function onAreaClear(radius: number, handler: () => void) {
        registerWatcher(1, clamp(radius, 1, 32), 0, handler)
    }

    /**
     * Run code once each time the path in that direction becomes blocked.
     */
    //% blockId=superagent_on_path_blocked block="on superagent path blocked %direction"
    //% group="Events"
    export function onPathBlocked(direction: SuperagentSense, handler: () => void) {
        registerWatcher(2, 0, direction, handler)
    }

    /**
     * Start the background event watcher loop.
     */
    //% blockId=superagent_watch_on block="superagent watch on"
    //% group="Events"
    export function watchOn() {
        watching = true
        ensureWatchLoop()
    }

    /**
     * Pause the background event watcher loop without losing registered events.
     */
    //% blockId=superagent_watch_off block="superagent watch off"
    //% group="Events"
    export function watchOff() {
        watching = false
    }

    /**
     * Check all registered events once right now (useful inside your own loop).
     */
    //% blockId=superagent_check_events block="superagent check events"
    //% group="Events"
    export function checkEvents() {
        pollWatchers()
    }

    /**
     * Smoothly walk (glide) the character to a world position.
     */
    //% blockId=superagent_walk_to block="superagent walk to x %x y %y z %z"
    //% group="Navigation"
    export function walkTo(x: number, y: number, z: number) {
        followingAgent = false
        ensureCharacter()
        runAtAgent("scriptevent superagent:goto " + x + " " + y + " " + z)
    }

    /**
     * Smoothly walk the character to the Agent's current position once.
     */
    //% blockId=superagent_walk_to_agent block="superagent walk to agent"
    //% group="Navigation"
    export function walkToAgent() {
        followingAgent = false
        ensureCharacter()
        runAtAgent("scriptevent superagent:gotoagent")
    }

    /**
     * Keep the character smoothly walking after the Agent.
     */
    //% blockId=superagent_follow_walk block="superagent follow walk %on"
    //% group="Navigation"
    export function followWalk(on: boolean) {
        followingAgent = false
        ensureCharacter()
        runAtAgent("scriptevent superagent:followwalk " + (on ? "on" : "off"))
    }

    /**
     * Stop any walking and clear the current walk target.
     */
    //% blockId=superagent_walk_stop block="superagent walk stop"
    //% group="Navigation"
    export function walkStop() {
        runAtAgent("scriptevent superagent:stop")
    }

    /**
     * True when the character has reached (is within 2 blocks of) a world position.
     */
    //% blockId=superagent_reached block="superagent reached x %x y %y z %z"
    //% group="Navigation"
    export function reached(x: number, y: number, z: number): boolean {
        return runAtAgent("testfor @e[type=superagent:superagent,x=" + x + ",y=" + y + ",z=" + z + ",r=2]")
    }

    /**
     * Pathfind (A*) the character to a world position, routing around obstacles.
     */
    //% blockId=superagent_path_to block="superagent path to x %x y %y z %z"
    //% group="Navigation"
    export function pathTo(x: number, y: number, z: number) {
        followingAgent = false
        ensureCharacter()
        runAtAgent("scriptevent superagent:pathto " + x + " " + y + " " + z)
    }

    /**
     * Pathfind (A*) the character to the Agent, routing around obstacles.
     */
    //% blockId=superagent_path_to_agent block="superagent path to agent"
    //% group="Navigation"
    export function pathToAgent() {
        followingAgent = false
        ensureCharacter()
        runAtAgent("scriptevent superagent:pathtoagent")
    }

    function blockId(block: SuperagentBlock): string {
        if (block == SuperagentBlock.Cobblestone) {
            return "cobblestone"
        }
        if (block == SuperagentBlock.Dirt) {
            return "dirt"
        }
        if (block == SuperagentBlock.OakPlanks) {
            return "oak_planks"
        }
        if (block == SuperagentBlock.Glass) {
            return "glass"
        }
        if (block == SuperagentBlock.Glowstone) {
            return "glowstone"
        }
        if (block == SuperagentBlock.Sandstone) {
            return "sandstone"
        }
        if (block == SuperagentBlock.Air) {
            return "air"
        }
        return "stone"
    }

    /**
     * Fill a solid box of blocks starting at the character corner.
     */
    //% blockId=superagent_build_box block="superagent build box %block width %width height %height depth %depth"
    //% width.min=1 width.max=16 height.min=1 height.max=16 depth.min=1 depth.max=16
    //% group="Build"
    export function buildBox(block: SuperagentBlock, width: number, height: number, depth: number) {
        width = clamp(width, 1, 16)
        height = clamp(height, 1, 16)
        depth = clamp(depth, 1, 16)
        ensureCharacter()
        runAtSuperagent("fill ~ ~ ~ ~" + (width - 1) + " ~" + (height - 1) + " ~" + (depth - 1) + " " + blockId(block))
    }

    /**
     * Build a box with only the outer walls, hollow inside.
     */
    //% blockId=superagent_build_hollow_box block="superagent build hollow box %block width %width height %height depth %depth"
    //% width.min=1 width.max=16 height.min=1 height.max=16 depth.min=1 depth.max=16
    //% group="Build"
    export function buildHollowBox(block: SuperagentBlock, width: number, height: number, depth: number) {
        width = clamp(width, 1, 16)
        height = clamp(height, 1, 16)
        depth = clamp(depth, 1, 16)
        ensureCharacter()
        runAtSuperagent("fill ~ ~ ~ ~" + (width - 1) + " ~" + (height - 1) + " ~" + (depth - 1) + " " + blockId(block) + " hollow")
    }

    /**
     * Build a flat floor of blocks starting at the character corner.
     */
    //% blockId=superagent_build_floor block="superagent build floor %block width %width depth %depth"
    //% width.min=1 width.max=16 depth.min=1 depth.max=16
    //% group="Build"
    export function buildFloor(block: SuperagentBlock, width: number, depth: number) {
        width = clamp(width, 1, 16)
        depth = clamp(depth, 1, 16)
        ensureCharacter()
        runAtSuperagent("fill ~ ~ ~ ~" + (width - 1) + " ~ ~" + (depth - 1) + " " + blockId(block))
    }

    /**
     * Build a wall going east and up from the character.
     */
    //% blockId=superagent_build_wall block="superagent build wall %block length %length height %height"
    //% length.min=1 length.max=16 height.min=1 height.max=16
    //% group="Build"
    export function buildWall(block: SuperagentBlock, length: number, height: number) {
        length = clamp(length, 1, 16)
        height = clamp(height, 1, 16)
        ensureCharacter()
        runAtSuperagent("fill ~ ~ ~ ~" + (length - 1) + " ~" + (height - 1) + " ~ " + blockId(block))
    }

    /**
     * Build a single column of blocks upward from the character.
     */
    //% blockId=superagent_build_pillar block="superagent build pillar %block height %height"
    //% height.min=1 height.max=32
    //% group="Build"
    export function buildPillar(block: SuperagentBlock, height: number) {
        height = clamp(height, 1, 32)
        ensureCharacter()
        runAtSuperagent("fill ~ ~ ~ ~ ~" + (height - 1) + " ~ " + blockId(block))
    }

    /**
     * Build a row from a text pattern: a block for each X, # or 1, a gap otherwise.
     * Returns how many blocks were placed.
     */
    //% blockId=superagent_build_pattern block="superagent build row %block pattern %pattern"
    //% group="Build"
    export function buildRowPattern(block: SuperagentBlock, pattern: string): number {
        ensureCharacter()
        let placed = 0
        for (let i = 0; i < pattern.length; i++) {
            let cell = pattern.charAt(i)
            if (cell == "X" || cell == "x" || cell == "#" || cell == "1") {
                runAtSuperagent("setblock ~" + i + " ~ ~ " + blockId(block))
                placed++
            }
        }
        return placed
    }

    /**
     * Clear a box of space to air starting at the character corner.
     */
    //% blockId=superagent_clear_area block="superagent clear area width %width height %height depth %depth"
    //% width.min=1 width.max=16 height.min=1 height.max=16 depth.min=1 depth.max=16
    //% group="Build"
    export function clearArea(width: number, height: number, depth: number) {
        buildBox(SuperagentBlock.Air, width, height, depth)
    }

    /**
     * Build a stepped pyramid that shrinks each layer going up.
     */
    //% blockId=superagent_build_pyramid block="superagent build pyramid %block size %size"
    //% size.min=1 size.max=16
    //% group="Build"
    export function buildPyramid(block: SuperagentBlock, size: number) {
        size = clamp(size, 1, 16)
        ensureCharacter()
        let id = blockId(block)
        for (let y = 0; y < size; y++) {
            runAtSuperagent("fill ~" + y + " ~" + y + " ~" + y + " ~" + (size - 1 - y) + " ~" + y + " ~" + (size - 1 - y) + " " + id)
        }
    }

    /**
     * Build a diagonal staircase going up and east.
     */
    //% blockId=superagent_build_staircase block="superagent build staircase %block steps %steps"
    //% steps.min=1 steps.max=32
    //% group="Build"
    export function buildStaircase(block: SuperagentBlock, steps: number) {
        steps = clamp(steps, 1, 32)
        ensureCharacter()
        let id = blockId(block)
        for (let i = 0; i < steps; i++) {
            runAtSuperagent("setblock ~" + i + " ~" + i + " ~ " + id)
        }
    }

    function plotBlock(dx: number, dz: number, id: string) {
        runAtSuperagent("setblock ~" + dx + " ~ ~" + dz + " " + id)
    }

    /**
     * Build a circle outline on the ground using the midpoint algorithm.
     */
    //% blockId=superagent_build_circle block="superagent build circle %block radius %radius"
    //% radius.min=1 radius.max=16
    //% group="Build"
    export function buildCircle(block: SuperagentBlock, radius: number) {
        radius = clamp(radius, 1, 16)
        ensureCharacter()
        let id = blockId(block)
        let x = radius
        let z = 0
        let err = 1 - radius
        while (x >= z) {
            plotBlock(x, z, id)
            plotBlock(0 - x, z, id)
            plotBlock(x, 0 - z, id)
            plotBlock(0 - x, 0 - z, id)
            plotBlock(z, x, id)
            plotBlock(0 - z, x, id)
            plotBlock(z, 0 - x, id)
            plotBlock(0 - z, 0 - x, id)
            z++
            if (err < 0) {
                err += 2 * z + 1
            } else {
                x--
                err += 2 * (z - x) + 1
            }
        }
    }

    /**
     * Build a filled disc (round floor) on the ground.
     */
    //% blockId=superagent_build_disc block="superagent build disc %block radius %radius"
    //% radius.min=1 radius.max=16
    //% group="Build"
    export function buildDisc(block: SuperagentBlock, radius: number) {
        radius = clamp(radius, 1, 16)
        ensureCharacter()
        let id = blockId(block)
        for (let x = 0 - radius; x <= radius; x++) {
            let zmax = Math.floor(Math.sqrt(radius * radius - x * x))
            runAtSuperagent("fill ~" + x + " ~ ~-" + zmax + " ~" + x + " ~ ~" + zmax + " " + id)
        }
    }

    /**
     * Dig a 2-high tunnel forward with the Agent and collect drops.
     */
    //% blockId=superagent_mine_forward block="superagent mine forward %length"
    //% length.min=1 length.max=64
    //% group="Mine"
    export function mineForward(length: number) {
        length = clamp(length, 1, 64)
        for (let i = 0; i < length; i++) {
            agent.destroy(FORWARD)
            agent.destroy(UP)
            agent.move(FORWARD, 1)
            agent.collectAll()
        }
    }

    /**
     * Dig straight down with the Agent and collect drops.
     */
    //% blockId=superagent_mine_down block="superagent mine down %depth"
    //% depth.min=1 depth.max=64
    //% group="Mine"
    export function mineDown(depth: number) {
        depth = clamp(depth, 1, 64)
        for (let i = 0; i < depth; i++) {
            agent.destroy(DOWN)
            agent.move(DOWN, 1)
            agent.collectAll()
        }
    }

    /**
     * Dig several parallel tunnels (a strip mine) and collect drops.
     */
    //% blockId=superagent_strip_mine block="superagent strip mine length %length tunnels %tunnels gap %gap"
    //% length.min=1 length.max=64 tunnels.min=1 tunnels.max=8 gap.min=1 gap.max=4
    //% group="Mine"
    export function stripMine(length: number, tunnels: number, gap: number) {
        length = clamp(length, 1, 64)
        tunnels = clamp(tunnels, 1, 8)
        gap = clamp(gap, 1, 4)
        for (let t = 0; t < tunnels; t++) {
            mineForward(length)
            agent.turn(TurnDirection.Right)
            for (let g = 0; g < gap; g++) {
                agent.destroy(FORWARD)
                agent.destroy(UP)
                agent.move(FORWARD, 1)
            }
            agent.turn(TurnDirection.Right)
            mineForward(length)
            agent.turn(TurnDirection.Left)
            for (let g = 0; g < gap; g++) {
                agent.destroy(FORWARD)
                agent.destroy(UP)
                agent.move(FORWARD, 1)
            }
            agent.turn(TurnDirection.Left)
        }
    }

    /**
     * Store a number under a key that survives world reloads (per player).
     */
    //% blockId=superagent_remember block="superagent remember %key = %value"
    //% group="Memory"
    export function remember(key: string, value: number) {
        runAtAgent("scoreboard objectives add sa_" + key + " dummy")
        runAtAgent("scoreboard players set @s sa_" + key + " " + value)
    }

    /**
     * Forget a stored key for this player.
     */
    //% blockId=superagent_forget block="superagent forget %key"
    //% group="Memory"
    export function forget(key: string) {
        runAtAgent("scoreboard players reset @s sa_" + key)
    }

    /**
     * True when a stored memory equals a value.
     */
    //% blockId=superagent_memory_equals block="superagent memory %key = %value"
    //% group="Memory"
    export function memoryEquals(key: string, value: number): boolean {
        return runAtAgent("execute if score @s sa_" + key + " matches " + value + " run testfor @s")
    }

    /**
     * True when a stored memory is at least a value.
     */
    //% blockId=superagent_memory_at_least block="superagent memory %key >= %value"
    //% group="Memory"
    export function memoryAtLeast(key: string, value: number): boolean {
        return runAtAgent("execute if score @s sa_" + key + " matches " + value + ".. run testfor @s")
    }

    /**
     * Read a stored memory by scanning 0..max. Returns the value or -1 if not found.
     */
    //% blockId=superagent_memory_value block="superagent memory %key value up to %max"
    //% max.min=1 max.max=1024
    //% group="Memory"
    export function memoryValue(key: string, max: number): number {
        max = clamp(max, 1, 1024)
        for (let v = 0; v <= max; v++) {
            if (memoryEquals(key, v)) {
                return v
            }
        }
        return -1
    }

    /**
     * Remember the character's current spot as home (survives reloads).
     */
    //% blockId=superagent_set_home block="superagent set home"
    //% group="Memory"
    export function setHome() {
        ensureCharacter()
        runAtAgent("scriptevent superagent:sethome")
    }

    /**
     * Walk the character smoothly back to the saved home spot.
     */
    //% blockId=superagent_go_home block="superagent go home"
    //% group="Memory"
    export function goHome() {
        followingAgent = false
        ensureCharacter()
        runAtAgent("scriptevent superagent:gohome")
    }

    /**
     * Clear the saved home spot.
     */
    //% blockId=superagent_clear_home block="superagent clear home"
    //% group="Memory"
    export function clearHome() {
        runAtAgent("scriptevent superagent:clearhome")
    }

    /**
     * Summon an extra autonomous guard character that follows and defends the player.
     */
    //% blockId=superagent_summon_guard block="superagent summon guard"
    //% group="Squad"
    export function summonGuard() {
        runAtAgent("scriptevent superagent:addguard")
    }

    /**
     * Dismiss all summoned guard characters.
     */
    //% blockId=superagent_dismiss_guards block="superagent dismiss guards"
    //% group="Squad"
    export function dismissGuards() {
        runAtAgent("scriptevent superagent:clearguards")
    }

    /**
     * Announce a mission title on screen and label the character.
     */
    //% blockId=superagent_mission_start block="superagent mission start %title"
    //% group="Mission"
    export function missionStart(title: string) {
        ensureCharacter()
        runAtAgent("scoreboard objectives add sa_score dummy")
        runAtAgent("title @s title " + title)
        setLabel(title)
    }

    /**
     * Award points to the player's saved score (survives reloads).
     */
    //% blockId=superagent_mission_award block="superagent award %points points"
    //% group="Mission"
    export function missionAward(points: number) {
        runAtAgent("scoreboard objectives add sa_score dummy")
        runAtAgent("scoreboard players add @s sa_score " + points)
        runAtAgent("title @s actionbar +" + points)
        showCharacterPulse()
    }

    /**
     * Read the player's saved score by scanning 0..max. Returns -1 if unset.
     */
    //% blockId=superagent_mission_score block="superagent score up to %max"
    //% max.min=1 max.max=1024
    //% group="Mission"
    export function missionScore(max: number): number {
        return memoryValue("score", max)
    }

    /**
     * Show a celebratory complete message.
     */
    //% blockId=superagent_mission_complete block="superagent mission complete"
    //% group="Mission"
    export function missionComplete() {
        ensureCharacter()
        runAtAgent("title @s title Complete!")
        auraPulseCommands()
        showStatus(SuperagentStatus.Ready)
    }

    /**
     * Show the score leaderboard on the sidebar.
     */
    //% blockId=superagent_show_scoreboard block="superagent show scoreboard"
    //% group="Mission"
    export function showScoreboard() {
        runAtAgent("scoreboard objectives add sa_score dummy")
        runAtAgent("scoreboard objectives setdisplay sidebar sa_score")
    }

    /**
     * Number of items in the given Agent inventory slot.
     */
    //% blockId=superagent_inventory_count block="superagent items in slot %slot"
    //% slot.min=1 slot.max=27
    //% group="Agent Work"
    export function inventoryCount(slot: number): number {
        slot = clamp(slot, 1, 27)
        return agent.getItemCount(slot)
    }

    /**
     * True when the Agent slot holds at least the given amount.
     */
    //% blockId=superagent_has_items block="superagent slot %slot has at least %amount"
    //% slot.min=1 slot.max=27 amount.min=1 amount.max=64
    //% group="Agent Work"
    export function hasItems(slot: number, amount: number): boolean {
        slot = clamp(slot, 1, 27)
        return agent.getItemCount(slot) >= amount
    }

    /**
     * Drop the Agent's whole inventory in a direction.
     */
    //% blockId=superagent_drop_items block="superagent drop items %direction"
    //% group="Agent Work"
    export function dropItems(direction: SuperagentSense) {
        agent.dropAll(senseDirection(direction))
    }

    /**
     * Collect nearby dropped items into the Agent.
     */
    //% blockId=superagent_collect_items block="superagent collect items"
    //% group="Agent Work"
    export function collectItems() {
        agent.collectAll()
    }

    /**
     * Bridge forward by placing a block under each step (equip a block first).
     */
    //% blockId=superagent_bridge_forward block="superagent bridge forward %steps"
    //% steps.min=1 steps.max=64
    //% group="Agent Work"
    export function bridgeForward(steps: number) {
        steps = clamp(steps, 1, 64)
        for (let i = 0; i < steps; i++) {
            agent.place(DOWN)
            agent.move(FORWARD, 1)
        }
    }

    /**
     * Build a climbing staircase forward and up (equip a block first).
     */
    //% blockId=superagent_stair_up block="superagent stair up %steps"
    //% steps.min=1 steps.max=32
    //% group="Agent Work"
    export function stairUp(steps: number) {
        steps = clamp(steps, 1, 32)
        for (let i = 0; i < steps; i++) {
            agent.place(FORWARD)
            agent.move(UP, 1)
            agent.move(FORWARD, 1)
            agent.place(DOWN)
        }
    }

    /**
     * Teacher control: freeze every superagent character in place.
     */
    //% blockId=superagent_freeze_all block="superagent freeze all"
    //% group="Teacher"
    export function freezeAll() {
        runAtAgent("scriptevent superagent:freeze on")
    }

    /**
     * Teacher control: let every superagent character move again.
     */
    //% blockId=superagent_unfreeze_all block="superagent unfreeze all"
    //% group="Teacher"
    export function unfreezeAll() {
        runAtAgent("scriptevent superagent:freeze off")
    }

    /**
     * Teacher control: gather all nearby characters to you.
     */
    //% blockId=superagent_gather_all block="superagent gather all"
    //% group="Teacher"
    export function gatherAll() {
        runAtAgent("scriptevent superagent:gather")
    }

    /**
     * Teacher control: dismiss guards and clear your character's targets and label.
     */
    //% blockId=superagent_reset_squad block="superagent reset squad"
    //% group="Teacher"
    export function resetSquad() {
        runAtAgent("scriptevent superagent:reset")
    }

    function isFilledCell(cell: string): boolean {
        return cell == "X" || cell == "x" || cell == "#" || cell == "1"
    }

    /**
     * Build a flat layer from rows of text (one string per row; X/#/1 = block).
     * Returns how many blocks were placed.
     */
    //% blockId=superagent_build_layer block="superagent build layer %block rows %rows"
    //% group="Blueprint"
    export function buildLayer(block: SuperagentBlock, rows: string[]): number {
        ensureCharacter()
        let id = blockId(block)
        let placed = 0
        for (let z = 0; z < rows.length; z++) {
            let row = rows[z]
            for (let x = 0; x < row.length; x++) {
                if (isFilledCell(row.charAt(x))) {
                    runAtSuperagent("setblock ~" + x + " ~ ~" + z + " " + id)
                    placed++
                }
            }
        }
        return placed
    }

    /**
     * Build a 3D structure from rows of text. Use a row of "-" to start the next
     * layer up. X/#/1 = block. Returns how many blocks were placed.
     */
    //% blockId=superagent_build_blueprint block="superagent build blueprint %block rows %rows"
    //% group="Blueprint"
    export function buildBlueprint(block: SuperagentBlock, rows: string[]): number {
        ensureCharacter()
        let id = blockId(block)
        let placed = 0
        let y = 0
        let z = 0
        for (let i = 0; i < rows.length; i++) {
            let row = rows[i]
            if (row == "-") {
                y++
                z = 0
            } else {
                for (let x = 0; x < row.length; x++) {
                    if (isFilledCell(row.charAt(x))) {
                        runAtSuperagent("setblock ~" + x + " ~" + y + " ~" + z + " " + id)
                        placed++
                    }
                }
                z++
            }
        }
        return placed
    }

    function placeTransformed(transform: SuperagentTransform, x: number, z: number, maxX: number, maxZ: number, id: string) {
        let px = x
        let pz = z
        if (transform == SuperagentTransform.MirrorX || transform == SuperagentTransform.Rotate180) {
            px = maxX - x
        }
        if (transform == SuperagentTransform.MirrorZ || transform == SuperagentTransform.Rotate180) {
            pz = maxZ - z
        }
        runAtSuperagent("setblock ~" + px + " ~ ~" + pz + " " + id)
    }

    /**
     * Build a 2D layer from rows of text, mirrored or rotated. Returns blocks placed.
     */
    //% blockId=superagent_build_layer_transformed block="superagent build layer %block rows %rows %transform"
    //% group="Blueprint"
    export function buildLayerTransformed(block: SuperagentBlock, rows: string[], transform: SuperagentTransform): number {
        ensureCharacter()
        let id = blockId(block)
        let placed = 0
        let maxZ = rows.length - 1
        for (let z = 0; z < rows.length; z++) {
            let row = rows[z]
            let maxX = row.length - 1
            for (let x = 0; x < row.length; x++) {
                if (isFilledCell(row.charAt(x))) {
                    placeTransformed(transform, x, z, maxX, maxZ, id)
                    placed++
                }
            }
        }
        return placed
    }

    /**
     * Remember a region (two world corners) to copy later.
     */
    //% blockId=superagent_copy_region block="superagent copy region from x %x1 y %y1 z %z1 to x %x2 y %y2 z %z2"
    //% group="Blueprint"
    export function copyRegion(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
        copyX1 = x1
        copyY1 = y1
        copyZ1 = z1
        copyX2 = x2
        copyY2 = y2
        copyZ2 = z2
    }

    /**
     * Paste the copied region at the character's position.
     */
    //% blockId=superagent_paste_here block="superagent paste here"
    //% group="Blueprint"
    export function pasteHere() {
        ensureCharacter()
        runAtSuperagent("clone " + copyX1 + " " + copyY1 + " " + copyZ1 + " " + copyX2 + " " + copyY2 + " " + copyZ2 + " ~ ~ ~")
    }

    /**
     * Replace one block type with another inside a box at the character.
     */
    //% blockId=superagent_replace_area block="superagent replace %fromBlock with %toBlock width %width height %height depth %depth"
    //% width.min=1 width.max=16 height.min=1 height.max=16 depth.min=1 depth.max=16
    //% group="Blueprint"
    export function replaceArea(fromBlock: SuperagentBlock, toBlock: SuperagentBlock, width: number, height: number, depth: number) {
        width = clamp(width, 1, 16)
        height = clamp(height, 1, 16)
        depth = clamp(depth, 1, 16)
        ensureCharacter()
        runAtSuperagent("fill ~ ~ ~ ~" + (width - 1) + " ~" + (height - 1) + " ~" + (depth - 1) + " " + blockId(toBlock) + " replace " + blockId(fromBlock))
    }
}
