import { MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
}

export class ArenaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
