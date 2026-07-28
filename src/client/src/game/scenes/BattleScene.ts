import Phaser from "phaser";
import { planCpuCommands } from "../ai/cpuPlanner";
import { findLeader, isUnitAlive } from "../core/battleState";
import {
  shouldKeepMoveMarker,
  transitionDragRelease
} from "../input/dragMovement";
import type {
  BattleState,
  ElementalId,
  ElementalState,
  LeaderState,
  PlayerUnitId,
  SummonedUnitState,
  TeamId,
  UnitState,
  Vec2
} from "../core/types";
import {
  battleStatusOverlayDepth,
  cardBorderColorForTeam,
  cardBorderDepth,
  cardBorderWidth,
  cardImageDepth,
  summonedCardPresentation,
  unitCardPresentation
} from "../render/cardPresentation";
import { healingAreaPresentation } from "../render/healingAreaPresentation";
import { canPlaceElementalAtUnit } from "../rules/elementalSystem";
import { cardRotationForMovement, initialCardRotation } from "../render/cardFacing";
import { GameSession } from "../rules/gameSession";
import { BattleHud } from "../ui/battleHud";
import {
  elementButtonTextureKey,
  summonButtonTextureKey
} from "../ui/battleHudModel";
import { calculateBattleLayout } from "../ui/battleLayout";

const maxFrameDeltaSeconds = 1 / 20;
const selectionRadiusPx = 28;
const summonerTextureKey = "summoner";
const elementalTextureKey = "elemental-crystal";
const summonerSpriteDisplaySize = 64;
const elementalSpriteDisplaySize = 15;
const elementButtonPath = "/assets/buttons/element_button.png";
const summonButtonPath = "/assets/buttons/summon_button.png";

export class BattleScene extends Phaser.Scene {
  private session!: GameSession;
  private battlefield!: Phaser.GameObjects.Graphics;
  private battlefieldOverlay!: Phaser.GameObjects.Graphics;
  private circleOverlay!: Phaser.GameObjects.Graphics;
  private circleMaskShape!: Phaser.GameObjects.Graphics;
  private hud!: BattleHud;
  private leaderSprites = new Map<TeamId, Phaser.GameObjects.Image>();
  private elementalSprites = new Map<ElementalId, Phaser.GameObjects.Image>();
  private unitImages = new Map<string, Phaser.GameObjects.Image>();
  private unitCardBorders = new Map<string, Phaser.GameObjects.Rectangle>();
  private summonedUnitImages = new Map<number, Phaser.GameObjects.Image>();
  private summonedUnitCardBorders = new Map<number, Phaser.GameObjects.Rectangle>();
  private unitCardPositions = new Map<string, Vec2>();
  private unitCardRotations = new Map<string, number>();
  private summonedCardPositions = new Map<number, Vec2>();
  private summonedCardRotations = new Map<number, number>();
  private selectedUnitId: PlayerUnitId | null = null;
  private draggedUnitId: PlayerUnitId | null = null;
  private moveMarkers = new Map<PlayerUnitId, Vec2>();
  private cpuPlanTimerSeconds = 0;

  constructor() {
    super("BattleScene");
  }

  preload(): void {
    for (const presentation of Object.values(unitCardPresentation)) {
      this.load.image(presentation.textureKey, presentation.path);
    }
    this.load.image(summonedCardPresentation.textureKey, summonedCardPresentation.path);
    this.load.image(summonerTextureKey, "/assets/summoners/summoner.png");
    this.load.image(elementalTextureKey, "/assets/elements/crystal.png");
    this.load.image(elementButtonTextureKey, elementButtonPath);
    this.load.image(summonButtonTextureKey, summonButtonPath);
  }

