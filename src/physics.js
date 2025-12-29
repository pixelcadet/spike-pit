// Physics system - character movement and jumping only
// All coordinates use world space (x, y, z)

const Physics = {
    // Court dimensions (in world units)
    COURT_WIDTH: 8,      // 8 cells wide (rotated 90 degrees)
    COURT_LENGTH: 4,     // 4 cells long (depth) - 4x4 grid per side
    NET_X: 4,            // Net divides court horizontally (x-axis) at middle (4 cells per side)
    NET_HEIGHT: 1.0,     // Net height in world units
    NET_TOP_THRESHOLD: 0.05, // Threshold for top edge collision (ball can hit top tape)
    GRAVITY: 0.012,      // Gravity constant for characters
    ballMovementSpeed: 1.0, // Ball movement speed multiplier (1.0 = normal, lower = slower)
    peakHangMultiplier: 0.15, // Gravity multiplier when near peak (0.0 = no gravity at peak = max hang, 1.0 = full gravity)
    peakVelocityThreshold: 0.02, // When |vz| < this, character is considered "at peak" (tighter window for hang effect)
    
    // Spike zone parameters
    SPIKE_ZONE_RADIUS: 0.96,     // Radius of spike zone sphere (default: slider 5)
    SPIKE_ZONE_HEAD_OFFSET: 0.6, // Height above character center for spike zone
    SPIKE_ZONE_FORWARD_OFFSET: 0.3, // Forward offset (toward net) so can't hit balls behind character
    SPIKE_ZONE_UPWARD_OFFSET: 0.2, // Upward offset above character center mass
    SPIKE_POWER: 0.3,            // Power for spike (straight trajectory, fast)
    SPIKE_LOB_POWER: 0.12,      // Power for lob (arching trajectory, slow) - when below/at net height
    SPIKE_LOB_ARCH_HEIGHT: 0.4, // Upward component for lob arching trajectory
    
    // Receiving zone parameters
    RECEIVING_ZONE_RADIUS: 1.2,  // Radius of receiving zone (bigger than spike zone)
    RECEIVE_MOVE_SPEED: 0.25,    // Speed boost when moving toward ball to receive
    RECEIVE_POWER: 0.12,         // Power for receiving hit (weaker than spike, arching trajectory)
    RECEIVE_ARCH_HEIGHT: 0.4,    // Upward component for arching trajectory (higher arc)
    
    // Player character
    player: {
        x: 1.0,          // Serve position: further from net (closer to left edge)
        y: 2.0,           // Middle depth
        z: 0,            // On ground
        vx: 0,
        vy: 0,
        vz: 0,
        speed: 0.15,
        jumpPower: 0.3,
        radius: 0.414,   // Size (20% bigger: 0.345 * 1.2)
        onGround: true,
        hasSpiked: false, // Spike cooldown flag (reset when landing)
        hasReceived: false, // Receive cooldown flag (reset when landing)
        justAttemptedAction: false, // Flag to prevent collision bounce when action was just attempted
        isFalling: false, // Falling state
        fallTimer: 0, // Timer for falling duration (1 second)
        fallEdge: null, // Which edge they fell from ('A', 'B', or 'C')
        fellFromHole: false, // True if the fall was triggered by a destroyed tile overlap (no grace slide)
        isBlinking: false, // Blinking state after respawn
        blinkTimer: 0 // Timer for blinking duration (1 second)
    },
    
    // AI character
    ai: {
        x: 7.0,          // Serve position: further from net (closer to right edge)
        y: 2.0,           // Middle depth
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        speed: 0.12,
        jumpPower: 0.3,
        radius: 0.414,   // Size (20% bigger: 0.345 * 1.2)
        onGround: true,
        hasSpiked: false, // Spike cooldown flag (reset when landing)
        hasReceived: false, // Receive cooldown flag (reset when landing)
        justAttemptedAction: false, // Flag to prevent collision bounce when action was just attempted
        isFalling: false, // Falling state
        fallTimer: 0, // Timer for falling duration (1 second)
        fallEdge: null, // Which edge they fell from ('A', 'B', or 'C')
        fellFromHole: false, // True if the fall was triggered by a destroyed tile overlap (no grace slide)
        isBlinking: false, // Blinking state after respawn
        blinkTimer: 0 // Timer for blinking duration (1 second)
    },
    
    // Ball
    ball: {
        x: 2.0,          // Start on player side
        y: 2.0,           // Middle depth
        z: 2.0,          // Start above character (will drop down)
        vx: 0,
        vy: 0,
        vz: 0,
        radius: 0.3036, // Ball size (15% bigger: 0.264 * 1.15)
        groundLevel: 0,
        bounceDamping: 0.7,  // Energy loss on bounce (0.7 = 70% of velocity retained)
        friction: 0.9,       // Ground friction (0.9 = 90% of velocity retained)
        lastTouchedBy: null, // Track who last touched the ball ('player' or 'ai')
        lastHitType: null,   // 'spike' | 'lob' | 'receive' | 'toss' | 'serve' | 'spikeServe' | 'body' | null
        tileDamageBounces: 0, // Count of ground impacts since last touch (first impact = big dmg, later = 0.2)
        hasScored: false,    // Flag to prevent multiple scores from same bounce/fall
        justServed: false,   // Flag to prevent immediate collision after serve
        serveTimer: 0,        // Timer for serve grace period
        fallingThroughHole: false // When true, ball ignores collisions and keeps falling (prevents "bouncing back up")
    },
    
    init() {
        // Initialize ball position above player
        this.resetBall();
    },
    
    resetBall() {
        // Position ball above player character
        this.ball.x = this.player.x;
        this.ball.y = this.player.y;
        this.ball.z = 2.0; // Above character
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.vz = 0;
        this.ball.lastTouchedBy = null;
        this.ball.lastHitType = null;
        this.ball.tileDamageBounces = 0;
        this.ball.hasScored = false;
        this.ball.justServed = false;
        this.ball.serveTimer = 0;
        this.ball.fallingThroughHole = false;
    },
    
    reset() {
        // Reset player to serve position: further from net
        this.player.x = 1.0; // Further from net (closer to left edge)
        this.player.y = 2.0; // Middle depth
        this.player.z = 0;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.vz = 0;
        this.player.onGround = true;
        this.player.hasSpiked = false;
        this.player.hasReceived = false;
        this.player.isFalling = false;
        this.player.fallTimer = 0;
        this.player.fallEdge = null;
        this.player.fellFromHole = false;
        this.player.isBlinking = false;
        this.player.blinkTimer = 0;
        
        // Reset AI to serve position: further from net
        this.ai.x = 7.0; // Further from net (closer to right edge)
        this.ai.y = 2.0; // Middle depth
        this.ai.z = 0;
        this.ai.vx = 0;
        this.ai.vy = 0;
        this.ai.vz = 0;
        this.ai.onGround = true;
        this.ai.hasSpiked = false;
        this.ai.hasReceived = false;
        this.ai.isFalling = false;
        this.ai.fallTimer = 0;
        this.ai.fallEdge = null;
        this.ai.fellFromHole = false;
        this.ai.isBlinking = false;
        this.ai.blinkTimer = 0;
        
        // Reset game state to starting state (scores, serving)
        Game.init();
    },
    
    // Calculate what percentage of the footprint is outside each court edge
    // Returns an object with percentages for each edge
    // Edge labels (from camera view):
    // - EDGE A: Top side of screen (back of court, y = COURT_LENGTH) - threshold 80%
    // - EDGE B: Left side of screen (opposite from net, x = 0 for player, x = COURT_WIDTH for AI) - threshold 80%
    // - EDGE C: Bottom side of screen (front of court, y = 0)
    getFootprintOutsidePercentages(character) {
        const footprintWidth = character.radius * 1.2;
        const footprintDepth = character.radius * 0.5;
        
        // Calculate footprint box edges
        const footprintLeft = character.x - footprintWidth * 0.5;
        const footprintRight = character.x + footprintWidth * 0.5;
        const footprintFront = character.y - footprintDepth * 0.5;
        const footprintBack = character.y + footprintDepth * 0.5;
        
        let edgeA_Outside = 0; // Top side of screen (back of court, y = COURT_LENGTH)
        let edgeB_Outside = 0; // Left side of screen (opposite from net)
        let edgeC_Outside = 0; // Bottom side of screen (front of court, y = 0)
        
        if (character === this.player) {
            // Player side: x from 0 to NET_X, y from 0 to COURT_LENGTH
            // EDGE A: Top side of screen (back of court, y = COURT_LENGTH) - threshold 70%
            const backOutside = Math.max(0, footprintBack - this.COURT_LENGTH);
            edgeA_Outside = Math.min(1.0, backOutside / footprintDepth);
            
            // EDGE B: Left side of screen (opposite from net, x = 0) - threshold 50%
            const leftOutside = Math.max(0, 0 - footprintLeft);
            edgeB_Outside = Math.min(1.0, leftOutside / footprintWidth);
            
            // EDGE C: Bottom side of screen (front of court, y = 0)
            const frontOutside = Math.max(0, 0 - footprintFront);
            edgeC_Outside = Math.min(1.0, frontOutside / footprintDepth);
        } else {
            // AI side: x from NET_X to COURT_WIDTH, y from 0 to COURT_LENGTH
            // EDGE A: Top side of screen (back of court, y = COURT_LENGTH) - threshold 70%
            const backOutside = Math.max(0, footprintBack - this.COURT_LENGTH);
            edgeA_Outside = Math.min(1.0, backOutside / footprintDepth);
            
            // EDGE B: Left side of screen (opposite from net, x = COURT_WIDTH) - threshold 50%
            const rightOutside = Math.max(0, footprintRight - this.COURT_WIDTH);
            edgeB_Outside = Math.min(1.0, rightOutside / footprintWidth);
            
            // EDGE C: Bottom side of screen (front of court, y = 0)
            const frontOutside = Math.max(0, 0 - footprintFront);
            edgeC_Outside = Math.min(1.0, frontOutside / footprintDepth);
        }
        
        return {
            edgeA: edgeA_Outside,  // Top side of screen (back of court)
            edgeB: edgeB_Outside,  // Left side of screen (opposite from net)
            edgeC: edgeC_Outside   // Bottom side of screen (front of court)
        };
    },
    
    // Check if character's footprint is at least partially on the court
    // Uses different thresholds for different edges
    // Edge labels (from camera view):
    // - EDGE A: Top side of screen (back of court) - threshold 70%
    // - EDGE B: Left side of screen (opposite from net) - threshold 50%
    // - EDGE C: Bottom side of screen (front of court) - threshold 5%
    isFootprintOnCourt(character) {
        // Edges first (fast path)
        if (!this.isFootprintOnCourtEdgesOnly(character)) return false;

        // Hole rule: directional thresholds based on which side of the hole "trapezoid" the character is on.
        // - Top/back side of hole: fall sooner (lower threshold)
        // - Bottom/front side of hole: fall later (higher threshold)
        // - Left/right sides: medium threshold
        const holeInfo = this.getFootprintHoleOverlapInfo(character);
        if (!holeInfo.overlaps.length) return true;

        let minThreshold = Infinity;
        for (const o of holeInfo.overlaps) {
            const t = this.getHoleFallThresholdForTileApproach(character, o.tx, o.ty);
            if (t < minThreshold) minThreshold = t;
            if (o.overlap >= t) return false;
        }

        // Adjacent holes: overlap can be split across tiles, so also consider total overlap.
        // Use the most-forgiving threshold among the overlapped tiles (minThreshold), so bottom/front "falls later"
        // still behaves as intended even when standing across multiple holes.
        if (holeInfo.totalOverlap >= minThreshold) return false;
        return true;
    },

    // Edge-only standing check (no hole logic). Used to distinguish edge-fall vs hole-fall.
    isFootprintOnCourtEdgesOnly(character) {
        const percentages = this.getFootprintOutsidePercentages(character);
        
        // Character falls if any edge exceeds its threshold:
        const edgeA_Threshold = 0.7; // Top side (back of court) - can lean more
        const edgeB_Threshold = 0.5; // Left side (opposite from net) - falls once center crosses boundary
        const edgeC_Threshold = 0.05; // Bottom side (front of court) - falls quickly
        
        // Character can stand if all edges are below their thresholds
        const onCourtEdges = percentages.edgeA < edgeA_Threshold && 
                             percentages.edgeB < edgeB_Threshold && 
                             percentages.edgeC < edgeC_Threshold;
        return onCourtEdges;
    },
    
    // Returns 0..1 indicating the maximum fraction of the character footprint that lies over any single destroyed tile.
    // Computed via exact rectangle–tile intersection area (no sampling), so visuals match physics more closely.
    getFootprintHoleOverlapMax(character) {
        if (!Game?.getTileState) return 0;
        
        // Use a slightly larger footprint for hole overlap than for edge checks, to better match what players perceive
        // as the "base" of the character in the perspective view.
        const footprintWidth = character.radius * 1.35;
        const footprintDepth = character.radius * 0.9;
        
        const left = character.x - footprintWidth * 0.5;
        const right = character.x + footprintWidth * 0.5;
        const front = character.y - footprintDepth * 0.5;
        const back = character.y + footprintDepth * 0.5;

        const footprintArea = Math.max(0.000001, (right - left) * (back - front));

        // Only tiles overlapped by the footprint AABB can contribute.
        const txMin = Math.max(0, Math.floor(left));
        const txMax = Math.min(this.COURT_WIDTH - 1, Math.floor(right - 1e-6));
        const tyMin = Math.max(0, Math.floor(front));
        const tyMax = Math.min(this.COURT_LENGTH - 1, Math.floor(back - 1e-6));

        let maxOverlap = 0;
        for (let ty = tyMin; ty <= tyMax; ty++) {
            const tileY0 = ty;
            const tileY1 = ty + 1;
            const iy0 = Math.max(front, tileY0);
            const iy1 = Math.min(back, tileY1);
            const ih = iy1 - iy0;
            if (ih <= 0) continue;

            for (let tx = txMin; tx <= txMax; tx++) {
                const tile = Game.getTileState(tx, ty);
                if (!tile || tile.indestructible || !tile.destroyed) continue;

                const tileX0 = tx;
                const tileX1 = tx + 1;
                const ix0 = Math.max(left, tileX0);
                const ix1 = Math.min(right, tileX1);
                const iw = ix1 - ix0;
                if (iw <= 0) continue;

                const overlapArea = iw * ih;
                const ratio = overlapArea / footprintArea;
                if (ratio > maxOverlap) maxOverlap = ratio;
            }
        }

        return Math.max(0, Math.min(1, maxOverlap));
    },

    // Returns overlap details for destroyed tiles under the character footprint.
    // - overlaps: [{tx, ty, overlap}] for each destroyed (non-indestructible) tile touched
    // - maxOverlap: max single-tile overlap
    // - totalOverlap: sum of overlaps across all destroyed tiles (helps when holes are adjacent)
    getFootprintHoleOverlapInfo(character) {
        if (!Game?.getTileState) {
            return { overlaps: [], maxOverlap: 0, totalOverlap: 0, maxTx: -1, maxTy: -1 };
        }

        // Same footprint as `getFootprintHoleOverlapMax()` so visuals + physics match.
        const footprintWidth = character.radius * 1.35;
        const footprintDepth = character.radius * 0.9;

        const left = character.x - footprintWidth * 0.5;
        const right = character.x + footprintWidth * 0.5;
        const front = character.y - footprintDepth * 0.5;
        const back = character.y + footprintDepth * 0.5;

        const footprintArea = Math.max(0.000001, (right - left) * (back - front));

        const txMin = Math.max(0, Math.floor(left));
        const txMax = Math.min(this.COURT_WIDTH - 1, Math.floor(right - 1e-6));
        const tyMin = Math.max(0, Math.floor(front));
        const tyMax = Math.min(this.COURT_LENGTH - 1, Math.floor(back - 1e-6));

        const overlaps = [];
        let maxOverlap = 0;
        let totalOverlap = 0;
        let maxTx = -1;
        let maxTy = -1;

        for (let ty = tyMin; ty <= tyMax; ty++) {
            const tileY0 = ty;
            const tileY1 = ty + 1;
            const iy0 = Math.max(front, tileY0);
            const iy1 = Math.min(back, tileY1);
            const ih = iy1 - iy0;
            if (ih <= 0) continue;

            for (let tx = txMin; tx <= txMax; tx++) {
                const tile = Game.getTileState(tx, ty);
                if (!tile || tile.indestructible || !tile.destroyed) continue;

                const tileX0 = tx;
                const tileX1 = tx + 1;
                const ix0 = Math.max(left, tileX0);
                const ix1 = Math.min(right, tileX1);
                const iw = ix1 - ix0;
                if (iw <= 0) continue;

                const overlapArea = iw * ih;
                const ratio = overlapArea / footprintArea;
                if (ratio <= 0) continue;

                overlaps.push({ tx, ty, overlap: ratio });
                totalOverlap += ratio;
                if (ratio > maxOverlap) {
                    maxOverlap = ratio;
                    maxTx = tx;
                    maxTy = ty;
                }
            }
        }

        return {
            overlaps,
            maxOverlap: Math.max(0, Math.min(1, maxOverlap)),
            totalOverlap: Math.max(0, Math.min(1, totalOverlap)),
            maxTx,
            maxTy
        };
    },

    // Directional hole fall thresholds (by approach direction relative to tile center).
    // Interpretation:
    // - dy > 0 => character is "above" the tile center (approaching from top/back): fall sooner (0.15)
    // - dy < 0 => approaching from bottom/front: fall later (0.85)
    // - Left/right approaches: 0.70
    getHoleFallThresholdForTileApproach(character, tx, ty) {
        const cx = tx + 0.5;
        const cy = ty + 0.5;
        const dx = character.x - cx;
        const dy = character.y - cy;

        // Choose dominant axis to determine which "side" of the trapezoid we're on.
        if (Math.abs(dy) >= Math.abs(dx)) {
            return dy > 0 ? 0.15 : 0.85;
        }
        return 0.7;
    },
    
    // Determine which tile the ball "landed on" by sampling points around the ball's footprint circle.
    // Returns { tx, ty } (always a single tile), or null if no in-bounds samples.
    getBallLandingTile() {
        const b = this.ball;
        const r = b.radius;
        const samples = [
            [0, 0],
            [r, 0],
            [-r, 0],
            [0, r],
            [0, -r],
            [r * 0.707, r * 0.707],
            [r * 0.707, -r * 0.707],
            [-r * 0.707, r * 0.707],
            [-r * 0.707, -r * 0.707]
        ];
        
        const counts = new Map();
        for (const [dx, dy] of samples) {
            const sx = b.x + dx;
            const sy = b.y + dy;
            const tx = Math.floor(sx);
            const ty = Math.floor(sy);
            if (tx < 0 || tx >= this.COURT_WIDTH || ty < 0 || ty >= this.COURT_LENGTH) continue;
            const key = `${tx},${ty}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        
        if (counts.size === 0) {
            const tx = Math.floor(Math.max(0, Math.min(this.COURT_WIDTH - 0.001, b.x)));
            const ty = Math.floor(Math.max(0, Math.min(this.COURT_LENGTH - 0.001, b.y)));
            return { tx, ty };
        }
        
        let bestKey = null;
        let bestCount = -1;
        for (const [key, count] of counts.entries()) {
            if (count > bestCount) {
                bestCount = count;
                bestKey = key;
            }
        }
        const [txStr, tyStr] = bestKey.split(',');
        return { tx: Number(txStr), ty: Number(tyStr) };
    },
    
    // Check if ball is on the court (accounting for ball radius)
    // Ball is "on court" if any part of it overlaps the court boundaries
    isBallOnCourt() {
        const b = this.ball;
        
        // Court boundaries: x from 0 to COURT_WIDTH, y from 0 to COURT_LENGTH
        // Account for ball radius - ball is on court if its center is within
        // (radius) distance of the court boundaries
        
        // Check horizontal bounds (x-axis)
        // Ball is on court if center is between -radius and COURT_WIDTH + radius
        const onCourtX = (b.x + b.radius >= 0) && (b.x - b.radius <= this.COURT_WIDTH);
        
        // Check depth bounds (y-axis)
        // Ball is on court if center is between -radius and COURT_LENGTH + radius
        const onCourtY = (b.y + b.radius >= 0) && (b.y - b.radius <= this.COURT_LENGTH);
        
        return onCourtX && onCourtY;
    },
    
    updatePlayer(input, deltaTime = 1/60) {
        const p = this.player;
        
        // SIMPLE FALLING/RESPAWN SYSTEM
        // Only trigger falling when character is actually falling (on ground and off court, or z < -2)
        // Don't trigger during jumps - allow characters to jump over edges
        const isOffCourt = !this.isFootprintOnCourt(p);
        const hasFallenTooFar = p.z < -2.0;
        // IMPORTANT: don't require onGround here. We can set onGround=false later in the frame when the
        // footprint is invalid, which previously allowed a "half fall then pop back up" state.
        // If the character is at/under the ground plane and their footprint is invalid (edge or hole),
        // they should enter the falling state.
        const isAtOrBelowGroundAndOffCourt = (p.z <= 0.01) && isOffCourt;
        
        // Only start falling if: (at/below ground and off court) OR (fallen too far below)
        // This allows jumping over edges without triggering falling state
        if ((isAtOrBelowGroundAndOffCourt || hasFallenTooFar) && !p.isFalling) {
            p.isFalling = true;
            p.fallTimer = 0;
            // CRITICAL: ensure gravity actually applies during the falling state.
            // Without this, it's possible to enter `isFalling` while `onGround` is still true (from the prior frame),
            // which makes the character "hang" at the edge until respawn.
            p.onGround = false;
            if (p.vz > -0.08) p.vz = -0.08;
            // Distinguish edge-fall vs hole-fall. We only apply grace slide for edge falls.
            p.fellFromHole = this.isFootprintOnCourtEdgesOnly(p) && !this.isFootprintOnCourt(p);
            // Determine which edge they fell from
            const percentages = this.getFootprintOutsidePercentages(p);
            if (percentages.edgeA >= 0.7) {
                p.fallEdge = 'A';
            } else if (percentages.edgeB >= 0.5) {
                p.fallEdge = 'B';
            } else if (percentages.edgeC >= 0.05) {
                p.fallEdge = 'C';
            } else {
                p.fallEdge = 'A'; // Default
            }
        }
        
        // Handle falling state - MUST be first, before any movement processing
        if (p.isFalling) {
            // After 1 second, respawn
            if (p.fallTimer >= 1.0) {
                this.respawnCharacter(p);
                p.isFalling = false;
                p.fallTimer = 0;
                p.fallEdge = null;
                // After respawn, allow normal movement again - don't return early
                // Continue with normal update logic below
            } else {
                // Still falling - disable all controls while falling - still apply gravity though
                if (!p.onGround) {
                    const absVz = Math.abs(p.vz);
                    if (absVz < this.peakVelocityThreshold) {
                        p.vz -= this.GRAVITY * this.peakHangMultiplier;
                    } else {
                        p.vz -= this.GRAVITY;
                    }
                }
                // Update position (only gravity affects it)
                p.z += p.vz;
                // Grace slide: while falling off an EDGE (not a hole), drift outward so it never reads like "hanging".
                // Small world-units-per-second drift, scaled by deltaTime for consistency.
                if (!p.fellFromHole) {
                    const slideSpeed = 0.55; // tiles/sec (tuned for subtlety)
                    if (p.fallEdge === 'A') p.y += slideSpeed * deltaTime;
                    else if (p.fallEdge === 'C') p.y -= slideSpeed * deltaTime;
                    else if (p.fallEdge === 'B') p.x -= slideSpeed * deltaTime; // player outer edge is x < 0
                }
                // Don't allow getting back on court while falling - keep falling until timer expires
                return;
            }
        }
        
        // Check if we're in receiving mode (ball in zone but not at center)
        // If so, automatic movement takes priority
        let isReceiving = false;
        if (input.isHitPressed()) {
            const b = this.ball;
            // Check if ball is in receiving zone
            const receiveZoneX = p.x;
            const receiveZoneY = p.y;
            const receiveZoneZ = p.z;
            const dx = b.x - receiveZoneX;
            const dy = b.y - receiveZoneY;
            const dz = b.z - receiveZoneZ;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const effectiveRadius = this.RECEIVING_ZONE_RADIUS + b.radius;
            
            if (dist <= effectiveRadius && b.z > b.groundLevel) {
                // Ball is in receiving zone and mid-air
                const horizontalDist = Math.sqrt(dx * dx + dy * dy);
                const centerThreshold = this.RECEIVING_ZONE_RADIUS * 0.3;
                
                // If not close to center, we're in receiving mode (automatic movement active)
                if (horizontalDist > centerThreshold) {
                    isReceiving = true;
                }
            }
        }
        
        // Lock movement when serving (but allow jump for spike serve)
        if (Game.state.isServing && Game.state.servingPlayer === 'player') {
            // Character cannot move while serving
            p.vx = 0;
            p.vy = 0;
            // Allow jump if spike serve is pending (jump already triggered in serveBallWithCharge)
            if (!Game.state.spikeServePending && p.onGround) {
                p.vz = 0;
            }
        } else {
            // Apply blinking penalty: half speed and jump power while blinking
            const speedMultiplier = p.isBlinking ? 0.5 : 1.0;
            const jumpMultiplier = p.isBlinking ? 0.5 : 1.0;
            
            // Horizontal movement (x-axis)
            const hDir = input.getHorizontal();
            // If receiving, don't override automatic movement (it's already set by attemptReceive)
            if (!isReceiving) {
                p.vx = hDir * p.speed * speedMultiplier;
            } else {
                // Combine automatic movement with manual input (manual adds to automatic)
                const manualVx = hDir * p.speed * speedMultiplier;
                p.vx += manualVx * 0.3; // Manual input adds 30% influence
            }
            
            // Depth movement (y-axis)
            const dDir = input.getDepth();
            // If receiving, don't override automatic movement
            if (!isReceiving) {
                p.vy = dDir * p.speed * speedMultiplier;
            } else {
                // Combine automatic movement with manual input
                const manualVy = dDir * p.speed * speedMultiplier;
                p.vy += manualVy * 0.3; // Manual input adds 30% influence
            }
            
            // Jump
            if (input.isJumpPressed() && p.onGround) {
                p.vz = p.jumpPower * jumpMultiplier;
                p.onGround = false;
            }
        }
        
        // Apply gravity (reduced when very close to peak for hang time)
        // Only affects a small window around the peak, not general ascent/descent
        if (!p.onGround) {
            const absVz = Math.abs(p.vz);
            if (absVz < this.peakVelocityThreshold) {
                // Very close to peak (just before or just after) - apply reduced gravity for hang time
                p.vz -= this.GRAVITY * this.peakHangMultiplier;
            } else {
                // Normal ascent or descent - apply full gravity
                p.vz -= this.GRAVITY;
            }
        }
        
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        
        // Ground collision - only if footprint is on court
        if (p.z <= 0) {
            // Check if character's body edge would overlap with the net
            // Player is on left side, so check if right edge (x + radius) would cross net
            const characterRightEdge = p.x + p.radius;
            const isTooCloseToNet = characterRightEdge >= this.NET_X;
            
            if (isTooCloseToNet) {
                // Push character away so body edge aligns with net
                // Set character's right edge to be exactly at the net
                p.x = this.NET_X - p.radius;
            }
            
            // Only allow standing if footprint is on court (less than 70% outside)
            if (this.isFootprintOnCourt(p) && !p.isFalling) {
                p.z = 0; // Clamp to ground level only if on court
                p.vz = 0;
                p.onGround = true;
                p.hasSpiked = false; // Reset spike cooldown when landing
                p.hasReceived = false; // Reset receive cooldown when landing
            } else {
                // Footprint exceeds threshold on at least one edge - character falls through
                p.onGround = false;
                // Don't reset vz to 0, let gravity continue pulling down
                // Don't clamp z to 0, let them fall below ground level
            }
        }
        
        // Check if character stepped off court while on ground
        if (p.onGround && !this.isFootprintOnCourt(p)) {
            p.onGround = false; // Start falling immediately
            
            // Add a gentle push away from court center for natural sliding-off animation
            const percentages = this.getFootprintOutsidePercentages(p);
            // Check if any edge exceeds its threshold (EDGE A: 70%, EDGE B: 50%, EDGE C: 5%)
            if (percentages.edgeA >= 0.7 || percentages.edgeB >= 0.5 || percentages.edgeC >= 0.05) {
                // Calculate direction from court center to character
                const courtCenterX = this.NET_X * 0.5; // Center of player's side
                const courtCenterY = this.COURT_LENGTH * 0.5;
                
                const dirX = p.x - courtCenterX;
                const dirY = p.y - courtCenterY;
                const dist = Math.sqrt(dirX * dirX + dirY * dirY);
                
                if (dist > 0.01) { // Avoid division by zero
                    // Normalize direction and apply gentle push (15% of movement speed)
                    const pushStrength = p.speed * 0.15;
                    p.vx += (dirX / dist) * pushStrength;
                    p.vy += (dirY / dist) * pushStrength;
                }
            }
        }
        
        // Prevent player from crossing the net horizontally
        // Check if character's body edge (right edge for player) would cross net
        const characterRightEdge = p.x + p.radius;
        if (characterRightEdge >= this.NET_X) {
            // Push character away so body edge aligns with net
            p.x = this.NET_X - p.radius;
        }
        
        // Prevent player from standing on top of the net (mid-air)
        // Check if character's body edge is too close to net AND z position is at/above net height
        if (characterRightEdge >= this.NET_X && p.z >= this.NET_HEIGHT) {
            // Push character away from the net horizontally
            p.x = this.NET_X - p.radius;
            // If on ground, also push them down slightly to prevent floating
            if (p.onGround && p.z <= this.NET_HEIGHT + 0.1) {
                p.z = Math.max(0, p.z - 0.05);
            }
        }
    },
    
    updateAI(aiInput, deltaTime = 1/60) {
        const ai = this.ai;
        
        // SIMPLE FALLING/RESPAWN SYSTEM
        // Only trigger falling when character is actually falling (on ground and off court, or z < -2)
        // Don't trigger during jumps - allow characters to jump over edges
        const isOffCourt = !this.isFootprintOnCourt(ai);
        const hasFallenTooFar = ai.z < -2.0;
        // Same rationale as player: don't rely on onGround, because it can be set false later in the frame,
        // leaving a "half fall then snap back" state. If we're at/under the ground plane and off court, fall.
        const isAtOrBelowGroundAndOffCourt = (ai.z <= 0.01) && isOffCourt;
        
        // Only start falling if: (at/below ground and off court) OR (fallen too far below)
        // This allows jumping over edges without triggering falling state
        if ((isAtOrBelowGroundAndOffCourt || hasFallenTooFar) && !ai.isFalling) {
            ai.isFalling = true;
            ai.fallTimer = 0;
            // CRITICAL: ensure gravity applies during falling (avoid "hanging" while off-court).
            ai.onGround = false;
            if (ai.vz > -0.08) ai.vz = -0.08;
            // Distinguish edge-fall vs hole-fall. We only apply grace slide for edge falls.
            ai.fellFromHole = this.isFootprintOnCourtEdgesOnly(ai) && !this.isFootprintOnCourt(ai);
            // Determine which edge they fell from
            const percentages = this.getFootprintOutsidePercentages(ai);
            if (percentages.edgeA >= 0.7) {
                ai.fallEdge = 'A';
            } else if (percentages.edgeB >= 0.5) {
                ai.fallEdge = 'B';
            } else if (percentages.edgeC >= 0.05) {
                ai.fallEdge = 'C';
            } else {
                ai.fallEdge = 'A'; // Default
            }
        }
        
        // Handle falling state - MUST be first, before any movement processing
        if (ai.isFalling) {
            // After 1 second, respawn
            if (ai.fallTimer >= 1.0) {
                this.respawnCharacter(ai);
                ai.isFalling = false;
                ai.fallTimer = 0;
                ai.fallEdge = null;
                // After respawn, allow normal movement again - don't return early
                // Continue with normal update logic below
            } else {
                // Still falling - disable all controls while falling - still apply gravity though
                if (!ai.onGround) {
                    const absVz = Math.abs(ai.vz);
                    if (absVz < this.peakVelocityThreshold) {
                        ai.vz -= this.GRAVITY * this.peakHangMultiplier;
                    } else {
                        ai.vz -= this.GRAVITY;
                    }
                }
                // Update position (only gravity affects it)
                ai.z += ai.vz;
                // Grace slide: while falling off an EDGE (not a hole), drift outward so it never reads like "hanging".
                if (!ai.fellFromHole) {
                    const slideSpeed = 0.55; // tiles/sec (tuned for subtlety)
                    if (ai.fallEdge === 'A') ai.y += slideSpeed * deltaTime;
                    else if (ai.fallEdge === 'C') ai.y -= slideSpeed * deltaTime;
                    else if (ai.fallEdge === 'B') ai.x += slideSpeed * deltaTime; // AI outer edge is x > COURT_WIDTH
                }
                // Don't allow getting back on court while falling - keep falling until timer expires
                return;
            }
        }
        
        // Lock movement and jump when serving
        if (Game.state.isServing && Game.state.servingPlayer === 'ai') {
            // AI cannot move or jump while serving
            ai.vx = 0;
            ai.vy = 0;
            // Force AI to be grounded during serve (prevents any leftover mid-air state looking like a jump)
            ai.vz = 0;
            ai.z = 0;
            ai.onGround = true;
            ai.isFalling = false;
            ai.fallTimer = 0;
            ai.fallEdge = null;
        } else {
            // Apply blinking penalty: half speed and jump power while blinking
            const speedMultiplier = ai.isBlinking ? 0.5 : 1.0;
            const jumpMultiplier = ai.isBlinking ? 0.5 : 1.0;
            
            // AI movement (set by AI system)
            ai.vx = (aiInput.vx || 0) * speedMultiplier;
            ai.vy = (aiInput.vy || 0) * speedMultiplier;
            
            // AI jump
            if (aiInput.jump && ai.onGround) {
                ai.vz = ai.jumpPower * jumpMultiplier;
                ai.onGround = false;
            }
        }
        
        // Apply gravity (reduced when very close to peak for hang time)
        // Only affects a small window around the peak, not general ascent/descent
        if (!ai.onGround) {
            const absVz = Math.abs(ai.vz);
            if (absVz < this.peakVelocityThreshold) {
                // Very close to peak (just before or just after) - apply reduced gravity for hang time
                ai.vz -= this.GRAVITY * this.peakHangMultiplier;
            } else {
                // Normal ascent or descent - apply full gravity
                ai.vz -= this.GRAVITY;
            }
        }
        
        // Update position
        ai.x += ai.vx;
        ai.y += ai.vy;
        ai.z += ai.vz;
        
        // Ground collision - only if footprint is on court
        if (ai.z <= 0) {
            // Check if character's body edge would overlap with the net
            // AI is on right side, so check if left edge (x - radius) would cross net
            const characterLeftEdge = ai.x - ai.radius;
            const isTooCloseToNet = characterLeftEdge <= this.NET_X;
            
            if (isTooCloseToNet) {
                // Push character away so body edge aligns with net
                // Set character's left edge to be exactly at the net
                ai.x = this.NET_X + ai.radius;
            }
            
            // Only allow standing if footprint is on court (edge-specific thresholds) and not falling
            if (this.isFootprintOnCourt(ai) && !ai.isFalling) {
                ai.z = 0; // Clamp to ground level only if on court
                ai.vz = 0;
                ai.onGround = true;
                ai.hasSpiked = false; // Reset spike cooldown when landing
                ai.hasReceived = false; // Reset receive cooldown when landing
            } else {
                // Footprint exceeds threshold on at least one edge - character falls through
                ai.onGround = false;
                // Don't reset vz to 0, let gravity continue pulling down
                // Don't clamp z to 0, let them fall below ground level
            }
        }
        
        // Check if character stepped off court while on ground (70% threshold)
        if (ai.onGround && !this.isFootprintOnCourt(ai)) {
            ai.onGround = false; // Start falling immediately
            
            // Add a gentle push away from court center for natural sliding-off animation
            const percentages = this.getFootprintOutsidePercentages(ai);
            // Check if any edge exceeds its threshold (EDGE A: 70%, EDGE B: 50%, EDGE C: 5%)
            if (percentages.edgeA >= 0.7 || percentages.edgeB >= 0.5 || percentages.edgeC >= 0.05) {
                // Calculate direction from court center to character
                // AI is on the right side, so court center is on AI's side
                const courtCenterX = this.NET_X + (this.COURT_WIDTH - this.NET_X) * 0.5; // Center of AI's side
                const courtCenterY = this.COURT_LENGTH * 0.5;
                
                const dirX = ai.x - courtCenterX;
                const dirY = ai.y - courtCenterY;
                const dist = Math.sqrt(dirX * dirX + dirY * dirY);
                
                if (dist > 0.01) { // Avoid division by zero
                    // Normalize direction and apply gentle push (15% of movement speed)
                    const pushStrength = ai.speed * 0.15;
                    ai.vx += (dirX / dist) * pushStrength;
                    ai.vy += (dirY / dist) * pushStrength;
                }
            }
        }
        
        // Prevent AI from crossing the net horizontally
        // Check if character's body edge (left edge for AI) would cross net
        const characterLeftEdge = ai.x - ai.radius;
        if (characterLeftEdge <= this.NET_X) {
            // Push character away so body edge aligns with net
            ai.x = this.NET_X + ai.radius;
        }
        
        // Prevent AI from standing on top of the net (mid-air)
        // Check if character's body edge is too close to net AND z position is at/above net height
        if (characterLeftEdge <= this.NET_X && ai.z >= this.NET_HEIGHT) {
            // Push character away from the net horizontally
            ai.x = this.NET_X + ai.radius;
            // If on ground, also push them down slightly to prevent floating
            if (ai.onGround && ai.z <= this.NET_HEIGHT + 0.1) {
                ai.z = Math.max(0, ai.z - 0.05);
            }
        }
    },
    
    checkBallCharacterCollision(character) {
        // Skip collision bounce if character just attempted an action (spike/receive)
        // This prevents the bounce from overriding the action's velocity
        if (character.justAttemptedAction) {
            return false;
        }
        
        // Skip collision if ball was just served (prevents immediate collision with serving character)
        if (this.ball.justServed) {
            return false;
        }
        
        const b = this.ball;
        const dx = b.x - character.x;
        const dy = b.y - character.y;
        const dz = b.z - character.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const collisionDist = b.radius + character.radius;
        
        if (dist < collisionDist) {
            // Collision detected - calculate bounce
            const pushDirX = dx / dist;
            const pushDirY = dy / dist;
            const pushDirZ = dz / dist;
            
            // Move ball to just outside character
            b.x = character.x + pushDirX * (collisionDist + 0.05);
            b.y = character.y + pushDirY * (collisionDist + 0.05);
            b.z = character.z + pushDirZ * (collisionDist + 0.05);
            
            // Ensure ball doesn't go below ground
            if (b.z < b.groundLevel) {
                b.z = b.groundLevel;
            }
            
            // Calculate bounce velocity based on character's movement
            // Character's velocity contributes to ball's bounce
            const characterSpeed = Math.sqrt(character.vx * character.vx + character.vy * character.vy);
            const bouncePower = 0.15; // Base bounce power
            const speedMultiplier = Math.min(characterSpeed * 2, 0.1); // Character speed adds to bounce
            
            // Bounce direction: opposite of collision normal + character velocity influence
            // The ball bounces away from the character in the direction opposite to where it came from
            // Plus it gets pushed in the direction the character is moving
            // Scale by ballMovementSpeed to maintain same trajectory at different time scales
            b.vx = (pushDirX * (bouncePower + speedMultiplier) + character.vx * 0.3) * this.ballMovementSpeed;
            b.vy = (pushDirY * (bouncePower + speedMultiplier) + character.vy * 0.3) * this.ballMovementSpeed;
            b.vz = (pushDirZ * (bouncePower + speedMultiplier) + 0.1) * this.ballMovementSpeed; // Always add some upward component
            
            // Apply bounce damping
            b.vx *= b.bounceDamping;
            b.vy *= b.bounceDamping;
            b.vz *= b.bounceDamping;

            // If the ball bumps a character's body very close to the ground, it can end up with
            // too little airtime (especially with low ballMovementSpeed) and immediately hit the ground,
            // making it feel like you "can't receive" even though the ball is overlapping your body.
            // Ensure body bounces always pop the ball slightly up so it remains interactable.
            if (b.z <= b.groundLevel + 0.02) {
                b.z = b.groundLevel + 0.05;
                const minVz = 0.08 * this.ballMovementSpeed;
                if (b.vz < minVz) b.vz = minVz;
            }
            
            // Track who last touched the ball
            b.lastTouchedBy = (character === this.player) ? 'player' : 'ai';
            b.lastHitType = 'body';
            b.tileDamageBounces = 0;
            b.hasScored = false; // Reset score flag on new touch
            b.fallingThroughHole = false;
            
            return true;
        }
        return false;
    },
    
    // Attempt to spike the ball (called when character presses spike key mid-air)
    attemptSpike(character) {
        // Can only spike when mid-air and haven't spiked this jump
        // Also can't spike if already received this jump (prevent spamming)
        if (character.onGround || character.hasSpiked || character.hasReceived) {
            return false;
        }
        
        const b = this.ball;
        
        // Can't spike ball that is on the ground (only mid-air balls)
        if (b.z <= b.groundLevel) {
            return false;
        }
        
        // Calculate spike zone center (at character's center mass, offset forward and upward)
        // Offset forward so character can't spike balls behind them
        let forwardOffset = this.SPIKE_ZONE_FORWARD_OFFSET;
        if (character === this.ai) {
            // AI is on right side, forward is toward left (decreasing x)
            forwardOffset = -forwardOffset;
        }
        const spikeZoneX = character.x + forwardOffset;
        const spikeZoneY = character.y;
        const spikeZoneZ = character.z + this.SPIKE_ZONE_UPWARD_OFFSET; // Slightly above center mass
        
        // Check if ball is within spike zone (3D distance)
        // Account for ball's radius - if any part of ball overlaps zone, it's in
        const dx = b.x - spikeZoneX;
        const dy = b.y - spikeZoneY;
        const dz = b.z - spikeZoneZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const effectiveRadius = this.SPIKE_ZONE_RADIUS + b.radius;
        
        if (dist > effectiveRadius) {
            return false; // Ball not in spike zone
        }
        
        // Determine trajectory based on ball height relative to net
        // If ball is at or below net height: lob (arching, slow)
        // If ball is above net height: spike (straight, fast)
        const isLob = b.z <= this.NET_HEIGHT;
        
        if (isLob) {
            // LOB: Arching trajectory (slow, high arc)
            // Determine target (opponent's side)
            let targetX, targetY;
            if (character === this.player) {
                // Player hits toward AI side (right side, x > NET_X)
                targetX = this.COURT_WIDTH * 0.75; // 75% across court (AI side)
                // Allow aiming with buffered W/S input (doesn't require perfect simultaneous press)
                const aimDir = Input.getAimDepthDirection?.() ?? 0;
                const aimOffset = this.COURT_LENGTH * 0.22; // lane offset (~top/bottom)
                targetY = this.COURT_LENGTH * 0.5 + aimDir * aimOffset;
                targetY = Math.max(0.3, Math.min(this.COURT_LENGTH - 0.3, targetY));
            } else {
                // AI hits toward player side (left side, x < NET_X)
                targetX = this.COURT_WIDTH * 0.25; // 25% across court (player side)
                targetY = this.COURT_LENGTH * 0.5;  // Middle depth
            }
            
            const dirX = targetX - b.x;
            const dirY = targetY - b.y;
            const horizontalDist = Math.sqrt(dirX * dirX + dirY * dirY);
            
            // Normalize horizontal direction
            const horizontalPower = this.SPIKE_LOB_POWER * 0.8; // Slightly weaker horizontal
            b.vx = (dirX / horizontalDist) * horizontalPower * this.ballMovementSpeed;
            b.vy = (dirY / horizontalDist) * horizontalPower * this.ballMovementSpeed;
            b.vz = this.SPIKE_LOB_ARCH_HEIGHT * this.ballMovementSpeed; // Upward for arch
            
            // Add character's velocity influence (slight)
            b.vx += character.vx * 0.1;
            b.vy += character.vy * 0.1;
            
            b.lastHitType = 'lob';
            b.tileDamageBounces = 0;
            b.fallingThroughHole = false;
        } else {
            // SPIKE: Strong trajectory with steep downward angle (similar to spike serve)
            // Calculate target based on ball's distance from net
            let targetX, targetY;
            let spikeDistanceRatio = 0.5; // 0=at net, 1=far back (used to shape steepness)
            
            if (character === this.player) {
                // Player spikes toward AI side (x > NET_X)
                // Determine spike depth based on spiker distance to the net:
                // - near net → short / steep (front of opponent court, close to net)
                // - mid court → deepest-in (furthest point from net while still in)
                // - far from net → mid court (safer, more central landing)
                const t = Math.max(0, Math.min(1, (this.NET_X - character.x) / this.NET_X)); // 0=at net, 1=far back
                spikeDistanceRatio = t;
                const span = (this.COURT_WIDTH - this.NET_X);
                const xFront = this.NET_X + span * 0.15;
                const xDeep = this.NET_X + span * 0.90;
                const xMid = this.NET_X + span * 0.55;
                if (t <= 0.5) {
                    targetX = xFront + (xDeep - xFront) * (t / 0.5);
                } else {
                    targetX = xDeep + (xMid - xDeep) * ((t - 0.5) / 0.5);
                }
                targetX = Math.max(this.NET_X + 0.4, Math.min(this.COURT_WIDTH - 0.4, targetX));
                // Allow aiming with buffered W/S input (doesn't require perfect simultaneous press)
                const aimDir = Input.getAimDepthDirection?.() ?? 0;
                const aimOffset = this.COURT_LENGTH * 0.22; // lane offset (~top/bottom)
                targetY = this.COURT_LENGTH * 0.5 + aimDir * aimOffset;
                targetY = Math.max(0.3, Math.min(this.COURT_LENGTH - 0.3, targetY));
            } else {
                // AI spikes toward player side (x < NET_X)
                // Mirror the same depth-by-distance behavior for AI (toward player side):
                // near net → short (close to net on player side), mid → deepest, far → mid court
                const t = Math.max(0, Math.min(1, (character.x - this.NET_X) / (this.COURT_WIDTH - this.NET_X))); // 0=at net, 1=far back
                spikeDistanceRatio = t;
                const span = this.NET_X;
                const xFront = this.NET_X - span * 0.15;
                const xDeep = this.NET_X - span * 0.90;
                const xMid = this.NET_X - span * 0.55;
                if (t <= 0.5) {
                    targetX = xFront + (xDeep - xFront) * (t / 0.5);
                } else {
                    targetX = xDeep + (xMid - xDeep) * ((t - 0.5) / 0.5);
                }
                targetX = Math.max(0.4, Math.min(this.NET_X - 0.4, targetX));
                targetY = this.COURT_LENGTH * 0.5; // Middle depth
            }
            
            // IMPORTANT: previously we set a fixed horizontal speed, which means the ball doesn't actually land
            // at (targetX,targetY) — it can overshoot and go out of bounds. Instead, estimate airtime and
            // set vx/vy so the ball lands near the chosen target.
            const verticalPower = 0.12; // base downward speed scale (same family as spike serve)
            const downwardMultiplier = 3.2 - 1.2 * spikeDistanceRatio; // near net=steeper (3.2), far=less steep (2.0)
            const vz0 = -verticalPower * this.ballMovementSpeed * downwardMultiplier;
            
            // Estimate flight time (in frames) until ground contact using a simple ballistic model.
            // Physics.updateBall() uses: vz -= GRAVITY*ballMovementSpeed; z += vz; (dt=1 "frame")
            const gEff = this.GRAVITY * this.ballMovementSpeed;
            const z0 = Math.max(0.001, b.z - b.groundLevel);
            const disc = vz0 * vz0 + 2 * gEff * z0;
            const flightFrames = disc > 0 ? (vz0 + Math.sqrt(disc)) / gEff : 8;
            const tFrames = Math.max(3, flightFrames); // prevent crazy speeds for extremely short flights
            
            b.vx = (targetX - b.x) / tFrames;
            b.vy = (targetY - b.y) / tFrames;
            b.vz = vz0;
            
            // Add character's velocity influence (slight)
            b.vx += character.vx * 0.05;
            b.vy += character.vy * 0.05;
            
            b.lastHitType = 'spike';
            b.tileDamageBounces = 0;
            b.fallingThroughHole = false;
        }
        
        character.hasSpiked = true;
        character.justAttemptedAction = true; // Flag to prevent collision bounce this frame
        
        // Track who last touched the ball
        b.lastTouchedBy = (character === this.player) ? 'player' : 'ai';
        b.hasScored = false; // Reset score flag on new touch
        
        return true;
    },
    
    // Attempt to receive the ball (can be called mid-air or on ground)
    attemptReceive(character) {
        // Can't receive if already received this jump (prevent spamming)
        if (character.hasReceived) {
            return false;
        }
        
        const b = this.ball;
        
        // Can't receive if ball was just served (prevents receive from interfering with serve)
        if (b.justServed) {
            return false;
        }
        
        // Can't receive ball that is on the ground (only mid-air balls)
        if (b.z <= b.groundLevel) {
            return false;
        }
        
        // Calculate receiving zone center (at character's center mass)
        const receiveZoneX = character.x;
        const receiveZoneY = character.y;
        const receiveZoneZ = character.z; // At ground level
        
        // Check if ball is within receiving zone (3D distance)
        // Account for ball's radius - if any part of ball overlaps zone, it's in
        const dx = b.x - receiveZoneX;
        const dy = b.y - receiveZoneY;
        const dz = b.z - receiveZoneZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const effectiveRadius = this.RECEIVING_ZONE_RADIUS + b.radius;
        
        if (dist > effectiveRadius) {
            return false; // Ball not in receiving zone
        }
        
        // Calculate distance from ball to center of receiving zone (horizontal)
        const horizontalDist = Math.sqrt(dx * dx + dy * dy);
        const centerThreshold = this.RECEIVING_ZONE_RADIUS * 0.3; // 30% of zone radius from center
        
        // If ball is not close enough to center, move character toward ball first
        // BUT only if character is on the ground (no automatic chasing mid-air)
        if (horizontalDist > centerThreshold && character.onGround) {
            // Move character toward ball to get it closer to center
            const moveDirX = dx / horizontalDist;
            const moveDirY = dy / horizontalDist;
            
            // Apply movement boost toward ball
            character.vx = moveDirX * this.RECEIVE_MOVE_SPEED;
            character.vy = moveDirY * this.RECEIVE_MOVE_SPEED;
            
            // Don't hit yet, just move closer
            // Don't set justAttemptedAction here - we want collision to still work while moving
            return true;
        }
        
        // If mid-air and ball not centered, don't attempt receive (need to be more precise mid-air)
        if (!character.onGround && horizontalDist > centerThreshold) {
            return false; // Can't receive if ball not centered and mid-air
        }
        
        // Ball is close enough to center, now hit it
        // If on ground, just bounce ball upward (for testing spikes)
        // If mid-air, lob to opponent's side
        if (character.onGround) {
            // Ground receive = "toss" (for future teammates/sets).
            // Keep it short (clamped distance) but allow aiming with buffered WASD (supports diagonals).
            const vz0 = this.RECEIVE_ARCH_HEIGHT * 0.7 * this.ballMovementSpeed; // Reduced upward toss (70% of normal)
            b.vz = vz0;
            b.lastHitType = 'toss';
            b.tileDamageBounces = 0;
            b.fallingThroughHole = false;
            
            const aim = Input.getAim2D?.() ?? { x: 0, y: 0 };
            // Disallow "back toss" (away from the net) so ground receives stay simple and forward-oriented.
            // If a back component is present, cancel ALL aiming (including diagonal back aims) → straight up.
            // Player (left side): back = negative x (A). AI (right side): back = positive x.
            const rawAx = aim.x ?? 0;
            const rawAy = aim.y ?? 0;
            const hasBackComponent = (character === this.player) ? (rawAx < -0.01) : (rawAx > 0.01);
            
            let ax = rawAx;
            let ay = rawAy;
            if (hasBackComponent) {
                ax = 0;
                ay = 0;
            } else {
                // Still prevent tiny numerical back drift; allow only forward-or-neutral x.
                if (character === this.player) {
                    ax = Math.max(0, ax);
                } else {
                    ax = Math.min(0, ax);
                }
            }
            const aimLen = Math.sqrt(ax * ax + ay * ay);
            
            if (aimLen < 0.01) {
                // No aim input → straight up (current behavior)
                b.vx = 0;
                b.vy = 0;
            } else {
                // Normalize aim so diagonals aren't stronger
                const nx = ax / aimLen;
                const ny = ay / aimLen;
                
                // Estimate flight time (in frames) until ground contact, then choose vx/vy so horizontal
                // displacement is limited to a small max distance (prevents "toss" becoming an attack).
                const gEff = this.GRAVITY * this.ballMovementSpeed;
                const z0 = Math.max(0.001, b.z - b.groundLevel);
                const disc = vz0 * vz0 + 2 * gEff * z0;
                const flightFrames = disc > 0 ? (vz0 + Math.sqrt(disc)) / gEff : 18;
                const tFrames = Math.max(8, flightFrames);
                
                // Toss distance caps:
                // - Forward/diagonal tosses: slightly longer (helps setting forward)
                // - Pure side tosses (I+W or I+S): shorter for control (can’t drift too far laterally)
                const isPureSideToss = Math.abs(ax) < 0.01 && Math.abs(ay) >= 0.01;
                const maxTossDistance = isPureSideToss ? 1.4 : 1.8; // court units
                b.vx = (nx * maxTossDistance) / tFrames;
                b.vy = (ny * maxTossDistance) / tFrames;
                
                // Tiny influence from character movement (kept very small for control)
                b.vx += character.vx * 0.02;
                b.vy += character.vy * 0.02;
            }
            character.justAttemptedAction = true; // Flag to prevent collision bounce this frame
        } else {
            // Mid-air: lob to opponent's side
            // Determine target (opponent's side)
            let targetX, targetY;
            if (character === this.player) {
                // Player receives toward AI side (right side, x > NET_X)
                targetX = this.COURT_WIDTH * 0.75; // 75% across court (AI side)
                // Allow aiming with buffered W/S input (doesn't require perfect simultaneous press)
                const aimDir = Input.getAimDepthDirection?.() ?? 0;
                const aimOffset = this.COURT_LENGTH * 0.18; // smaller offset than spikes for control
                targetY = this.COURT_LENGTH * 0.5 + aimDir * aimOffset;
                targetY = Math.max(0.3, Math.min(this.COURT_LENGTH - 0.3, targetY));
            } else {
                // AI receives toward player side (left side, x < NET_X)
                targetX = this.COURT_WIDTH * 0.25; // 25% across court (player side)
                targetY = this.COURT_LENGTH * 0.5;  // Middle depth
            }
            
            // Calculate direction to target
            const dirX = targetX - b.x;
            const dirY = targetY - b.y;
            const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
            
            // Normalize horizontal direction
            const normDirX = dirX / dirLength;
            const normDirY = dirY / dirLength;
            
            // Apply arching trajectory (weaker and more arching than spike)
            // Reduce horizontal power more than vertical to create a higher arc
            const horizontalPower = this.RECEIVE_POWER * 0.8; // Even weaker horizontal component
            b.vx = normDirX * horizontalPower * this.ballMovementSpeed;
            b.vy = normDirY * horizontalPower * this.ballMovementSpeed;
            b.vz = this.RECEIVE_ARCH_HEIGHT * this.ballMovementSpeed; // Higher upward component for arch
            
            // Add slight character velocity influence (reduced for lob)
            b.vx += character.vx * 0.1;
            b.vy += character.vy * 0.1;
            
            b.lastHitType = 'receive';
            b.tileDamageBounces = 0;
            b.fallingThroughHole = false;
        }
        
        // Mark character as having received (prevent spamming)
        character.hasReceived = true;
        character.justAttemptedAction = true; // Flag to prevent collision bounce this frame
        
        // Track who last touched the ball
        b.lastTouchedBy = (character === this.player) ? 'player' : 'ai';
        b.hasScored = false; // Reset score flag on new touch
        
        return true;
    },
    
    checkBallNetCollision() {
        const b = this.ball;
        const netX = this.NET_X;
        const netHeight = this.NET_HEIGHT;
        const topThreshold = this.NET_TOP_THRESHOLD;
        
        // Check if ball is near the net (within ball radius)
        const distToNet = Math.abs(b.x - netX);
        
        // Ball must be within net's depth range (y: 0 to COURT_LENGTH)
        const withinNetDepth = b.y >= 0 && b.y <= this.COURT_LENGTH;
        
        if (distToNet < b.radius && withinNetDepth) {
            // Check if ball is below net (main collision)
            const belowNet = b.z < netHeight - topThreshold;
            
            // Check if ball is at top edge (hitting the tape/rope)
            const atTopEdge = b.z >= netHeight - topThreshold && b.z <= netHeight + topThreshold;
            
            // Check if ball is above net (should pass over)
            const aboveNet = b.z > netHeight + topThreshold;
            
            if (belowNet) {
                // Main net collision - ball hits the net below the top
                const ballOnLeftSide = b.x < netX;
                
                // Push ball away from net
                if (ballOnLeftSide) {
                    b.x = netX - b.radius - 0.05;
                } else {
                    b.x = netX + b.radius + 0.05;
                }
                
                // Bounce off net - reverse horizontal velocity with damping
                // Scale by ballMovementSpeed to maintain trajectory
                const vxBeforeBounce = b.vx;
                b.vx = -b.vx * b.bounceDamping;
                
                // Slight upward component to prevent ball from getting stuck
                // Scale by ballMovementSpeed to maintain trajectory
                if (b.vz < 0.05 * this.ballMovementSpeed) {
                    b.vz = 0.05 * this.ballMovementSpeed;
                }
                
                // Apply slight damping to other velocities
                b.vy *= 0.95;
                
                return true;
            } else if (atTopEdge) {
                // Top edge collision - ball hits the tape/rope at top of net
                const ballOnLeftSide = b.x < netX;
                
                // Push ball away from net
                if (ballOnLeftSide) {
                    b.x = netX - b.radius - 0.05;
                } else {
                    b.x = netX + b.radius + 0.05;
                }
                
                // Top edge bounce - deflects ball with reduced horizontal bounce
                // Velocities already scaled by ballMovementSpeed from previous updates
                b.vx = -b.vx * b.bounceDamping * 0.7; // Less horizontal bounce on top edge
                
                // Deflect downward slightly (ball hits top and bounces down)
                if (b.vz > 0) {
                    b.vz = -b.vz * 0.5; // Reverse and reduce upward velocity
                }
                
                // Apply damping
                b.vy *= 0.95;
                
                return true;
            }
            // If aboveNet, ball passes over - no collision
        }
        return false;
    },
    
    updateBall(deltaTime = 1/60) {
        const b = this.ball;

        // If ball is falling through a hole, let it keep falling without any collisions.
        // This prevents net/character collision logic from injecting upward velocity while "under the floor".
        if (b.fallingThroughHole) {
            b.vz -= this.GRAVITY * this.ballMovementSpeed;
            b.x += b.vx;
            b.y += b.vy;
            b.z += b.vz;
            return;
        }
        
        // Update serve timer
        if (b.justServed) {
            b.serveTimer -= deltaTime;
            if (b.serveTimer <= 0) {
                b.justServed = false;
                b.serveTimer = 0;
            }
        }
        
        // Check collisions with characters first (before updating position)
        // Skip collision check if ball was just served (prevents immediate collision with serving character)
        const velocitiesBeforeCollisionCheck = { vx: b.vx, vy: b.vy, vz: b.vz };
        
        if (!b.justServed) {
            const playerCollision = this.checkBallCharacterCollision(this.player);
            const aiCollision = this.checkBallCharacterCollision(this.ai);
            
        } else {
        }
        
        // Apply gravity (same as characters - uses Physics.GRAVITY which is controlled by slider)
        // Scale gravity by ballMovementSpeed to act as time-scale factor
        // This ensures the same trajectory but at different time scales
        b.vz -= this.GRAVITY * this.ballMovementSpeed;
        
        // Update position
        // ballMovementSpeed acts as time-scale: lower = slower = same distance takes longer
        // Since velocities are already scaled by ballMovementSpeed (from forces),
        // we update position directly with the scaled velocities
        // This maintains the same trajectory but at different time scales
        b.x += b.vx;
        b.y += b.vy;
        b.z += b.vz;
        
        // Check net collision (after position update)
        const velocitiesBeforeNetCheck = { vx: b.vx, vy: b.vy, vz: b.vz };
        const netCollision = this.checkBallNetCollision();
        
        // Ground collision with bounce (only if ball is on court)
        if (b.z <= b.groundLevel) {
            // Only bounce if ball is on court - if off court, let it fall through
            if (this.isBallOnCourt()) {
                // Tile system: determine impacted tile (single tile) and apply damage / holes.
                // IMPORTANT: Never damage tiles or score during the score splash/reset window.
                // However, hole fall-through should still happen (no bounce), otherwise it looks broken on matchOver screens.
                const tileEffectsEnabled = !(Game?.state?.isResetting) && !(Game?.state?.matchOver);
                const landing = this.getBallLandingTile();
                if (landing && Game?.getTileState) {
                    const { tx, ty } = landing;
                    const tile = Game.getTileState(tx, ty);
                    
                    // If tile is already destroyed (hole), ball falls through (no bounce).
                    // Score only when tileEffectsEnabled; otherwise just fall through silently.
                    if (tile && !tile.indestructible && tile.destroyed) {
                        if (tileEffectsEnabled && !b.hasScored) {
                            // Hole scoring: treat as "ball hit the ground on that side" (encourages destroying opponent floor).
                            if (tx < this.NET_X) {
                                // Hole on player's side → AI scores
                                Game.scorePoint('ai');
                            } else {
                                // Hole on AI's side → Player scores
                                Game.scorePoint('player');
                            }
                            Game.startHoleScoreFx?.(tx, ty);
                            b.hasScored = true;
                        }
                        // Fall through: don't clamp or bounce.
                        // IMPORTANT: don't continuously clamp z to just-below-ground, otherwise the ball looks like it
                        // "bounces" on an invisible floor at the hole. Let it keep falling.
                        const minFallVz = -0.12 * this.ballMovementSpeed;
                        if (b.vz > minFallVz) b.vz = minFallVz;
                        b.fallingThroughHole = true;
                        return;
                    }
                    
                    // Apply tile damage on ground contact (tile HP persists across points).
                    // Only the FIRST ground impact since last touch deals damage.
                    if (tileEffectsEnabled && tile && !tile.indestructible) {
                        const spikeLike = b.lastHitType === 'spike' || b.lastHitType === 'spikeServe';
                        if ((b.tileDamageBounces ?? 0) === 0) {
                            const damage = spikeLike ? 3 : 1;
                            Game.damageTile(tx, ty, damage);

                            // Camera shake: only for spike-like hits that directly impact the tile (first ground impact).
                            // Includes spike serves and normal spikes.
                            if (spikeLike && typeof Render !== 'undefined' && Render?.startShake) {
                                // Slight but noticeable (especially when score splash appears right after).
                                Render.startShake(9, 0.18);
                            }
                        }
                        b.tileDamageBounces = (b.tileDamageBounces ?? 0) + 1;
                    } else if (tile && !tile.indestructible) {
                        // Still count the bounce so later bounces (before next touch) are treated as "repeated".
                        b.tileDamageBounces = (b.tileDamageBounces ?? 0) + 1;
                    }
                }
                
                // Check for scoring: ball bounces on court ground
                // Score goes to opponent of the side where ball lands
                if (!b.hasScored) {
                    // Determine which side the ball is on
                    if (b.x < this.NET_X) {
                        // Ball landed on player's side (left) → AI scores
                        Game.scorePoint('ai');
                    } else {
                        // Ball landed on AI's side (right) → Player scores
                        Game.scorePoint('player');
                    }
                    b.hasScored = true; // Prevent multiple scores from same bounce
                }
                
                b.z = b.groundLevel;
                
                // Bounce off ground (reverse vertical velocity with damping)
                if (b.vz < 0) {
                    b.vz = -b.vz * b.bounceDamping;
                } else {
                    b.vz = 0;
                }
                
                // Apply friction to horizontal movement
                b.vx *= b.friction;
                b.vy *= b.friction;
                
                // Stop very small velocities to prevent jitter
                if (Math.abs(b.vx) < 0.001) b.vx = 0;
                if (Math.abs(b.vy) < 0.001) b.vy = 0;
                if (Math.abs(b.vz) < 0.001) b.vz = 0;
            } else {
                // Ball is off court and falling - check for out-of-bounds score
                if (!b.hasScored && b.lastTouchedBy) {
                    // Ball went out of bounds - opponent of last toucher scores
                    if (b.lastTouchedBy === 'player') {
                        // Player hit it out → AI scores
                        Game.scorePoint('ai');
                    } else {
                        // AI hit it out → Player scores
                        Game.scorePoint('player');
                    }
                    b.hasScored = true; // Prevent multiple scores from same fall
                }
            }
            // If ball is off court, don't clamp z or reset velocities - let it fall through
        }
        
        // Check for out-of-bounds score when ball falls off court (even if z > groundLevel)
        // This handles cases where ball goes out of bounds while still in the air
        if (!b.hasScored && !this.isBallOnCourt() && b.z < 0 && b.lastTouchedBy) {
            // Ball went out of bounds - opponent of last toucher scores
            if (b.lastTouchedBy === 'player') {
                // Player hit it out → AI scores
                Game.scorePoint('ai');
            } else {
                // AI hit it out → Player scores
                Game.scorePoint('player');
            }
            b.hasScored = true; // Prevent multiple scores from same fall
        }
        
        // Ball can move freely (no clamping)
    },
    
    // Respawn character near the edge they fell from, but snap to nearest intact tile on their side.
    // Called when character falls out of court OR falls into a destroyed tile (hole).
    // Both cases trigger the same falling/respawn flow, so blinking works for both.
    respawnCharacter(character) {
        const side = (character === this.player) ? 'player' : 'ai';
        
        let preferredTx, preferredTy;
        if (character.fallEdge === 'A') {
            // Back row
            preferredTy = this.COURT_LENGTH - 1;
            preferredTx = side === 'player' ? 1 : 6;
        } else if (character.fallEdge === 'B') {
            // Side edge
            preferredTy = Math.floor(this.COURT_LENGTH * 0.5);
            preferredTx = side === 'player' ? 0 : (this.COURT_WIDTH - 1);
        } else if (character.fallEdge === 'C') {
            // Front row
            preferredTy = 0;
            preferredTx = side === 'player' ? 1 : 6;
        } else {
            // Center-ish (also used when falling into holes in the middle of court)
            preferredTy = Math.floor(this.COURT_LENGTH * 0.5);
            preferredTx = side === 'player' ? 2 : 5;
        }
        
        const spawn = Game?.findNearestIntactTileCenter
            ? Game.findNearestIntactTileCenter(preferredTx, preferredTy, side)
            : { x: side === 'player' ? this.NET_X * 0.5 : this.NET_X + (this.COURT_WIDTH - this.NET_X) * 0.5, y: this.COURT_LENGTH * 0.5 };
        
        character.x = spawn.x;
        character.y = spawn.y;
        
        // Reset position and velocity
        character.z = 0;
        character.vx = 0;
        character.vy = 0;
        character.vz = 0;
        character.onGround = true;
        character.hasSpiked = false;
        character.hasReceived = false;
        character.fellFromHole = false;
        
        // Start blinking state (1 second) - applies to both falling out of court and falling into holes
        character.isBlinking = true;
        character.blinkTimer = 0;
    },
    
    update(input, aiInput, deltaTime = 1/60) {
        // Update fall timers with actual deltaTime
        if (this.player.isFalling) {
            this.player.fallTimer += deltaTime;
        }
        if (this.ai.isFalling) {
            this.ai.fallTimer += deltaTime;
        }
        
        // Update blink timers with actual deltaTime
        if (this.player.isBlinking) {
            this.player.blinkTimer += deltaTime;
            if (this.player.blinkTimer >= 1.0) {
                this.player.isBlinking = false;
                this.player.blinkTimer = 0;
            }
        }
        if (this.ai.isBlinking) {
            this.ai.blinkTimer += deltaTime;
            if (this.ai.blinkTimer >= 1.0) {
                this.ai.isBlinking = false;
                this.ai.blinkTimer = 0;
            }
        }
        
        this.updatePlayer(input, deltaTime);
        this.updateAI(aiInput, deltaTime);
        
        // If serving, keep ball "held" by serving character
        // Do this AFTER character movement so ball follows character if they move
        if (Game.state.isServing) {
            const servingChar = Game.state.servingPlayer === 'player' ? this.player : this.ai;
            // Keep ball at character position (held)
            // Ball follows character's position, including z (for jump)
            this.ball.x = servingChar.x;
            this.ball.y = servingChar.y;
            this.ball.z = servingChar.z + servingChar.radius * 1.5; // Slightly above character (follows z position)
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.ball.vz = 0;
        } else {
            // Update ball after character movement (so collisions work correctly)
            // Only update ball physics if not serving
            const velocitiesBeforeUpdate = { vx: this.ball.vx, vy: this.ball.vy, vz: this.ball.vz };
            const posBeforeUpdate = { x: this.ball.x, y: this.ball.y, z: this.ball.z };
            
            this.updateBall();
        }

        // Reset action flags at end of frame.
        // IMPORTANT: Actions (spike/receive) are triggered in main.js BEFORE Physics.update().
        // We must keep justAttemptedAction=true through this update so collision bounce doesn't override the action,
        // then clear it after collisions/physics have run.
        this.player.justAttemptedAction = false;
        this.ai.justAttemptedAction = false;
    }
};

