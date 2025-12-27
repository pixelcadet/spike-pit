// Rendering system - projection, drawing, sprites
// Converts world coordinates (x, y, z) to screen coordinates

const Render = {
    canvas: null,
    ctx: null,
    
    // Canvas dimensions
    width: 800,
    height: 600,
    
    // Perspective projection parameters (side camera view)
    horizonY: 100,           // Y position of horizon on screen (top)
    scaleAtBottom: 1.0,      // Scale at bottom of screen (front/closer)
    scaleAtTop: 0.8,         // Scale at top of screen (back/farther) - 80% of front
    depthRange: 4,           // World depth range (0 to COURT_LENGTH = 4)
    
    // Court rendering
    courtTileSize: 88,      // Base tile size in pixels (reduced slightly for narrower court width)
    
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Initialize projection parameters based on court
        this.depthRange = Physics.COURT_LENGTH;
    },
    
    // Project world coordinates to screen space
    // Camera is from the side, looking at the court
    // X (left/right) maps to screen X
    // Y (depth) creates perspective (receding into distance)
    // Z (height) affects screen Y
    project(x, y, z) {
        // Normalize y to 0-1 range (0 = front/closer, 1 = back/farther)
        const normalizedY = y / this.depthRange;
        
        // Calculate scale based on depth (closer = larger, farther = smaller)
        const scale = this.scaleAtBottom + (this.scaleAtTop - this.scaleAtBottom) * normalizedY;
        
        // X maps directly to screen X (left/right), centered
        const centerX = this.width / 2;
        const xOffset = (x - Physics.COURT_WIDTH / 2) * this.courtTileSize;
        const screenX = centerX + xOffset * scale;
        
        // Y maps to screen Y with perspective (y=0 is front/bottom, y=COURT_LENGTH is back/top)
        // To maintain square cells, integrate the scale function along Y
        // Each unit of Y should take up courtTileSize * scale(y) pixels on screen
        // Using analytical integration for accuracy:
        // Integral of scale(y) from 0 to y where scale(y) = scaleAtBottom - scaleDiff * (y/depthRange)
        // Result: scaleAtBottom * y - (scaleDiff * y^2) / (2 * depthRange)
        const scaleDiff = this.scaleAtBottom - this.scaleAtTop;
        const integratedDepth = this.courtTileSize * (
            this.scaleAtBottom * y - 
            (scaleDiff * y * y) / (2 * this.depthRange)
        );
        
        // Calculate screen Y: start at bottom, subtract integrated scaled depth
        // Position court lower on screen (closer to bottom than top)
        const totalCourtHeight = this.courtTileSize * (
            this.scaleAtBottom * this.depthRange - 
            (scaleDiff * this.depthRange * this.depthRange) / (2 * this.depthRange)
        );
        const baseOffset = (this.height - totalCourtHeight) * 0.15; // Position court much lower (only 15% from bottom)
        const screenY = this.height - baseOffset - integratedDepth;
        
        // Z (height) moves up on screen (subtract from screenY)
        const screenZ = screenY - z * this.courtTileSize * scale;
        
        return {
            x: screenX,
            y: screenZ,
            scale: scale
        };
    },
    
    // Draw court (8 cells wide, 4 cells long - rotated 90 degrees)
    drawCourt() {
        const ctx = this.ctx;
        
        // Court background
        ctx.fillStyle = '#4a7c59';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw tiles with forced perspective
        // 8 cells wide (tx: 0-7, net at tx=4)
        // 4 cells long (ty: 0-3, depth) - 4x4 grid per side
        const tilesWide = 8;
        const tilesLong = 4;
        
        for (let ty = 0; ty < tilesLong; ty++) {
            for (let tx = 0; tx < tilesWide; tx++) {
                const worldX = tx;
                const worldY = ty;
                
                // Project tile corners (y increases toward back/top)
                // Project exact cell boundaries to ensure square cells
                const frontLeft = this.project(worldX, worldY, 0);
                const frontRight = this.project(worldX + 1, worldY, 0);
                const backLeft = this.project(worldX, worldY + 1, 0);
                const backRight = this.project(worldX + 1, worldY + 1, 0);
                
                // Alternate tile colors for grid effect
                const isEven = (tx + ty) % 2 === 0;
                ctx.fillStyle = isEven ? '#5a8c69' : '#4a7c59';
                
                // Draw trapezoid tile (wider at front, narrower at back)
                ctx.beginPath();
                ctx.moveTo(frontLeft.x, frontLeft.y);
                ctx.lineTo(frontRight.x, frontRight.y);
                ctx.lineTo(backRight.x, backRight.y);
                ctx.lineTo(backLeft.x, backLeft.y);
                ctx.closePath();
                ctx.fill();
                
                // Draw tile border
                ctx.strokeStyle = '#3a6c49';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        
        // Draw net
        this.drawNet();
    },
    
    drawNet() {
        const ctx = this.ctx;
        const netX = Physics.NET_X; // 4 - divides court horizontally (X axis)
        const netHeight = 1.0; // Net height
        
        // Draw net shadow on the ground first (so it appears behind the net)
        const shadowFront = this.project(netX, 0, 0);
        const shadowBack = this.project(netX, Physics.COURT_LENGTH, 0);
        const shadowThickness = 16; // Rectangle thickness in pixels (twice as wide)
        
        // Draw rectangle shadow spanning from front to back of net
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Slightly more opaque for visibility
        ctx.beginPath();
        // Calculate rectangle corners
        const halfThickness = shadowThickness / 2;
        ctx.moveTo(shadowFront.x - halfThickness, shadowFront.y);
        ctx.lineTo(shadowFront.x + halfThickness, shadowFront.y);
        ctx.lineTo(shadowBack.x + halfThickness, shadowBack.y);
        ctx.lineTo(shadowBack.x - halfThickness, shadowBack.y);
        ctx.closePath();
        ctx.fill();
        
        // Net spans full depth (3 cells) and divides court by X (left/right)
        // From side camera view, net appears as a vertical line on screen
        // Project net at front (y=0) and back (y=COURT_LENGTH=4)
        const netFrontTop = this.project(netX, 0, netHeight);
        const netFrontBottom = this.project(netX, 0, 0);
        const netBackTop = this.project(netX, Physics.COURT_LENGTH, netHeight);
        const netBackBottom = this.project(netX, Physics.COURT_LENGTH, 0);
        
        // Draw net posts (thicker vertical lines at front and back to show structure)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(netFrontTop.x, netFrontTop.y);
        ctx.lineTo(netFrontBottom.x, netFrontBottom.y);
        ctx.moveTo(netBackTop.x, netBackTop.y);
        ctx.lineTo(netBackBottom.x, netBackBottom.y);
        ctx.stroke();
        
        // Draw main net top line (shows the height)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(netFrontTop.x, netFrontTop.y);
        ctx.lineTo(netBackTop.x, netBackTop.y);
        ctx.stroke();
        
        // Draw net bottom line (at ground level)
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(netFrontBottom.x, netFrontBottom.y);
        ctx.lineTo(netBackBottom.x, netBackBottom.y);
        ctx.stroke();
        
        // Draw net mesh (vertical lines along depth) - these show the net structure
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= 3; i++) {
            const y = i;
            const netTop = this.project(netX, y, netHeight);
            const netBottom = this.project(netX, y, 0);
            ctx.beginPath();
            ctx.moveTo(netTop.x, netTop.y);
            ctx.lineTo(netBottom.x, netBottom.y);
            ctx.stroke();
        }
        
        // Draw horizontal net lines (across depth) - these show height levels
        ctx.strokeStyle = '#bbbbbb';
        ctx.lineWidth = 1;
        const numLines = 10; // More lines to show net structure
        for (let i = 0; i <= numLines; i++) {
            const z = (netHeight / numLines) * i;
            const netFront = this.project(netX, 0, z);
            const netBack = this.project(netX, Physics.COURT_LENGTH, z);
            // Make lines slightly darker at bottom, lighter at top for depth
            const alpha = 0.3 + (i / numLines) * 0.4;
            ctx.strokeStyle = `rgba(200, 200, 200, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(netFront.x, netFront.y);
            ctx.lineTo(netBack.x, netBack.y);
            ctx.stroke();
        }
        
        // Draw a subtle highlight on the top edge to show it's a 3D structure
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(netFrontTop.x, netFrontTop.y);
        ctx.lineTo(netBackTop.x, netBackTop.y);
        ctx.stroke();
    },
    
    // Draw character (placeholder - colored rectangle)
    drawCharacter(character, color) {
        const ctx = this.ctx;
        const proj = this.project(character.x, character.y, character.z);
        
        // Calculate character rectangle dimensions first
        const charSize = character.radius * this.courtTileSize * proj.scale;
        const minSize = 8;
        const finalSize = Math.max(charSize, minSize);
        const rectWidth = finalSize * 1.2;
        const rectHeight = finalSize * 1.5;
        
        // Draw shadow - directly below character at ground level (z=0)
        // Project ground position at same x,y coordinates
        const shadowProj = this.project(character.x, character.y, 0);
        
        // Shadow size reduces as character jumps higher (z increases)
        // At z=0 (ground), shadow is full size (scale = 1.0)
        // As z increases, shadow gets smaller proportionally
        const shadowScale = Math.max(0.2, 1.0 - character.z * 0.4); // Reduces by 40% per unit of height, min 20%
        const baseShadowWidth = character.radius * this.courtTileSize * shadowProj.scale * 2;
        const shadowWidth = baseShadowWidth * shadowScale;
        const shadowHeight = shadowWidth * 0.5; // Flattened for perspective
        
        // Character's bottom edge in screen coordinates
        const characterBottomY = proj.y + rectHeight / 2;
        
        // Shadow X matches character X exactly
        const shadowX = proj.x;
        // Shadow Y should be at ground level, positioned to align with character's bottom edge
        // When character is on ground (z=0), proj.y equals shadowProj.y (both at center)
        // Character's bottom is at proj.y + rectHeight/2, so shadow should be offset down by half height
        // Account for scale difference between character position and ground position
        const scaleRatio = shadowProj.scale / proj.scale;
        const shadowY = shadowProj.y + (rectHeight / 2) * scaleRatio;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, shadowWidth * 0.5, shadowHeight * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw character rectangle (centered on position)
        ctx.fillStyle = color;
        ctx.fillRect(proj.x - rectWidth / 2, proj.y - rectHeight / 2, rectWidth, rectHeight);
        
        // Draw character border (thicker for visibility)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(proj.x - rectWidth / 2, proj.y - rectHeight / 2, rectWidth, rectHeight);
        
        // Draw a small indicator on top (rectangle highlight)
        ctx.fillStyle = '#fff';
        ctx.fillRect(proj.x - rectWidth * 0.2, proj.y - rectHeight * 0.4, rectWidth * 0.4, rectHeight * 0.2);
    },
    
    // Main render function
    render() {
        const ctx = this.ctx;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw court
        this.drawCourt();
        
        // Draw entities (depth sorted by y position - higher y = farther = drawn first)
        // Sort by y position for proper depth
        const entities = [
            { type: 'character', data: Physics.player, color: '#4a9eff', y: Physics.player.y },
            { type: 'character', data: Physics.ai, color: '#ff4a4a', y: Physics.ai.y }
        ];
        
        // Sort by y (farther = higher y = draw first)
        entities.sort((a, b) => b.y - a.y);
        
        // Draw sorted entities
        entities.forEach(entity => {
            if (entity.type === 'character') {
                this.drawCharacter(entity.data, entity.color);
            }
        });
    }
};

