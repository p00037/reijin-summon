# Game Environment Design

## Goal

Create a starter game project with a TypeScript + Phaser browser client and a Node.js + Colyseus multiplayer server.

## Architecture

The repository uses npm workspaces so the client and server can be managed from the project root while remaining independently buildable. The client lives in `src/client` and uses Vite for local development and bundling. The server lives in `src/server` and uses Colyseus rooms over WebSocket with TypeScript source compiled to `dist`.

## Components

- Root workspace: shared scripts, shared TypeScript base config, dependency installation entry point.
- Client app: Phaser scene, Colyseus client connection, Vite HTML entry point.
- Server app: Colyseus server bootstrap, health endpoint, sample room, schema state.

## Data Flow

The browser loads the Phaser scene from Vite. On scene creation, the client connects to the Colyseus server at `ws://localhost:2567`, joins or creates the `arena` room, and receives the room state. The starter room stores connected players in a Colyseus schema map and broadcasts a short chat-style message when a player joins.

## Testing And Verification

The first verification target is successful TypeScript compilation for both workspaces. After dependencies are installed, `npm.cmd run build` should build the client and server. `npm.cmd run dev` should run both local development servers.
