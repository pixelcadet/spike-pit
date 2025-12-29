// Behind-camera renderer (court/net preview)
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
    depthPowFar: 1.35,  // >1 squeezes far side vertically
    zPixels: 90,        // pixels per world z at near end

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
            tp = netS + (1 - netS) * Math.pow(u, this.depthPowFar);
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

    drawCourt() {
        const ctx = this.ctx;

        // Court corners (depth x: 0..COURT_WIDTH, lateral y: 0..COURT_LENGTH)
        const d0 = 0;
        const d1 = Physics.COURT_WIDTH;
        const l0 = 0;
        const l1 = Physics.COURT_LENGTH;

        const p00 = this.project(d0, l0, 0);
        const p01 = this.project(d0, l1, 0);
        const p10 = this.project(d1, l0, 0);
        const p11 = this.project(d1, l1, 0);

        // Fill court
        ctx.save();
        ctx.fillStyle = '#2d5a3a';
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.closePath();
        ctx.fill();

        // Outer boundary
        ctx.strokeStyle = 'rgba(255,255,255,0.20)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.closePath();
        ctx.stroke();

        // Tile/grid lines (light)
        ctx.strokeStyle = 'rgba(0,0,0,0.20)';
        ctx.lineWidth = 1;

        // Depth lines (x = integer)
        for (let x = 1; x < Physics.COURT_WIDTH; x++) {
            const a = this.project(x, l0, 0);
            const b = this.project(x, l1, 0);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        // Lateral lines (y = integer)
        for (let y = 1; y < Physics.COURT_LENGTH; y++) {
            const a = this.project(d0, y, 0);
            const b = this.project(d1, y, 0);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        ctx.restore();
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

    drawLabels() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Behind-camera court preview (depth=x → screenY, lateral=y → screenX)', 10, 20);
        ctx.fillText(`Court depth: x=0..${Physics.COURT_WIDTH}, Net at x=${Physics.NET_X}`, 10, 38);
        ctx.restore();
    },

    render() {
        this.clear();
        this.drawCourt();
        this.drawNet();
        this.drawLabels();
    }
};