  create(): void {
    this.session = new GameSession();
    this.leaderSprites = new Map();
    this.elementalSprites = new Map();
    this.unitImages = new Map();
    this.unitCardBorders = new Map();
    this.summonedUnitImages = new Map();
    this.summonedUnitCardBorders = new Map();
    this.unitCardPositions = new Map();
    this.unitCardRotations = new Map();
    this.summonedCardPositions = new Map();
    this.summonedCardRotations = new Map();
    this.selectedUnitId = null;
    this.draggedUnitId = null;
    this.moveMarkers = new Map();
    this.cpuPlanTimerSeconds = 0;
    this.cameras.main.setBackgroundColor("#101827");

    const layout = calculateBattleLayout(this.scale.width, this.scale.height);

    this.battlefield = this.add.graphics();
    this.battlefieldOverlay = this.add.graphics();
    this.battlefieldOverlay.setDepth(battleStatusOverlayDepth);
    this.circleOverlay = this.add.graphics();
    this.circleOverlay.setDepth(battleStatusOverlayDepth - 0.5);
    this.circleMaskShape = this.make.graphics({}, false);
    this.circleMaskShape
      .fillStyle(0xffffff, 1)
      .fillRect(
        layout.field.x,
        layout.field.y,
        layout.field.width,
        layout.field.height
      );
    this.circleOverlay.setMask(this.circleMaskShape.createGeometryMask());
    this.createLeaderSprites();
    this.createUnitImages();
    this.hud = new BattleHud(this, layout, {
      onBuild: () => this.handleBuild(),
      onSummon: () => this.handleSummon(),
      onRetry: () => this.scene.restart()
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer));
    this.input.on("pointerupoutside", () => {
      this.draggedUnitId = null;
    });
    this.draw();
  }

  update(_time: number, deltaMs: number): void {
    const deltaSeconds = Math.min(deltaMs / 1000, maxFrameDeltaSeconds);

    if (this.session.state.result === "InProgress") {
      this.cpuPlanTimerSeconds += deltaSeconds;
      if (this.cpuPlanTimerSeconds >= 1) {
        this.cpuPlanTimerSeconds = 0;
        for (const command of planCpuCommands(this.session.state, this.session.config)) {
          this.session.applyCommand(command);
        }
      }
      this.session.tick(deltaSeconds);
    }

    this.draw();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.draggedUnitId = null;
    if (this.hud.contains(pointer.x, pointer.y) || this.session.state.result !== "InProgress") {
      return;
    }

    const unit = this.findPlayerUnitNear(pointer.x, pointer.y);
    if (!unit) {
      return;
    }

    this.selectedUnitId = unit.unitId;
    this.draggedUnitId = unit.unitId;
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const draggedUnitId = this.draggedUnitId;
    const unit = this.session.state.units.find(
      (candidate) => candidate.unitId === draggedUnitId
    );
    const transition = transitionDragRelease(
      {
        draggedUnitId,
        moveMarkers: this.moveMarkers
      },
      {
        matchInProgress: this.session.state.result === "InProgress",
        overHud: this.hud.contains(pointer.x, pointer.y),
        insideBattlefield: this.fieldBounds().contains(pointer.x, pointer.y),
        targetUnitAlive: unit !== undefined && isUnitAlive(unit)
      },
      this.screenToWorld(pointer.x, pointer.y)
    );
    this.draggedUnitId = transition.draggedUnitId;
    this.moveMarkers = transition.moveMarkers;
    if (!transition.command || !unit) {
      return;
    }

    this.session.applyCommand(transition.command);
  }

  private handleBuild(): void {
    if (this.session.state.result !== "InProgress") {
      return;
    }
    if (!this.selectedUnitId) {
      return;
    }

    const unit = this.session.state.units.find((candidate) => candidate.unitId === this.selectedUnitId);
    if (!unit || unit.mode !== "Active" || !isUnitAlive(unit)) {
      return;
    }
    if (!canPlaceElementalAtUnit(this.session.state, this.session.config, this.selectedUnitId)) {
      return;
    }

    this.session.applyCommand({
      commandType: "BeginElementalBuild",
      team: "Player",
      unitId: this.selectedUnitId
    });
  }

  private handleSummon(): void {
    if (this.session.state.result !== "InProgress") {
      return;
    }
    if (!this.session.canSummon("Player")) {
      return;
    }

    this.session.applyCommand({ commandType: "Summon", team: "Player" });
  }

