import express from "express";
import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom } from "./rooms/ArenaRoom.js";

const port = Number(process.env.PORT ?? 2567);
const app = express();
const httpServer = createServer(app);

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer
  })
});

gameServer.define("arena", ArenaRoom);

gameServer.listen(port).then(() => {
  console.log(`Colyseus server listening on http://localhost:${port}`);
});
