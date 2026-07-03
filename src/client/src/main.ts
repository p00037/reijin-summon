import Phaser from "phaser";
import { Client, Room } from "colyseus.js";
import "./style.css";

type ArenaState = {
  players: Map<string, unknown>;
};

class BootScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private room?: Room<ArenaState>;

  constructor() {
    super("BootScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#111827");

    this.add
      .text(width / 2, height / 2 - 48, "reijin-summon", {
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        fontSize: "36px"
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(width / 2, height / 2 + 12, "Connecting to Colyseus...", {
        color: "#a7f3d0",
        fontFamily: "Arial, sans-serif",
        fontSize: "18px"
      })
      .setOrigin(0.5);

    void this.connectToServer();
  }

  private async connectToServer(): Promise<void> {
    try {
      const client = new Client("ws://localhost:2567");
      this.room = await client.joinOrCreate<ArenaState>("arena");
      this.statusText?.setText(`Connected: ${this.room.sessionId}`);

      this.room.onMessage("notice", (message: string) => {
        this.statusText?.setText(message);
      });
    } catch (error) {
      console.error(error);
      this.statusText?.setText("Server offline. Run npm.cmd run dev:server");
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#111827",
  scene: BootScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