  private findPlayerUnitNear(x: number, y: number): (UnitState & { unitId: PlayerUnitId; team: "Player" }) | null {
    let nearest: (UnitState & { unitId: PlayerUnitId; team: "Player" }) | null = null;
    let nearestDistanceSq = selectionRadiusPx * selectionRadiusPx;
    for (const unit of this.session.state.units) {
      if (!isPlayerUnit(unit) || !isUnitAlive(unit)) {
        continue;
      }
      const screen = this.worldToScreen(unit.position);
      const distanceSq = Phaser.Math.Distance.Squared(x, y, screen.x, screen.y);
      if (distanceSq <= nearestDistanceSq) {
        nearest = unit;
        nearestDistanceSq = distanceSq;
      }
    }
    return nearest;
  }

  private draw(): void {
    const state = this.session.state;
    this.battlefield.clear();
    this.battlefieldOverlay.clear();
    this.circleOverlay.clear();
    this.drawField();
    this.drawArea("Player");
    this.drawArea("Cpu");
    this.drawHealingAreas(state.leaders);
    this.drawLeaders(state.leaders);
    this.drawElementals(state.elementals);
    this.drawSummonedUnits(state.summonedUnits);
    this.pruneMoveMarkers(state.units);
    this.drawMoveMarkers();
    this.drawUnits(state.units);
    this.drawAttackEvents(state);

    this.hud.update(
      state,
      this.selectedUnitId,
      this.session.canSummon("Player")
    );
  }

  private drawField(): void {
    const bounds = this.fieldBounds();
    this.battlefield.fillStyle(0x111c31, 1);
    this.battlefield.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.battlefield.lineStyle(1, 0x334155, 1);
    this.battlefield.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    const centerY = bounds.y + bounds.height / 2;
    this.battlefield.lineStyle(2, 0x475569, 0.7);
    this.battlefield.lineBetween(bounds.x, centerY, bounds.x + bounds.width, centerY);
    for (let offset = -3; offset <= 3; offset += 1) {
      const x = bounds.x + bounds.width / 2 + offset * (bounds.width / 7);
      this.battlefield.lineStyle(1, 0x1f2a44, 0.9);
      this.battlefield.lineBetween(x, bounds.y, x, bounds.y + bounds.height);
    }
  }

  private drawArea(team: TeamId): void {
    const leader = findLeader(this.session.state, team);
    const points = [
      leader.position,
      ...this.session.state.elementals
        .filter((elemental) => elemental.team === team && elemental.isComplete && elemental.currentHp > 0)
        .map((elemental) => elemental.position)
    ];
    if (points.length < 2) {
      return;
    }

    const ordered = orderPoints(points);
    const color = team === "Player" ? 0x38bdf8 : 0xfb7185;
    this.battlefield.lineStyle(2, color, 0.55);
    for (let index = 0; index < ordered.length; index += 1) {
      const current = this.worldToScreen(ordered[index]);
      const next = this.worldToScreen(ordered[(index + 1) % ordered.length]);
      this.battlefield.lineBetween(current.x, current.y, next.x, next.y);
    }
  }

  private drawHealingAreas(leaders: LeaderState[]): void {
    const presentation = healingAreaPresentation(this.session.config.leaderHealingRadius);
    const screenRadius = this.worldRadiusToScreen(presentation.radius);
    for (const leader of leaders) {
      const screen = this.worldToScreen(leader.position);
      this.circleOverlay.fillStyle(presentation.fillColor, presentation.fillAlpha);
      this.circleOverlay.fillCircle(screen.x, screen.y, screenRadius);
      this.circleOverlay.lineStyle(
        presentation.strokeWidth,
        presentation.strokeColor,
        presentation.strokeAlpha
      );
      this.circleOverlay.strokeCircle(screen.x, screen.y, screenRadius);
    }
  }

  private drawLeaders(leaders: LeaderState[]): void {
    for (const leader of leaders) {
      const screen = this.worldToScreen(leader.position);
      const color = leader.team === "Player" ? 0x3b82f6 : 0xef4444;
      this.updateLeaderSprite(leader, screen);
      this.circleOverlay.lineStyle(3, color, 0.75);
      this.circleOverlay.strokeCircle(screen.x, screen.y, 28);
      this.circleOverlay.lineStyle(3, 0xf8fafc, 0.9);
      this.circleOverlay.strokeCircle(screen.x, screen.y, 25);
      this.drawHpBar(screen.x - 30, screen.y - 38, 60, leader.currentHp / leader.maxHp, color);
    }
  }

