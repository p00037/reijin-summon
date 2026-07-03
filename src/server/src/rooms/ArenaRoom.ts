import { Client, Room } from "colyseus";
import { ArenaState, PlayerState } from "./schema/ArenaState.js";

export class ArenaRoom extends Room<ArenaState> {
  maxClients = 8;

  onCreate(): void {
    this.setState(new ArenaState());
  }

  onJoin(client: Client): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.x = 480;
    player.y = 270;

    this.state.players.set(client.sessionId, player);
    this.broadcast("notice", `Player joined: ${client.sessionId}`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.broadcast("notice", `Player left: ${client.sessionId}`);
  }
}
