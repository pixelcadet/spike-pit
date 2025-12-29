# PROJECT CONTEXT — SPIKE PIT

## Overview

Spike Pit is a small, shippable HTML5 arcade game built for itch.io.

It is a fake-3D / 2.5D volleyball game using a forced-perspective camera. The game looks 3D but is technically fully 2D, built with HTML5 Canvas and vanilla JavaScript.

The goal is a fast, polished MVP that feels fun and readable, not a full simulation.

---

## Terminology

**Important distinction:**
- **Player** = the human person playing the game
- **Character** = the in-game entity/sprite that the player controls

When referring to in-game entities, sprites, or movement, use "character" or "player character". When referring to the human controlling the game, use "player".

---

## Core Goals

- Ship a complete, playable MVP quickly
- Run directly in the browser
- Uploadable to itch.io as an HTML game
- Easy to iterate and reskin later
- Designed to work well with Cursor-based development

---

## Game Concept

- Arcade volleyball with exaggerated physics
- One human player vs one AI opponent
- Short matches with fast feedback
- Fake depth and height sell a 3D look without real 3D tech

**Tone:**
- Short, punchy, slightly chaotic
- Rock-and-roll energy inspired by games like Blood Bowl
- More fun than realistic

---

## Perspective & Visual Style

- Forced perspective / 2.5D look
- Trapezoid volleyball court
- Court is visually deeper toward the top of the screen
- Characters closer to the bottom appear larger
- Characters farther away appear smaller

**Depth illusion is created by:**
  - Sprite scaling
  - Vertical compression
  - Draw order
  - Ground shadows

**Note:** Reference images are used only for camera perspective and court look. They do not imply grid-based or lane-based movement.

**This is NOT:**
- Grid or lane gameplay
- Isometric tile movement
- WebGL or real 3D

---

## Court Dimensions & Layout

- Court is **8 cells wide** and **4 cells long** (depth)
- Each side has a **4x4 grid** (4 cells wide × 4 cells deep)
- Net divides the court horizontally at x = 4 (middle)
- Net height: 1.0 world units
- Court uses forced perspective: front side (bottom of screen) is ~80% shorter than back side (top of screen)
- Each grid cell appears square in perspective

## Court Sides & Boundaries

- The player character is always on the **left side** of the court (x < 4)
- The AI character is always on the **right side** (x > 4)
- Characters cannot cross the net
- Characters can fall off the court edges if their footprint goes too far outside
- **Footprint-based detection**: Only the lower half of the character body (rectangular footprint) is checked for court boundaries
- **Edge thresholds** (percentage of footprint outside before falling):
  - **EDGE A** (top/back): 70%
  - **EDGE B** (left/right side): 70%
  - **EDGE C** (bottom/front): 10%
- When a character falls off, they respawn after 1 second at a fixed position near the edge they fell from
- After respawn, characters blink for 1 second with 50% movement speed and jump power

---

## World Coordinate System

All gameplay logic uses world coordinates, independent from rendering.

**Axes:**
- **x:** horizontal position across the court (left ↔ right from player perspective)
- **y:** depth position on the court (up ↔ down from player perspective)
- **z:** height (jumping and ball arc)

**Important:**
- Character movement is continuous, not locked to lanes or grids
- x and y are floating-point values
- z affects vertical height only and never horizontal or depth movement

Rendering projects (x, y, z) into screen space using a perspective projection function.

---

## Controls (Keyboard)

Key mapping is fixed and must be implemented exactly as follows:

- **A / D** → move back and forth horizontally (x axis)
- **W / S** → move up and down on the court depth (y axis)
  - **W** = forward (toward net, increases y)
  - **S** = backward (away from net, decreases y)
- **J** → jump (affects z only)
- **I** → spike / receive (context-dependent)
  - **Mid-air + ball in spike zone**: Spike the ball (powerful, straight trajectory if above net height; lob if at/below net height)
  - **On ground + ball in receiving zone**: Receive the ball (character moves toward ball if off-center, then lobs it upward for testing)
  - **Mid-air + ball in receiving zone (but not spike zone)**: Receive the ball (arching lob trajectory)