  private drawElementals(elementals: ElementalState[]): void {
    this.destroyRemovedElementalSprites(elementals);
    for (const elemental of elementals) {
      const screen = this.worldToScreen(elemental.position);
      const color = elemental.team === "Player" ? 0x7dd3fc : 0xfda4af;
      this.updateElementalSprite(elemental, screen);
      this.battlefieldOverlay.lineStyle(2, color, elemental.isComplete ? 0.85 : 0.45);
      this.battlefieldOverlay.strokeCircle(screen.x, screen.y, 13);
      this.drawHpBar(screen.x - 18, screen.y + 18, 36, elemental.currentHp / elemental.maxHp, color);
    }
  }

  private drawSummonedUnits(summonedUnits: SummonedUnitState[]): void {
    this.destroyRemovedSummonedUnitImages(summonedUnits);
    for (const summoned of summonedUnits) {
      const screen = this.worldToScreen(summoned.position);
      const color = summoned.team === "Player" ? 0x22d3ee : 0xfb7185;
      this.updateSummonedUnitImage(summoned, screen);
      this.battlefieldOverlay.lineStyle(2, color, 1);
      this.battlefieldOverlay.strokeCircle(screen.x, screen.y, 30);
      this.drawHpBar(screen.x - 28, screen.y + 34, 56, summoned.currentHp / summoned.maxHp, color);
    }
  }

  private pruneMoveMarkers(units: UnitState[]): void {
    for (const [unitId] of this.moveMarkers) {
      const unit = units.find((candidate) => candidate.unitId === unitId);
      if (!unit || !shouldKeepMoveMarker(unit)) {
        this.moveMarkers.delete(unitId);
      }
    }
  }

  private drawMoveMarkers(): void {
    this.battlefieldOverlay.lineStyle(2, 0xfacc15, 0.9);
    for (const marker of this.moveMarkers.values()) {
      const screen = this.worldToScreen(marker);
      this.battlefieldOverlay.strokeCircle(screen.x, screen.y, 10);
      this.battlefieldOverlay.lineBetween(screen.x - 6, screen.y, screen.x + 6, screen.y);
      this.battlefieldOverlay.lineBetween(screen.x, screen.y - 6, screen.x, screen.y + 6);
    }
  }

  private drawUnits(units: UnitState[]): void {
    for (const unit of units) {
      const screen = this.worldToScreen(unit.position);
      const isSelected = unit.unitId === this.selectedUnitId;
      const color = unit.team === "Player" ? 0x60a5fa : 0xf87171;
      const alpha = unit.mode === "Defeated" ? 0.28 : 1;

      this.updateUnitImage(unit, screen, alpha);

      if (isSelected) {
        this.battlefieldOverlay.lineStyle(3, 0xfacc15, 1);
        this.battlefieldOverlay.strokeCircle(screen.x, screen.y, 24);
      }

      if (!this.unitImages.has(unit.unitId)) {
        this.battlefield.fillStyle(color, alpha);
        if (unit.unitType === "Speed") {
          this.battlefield.fillTriangle(screen.x, screen.y - 15, screen.x - 13, screen.y + 12, screen.x + 13, screen.y + 12);
        } else {
          this.battlefield.fillCircle(screen.x, screen.y, 14);
        }
      }

      if (unit.mode === "BuildingElemental") {
        this.battlefieldOverlay.lineStyle(2, 0xfacc15, 0.95);
        this.battlefieldOverlay.strokeCircle(screen.x, screen.y, 20);
      }
      this.drawHpBar(screen.x - 20, screen.y + 21, 40, unit.currentHp / unit.stats.maxHp, color);
    }
  }

  private createUnitImages(): void {
    for (const unit of this.session.state.units) {
      const presentation = unitCardPresentation[unit.unitType];
      const image = this.add.image(0, 0, presentation.textureKey);
      const displayWidth = image.width / image.height * presentation.displayHeight;
      image.setDisplaySize(displayWidth, presentation.displayHeight);
      image.setDepth(cardImageDepth);
      const border = this.add.rectangle(
        0,
        0,
        displayWidth + cardBorderWidth * 2,
        presentation.displayHeight + cardBorderWidth * 2,
        cardBorderColorForTeam(unit.team)
      );
      border.setDepth(cardBorderDepth);
      const rotation = initialCardRotation(unit.team);
      image.setRotation(rotation);
      border.setRotation(rotation);
      this.unitImages.set(unit.unitId, image);
      this.unitCardBorders.set(unit.unitId, border);
      this.unitCardRotations.set(unit.unitId, rotation);
    }
  }

