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

## Court Sides

- The player character is always on the **left side** of the court
- The AI character is always on the **right side**
- Characters cannot cross the net
- Movement is clamped to each side of the court

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
- **J** → jump (affects z only)
- **I** → hit / spike / serve / receive

**Notes:**
- Jump and hit are separate actions
- Hitting the ball should only occur when the hit key is pressed
- Timing and proximity determine hit strength and direction

---

## Gameplay Scope (MVP)

- 1 player vs AI
- Single court
- Single camera
- First to 5 or 7 points wins
- Auto-serve after each point
- Serve is triggered using the hit key
- Press a key to restart after match ends

---

## Ball Physics

- Arcade-style physics, not realistic simulation
- Ball has fake Z axis for arc and height
- Gravity pulls the ball downward over time
- Ball bounces on the ground

**Ball collides with:**
- Player character
- AI character
- Net
- Ground

Shadows under the ball communicate height clearly.

---

## AI Scope (Simple)

- AI character tracks ball position
- Moves freely along x and y within its court side
- Uses jump and hit actions to return the ball
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
- Depth-sort entities before drawing using y or projected screenY
- Draw ground shadows under characters and ball
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

## Explicitly Out of Scope (MVP)

- Online multiplayer
- Real 3D or WebGL
- Grid or lane-locked movement
- Complex animation systems
- Sprite sheets
- Advanced UI or menus
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

## Definition of Done (MVP)

- Game loads and plays in browser
- Player character always spawns on left side
- Player can win or lose against AI
- Controls feel responsive and intentional
- Perspective illusion reads clearly
- No blockers or broken states
- Zip and upload results in a playable itch.io build
