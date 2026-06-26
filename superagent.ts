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

enum SuperagentStairDirection {
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

enum SuperagentTurn {
    //% block="left"
    Left = 0,
    //% block="right"
    Right = 1
}

enum SuperagentFaceDirection {
    //% block="north"
    North = 0,
    //% block="east"
    East = 1,
    //% block="south"
    South = 2,
    //% block="west"
    West = 3
}

enum SuperagentAssist {
    //% block="place on move"
    PlaceOnMove = 0,
    //% block="place from any slot"
    PlaceFromAnySlot = 1,
    //% block="destroy obstacles"
    DestroyObstacles = 2
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
    let homePositionSet = false
    let homeX = 0
    let homeY = 0
    let homeZ = 0
    let trackedX = 0
    let trackedY = 0
    let trackedZ = 0
    let watchLoopStarted = false
    let watching = false
    let watcherKinds: number[] = []
    let watcherParams: number[] = []
    let watcherDirs: number[] = []
    let watcherLast: boolean[] = []
    let watcherHandlers: (() => void)[] = []
    const WATCHER_POLL_MS = 500
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

    function runBuildAtSuperagent(command: string): boolean {
        ensureCharacter()
        return runAtSuperagent(command)
    }

    function textValue(value: any): string {
        return "" + value
    }

    function memoryObjective(key: any): string {
        return "sa_" + textValue(key)
    }

    function roundedPositionValue(value: number): number {
        return Math.round(value)
    }

    function setTrackedPosition(x: number, y: number, z: number) {
        trackedX = roundedPositionValue(x)
        trackedY = roundedPositionValue(y)
        trackedZ = roundedPositionValue(z)
    }

    function setTrackedPositionFrom(position: Position) {
        setTrackedPosition(position.getValue(Axis.X), position.getValue(Axis.Y), position.getValue(Axis.Z))
    }

    function moveTrackedPosition(direction: SuperagentMoveDirection, blocks: number) {
        if (direction == SuperagentMoveDirection.East) {
            trackedX += blocks
        } else if (direction == SuperagentMoveDirection.South) {
            trackedZ += blocks
        } else if (direction == SuperagentMoveDirection.West) {
            trackedX -= blocks
        } else if (direction == SuperagentMoveDirection.Up) {
            trackedY += blocks
        } else if (direction == SuperagentMoveDirection.Down) {
            trackedY -= blocks
        } else {
            trackedZ -= blocks
        }
    }

    function positionText(): string {
        return "x=" + trackedX + " y=" + trackedY + " z=" + trackedZ
    }

    function selectSuperagentNear(position: Position, radius: number) {
        // Select by type within a radius of the command source (the player).
        // We avoid atCoordinate because the stored position can be relative, and
        // Bedrock rejects relative coordinates inside a target selector.
        let selected = mobs.target(ALL_ENTITIES)
        selected.withinRadius(clamp(radius, 1, 256))
        selected.addRule("type", "superagent:superagent")
        return selected
    }

    function teleportCharacterFrom(oldPosition: Position, newPosition: Position) {
        mobs.teleportToPosition(selectSuperagentNear(oldPosition, 256), newPosition)
        mobs.teleportToPosition(selectSuperagentNear(newPosition, 32), newPosition)
    }

    function teleportCharacterTo(position: Position) {
        let oldPosition = superagentPosition
        superagentPosition = position
        setTrackedPositionFrom(position)
        teleportCharacterFrom(oldPosition, superagentPosition)
    }

    function setSuperagentPosition(position: Position) {
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
        // The behavior pack spawns, protects and positions the character. We no
        // longer force-teleport it here because that ignored block collision and
        // would undo collision-aware moves. Avoid ambient particles so effects
        // never appear to come from the player.
    }

    function directionName(direction: SuperagentMoveDirection): string {
        if (direction == SuperagentMoveDirection.East) {
            return "east"
        }
        if (direction == SuperagentMoveDirection.South) {
            return "south"
        }
        if (direction == SuperagentMoveDirection.West) {
            return "west"
        }
        if (direction == SuperagentMoveDirection.Up) {
            return "up"
        }
        if (direction == SuperagentMoveDirection.Down) {
            return "down"
        }
        return "north"
    }

    function assistKind(assist: SuperagentAssist): number {
        if (assist == SuperagentAssist.PlaceFromAnySlot) {
            return PLACE_FROM_ANY_SLOT
        }
        if (assist == SuperagentAssist.DestroyObstacles) {
            return DESTROY_OBSTACLES
        }
        return PLACE_ON_MOVE
    }

    function showCharacterPulse() {
        // Kept for legacy callers; intentionally no-op.
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
    }

