// Behind-camera renderer (full game view)
// Coordinate convention for this view:
// - depth = Physics axis x (0..COURT_WIDTH), where x increases toward the opponent.
// - lateral = Physics axis y (0..COURT_LENGTH), mapped to screen X (left/right).
//
// This matches the existing physics world (net plane at x = NET_X) while rendering it
// as a behind-the-player perspective (net is a horizontal band across the screen).

const RenderBehind = {
    canvas: null,
    ctx: null,

    width: 800,
    height: 600,

    // Debug/visual toggles (wired via Controls)
    showZones: true,
    showHitboxes: false,

    // Highlight states (for debug visualization parity)
    playerSpikeHighlight: false,
    playerReceivingHighlight: false,
    aiSpikeHighlight: false,
    aiReceivingHighlight: false,

    // Camera / projection tuning
    centerX: 400,
    bottomY: 540,
    topY: 150,
    nearHalfWidth: 310, // half width of court at depth=0
    farHalfWidth: 135,  // half width of court at depth=COURT_WIDTH
    // Depth mapping is asymmetric around the net:
    // - We want the PLAYER side (near) to look bigger (more vertical space).
    // - We want the OPPONENT side (far) to look smaller (more compressed).
    // We also place the net a bit higher on screen so the player side is visually emphasized.
    //
    // netScreenFrac: where the net plane maps along [bottomY..topY] in "t" space.
    //   0.5 would be centered; >0.5 moves the net UP (toward topY).
    netScreenFrac: 0.60,
    depthPowNear: 0.78, // <1 stretches near side vertically
    depthPowFar: 1.35,  // >1 squeezes far side vertically (overall)
    // Far-side shaping: distribute vertical space across the 4 far rows explicitly so
    // they remain visually distinct (prevents the last row collapsing into the far edge).
    // Values are relative weights; they get normalized at runtime.
    // Index 0 is the opponent row closest to the net (NET_X..NET_X+1).
    farRowWeights: [1.00, 0.92, 0.86, 0.80],
    zPixels: 90,        // pixels per world z at near end

    // Visual scale multipliers (render-only; does NOT change physics)
    characterScaleMul: 2.0,
    ballScaleMul: 2.5,

    // ---- helpers ----
    colorWithAlpha(color, alpha) {
        if (typeof color !== 'string') return color;
        const c = color.trim();
        if (/^#([0-9a-f]{6})$/i.test(c)) {
            const r = parseInt(c.slice(1, 3), 16);
            const g = parseInt(c.slice(3, 5), 16);
            const b = parseInt(c.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        if (/^#([0-9a-f]{3})$/i.test(c)) {
            const r = parseInt(c[1] + c[1], 16);
            const g = parseInt(c[2] + c[2], 16);
            const b = parseInt(c[3] + c[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return c;
    },

    // Approximate world-space circle as a screen-space ellipse at a given center.
    // Returns { cx, cy, rx, ry } in screen pixels.
    worldCircleToEllipse(cx, cy, cz, rWorld) {
        const p0 = this.project(cx, cy, cz);
        const pLat = this.project(cx, cy + rWorld, cz);
        const pDep = this.project(cx + rWorld, cy, cz);
        const rx = Math.max(2, Math.abs(pLat.x - p0.x));
        // Depth offset mostly changes screen Y; use it to approximate vertical radius.
        const ry = Math.max(2, Math.abs(pDep.y - p0.y));
        return { cx: p0.x, cy: p0.y, rx, ry };
    },

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    // Project world coords (x,y,z) -> screen.
    // We treat Physics.x as depth (toward/away), Physics.y as lateral.
    project(x, y, z = 0) {
        const depthMax = Physics.COURT_WIDTH;
        const lateralMid = Physics.COURT_LENGTH * 0.5;
        const lateralHalf = Math.max(0.0001, lateralMid);

        let t = x / depthMax;
        t = Math.max(0, Math.min(1, t));
        // Asymmetric depth-to-screen mapping, anchored at the net plane.
        const netT = Physics.NET_X / depthMax; // 0..1
        const netS = Math.max(0.05, Math.min(0.95, this.netScreenFrac)); // safety clamp
        let tp;
        if (t <= netT) {
            // Map [0..netT] -> [0..netS]
            const u = netT <= 0 ? 0 : (t / netT); // 0..1
            tp = netS * Math.pow(u, this.depthPowNear);
        } else {
            // Map [netT..1] -> [netS..1]
            const u = (1 - netT) <= 0 ? 1 : ((t - netT) / (1 - netT)); // 0..1
            const farTiles = Math.max(1, (Physics.COURT_WIDTH - Physics.NET_X));

            // Prefer explicit per-row weights when we have the expected number of rows.
            if (Array.isArray(this.farRowWeights) && this.farRowWeights.length === farTiles) {
                const weights = this.farRowWeights.map(v => Math.max(0.0001, Number(v) || 0.0001));
                const total = weights.reduce((a, b) => a + b, 0);
                const seg = 1 / farTiles;
                const idx = Math.min(farTiles - 1, Math.max(0, Math.floor(u / seg)));
                const localU = (u - idx * seg) / seg; // 0..1 within row
                let cum = 0;
                for (let i = 0; i < idx; i++) cum += weights[i];
                const start = cum / total;
                const span = weights[idx] / total;
                const s = start + localU * span;
                tp = netS + (1 - netS) * s;
            } else {
                // Fallback: single exponent mapping.
                tp = netS + (1 - netS) * Math.pow(u, this.depthPowFar);
            }
        }

        const yScreen = this.lerp(this.bottomY, this.topY, tp);
        const halfW = this.lerp(this.nearHalfWidth, this.farHalfWidth, tp);

        const lateralNorm = (y - lateralMid) / lateralHalf; // -1..1
        const xScreen = this.centerX + lateralNorm * halfW;

        // z lifts upward on screen; scale a bit with depth (smaller when far)
        const zScale = this.zPixels * this.lerp(1.0, 0.65, tp);
        const zLift = z * zScale;

        return { x: xScreen, y: yScreen - zLift, t: tp, halfW };
    },

    clear() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        // background (match existing vibe)
        ctx.fillStyle = '#1a0a1a';
        ctx.fillRect(0, 0, this.width, this.height);
    },

    drawCourtTiles() {
        const ctx = this.ctx;

        const tilesWide = Physics.COURT_WIDTH;
        const tilesLong = Physics.COURT_LENGTH;

        const destructibleColor = '#4f865d';
        const indestructibleColor = '#3f5f8a';
        const holeColor = '#1a0a1a';

        for (let ty = 0; ty < tilesLong; ty++) {
            for (let tx = 0; tx < tilesWide; tx++) {
                const a = this.project(tx, ty, 0);
                const b = this.project(tx + 1, ty, 0);
                const c = this.project(tx + 1, ty + 1, 0);
                const d = this.project(tx, ty + 1, 0);

                let fill = destructibleColor;
                let fillAlpha = 1.0;
                const tileState = Game?.getTileState ? Game.getTileState(tx, ty) : null;
                if (tileState) {
                    if (tileState.indestructible) {
                        fill = indestructibleColor;
                        fillAlpha = 1.0;
                    } else if (tileState.destroyed) {
                        fill = holeColor;
                        fillAlpha = 1.0;
                    } else {
                        const hp = (tileState.blinkTimeLeft > 0 && tileState.blinkOldHp != null)
                            ? tileState.blinkOldHp
                            : (tileState.hp ?? 0);
                        if (hp >= 3) fillAlpha = 1.0;
                        else if (hp >= 2) fillAlpha = 0.85;
                        else fillAlpha = 0.60;
                    }
                }

                ctx.save();
                ctx.globalAlpha = fillAlpha;
                ctx.fillStyle = fill;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.lineTo(c.x, c.y);
                ctx.lineTo(d.x, d.y);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // Outline (skip holes for cleanliness)
                if (!tileState || !tileState.destroyed) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.lineTo(c.x, c.y);
                    ctx.lineTo(d.x, d.y);
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        }
    },

    drawNet() {
        const ctx = this.ctx;
        const nx = Physics.NET_X;
        const l0 = 0;
        const l1 = Physics.COURT_LENGTH;
        const z0 = 0;
        const z1 = Physics.NET_HEIGHT;

        const bl = this.project(nx, l0, z0);
        const br = this.project(nx, l1, z0);
        const tl = this.project(nx, l0, z1);
        const tr = this.project(nx, l1, z1);

        // Net body (semi-transparent, slightly bluish)
        ctx.save();
        ctx.fillStyle = 'rgba(200, 220, 255, 0.14)';
        ctx.beginPath();
        ctx.moveTo(bl.x, bl.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(tl.x, tl.y);
        ctx.closePath();
        ctx.fill();

        // Net outline
        ctx.strokeStyle = 'rgba(240,240,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bl.x, bl.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(tl.x, tl.y);
        ctx.closePath();
        ctx.stroke();

        // Top tape
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.stroke();

        // Posts (at the sides)
        ctx.strokeStyle = 'rgba(120,140,170,0.9)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bl.x, bl.y);
        ctx.lineTo(tl.x, tl.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(br.x, br.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.stroke();

        ctx.restore();
    },

    drawEllipseOutline(cx, cy, rx, ry, stroke, alpha = 1.0, lineWidth = 1, dash = null) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = typeof stroke === 'string' ? this.colorWithAlpha(stroke, alpha) : stroke;
        ctx.lineWidth = lineWidth;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    },

    drawEllipseFill(cx, cy, rx, ry, fill, alpha = 0.25) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = typeof fill === 'string' ? this.colorWithAlpha(fill, alpha) : fill;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawZones() {
        if (!this.showZones || this.showHitboxes) return; // avoid double visuals

        const drawReceiveRing = (character, color) => {
            const r = Physics.RECEIVING_ZONE_RADIUS + Physics.ball.radius;
            const e = this.worldCircleToEllipse(character.x, character.y, 0, r);
            this.drawEllipseOutline(e.cx, e.cy, e.rx, e.ry, color, 0.55, 1, null);
        };

        const drawSpikeRing = (character, color) => {
            let forwardOffset = Physics.SPIKE_ZONE_FORWARD_OFFSET;
            if (character === Physics.ai) forwardOffset = -forwardOffset;
            const cx = character.x + forwardOffset;
            const cy = character.y;
            const cz = character.z + Physics.SPIKE_ZONE_UPWARD_OFFSET;
            const r = Physics.SPIKE_ZONE_RADIUS + Physics.ball.radius;
            const e = this.worldCircleToEllipse(cx, cy, cz, r);
            this.drawEllipseOutline(e.cx, e.cy, e.rx, e.ry, color, 0.55, 1, null);
        };

        drawReceiveRing(Physics.player, '#4a9eff');
        drawReceiveRing(Physics.ai, '#ff4a4a');
        if (!Physics.player.onGround) drawSpikeRing(Physics.player, '#4a9eff');
        if (!Physics.ai.onGround) drawSpikeRing(Physics.ai, '#ff4a4a');
    },

    drawDebugHitboxes() {
        if (!this.showHitboxes) return;

        const drawCharHitbox = (character, color) => {
            const e = this.worldCircleToEllipse(character.x, character.y, character.z, character.radius);
            this.drawEllipseOutline(e.cx, e.cy, e.rx, e.ry, color, 1.0, 2, [5, 5]);
            // ground projection
            const eg = this.worldCircleToEllipse(character.x, character.y, 0, character.radius);
            this.drawEllipseOutline(eg.cx, eg.cy, eg.rx, eg.ry, color, 0.5, 2, [5, 5]);
        };

        const drawBallHitbox = () => {
            const b = Physics.ball;
            const e = this.worldCircleToEllipse(b.x, b.y, b.z, b.radius);
            this.drawEllipseOutline(e.cx, e.cy, e.rx, e.ry, '#ff0000', 1.0, 2, [5, 5]);
            const eg = this.worldCircleToEllipse(b.x, b.y, 0, b.radius);
            this.drawEllipseOutline(eg.cx, eg.cy, eg.rx, eg.ry, '#ff0000', 0.5, 2, [5, 5]);
        };

        const drawFootprint = (character) => {
            const ctx = this.ctx;
            const charZ = character.z;

            // Edge footprint (smaller)
            const w1 = character.radius * 1.2;
            const d1 = character.radius * 0.5;
            // Hole footprint (larger)
            const w2 = character.radius * 1.35;
            const d2 = character.radius * 0.9;

            const drawRectPoly = (w, d, stroke, dash) => {
                const x0 = character.x - w * 0.5;
                const x1 = character.x + w * 0.5;
                const y0 = character.y - d * 0.5;
                const y1 = character.y + d * 0.5;
                const p00 = this.project(x0, y0, charZ);
                const p01 = this.project(x0, y1, charZ);
                const p11 = this.project(x1, y1, charZ);
                const p10 = this.project(x1, y0, charZ);
                ctx.save();
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 2;
                if (dash) ctx.setLineDash(dash);
                ctx.beginPath();
                ctx.moveTo(p00.x, p00.y);
                ctx.lineTo(p01.x, p01.y);
                ctx.lineTo(p11.x, p11.y);
                ctx.lineTo(p10.x, p10.y);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            };

            drawRectPoly(w1, d1, 'rgba(0,255,0,0.9)', [2, 2]);
            drawRectPoly(w2, d2, 'rgba(255,80,200,0.85)', [5, 4]);
        };

        const drawSpikeZone = (character, color, highlight) => {
            let forwardOffset = Physics.SPIKE_ZONE_FORWARD_OFFSET;
            if (character === Physics.ai) forwardOffset = -forwardOffset;
            const cx = character.x + forwardOffset;
            const cy = character.y;
            const cz = character.z + Physics.SPIKE_ZONE_UPWARD_OFFSET;
            const r = Physics.SPIKE_ZONE_RADIUS + Physics.ball.radius;
            const e = this.worldCircleToEllipse(cx, cy, cz, r);
            if (highlight) this.drawEllipseFill(e.cx, e.cy, e.rx, e.ry, color, 0.18);
            this.drawEllipseOutline(e.cx, e.cy, e.rx, e.ry, color, 1.0, 2, [3, 3]);
        };

        const drawReceiveZone = (character, color, highlight) => {
            const r = Physics.RECEIVING_ZONE_RADIUS + Physics.ball.radius;
            const e = this.worldCircleToEllipse(character.x, character.y, character.z, r);
            if (highlight) this.drawEllipseFill(e.cx, e.cy, e.rx, e.ry, color, 0.18);
            this.drawEllipseOutline(e.cx, e.cy, e.rx, e.ry, color, 1.0, 2, [4, 4]);
        };

        drawCharHitbox(Physics.player, '#4a9eff');
        drawCharHitbox(Physics.ai, '#ff4a4a');
        drawFootprint(Physics.player);
        drawFootprint(Physics.ai);
        drawBallHitbox();
        drawSpikeZone(Physics.player, '#4a9eff', this.playerSpikeHighlight);
        drawSpikeZone(Physics.ai, '#ff4a4a', this.aiSpikeHighlight);
        drawReceiveZone(Physics.player, '#4a9eff', this.playerReceivingHighlight);
        drawReceiveZone(Physics.ai, '#ff4a4a', this.aiReceivingHighlight);
    },

    drawCharacterShadow(char) {
        const ctx = this.ctx;
        const g = this.project(char.x, char.y, 0);
        const pg = this.project(char.x, char.y, 0);
        const scale = (pg.halfW / this.nearHalfWidth) * 1.2 * this.characterScaleMul;

        // Shadow
        const shadowR = 18 * scale * (char.isFalling ? 0.6 : 1.0);
        const shadowAlpha = char.z > 0 ? 0.25 : 0.35;
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(g.x, g.y + 6, shadowR * 1.2, shadowR * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawCharacterBody(char, color) {
        const ctx = this.ctx;
        const p = this.project(char.x, char.y, char.z);
        const scale = (p.halfW / this.nearHalfWidth) * 1.2 * this.characterScaleMul;

        // Body (simple: rectangle + head circle)
        const bodyW = 26 * scale;
        const bodyH = 32 * scale;
        const headR = 12 * scale;

        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        const x0 = p.x - bodyW / 2;
        const y0 = p.y - bodyH / 2;
        const r = 4 * scale;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x0, y0, bodyW, bodyH, r);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(x0, y0, bodyW, bodyH);
            ctx.strokeRect(x0, y0, bodyW, bodyH);
        }

        // Head color: blue (distinct from the orange ball).
        ctx.fillStyle = '#2ea8ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y - bodyH / 2 - headR * 0.1, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawBallShadow() {
        const ctx = this.ctx;
        const b = Physics.ball;
        const g = this.project(b.x, b.y, 0);
        const p0 = this.project(b.x, b.y, Math.max(0, b.z));
        const scale = (p0.halfW / this.nearHalfWidth) * 1.2 * this.ballScaleMul;

        // Shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        const sr = 10 * scale;
        ctx.beginPath();
        ctx.ellipse(g.x, g.y + 4, sr * 1.1, sr * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawBallBody() {
        const ctx = this.ctx;
        const b = Physics.ball;
        const p = this.project(b.x, b.y, b.z);
        const scale = (p.halfW / this.nearHalfWidth) * 1.2 * this.ballScaleMul;

        // Ball
        const r = 10 * scale;
        let alpha = 1.0;
        if (b.fallingThroughHole && b.z < 0) alpha = 0.25;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Ball: orange, clearly distinct from blue heads.
        ctx.fillStyle = '#ff8a00';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Small highlight
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(p.x - r * 0.25, p.y - r * 0.25, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    updateHighlights(input, aiInput) {
        // Copied from side renderer; independent of projection.
        this.playerSpikeHighlight = false;
        this.playerReceivingHighlight = false;
        this.aiSpikeHighlight = false;
        this.aiReceivingHighlight = false;

        if (input.isHitPressed()) {
            if (!Physics.player.onGround) {
                const ball = Physics.ball;
                const spikeZoneX = Physics.player.x + Physics.SPIKE_ZONE_FORWARD_OFFSET;
                const spikeZoneY = Physics.player.y;
                const spikeZoneZ = Physics.player.z + Physics.SPIKE_ZONE_UPWARD_OFFSET;
                const dxSpike = ball.x - spikeZoneX;
                const dySpike = ball.y - spikeZoneY;
                const dzSpike = ball.z - spikeZoneZ;
                const distToSpikeZone = Math.sqrt(dxSpike * dxSpike + dySpike * dySpike + dzSpike * dzSpike);

                const ballRadius = Physics.ball.radius;
                const effectiveSpikeRadius = Physics.SPIKE_ZONE_RADIUS + ballRadius;
                const effectiveReceiveRadius = Physics.RECEIVING_ZONE_RADIUS + ballRadius;

                if (distToSpikeZone < effectiveSpikeRadius) {
                    this.playerSpikeHighlight = true;
                } else {
                    const receiveZoneZ = Physics.player.z;
                    const dxReceive = ball.x - Physics.player.x;
                    const dyReceive = ball.y - Physics.player.y;
                    const dzReceive = ball.z - receiveZoneZ;
                    const distToReceiveZone = Math.sqrt(dxReceive * dxReceive + dyReceive * dyReceive + dzReceive * dzReceive);
                    if (distToReceiveZone < effectiveReceiveRadius) {
                        this.playerReceivingHighlight = true;
                    }
                }
            } else {
                this.playerReceivingHighlight = true;
            }
        }

        if (aiInput.spike) this.aiSpikeHighlight = true;
        if (aiInput.receive) this.aiReceivingHighlight = true;
    },

    update(_dt) {
        // placeholder for future (shake, etc.)
    },

    drawScoreSplash() {
        const ctx = this.ctx;
        const duration = Game.state.resetDuration || 0.8;
        const t = duration > 0 ? Math.max(0, Math.min(1, Game.state.resetTimer / duration)) : 0;
        const alpha = 0.35 + 0.45 * t;
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 72px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText('SCORED!', this.width / 2, this.height / 2);
        if (Game.state.lastPointWinner) {
            const who = Game.state.lastPointWinner === 'player' ? 'PLAYER' : 'AI';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillText(`${who} SCORED`, this.width / 2, this.height / 2 + 60);
        }
        ctx.restore();
    },

    render() {
        this.clear();
        this.drawCourtTiles();
        this.drawZones();

        // Layering:
        // - far side entities behind the net
        // - net
        // - near side entities in front of the net
        // Draw shadows first to avoid shadows appearing on top of other entities.
        const isFar = (x) => x >= Physics.NET_X;

        // FAR shadows
        if (isFar(Physics.player.x)) this.drawCharacterShadow(Physics.player);
        if (isFar(Physics.ai.x)) this.drawCharacterShadow(Physics.ai);
        if (isFar(Physics.ball.x)) this.drawBallShadow();

        // FAR bodies
        if (isFar(Physics.player.x)) this.drawCharacterBody(Physics.player, '#4a9eff');
        if (isFar(Physics.ai.x)) this.drawCharacterBody(Physics.ai, '#ff4a4a');
        if (isFar(Physics.ball.x)) this.drawBallBody();

        // NET
        this.drawNet();

        // NEAR shadows
        if (!isFar(Physics.player.x)) this.drawCharacterShadow(Physics.player);
        if (!isFar(Physics.ai.x)) this.drawCharacterShadow(Physics.ai);
        if (!isFar(Physics.ball.x)) this.drawBallShadow();

        // NEAR bodies
        if (!isFar(Physics.player.x)) this.drawCharacterBody(Physics.player, '#4a9eff');
        if (!isFar(Physics.ai.x)) this.drawCharacterBody(Physics.ai, '#ff4a4a');
        if (!isFar(Physics.ball.x)) this.drawBallBody();

        this.drawDebugHitboxes();

        // NOTE: Behind-camera sandbox mode disables scoring/splash/reset, so we don't render the splash here.
    }
};