  private createLeaderSprites(): void {
    for (const leader of this.session.state.leaders) {
      const sprite = this.add.image(0, 0, summonerTextureKey);
      sprite.setDisplaySize(summonerSpriteDisplaySize, summonerSpriteDisplaySize);
      sprite.setDepth(1);
      sprite.setFlipX(leader.team === "Cpu");
      this.leaderSprites.set(leader.team, sprite);
    }
  }

  private updateLeaderSprite(leader: LeaderState, screen: Vec2): void {
    const sprite = this.leaderSprites.get(leader.team);
    if (!sprite) {
      return;
    }

    sprite.setPosition(screen.x, screen.y);
    sprite.setAlpha(leader.currentHp > 0 ? 1 : 0.35);
    sprite.setFlipX(leader.team === "Cpu");
  }

  private updateElementalSprite(elemental: ElementalState, screen: Vec2): void {
    let sprite = this.elementalSprites.get(elemental.elementalId);
    if (!sprite) {
      sprite = this.add.image(0, 0, elementalTextureKey);
      sprite.setDisplaySize(elementalSpriteDisplaySize, elementalSpriteDisplaySize);
      sprite.setDepth(1);
      this.elementalSprites.set(elemental.elementalId, sprite);
    }

    sprite.setPosition(screen.x, screen.y);
    sprite.setAlpha(elemental.isComplete ? 1 : 0.55);
    sprite.setTint(elemental.team === "Player" ? 0x7dd3fc : 0xfda4af);
  }