- **P** → Reset (respawns ball and resets character positions)

**Action Mechanics:**
- **Spike Zone**: 3D sphere at character's center mass, offset forward (toward net) and slightly upward. Radius adjustable via slider.
- **Receiving Zone**: 3D sphere at character's center mass, larger than spike zone. Radius adjustable via slider.
- Actions have cooldowns: `hasSpiked` and `hasReceived` flags prevent spamming (reset when landing)
- Only mid-air balls can be spiked or received (ground balls are ignored)
- Automatic movement: When receiving on ground, character automatically moves toward ball if it's not centered in the receiving zone
- Manual input (WASD) blends with automatic receiving movement (30% influence) so player retains some control

---

## Gameplay Scope (Current State)

- 1 player vs AI
- Single court
- Single camera
- **Note**: Scoring and match system are currently stripped down for physics testing
- Focus is on character movement, jumping, ball physics, and spike/receive mechanics
- Physics parameters are adjustable in real-time via on-screen controls menu

---

## Ball Physics

- Arcade-style physics, not realistic simulation
- Ball has fake Z axis for arc and height
- Gravity pulls the ball downward over time
- Ball bounces on the ground with damping (0.7) and friction (0.9)
- **Ball movement speed**: Adjustable via slider (affects time-scale, not trajectory distance)
- Ball size: 0.3036 world units radius

**Ball collides with:**
- Player character (bounces based on character velocity)
- AI character (bounces based on character velocity)
- Net (bounces, with special top-edge collision zone for realistic deflection)
- Ground (bounces with damping)

**Ball Actions:**
- **Spike**: Mid-air action when ball is in spike zone. Trajectory depends on ball height:
  - If ball z > net height: Straight, powerful spike toward opponent
  - If ball z ≤ net height: Arcing lob toward opponent
- **Receive**: Ground or mid-air action when ball is in receiving zone. Creates arching lob trajectory.
- **Ground bounce**: Pressing 'I' on ground with ball in receiving zone makes ball bounce straight up (for spike testing)

Shadows under the ball communicate height clearly and shrink proportionally with height. Ball shadow aligns with character shadow when directly above.

---

## AI Scope (Simple)

- AI character tracks ball position
- Moves freely along x and y within its court side
- **Ball tracking**: When ball is on AI's side, AI moves toward predicted ball position
- **Jumping**: AI jumps if ball is close and in a hittable position
- **Spiking/Receiving**: AI checks if ball is in spike zone (prioritized) or receiving zone and attempts actions accordingly
- **Return to center**: When ball is on player's side, AI returns to center of its court
- Uses same spike/receive mechanics as player character
- No advanced prediction
- No difficulty scaling for MVP

AI character should feel reactive and readable, not perfect.

---

## Rendering Rules

- Use HTML5 Canvas with 2D context
- Implement a projection function:
  - Converts (x, y, z) into (screenX, screenY, scale)
- Characters near the bottom are larger
- Characters near the top are smaller
- **Layered rendering**:
  - Background (dark purple) drawn first
  - Entities behind court (falling from EDGE A or B) drawn next
  - Court (green tiles and net) drawn next
  - Entities on/in front of court drawn last
- Depth-sort entities before drawing using y or projected screenY
- Draw ground shadows under characters and ball
  - Character shadows: Square shape, shrink with height, positioned at feet
  - Ball shadows: Circular, shrink with height, align with character shadow when directly above
- **Visual cues**: Ground rings for receiving zone (always visible) and spike zone (visible when jumping), matching character colors
- **Blinking effect**: Characters blink (alternating alpha) for 1 second after respawn
- Collision logic must never rely on sprite pixels

---

## Asset & Sprite Strategy

All visuals must be easily replaceable later.

**Rules:**
- Rendering is fully decoupled from game logic
- Sprites are loaded via a central configuration
- Each sprite defines:
  - File path
  - Width
  - Height
  - Anchor point
- Placeholder sprites are acceptable for MVP
- Later art swaps must not require logic refactoring

---

## Folder Structure

Simple and flat, no build tooling.