    function attackCommandBurst(strength: number) {
        // The behavior pack owns combat particles so they anchor on the
        // superagent entity, not on the player running MakeCode commands.
        runAtAgent("scriptevent superagent:burst")
        lastBurstCount += strength
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
    export function reportLastBurstCount(): number {
        return lastBurstCount
    }

    /**
     * Show a status label above the superagent character.
     */
    //% blockId=superagent_set_label block="superagent label %text"
    //% group="Status"
    export function setLabel(text: any) {
        ensureCharacter()
        runAtAgent("scriptevent superagent:label " + textValue(text))
    }

    /**
     * Show the character's real add-on world position above its head.
     */
    //% blockId=superagent_label_world_position block="superagent label world position"
    //% group="Status"
    export function labelWorldPosition() {
        ensureCharacter()
        runAtAgent("scriptevent superagent:labelpos")
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
     * Hard-stop all combat: turn auto guard off and clear any in-progress
     * attack/spin state so the character stops fighting immediately.
     */
    //% blockId=superagent_stop_combat block="superagent stop combat"
    //% group="Combat"
    export function stopCombat() {
        runAtAgent("scriptevent superagent:combat off")
        runAtAgent("scriptevent superagent:stopcombat")
    }

    /**
     * Show a small Agent status gesture that does not require commands.
     */
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
    export function attackAura(rounds: number, hits: number, style: SuperagentBurstStyle) {
        lastBurstCount = 0
        ensureAuraLoop()
        rounds = clamp(rounds, 1, 32)
        hits = clamp(hits, 1, 8)
        for (let i = 0; i < rounds; i++) {
            ensureCharacter()
            auraPulseCommands()
            attackCommandBurst(hits)
        }
    }

    /**
     * Keep guarding the Agent's space with repeated horizontal bursts.
     */
    export function guardAgent(rounds: number, hits: number) {
        attackAura(rounds, hits, SuperagentBurstStyle.Ring)
    }

    /**
     * Perform a full six-direction burst and collect any nearby drops.
     */
    export function powerBurst(rounds: number, hits: number) {
        attackAura(rounds, hits, SuperagentBurstStyle.Sphere)
        agent.collectAll()
    }

    /**
     * Sweep threats with a smarter pattern that prioritizes the front, sides, then vertical danger when needed.
     */
    export function smartSweep(rounds: number, strength: number, mode: SuperagentSmartMode) {
        lastBurstCount = 0
        ensureAuraLoop()
        rounds = clamp(rounds, 1, 16)
        strength = clamp(strength, 1, 5)
        let power = mode == SuperagentSmartMode.Emergency ? strength + 1 : strength
        for (let i = 0; i < rounds; i++) {
            ensureCharacter()
            auraPulseCommands()
            attackCommandBurst(power)
        }
    }

    /**
     * Use the strongest member-safe superagent attack pattern and collect nearby drops.
     */
    export function overdrive(rounds: number, strength: number) {
        smartSweep(rounds, strength, SuperagentSmartMode.Emergency)
        agent.collectAll()
    }

    /**
     * Start and refresh the visible superagent aura at the Agent's current position.
     */
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
        let target = agent.getPosition()
        setSuperagentPosition(target)
        // Send only the scriptevent (no raw "summon"). The behavior pack creates
        // and OWNS the character for the player who ran this command, then moves
        // it to these explicit own-Agent coordinates. A raw summon would let the
        // BP claim ownership by proximity, which in multiplayer can attach the
        // character to whichever player happens to stand closest to the Agent.
        runAtAgent("scriptevent superagent:spawnat " + target.getValue(Axis.X) + " " + target.getValue(Axis.Y) + " " + target.getValue(Axis.Z))
    }

    /**
     * Bring the visible superagent character to the player's own position.
     */
    //% blockId=superagent_spawn_at_player block="superagent spawn at player"
    //% group="Control"
    export function spawnAtPlayer() {
        followingAgent = false
        // Send only the scriptevent. The behavior pack creates and OWNS the
        // character for the player who ran this command and places it on that
        // player. We avoid a raw "summon" (and the older nested execute-run form
        // that some Minecraft Education worlds reject with a red "Unexpected '@s'"
        // error) so ownership is never decided by proximity in multiplayer.
        runAtAgent("scriptevent superagent:recall")
    }

    /**
     * Recall the visible superagent character back to the Agent.
     */
    //% blockId=superagent_recall_to_agent block="superagent recall to agent"
    //% group="Control"
    export function recallToAgent() {
        // Read THIS player's own Agent position and send explicit coordinates so
        // the behavior pack never has to guess/scan for an Agent. In multiplayer
        // this keeps the recall scoped to the caller's own superagent + Agent.
        let target = agent.getPosition()
        setSuperagentPosition(target)
        runAtAgent("scriptevent superagent:spawnat " + target.getValue(Axis.X) + " " + target.getValue(Axis.Y) + " " + target.getValue(Axis.Z))
    }

    /**
     * Move the visible superagent character on the world grid.
     */
    //% blockId=superagent_move_character block="superagent move %direction blocks %blocks"
    //% blocks.min=1 blocks.max=32
    //% group="Control"
    export function moveCharacter(direction: SuperagentMoveDirection, blocks: number) {
        followingAgent = false
        blocks = clamp(blocks, 1, 32)
        // Track the intended position for build/sense continuity, but let the
        // behavior pack do the actual stepping with block collision.
        superagentPosition = positions.add(superagentPosition, directionOffset(direction, blocks))
        moveTrackedPosition(direction, blocks)
        runAtAgent("scriptevent superagent:step " + directionName(direction) + " " + blocks)
    }

    /**
     * Keep the visible superagent character following the Agent.
     */
    export function followAgentOn() {
        followingAgent = true
        ensureFollowLoop()
        recallToAgent()
    }

    /**
     * Stop automatic follow mode for the visible superagent character.
     */
    export function followAgentOff() {
        followingAgent = false
        showCharacterPulse()
    }

    /**
     * Attack hostile mobs around the visible superagent character.
     */
    //% blockId=superagent_attack_from_character block="superagent attack from character radius %radius strength %strength"
    //% radius.min=1 radius.max=5 strength.min=1 strength.max=3
    //% group="Combat"
    export function attackFromCharacter(radius: number, strength: number) {
        radius = clamp(radius, 1, 5)
        strength = clamp(strength, 1, 3)
        ensureCharacter()
        // Delegate visual effects and damage to the behavior pack so particles
        // stay centered on the superagent entity.
        runAtAgent("scriptevent superagent:burst")
    }

    /**
     * Dash the visible superagent character quickly in one direction.
     */
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
    export function evadeToAgentSide(distance: number) {
        followingAgent = false
        distance = clamp(distance, 1, 16)
        setSuperagentPosition(positions.add(agent.getPosition(), pos(distance, 0, distance)))
        attackFromCharacter(8, 3)
    }

    /**
     * Move the superagent upward for a high-ground guard position.
     */
    export function highGround(blocks: number) {
        followingAgent = false
        blocks = clamp(blocks, 1, 16)
        moveCharacter(SuperagentMoveDirection.Up, blocks)
        attackFromCharacter(8, 3)
    }

    /**
     * Advance with alternating side steps to cover more area.
     */
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

    function relativeCoord(value: number): string {
        if (value == 0) {
            return "~"
        }
        return "~" + value
    }

    function nearbyBlockIs(direction: SuperagentSense, block: SuperagentBlock): boolean {
        return runAtSuperagent("testforblock " + senseOffset(direction) + " " + blockId(block))
    }

    function inspectKnownBlock(direction: SuperagentSense): number {
        if (nearbyBlockIs(direction, SuperagentBlock.Stone)) {
            return SuperagentBlock.Stone
        }
        if (nearbyBlockIs(direction, SuperagentBlock.Cobblestone)) {
            return SuperagentBlock.Cobblestone
        }
        if (nearbyBlockIs(direction, SuperagentBlock.Dirt)) {
            return SuperagentBlock.Dirt
        }
        if (nearbyBlockIs(direction, SuperagentBlock.OakPlanks)) {
            return SuperagentBlock.OakPlanks
        }
        if (nearbyBlockIs(direction, SuperagentBlock.Glass)) {
            return SuperagentBlock.Glass
        }
        if (nearbyBlockIs(direction, SuperagentBlock.Glowstone)) {
            return SuperagentBlock.Glowstone
        }
        if (nearbyBlockIs(direction, SuperagentBlock.Sandstone)) {
            return SuperagentBlock.Sandstone
        }
        if (nearbyBlockIs(direction, SuperagentBlock.Air)) {
            return SuperagentBlock.Air
        }
        return -1
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
    //% radius.min=1 radius.max=5 strength.min=1 strength.max=3
    //% group="Reactive"
    export function defendIfThreatened(radius: number, strength: number): boolean {
        radius = clamp(radius, 1, 5)
        strength = clamp(strength, 1, 3)
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
        if (watcherKinds.length == 0) {
            return
        }
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
            if (watching && watcherKinds.length > 0) {
                pollWatchers()
            }
            loops.pause(WATCHER_POLL_MS)
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
    export function onPathBlocked(direction: SuperagentSense, handler: () => void) {
        registerWatcher(2, 0, direction, handler)
    }

    /**
     * Start the background event watcher loop.
     */
    export function watchOn() {
        watching = true
        ensureWatchLoop()
    }

    /**
     * Pause the background event watcher loop without losing registered events.
     */
    export function watchOff() {
        watching = false
    }

    /**
     * Check all registered events once right now (useful inside your own loop).
     */
    export function checkEvents() {
        pollWatchers()
    }

    /**
     * Smoothly walk (glide) the character to a world position.
     */
    export function walkTo(x: number, y: number, z: number) {
        followingAgent = false
        ensureCharacter()
        superagentPosition = pos(x, y, z)
        setTrackedPosition(x, y, z)
        runAtAgent("scriptevent superagent:goto " + x + " " + y + " " + z)
    }

    /**
     * Keep the character smoothly walking after the Agent.
     */
    export function followWalk(on: boolean) {
        followingAgent = false
        ensureCharacter()
        runAtAgent("scriptevent superagent:followwalk " + (on ? "on" : "off"))
    }

    /**
     * Stop any walking and clear the current walk target.
     */
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
    export function pathTo(x: number, y: number, z: number) {
        followingAgent = false
        ensureCharacter()
        superagentPosition = pos(x, y, z)
        setTrackedPosition(x, y, z)
        runAtAgent("scriptevent superagent:pathto " + x + " " + y + " " + z)
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
     * Value block: use a direction as a plug-in input for other superagent blocks.
     */
    export function moveDirectionValue(direction: SuperagentMoveDirection): SuperagentMoveDirection {
        return direction
    }

    /**
     * Value block: use a sensing direction as a plug-in input for sensing/event blocks.
     */
    export function senseDirectionValue(direction: SuperagentSense): SuperagentSense {
        return direction
    }

    /**
     * Value block: use a mob type as a plug-in input for sensing blocks.
     */
    //% blockId=superagent_value_mob block="superagent mob %mob"
    //% group="Values"
    export function mobValue(mob: SuperagentMobType): SuperagentMobType {
        return mob
    }

    /**
     * Value block: use a block type as a plug-in input for build and block-sensing blocks.
     */
    export function blockValue(block: SuperagentBlock): SuperagentBlock {
        return block
    }

    /**
     * Value block: use a blueprint transform as a plug-in input for transformed layer builds.
     */
    export function transformValue(transform: SuperagentTransform): SuperagentTransform {
        return transform
    }

    /**
     * Value block: use a world direction as a plug-in input for movement commands.
     */
    //% blockId=superagent_value_world_direction block="superagent world direction %direction"
    //% group="Values"
    export function worldDirectionValue(direction: SuperagentMoveDirection): SuperagentMoveDirection {
        return direction
    }

    /**
     * Text reporter: the tracked superagent world position.
     */
    //% blockId=superagent_world_position_text block="superagent world position text"
    //% group="Values"
    export function worldPositionText(): string {
        return positionText()
    }

    /**
     * Number reporter: tracked superagent world x coordinate.
     */
    //% blockId=superagent_world_x block="superagent world x"
    //% group="Values"
    export function worldX(): number {
        return trackedX
    }

    /**
     * Number reporter: tracked superagent world y coordinate.
     */
    //% blockId=superagent_world_y block="superagent world y"
    //% group="Values"
    export function worldY(): number {
        return trackedY
    }

    /**
     * Number reporter: tracked superagent world z coordinate.
     */
    //% blockId=superagent_world_z block="superagent world z"
    //% group="Values"
    export function worldZ(): number {
        return trackedZ
    }

    /**
     * Text reporter: make a readable world position from x/y/z numbers.
     */
    //% blockId=superagent_world_position_at_text block="superagent world position text x %x y %y z %z"
    //% group="Values"
    export function worldPositionAtText(x: number, y: number, z: number): string {
        return "x=" + x + " y=" + y + " z=" + z
    }

    /**
     * Text reporter: the tracked superagent x/y/z position. Plug this into
     * `superagent label` or `superagent report`.
     */
    //% blockId=superagent_position_text block="superagent position x y z"
    //% group="Values"
    export function positionXYZ(): string {
        return positionText()
    }

    /**
     * Number reporter: tracked superagent x coordinate.
     */
    //% blockId=superagent_position_x block="superagent x"
    //% group="Values"
    export function positionX(): number {
        return trackedX
    }

    /**
     * Number reporter: tracked superagent y coordinate.
     */
    //% blockId=superagent_position_y block="superagent y"
    //% group="Values"
    export function positionY(): number {
        return trackedY
    }

    /**
     * Number reporter: tracked superagent z coordinate.
     */
    //% blockId=superagent_position_z block="superagent z"
    //% group="Values"
    export function positionZ(): number {
        return trackedZ
    }

    /**
     * Fill a solid box of blocks starting at the superagent position.
     */
    //% blockId=superagent_build_box block="superagent build box %block width %width height %height depth %depth"
    //% width.min=1 width.max=16 height.min=1 height.max=16 depth.min=1 depth.max=16
    //% group="Build"
    export function buildBox(block: SuperagentBlock, width: number, height: number, depth: number) {
        width = clamp(width, 1, 16)
        height = clamp(height, 1, 16)
        depth = clamp(depth, 1, 16)
        runBuildAtSuperagent("fill ~ ~ ~ ~" + (width - 1) + " ~" + (height - 1) + " ~" + (depth - 1) + " " + blockId(block))
    }

    /**
     * Build a box with only the outer walls, hollow inside, starting at the superagent position.
     */
    //% blockId=superagent_build_hollow_box block="superagent build hollow box %block width %width height %height depth %depth"
    //% width.min=1 width.max=16 height.min=1 height.max=16 depth.min=1 depth.max=16
    //% group="Build"
    export function buildHollowBox(block: SuperagentBlock, width: number, height: number, depth: number) {
        width = clamp(width, 1, 16)
        height = clamp(height, 1, 16)
        depth = clamp(depth, 1, 16)
        runBuildAtSuperagent("fill ~ ~ ~ ~" + (width - 1) + " ~" + (height - 1) + " ~" + (depth - 1) + " " + blockId(block) + " hollow")
    }

    /**
     * Build a flat floor of blocks starting at the superagent position.
     */
    //% blockId=superagent_build_floor block="superagent build floor %block width %width depth %depth"
    //% width.min=1 width.max=16 depth.min=1 depth.max=16
    //% group="Build"
    export function buildFloor(block: SuperagentBlock, width: number, depth: number) {
        width = clamp(width, 1, 16)
        depth = clamp(depth, 1, 16)
        runBuildAtSuperagent("fill ~ ~ ~ ~" + (width - 1) + " ~ ~" + (depth - 1) + " " + blockId(block))
    }

    /**
     * Build a wall going east and up from the superagent position.
     */
    //% blockId=superagent_build_wall block="superagent build wall %block length %length height %height"
    //% length.min=1 length.max=16 height.min=1 height.max=16
    //% group="Build"
    export function buildWall(block: SuperagentBlock, length: number, height: number) {
        length = clamp(length, 1, 16)
        height = clamp(height, 1, 16)
        runBuildAtSuperagent("fill ~ ~ ~ ~" + (length - 1) + " ~" + (height - 1) + " ~ " + blockId(block))
    }

    /**
     * Build a single column of blocks upward from the superagent position.
     */
    //% blockId=superagent_build_pillar block="superagent build pillar %block height %height"
    //% height.min=1 height.max=32
    //% group="Build"
    export function buildPillar(block: SuperagentBlock, height: number) {
        height = clamp(height, 1, 32)
        runBuildAtSuperagent("fill ~ ~ ~ ~ ~" + (height - 1) + " ~ " + blockId(block))
    }

    /**
     * Build a row from a text pattern: a block for each X, # or 1, a gap otherwise.
     * Returns how many blocks were placed.
     */
    //% blockId=superagent_build_pattern block="superagent build row %block pattern %pattern"
    //% group="Build"
    export function buildRowPattern(block: SuperagentBlock, pattern: any): number {
        let row = textValue(pattern)
        let placed = 0
        for (let i = 0; i < row.length; i++) {
            let cell = row.charAt(i)
            if (cell == "X" || cell == "x" || cell == "#" || cell == "1") {
                runBuildAtSuperagent("setblock ~" + i + " ~ ~ " + blockId(block))
                placed++
            }
        }
        return placed
    }

    /**
     * Clear a box of space to air starting at the superagent position.
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
        let id = blockId(block)
        for (let y = 0; y < size; y++) {
            runBuildAtSuperagent("fill ~" + y + " ~" + y + " ~" + y + " ~" + (size - 1 - y) + " ~" + y + " ~" + (size - 1 - y) + " " + id)
        }
    }

    /**
     * Build a diagonal staircase going up in a chosen direction from the superagent position.
     */
    //% blockId=superagent_build_staircase block="superagent build staircase %block direction %direction steps %steps"
    //% steps.min=1 steps.max=32
    //% group="Build"
    export function buildStaircase(block: SuperagentBlock, direction: SuperagentStairDirection, steps: number) {
        steps = clamp(steps, 1, 32)
        let id = blockId(block)
        for (let i = 0; i < steps; i++) {
            if (direction == SuperagentStairDirection.Up) {
                runBuildAtSuperagent("setblock ~ ~" + i + " ~ " + id)
            } else if (direction == SuperagentStairDirection.Down) {
                runBuildAtSuperagent("setblock ~ ~" + (0 - i) + " ~ " + id)
            } else if (direction == SuperagentStairDirection.East) {
                runBuildAtSuperagent("setblock ~" + i + " ~" + i + " ~ " + id)
            } else if (direction == SuperagentStairDirection.South) {
                runBuildAtSuperagent("setblock ~ ~" + i + " ~" + i + " " + id)
            } else if (direction == SuperagentStairDirection.West) {
                runBuildAtSuperagent("setblock ~" + (0 - i) + " ~" + i + " ~ " + id)
            } else {
                runBuildAtSuperagent("setblock ~ ~" + i + " ~" + (0 - i) + " " + id)
            }
        }
    }

    function plotBlock(dx: number, dz: number, id: string) {
        runBuildAtSuperagent("setblock ~" + dx + " ~ ~" + dz + " " + id)
    }

    /**
     * Build a circle outline on the ground using the midpoint algorithm.
     */
    //% blockId=superagent_build_circle block="superagent build circle %block radius %radius"
    //% radius.min=1 radius.max=16
    //% group="Build"
    export function buildCircle(block: SuperagentBlock, radius: number) {
        radius = clamp(radius, 1, 16)
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
        let id = blockId(block)
        for (let x = 0 - radius; x <= radius; x++) {
            let zmax = Math.floor(Math.sqrt(radius * radius - x * x))
            runBuildAtSuperagent("fill ~" + x + " ~ ~-" + zmax + " ~" + x + " ~ ~" + zmax + " " + id)
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
        ensureCharacter()
        // The visible superagent breaks the blocks itself (handled in the behavior
        // pack), instead of delegating to the normal Minecraft Agent.
        runAtAgent("scriptevent superagent:mine forward " + length)
    }

    /**
     * Dig straight down with the Agent and collect drops.
     */
    //% blockId=superagent_mine_down block="superagent mine down %depth"
    //% depth.min=1 depth.max=64
    //% group="Mine"
    export function mineDown(depth: number) {
        depth = clamp(depth, 1, 64)
        ensureCharacter()
        // The visible superagent digs straight down itself (handled in the
        // behavior pack), instead of delegating to the normal Minecraft Agent.
        runAtAgent("scriptevent superagent:mine down " + depth)
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
        ensureCharacter()
        // The visible superagent digs the strip itself (handled in the behavior
        // pack), instead of delegating to the normal Minecraft Agent.
        runAtAgent("scriptevent superagent:mine strip " + length + " " + tunnels + " " + gap)
    }

    /**
     * Store a number under a key that survives world reloads (per player).
     */
    export function remember(key: any, value: number) {
        let objective = memoryObjective(key)
        runAtAgent("scoreboard objectives add " + objective + " dummy")
        runAtAgent("scoreboard players set @s " + objective + " " + value)
    }

    /**
     * Forget a stored key for this player.
     */
    export function forget(key: any) {
        runAtAgent("scoreboard players reset @s " + memoryObjective(key))
    }

    /**
     * True when a stored memory equals a value.
     */
    export function memoryEquals(key: any, value: number): boolean {
        return runAtAgent("scoreboard players test @s " + memoryObjective(key) + " " + value + " " + value)
    }

    /**
     * True when a stored memory is at least a value.
     */
    export function memoryAtLeast(key: any, value: number): boolean {
        return runAtAgent("scoreboard players test @s " + memoryObjective(key) + " " + value + " 2147483647")
    }

    /**
     * Read a stored memory by scanning 0..max. Returns the value or -1 if not found.
     */
    export function memoryValue(key: any, max: number): number {
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
        homeX = trackedX
        homeY = trackedY
        homeZ = trackedZ
        homePositionSet = true
        runAtAgent("scriptevent superagent:sethome " + homeX + " " + homeY + " " + homeZ)
    }

    /**
     * Walk the character smoothly back to the saved home spot.
     */
    //% blockId=superagent_go_home block="superagent go home"
    //% group="Memory"
    export function goHome() {
        followingAgent = false
        ensureCharacter()
        if (homePositionSet) {
            superagentPosition = pos(homeX, homeY, homeZ)
            setTrackedPosition(homeX, homeY, homeZ)
            runAtAgent("scriptevent superagent:gohome " + homeX + " " + homeY + " " + homeZ)
            return
        }
        runAtAgent("scriptevent superagent:gohome")
    }

    /**
     * Clear the saved home spot.
     */
    //% blockId=superagent_clear_home block="superagent clear home"
    //% group="Memory"
    export function clearHome() {
        homePositionSet = false
        runAtAgent("scriptevent superagent:clearhome")
    }

    /**
     * Summon an extra autonomous guard character that follows and defends the player.
     */
    export function summonGuard() {
        runAtAgent("scriptevent superagent:addguard")
    }

    /**
     * Dismiss all summoned guard characters.
     */
    export function dismissGuards() {
        runAtAgent("scriptevent superagent:clearguards")
    }

    /**
     * Announce a mission title on screen and label the character.
     */
    export function missionStart(title: any) {
        let text = textValue(title)
        ensureCharacter()
        runAtAgent("scoreboard objectives add sa_score dummy")
        runAtAgent("title @s title " + text)
        setLabel(text)
    }

    /**
     * Award points to the player's saved score (survives reloads).
     */
    export function missionAward(points: number) {
        runAtAgent("scoreboard objectives add sa_score dummy")
        runAtAgent("scoreboard players add @s sa_score " + points)
        runAtAgent("title @s actionbar +" + points)
        showCharacterPulse()
    }

    /**
     * Read the player's saved score by scanning 0..max. Returns -1 if unset.
     */
    export function missionScore(max: number): number {
        return memoryValue("score", max)
    }

    /**
     * Show a celebratory complete message.
     */
    export function missionComplete() {
        ensureCharacter()
        runAtAgent("title @s title Complete!")
        auraPulseCommands()
        showStatus(SuperagentStatus.Ready)
    }

    /**
     * Show the score leaderboard on the sidebar.
     */
    export function showScoreboard() {
        runAtAgent("scoreboard objectives add sa_score dummy")
        runAtAgent("scoreboard objectives setdisplay sidebar sa_score")
    }

    /**
     * Agent command mirror: move the Minecraft Agent in a direction.
     */
    export function agentMove(direction: SuperagentSense, steps: number) {
        agent.move(senseDirection(direction), clamp(steps, 1, 64))
    }

    /**
     * Agent command mirror: turn the Minecraft Agent left or right.
     */
    export function agentTurn(turn: SuperagentTurn) {
        agent.turn(turn == SuperagentTurn.Left ? TurnDirection.Left : TurnDirection.Right)
    }

    /**
     * Agent command mirror: enable or disable an Agent assist.
     */
    export function agentSetAssist(assist: SuperagentAssist, on: boolean) {
        agent.setAssist(assistKind(assist), on)
    }

    /**
     * Agent command mirror: teleport the Minecraft Agent to the player.
     */
    export function agentTeleportToPlayer() {
        agent.teleportToPlayer()
    }

    /**
     * Agent command mirror: place from the active Agent slot.
     */
    export function agentPlace(direction: SuperagentSense) {
        agent.place(senseDirection(direction))
    }

    /**
     * Agent command mirror: destroy one block.
     */
    export function agentDestroy(direction: SuperagentSense) {
        agent.destroy(senseDirection(direction))
    }

    /**
     * Agent command mirror: till farmland.
     */
    export function agentTill(direction: SuperagentSense) {
        agent.till(senseDirection(direction))
    }

    /**
     * Agent command mirror: attack once.
     */
    export function agentAttack(direction: SuperagentSense) {
        agent.attack(senseDirection(direction))
    }

    /**
     * Agent command mirror: interact with a block or entity.
     */
    export function agentInteract(direction: SuperagentSense) {
        agent.interact(senseDirection(direction))
    }

    /**
     * Agent command mirror: select the active Agent inventory slot.
     */
    export function agentSetSlot(slot: number) {
        agent.setSlot(clamp(slot, 1, 27))
    }

    /**
     * Detect whether a block is present next to the superagent character.
     */
    export function agentDetectBlock(direction: SuperagentSense): boolean {
        ensureCharacter()
        return !nearbyBlockIs(direction, SuperagentBlock.Air)
    }

    /**
     * Agent command mirror: detect whether redstone is present.
     */
    export function agentDetectRedstone(direction: SuperagentSense): boolean {
        return agent.detect(AgentDetection.Redstone, senseDirection(direction))
    }

    /**
     * Inspect a known block next to the superagent character.
     */
    export function agentInspectBlock(direction: SuperagentSense): number {
        ensureCharacter()
        return inspectKnownBlock(direction)
    }

    /**
     * Agent command mirror: inspect block data.
     */
    export function agentInspectData(direction: SuperagentSense): number {
        return agent.inspect(AgentInspection.Data, senseDirection(direction))
    }

    /**
     * Agent command mirror: collect a specific item type.
     */
    export function agentCollectItem(item: number) {
        agent.collect(item)
    }

    /**
     * Agent command mirror: drop a quantity from one slot.
     */
    export function agentDrop(slot: number, amount: number, direction: SuperagentSense) {
        agent.drop(senseDirection(direction), clamp(slot, 1, 27), clamp(amount, 1, 64))
    }

    /**
     * Agent command mirror: move items between Agent inventory slots.
     */
    export function agentTransfer(fromSlot: number, amount: number, toSlot: number) {
        agent.transfer(clamp(fromSlot, 1, 27), clamp(amount, 1, 64), clamp(toSlot, 1, 27))
    }

    /**
     * Agent command mirror: set an item stack in an Agent inventory slot.
     */
    export function agentSetItem(item: number, amount: number, slot: number) {
        agent.setItem(item, clamp(amount, 0, 64), clamp(slot, 1, 27))
    }

    /**
     * Agent command mirror: free space in an Agent inventory slot.
     */
    export function agentItemSpace(slot: number): number {
        return agent.getItemSpace(clamp(slot, 1, 27))
    }

    /**
     * Agent command mirror: item detail/data in an Agent inventory slot.
     */
    export function agentItemDetail(slot: number): number {
        return agent.getItemDetail(clamp(slot, 1, 27))
    }

    /**
     * Number of items in the given Agent inventory slot.
     */
    export function inventoryCount(slot: number): number {
        slot = clamp(slot, 1, 27)
        return agent.getItemCount(slot)
    }

    /**
     * True when the Agent slot holds at least the given amount.
     */
    export function hasItems(slot: number, amount: number): boolean {
        slot = clamp(slot, 1, 27)
        return agent.getItemCount(slot) >= amount
    }

    /**
     * Drop the Agent's whole inventory in a direction.
     */
    export function dropItems(direction: SuperagentSense) {
        agent.dropAll(senseDirection(direction))
    }

    /**
     * Collect nearby dropped items into the Agent.
     */
    export function collectItems() {
        agent.collectAll()
    }

    /**
     * Build a stone bridge forward from the superagent position.
     */
    //% blockId=superagent_bridge_forward block="superagent bridge forward %steps"
    //% steps.min=1 steps.max=64
    //% group="Build"
    export function bridgeForward(steps: number) {
        steps = clamp(steps, 1, 64)
        for (let i = 1; i <= steps; i++) {
            runBuildAtSuperagent("setblock ~ ~-1 ~-" + i + " stone")
        }
    }

    /**
     * Build a stone staircase forward and up from the superagent position.
     */
    //% blockId=superagent_stair_up block="superagent stair up %steps"
    //% steps.min=1 steps.max=32
    //% group="Build"
    export function stairUp(steps: number) {
        steps = clamp(steps, 1, 32)
        for (let i = 0; i < steps; i++) {
            runBuildAtSuperagent("setblock ~ " + relativeCoord(i) + " ~-" + (i + 1) + " stone")
        }
    }

    /**
     * Teacher control: freeze every superagent character in place.
     */
    export function freezeAll() {
        runAtAgent("scriptevent superagent:freeze on")
    }

    /**
     * Teacher control: let every superagent character move again.
     */
    export function unfreezeAll() {
        runAtAgent("scriptevent superagent:freeze off")
    }

    /**
     * Teacher control: gather all nearby characters to you.
     */
    export function gatherAll() {
        runAtAgent("scriptevent superagent:gather")
    }

    /**
     * Teacher control: dismiss guards and clear your character's targets and label.
     */
    export function resetSquad() {
        runAtAgent("scriptevent superagent:reset")
    }

    /**
     * Teacher control: remove EVERY superagent character in the world (clean slate).
     * The behavior pack deletes them with the scripting API, so this works even when
     * command add-ons (e.g. RaiseUAC) rewrite "/kill @e[type=...]" selectors.
     */
    //% blockId=superagent_remove_all block="superagent remove all characters"
    //% group="Control"
    export function removeAll() {
        runAtAgent("scriptevent superagent:purge")
    }

    /**
     * Diagnostics: print how many superagent characters exist, their owner, and
     * position to the chat. Useful for understanding multiplayer ownership.
     */
    //% blockId=superagent_debug block="superagent debug report"
    //% group="Control"
    export function debugReport() {
        runAtAgent("scriptevent superagent:debug")
    }

    function isFilledCell(cell: string): boolean {
        return cell == "X" || cell == "x" || cell == "#" || cell == "1"
    }

    /**
     * Build a flat layer from rows of text (one string per row; X/#/1 = block).
     * Returns how many blocks were placed.
     */
    export function buildLayer(block: SuperagentBlock, rows: string[]): number {
        let id = blockId(block)
        let placed = 0
        for (let z = 0; z < rows.length; z++) {
            let row = rows[z]
            for (let x = 0; x < row.length; x++) {
                if (isFilledCell(row.charAt(x))) {
                    runBuildAtSuperagent("setblock ~" + x + " ~ ~" + z + " " + id)
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
    export function buildBlueprint(block: SuperagentBlock, rows: string[]): number {
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
                        runBuildAtSuperagent("setblock ~" + x + " ~" + y + " ~" + z + " " + id)
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
        runBuildAtSuperagent("setblock ~" + px + " ~ ~" + pz + " " + id)
    }

    /**
     * Build a 2D layer from rows of text, mirrored or rotated. Returns blocks placed.
     */
    export function buildLayerTransformed(block: SuperagentBlock, rows: string[], transform: SuperagentTransform): number {
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
    export function copyRegion(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
        copyX1 = x1
        copyY1 = y1
        copyZ1 = z1
        copyX2 = x2
        copyY2 = y2
        copyZ2 = z2
    }

    /**
     * Paste the copied region at the superagent position.
     */
    //% blockId=superagent_paste_here block="superagent paste here"
    //% group="Blueprint"
    export function pasteHere() {
        runBuildAtSuperagent("clone " + copyX1 + " " + copyY1 + " " + copyZ1 + " " + copyX2 + " " + copyY2 + " " + copyZ2 + " ~ ~ ~")
    }

    /**
     * Replace one block type with another inside a box at the superagent position.
     */
    //% blockId=superagent_replace_area block="superagent replace %fromBlock with %toBlock width %width height %height depth %depth"
    //% width.min=1 width.max=16 height.min=1 height.max=16 depth.min=1 depth.max=16
    //% group="Blueprint"
    export function replaceArea(fromBlock: SuperagentBlock, toBlock: SuperagentBlock, width: number, height: number, depth: number) {
        width = clamp(width, 1, 16)
        height = clamp(height, 1, 16)
        depth = clamp(depth, 1, 16)
        runBuildAtSuperagent("fill ~ ~ ~ ~" + (width - 1) + " ~" + (height - 1) + " ~" + (depth - 1) + " " + blockId(toBlock) + " replace " + blockId(fromBlock))
    }

    /**
     * Special power: strike the nearest hostile with a lightning bolt.
     */
    //% blockId=superagent_lightning block="superagent lightning strike"
    //% group="Powers"
    export function lightningStrike() {
        runAtAgent("scriptevent superagent:lightning")
    }

    /**
     * Special power: knock all nearby hostiles away from the character.
     */
    //% blockId=superagent_force_blast block="superagent force blast radius %radius"
    //% radius.min=1 radius.max=16
    //% group="Powers"
    export function forceBlast(radius: number) {
        runAtAgent("scriptevent superagent:blast " + clamp(radius, 1, 16))
    }

    /**
     * Special power: give the player a protective shield for a few seconds.
     */
    //% blockId=superagent_shield_player block="superagent shield player for %seconds s"
    //% seconds.min=1 seconds.max=120
    //% group="Powers"
    export function shieldPlayer(seconds: number) {
        runAtAgent("scriptevent superagent:shield " + clamp(seconds, 1, 120))
    }

    /**
     * Special power: heal the player to full and grant regeneration.
     */
    //% blockId=superagent_heal_player block="superagent heal player"
    //% group="Powers"
    export function healPlayer() {
        runAtAgent("scriptevent superagent:heal")
    }

    /**
     * Special power: pull nearby dropped items to the player.
     */
    export function magnetItems(radius: number) {
        runAtAgent("scriptevent superagent:magnet " + clamp(radius, 1, 24))
    }

    /**
     * Special power: blink the player to the character (escape / travel).
     */
    //% blockId=superagent_blink_player block="superagent blink player to character"
    //% group="Powers"
    export function blinkPlayer() {
        runAtAgent("scriptevent superagent:blink")
    }

    /**
     * Special power: summon a temporary iron golem ally that fights for you.
     */
    //% blockId=superagent_summon_ally block="superagent summon ally for %seconds s"
    //% seconds.min=5 seconds.max=120
    //% group="Powers"
    export function summonAlly(seconds: number) {
        runAtAgent("scriptevent superagent:ally " + clamp(seconds, 5, 120))
    }

    // ===== Basic command set: Control / Sensing / Thinking / Judging / Communicate =====

    /**
     * Control: stop all movement (clears walk target, path and follow).
     */
    //% blockId=superagent_stop block="superagent stop"
    //% group="Control"
    export function stop() {
        followingAgent = false
        runAtAgent("scriptevent superagent:stop")
    }

    /**
     * Control: turn the character to face a direction.
     */
    //% blockId=superagent_face block="superagent face %direction"
    //% group="Control"
    export function face(direction: SuperagentFaceDirection) {
        runAtAgent("scriptevent superagent:face " + faceDirectionName(direction))
    }

    function faceDirectionName(direction: SuperagentFaceDirection): string {
        if (direction == SuperagentFaceDirection.East) {
            return "east"
        }
        if (direction == SuperagentFaceDirection.South) {
            return "south"
        }
        if (direction == SuperagentFaceDirection.West) {
            return "west"
        }
        return "north"
    }

    /**
     * Sensing: distance in blocks to the Agent, or -1 if not within range.
     */
    //% blockId=superagent_distance_to_agent block="superagent distance to agent up to %max"
    //% max.min=1 max.max=64
    //% group="Sensing"
    export function distanceToAgent(max: number): number {
        max = clamp(max, 1, 64)
        ensureCharacter()
        for (let r = 1; r <= max; r++) {
            if (runAtSuperagent("testfor @e[type=minecraft:agent,r=" + r + "]")) {
                return r
            }
        }
        return -1
    }

    /**
     * Sensing: true when the Agent has solid ground directly below it.
     */
    export function groundBelow(): boolean {
        return agent.detect(AgentDetection.Block, DOWN)
    }

    /**
     * Thinking: a random whole number from 1 to max.
     */
    //% blockId=superagent_random block="superagent random 1 to %max"
    //% max.min=1 max.max=1000
    //% group="Thinking"
    export function randomUpTo(max: number): number {
        max = clamp(max, 1, 1000)
        return Math.randomRange(1, max)
    }

    /**
     * Thinking: add one to a saved counter (survives reloads).
     */
    export function countUp(key: any) {
        let value = memoryValue(key, 1024)
        if (value < 0) {
            value = 0
        }
        remember(key, value + 1)
    }

    /**
     * Thinking: set a saved on/off flag.
     */
    export function setFlag(key: any, on: boolean) {
        remember(key, on ? 1 : 0)
    }

    /**
     * Thinking: true when a saved flag is on.
     */
    export function flagIsOn(key: any): boolean {
        return memoryEquals(key, 1)
    }

    /**
     * Judging: should the character attack? (a hostile is within range)
     */
    //% blockId=superagent_should_attack block="superagent should attack within %radius"
    //% radius.min=1 radius.max=32
    //% group="Judging"
    export function shouldAttack(radius: number): boolean {
        return senseHostiles(radius)
    }

    /**
     * Judging: is it safe? (no hostile within range)
     */
    //% blockId=superagent_is_safe block="superagent is safe within %radius"
    //% radius.min=1 radius.max=32
    //% group="Judging"
    export function isSafe(radius: number): boolean {
        return !senseHostiles(radius)
    }

    /**
     * Judging: is danger very close? (a hostile within 3 blocks)
     */
    //% blockId=superagent_danger_close block="superagent danger close within %radius"
    //% radius.min=1 radius.max=32
    //% group="Judging"
    export function dangerClose(radius: number): boolean {
        let distance = nearestHostileDistance(radius)
        return distance != -1 && distance <= 3
    }

    /**
     * Communicate: show a message from the character to the player.
     */
    //% blockId=superagent_report block="superagent report %text"
    //% group="Communicate"
    export function report(text: any) {
        runAtAgent("title @s actionbar " + textValue(text))
    }

    /**
     * Communicate: show the character's real add-on world position to the player.
     */
    //% blockId=superagent_report_world_position block="superagent report world position"
    //% group="Communicate"
    export function reportWorldPosition() {
        runAtAgent("scriptevent superagent:reportpos")
    }

}