  private destroyRemovedElementalSprites(elementals: ElementalState[]): void {
    const activeIds = new Set(elementals.map((elemental) => elemental.elementalId));
    for (const [id, sprite] of this.elementalSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.elementalSprites.delete(id);
      }
    }
  }

  private updateUnitImage(unit: UnitState, screen: Vec2, alpha: number): void {
    const image = this.unitImages.get(unit.unitId);
    if (!image) {
      return;
    }

    const border = this.unitCardBorders.get(unit.unitId);
    const rotation = cardRotationForMovement(
      this.unitCardPositions.get(unit.unitId) ?? screen,
      screen,
      this.unitCardRotations.get(unit.unitId) ?? initialCardRotation(unit.team)
    );
    if (border) {
      border.setPosition(screen.x, screen.y);
      border.setAlpha(alpha);
      border.setFillStyle(cardBorderColorForTeam(unit.team));
      border.setRotation(rotation);
    }
    image.setPosition(screen.x, screen.y);
    image.setAlpha(alpha);
    image.setRotation(rotation);
    this.unitCardPositions.set(unit.unitId, { ...screen });
    this.unitCardRotations.set(unit.unitId, rotation);
  }

  private updateSummonedUnitImage(summoned: SummonedUnitState, screen: Vec2): void {
    let image = this.summonedUnitImages.get(summoned.summonedUnitId);
    if (!image) {
      image = this.add.image(0, 0, summonedCardPresentation.textureKey);
      const displayWidth = image.width / image.height * summonedCardPresentation.displayHeight;
      image.setDisplaySize(displayWidth, summonedCardPresentation.displayHeight);
      image.setDepth(cardImageDepth);
      const border = this.add.rectangle(
        0,
        0,
        displayWidth + cardBorderWidth * 2,
        summonedCardPresentation.displayHeight + cardBorderWidth * 2,
        cardBorderColorForTeam(summoned.team)
      );
      border.setDepth(cardBorderDepth);
      const rotation = initialCardRotation(summoned.team);
      image.setRotation(rotation);
      border.setRotation(rotation);
      this.summonedUnitImages.set(summoned.summonedUnitId, image);
      this.summonedUnitCardBorders.set(summoned.summonedUnitId, border);
      this.summonedCardRotations.set(summoned.summonedUnitId, rotation);
    }

    const border = this.summonedUnitCardBorders.get(summoned.summonedUnitId);
    const rotation = cardRotationForMovement(
      this.summonedCardPositions.get(summoned.summonedUnitId) ?? screen,
      screen,
      this.summonedCardRotations.get(summoned.summonedUnitId) ?? initialCardRotation(summoned.team)
    );
    if (border) {
      border.setPosition(screen.x, screen.y);
      border.setAlpha(summoned.currentHp > 0 ? 1 : 0.25);
      border.setFillStyle(cardBorderColorForTeam(summoned.team));
      border.setRotation(rotation);
    }
    image.setPosition(screen.x, screen.y);
    image.setAlpha(summoned.currentHp > 0 ? 1 : 0.25);
    image.setRotation(rotation);
    this.summonedCardPositions.set(summoned.summonedUnitId, { ...screen });
    this.summonedCardRotations.set(summoned.summonedUnitId, rotation);
  }

  private destroyRemovedSummonedUnitImages(summonedUnits: SummonedUnitState[]): void {
    const activeIds = new Set(summonedUnits.map((summoned) => summoned.summonedUnitId));
    for (const [id, image] of this.summonedUnitImages) {
      if (!activeIds.has(id)) {
        image.destroy();
        this.summonedUnitImages.delete(id);
        const border = this.summonedUnitCardBorders.get(id);
        border?.destroy();
        this.summonedUnitCardBorders.delete(id);
        this.summonedCardPositions.delete(id);
        this.summonedCardRotations.delete(id);
      }
    }
  }

  private drawAttackEvents(state: BattleState): void {
    this.battlefield.lineStyle(2, 0xf8fafc, 0.8);
    for (const event of state.recentAttackEvents) {
      const origin = this.worldToScreen(event.origin);
      const target = this.worldToScreen(event.targetPosition);
      this.battlefield.lineBetween(origin.x, origin.y, target.x, target.y);
    }
  }

  private drawHpBar(x: number, y: number, width: number, ratio: number, color: number): void {
    const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
    this.battlefieldOverlay.fillStyle(0x020617, 0.9);
    this.battlefieldOverlay.fillRect(x, y, width, 5);
    this.battlefieldOverlay.fillStyle(color, 1);
    this.battlefieldOverlay.fillRect(x, y, width * clampedRatio, 5);
  }

  private worldToScreen(position: Vec2): Vec2 {
    const bounds = this.fieldBounds();
    const { battlefieldMin, battlefieldMax } = this.session.config;
    return {
      x: Phaser.Math.Linear(bounds.x, bounds.x + bounds.width, (position.x - battlefieldMin.x) / (battlefieldMax.x - battlefieldMin.x)),
      y: Phaser.Math.Linear(bounds.y + bounds.height, bounds.y, (position.y - battlefieldMin.y) / (battlefieldMax.y - battlefieldMin.y))
    };
  }

  private worldRadiusToScreen(radius: number): number {
    const { battlefieldMin } = this.session.config;
    const origin = this.worldToScreen(battlefieldMin);
    const edge = this.worldToScreen({ x: battlefieldMin.x + radius, y: battlefieldMin.y });
    return Math.abs(edge.x - origin.x);
  }

  private screenToWorld(x: number, y: number): Vec2 {
    const bounds = this.fieldBounds();
    const { battlefieldMin, battlefieldMax } = this.session.config;
    const normalizedX = Phaser.Math.Clamp((x - bounds.x) / bounds.width, 0, 1);
    const normalizedY = Phaser.Math.Clamp((bounds.y + bounds.height - y) / bounds.height, 0, 1);
    return {
      x: Phaser.Math.Linear(battlefieldMin.x, battlefieldMax.x, normalizedX),
      y: Phaser.Math.Linear(battlefieldMin.y, battlefieldMax.y, normalizedY)
    };
  }

  private fieldBounds(): Phaser.Geom.Rectangle {
    const field = calculateBattleLayout(this.scale.width, this.scale.height).field;
    return new Phaser.Geom.Rectangle(field.x, field.y, field.width, field.height);
  }
}

function isPlayerUnit(unit: UnitState): unit is UnitState & { unitId: PlayerUnitId; team: "Player" } {
  return unit.team === "Player" && unit.unitId.startsWith("Player");
}

function orderPoints(points: Vec2[]): Vec2[] {
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 }
  );
  return [...points].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
}