```
index.html  
style.css  

src/
- main.js        // game loop
- game.js        // game state
- physics.js     // movement and collisions
- render.js      // projection and drawing
- ai.js          // AI logic
- input.js       // keyboard handling
- controls.js    // physics parameter UI controls

assets/
- player.png        // player character sprite
- enemy.png         // AI character sprite
- ball.png
- net.png
- court.png

docs/
- CONTEXT.md

README.md        // project overview (in root)
```

---

## Technical Constraints

- Vanilla JavaScript only
- No frameworks
- No build step
- Must run by opening index.html directly
- Compatible with itch.io HTML uploads

---

## Physics Controls Menu

A collapsible menu (collapsed by default) on the right side allows real-time adjustment of physics parameters:

- **Movement Speed** (1-10): Character and AI movement speed
- **Jump Power** (1-10): Character and AI jump strength
- **Gravity** (1-10): Gravity affecting characters and ball
- **Air Time** (1-10): Peak hang time multiplier (extends time at jump peak without increasing height)
- **Ball Movement Speed** (1-10): Time-scale factor for ball physics (affects duration, not trajectory distance)
- **Receive Zone Size** (1-10): Radius of receiving zone sphere
- **Spike Zone Size** (1-10): Radius of spike zone sphere

All sliders use a 1-10 scale mapped to specific physics ranges. Default values are calibrated to comfortable gameplay.

## Explicitly Out of Scope (MVP)

- Online multiplayer
- Real 3D or WebGL
- Grid or lane-locked movement
- Complex animation systems
- Sprite sheets
- Advanced UI or menus (basic physics controls menu is acceptable)
- Feature creep

---

## Expansion Friendly

The architecture should allow future expansion into:
- 2v2 matches
- Better AI
- Local multiplayer
- Improved visuals and animation
- Multiple courts or themes

The MVP must remain minimal and shippable.

---

## Future Considerations / Notes

### Frame-rate dependent physics (time-based integration)
**Observed behavior:** Moving the game between monitors (e.g., 60Hz ↔ 120Hz) can make the ball/game feel significantly faster/slower.

**Why:** Some physics integration is effectively **per-frame** (e.g., position updates like `x += vx`, `z += vz`), so a higher refresh rate runs more updates per second.

**Future fix:** Convert physics to be **time-based** using `deltaTime` for integration (e.g., `x += vx * dt`, `vz -= g * dt`, etc.). This will require re-tuning `ballMovementSpeed` so it remains a *time-scale* control rather than a frame-rate proxy.

### Canvas artifacts across monitors / DPI scaling
**Observed behavior:** “Ghost” dashed lines / ring artifacts can appear on one monitor but disappear when moving the tab to another.

**Why:** Canvas rendering can differ across **devicePixelRatio**, OS scaling, and compositor paths; dash patterns and anti-aliasing can land on different subpixels.

**Mitigations:** Prefer `rgba()` for alpha, isolate canvas state with `save()/restore()`, and consider DPR-aware canvas sizing if artifacts persist.

### Receiving Mechanic and Falling System Interaction

**Current Behavior (as of latest implementation):**
- When pressing 'I' on the ground to receive, the character automatically moves toward the ball if it's not centered in the receiving zone
- This automatic movement can push the character off the court edges
- Falling detection triggers when: character is on ground AND off court (or z < -2.0)
- Once falling is triggered, all controls (including automatic receiving movement) are disabled
- This allows natural gameplay where characters can chase balls near edges and fall off

**Potential Future Refinements:**
- Consider if automatic receiving movement should be aware of court boundaries
- May want to add visual/audio feedback when character is about to fall while chasing ball
- Could add a "commitment" window where character continues chasing even slightly off court before falling
- Consider if receiving movement speed should slow down near edges to give player more control

**Status:** Working as intended for now, but may need refinement based on playtesting feedback.

---

## Definition of Done (MVP)

- Game loads and plays in browser
- Player character always spawns on left side
- Player can win or lose against AI
- Controls feel responsive and intentional
- Perspective illusion reads clearly
- No blockers or broken states
- Zip and upload results in a playable itch.io build
