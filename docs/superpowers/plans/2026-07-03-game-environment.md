# Game Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a runnable TypeScript + Phaser client and Node.js + Colyseus server starter project.

**Architecture:** Use npm workspaces with `src/client` for the Vite/Phaser frontend and `src/server` for the Colyseus backend. Keep shared TypeScript settings in `tsconfig.base.json`, with each workspace owning its build config.

**Tech Stack:** TypeScript, Vite, Phaser, Node.js, Colyseus, @colyseus/schema, tsx, concurrently.

---

### Task 1: Root Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Modify: `README.md`

- [ ] Add workspace scripts for installing, developing, and building both apps.
- [ ] Add shared TypeScript compiler defaults.
- [ ] Ignore generated dependencies, build output, logs, and environment files.
- [ ] Document setup and local development commands.

### Task 2: Phaser Client

**Files:**
- Create: `src/client/package.json`
- Create: `src/client/tsconfig.json`
- Create: `src/client/index.html`
- Create: `src/client/src/main.ts`
- Create: `src/client/src/style.css`

- [ ] Add a Vite client workspace with Phaser and the Colyseus browser client.
- [ ] Render a starter Phaser scene.
- [ ] Connect to `arena` on `ws://localhost:2567`.
- [ ] Display connection status inside the game canvas.

### Task 3: Colyseus Server

**Files:**
- Create: `src/server/package.json`
- Create: `src/server/tsconfig.json`
- Create: `src/server/src/index.ts`
- Create: `src/server/src/rooms/ArenaRoom.ts`
- Create: `src/server/src/rooms/schema/ArenaState.ts`

- [ ] Add a TypeScript Node server workspace.
- [ ] Start a Colyseus server on port `2567`.
- [ ] Register the `arena` room.
- [ ] Track connected players in schema state.
- [ ] Expose `/health` for quick server checks.

### Task 4: Verification

**Files:**
- Generate: `package-lock.json`

- [ ] Run `npm.cmd install`.
- [ ] Run `npm.cmd run build`.
- [ ] If build passes, the starter environment is ready.
