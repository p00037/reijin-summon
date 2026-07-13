import Phaser from "phaser";
import { planCpuCommands } from "../ai/cpuPlanner";
import { findLeader, isUnitAlive, oppositeTeam } from "../core/battleState";
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
  meleeAnimationKey,
  meleeAnimationFrameRate,
  meleeAnimationKeyForUnit,
  meleeFrameStart,
  rangedAnimationKey,
  rangedAnimationFrameRate,
  rangedAnimationKeyForUnit,
  rangedFrameStart,
  speedAnimationKey,
  speedAnimationFrameRate,
  speedAnimationKeyForUnit,
  speedFrameStart,
  spriteFlipXForMovement,
  summonedAnimationKey,
  summonedAnimationFrameRate,
  summonedAnimationKeyForUnit,
  summonedFrameStart
} from "../render/unitAnimation";
import { GameSession } from "../rules/gameSession";
import { BattleHud } from "../ui/battleHud";

const maxFrameDeltaSeconds = 1 / 20;
const selectionRadiusPx = 28;
const meleeTextureKey = "melee-octopus";
const rangedTextureKey = "ranged-mermaid";
const speedTextureKey = "speed-shark";
const summonedTextureKey = "summoned-seiryuu";
const summonerTextureKey = "summoner";
const elementalTextureKey = "elemental-crystal";
const meleeSpriteDisplaySize = 52;
const rangedSpriteDisplaySize = 52;
const speedSpriteDisplaySize = 52;
const summonedSpriteDisplaySize = 108;
const summonerSpriteDisplaySize = 64;
const elementalSpriteDisplaySize = 44;

export class BattleScene extends Phaser.Scene {
  private session!: GameSession;
  private battlefield!: Phaser.GameObjects.Graphics;
  private hud!: BattleHud;
  private leaderSprites = new Map<TeamId, Phaser.GameObjects.Image>();
  private elementalSprites = new Map<ElementalId, Phaser.GameObjects.Image>();
  private meleeUnitSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private rangedUnitSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private speedUnitSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private summonedUnitSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private selectedUnitId: PlayerUnitId | null = null;
  private cpuPlanTimerSeconds = 0;

  constructor() {
    super("BattleScene");
  }

  preload(): void {
    this.load.spritesheet(meleeTextureKey, "/assets/units/octopus.png", {
      frameWidth: 280,
      frameHeight: 280,
      margin: 1,
      spacing: 0
    });
    this.load.spritesheet(rangedTextureKey, "/assets/units/mermaid.png", {
      frameWidth: 280,
      frameHeight: 280,
      margin: 1,
      spacing: 0
    });
    this.load.spritesheet(speedTextureKey, "/assets/units/shark.png", {
      frameWidth: 280,
      frameHeight: 280,
      margin: 1,
      spacing: 0
    });
    this.load.spritesheet(summonedTextureKey, "/assets/units/seiryuu.png", {
      frameWidth: 442,
      frameHeight: 442,
      margin: 0,
      spacing: 0
    });
    this.load.image(summonerTextureKey, "/assets/summoners/summoner.png");
    this.load.image(elementalTextureKey, "/assets/elements/crystal.png");
  }

  create(): void {
    this.session = new GameSession();
    this.leaderSprites = new Map();
    this.elementalSprites = new Map();
    this.meleeUnitSprites = new Map();
    this.rangedUnitSprites = new Map();
    this.speedUnitSprites = new Map();
    this.summonedUnitSprites = new Map();
    this.selectedUnitId = null;
    this.cpuPlanTimerSeconds = 0;
    this.cameras.main.setBackgroundColor("#101827");

    this.battlefield = this.add.graphics();
    this.createMeleeAnimations();
    this.createRangedAnimations();
    this.createSpeedAnimations();
    this.createSummonedAnimations();
    this.createLeaderSprites();
    this.createMeleeUnitSprites();
    this.createRangedUnitSprites();
    this.createSpeedUnitSprites();
    this.hud = new BattleHud(this, {
      onBuild: () => this.handleBuild(),
      onSummon: () => this.handleSummon(),
      onRetry: () => this.scene.restart()
    });
    this.hud.setStatus("Select unit, then click field.");

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
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

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    if (this.hud.contains(pointer.x, pointer.y) || this.session.state.result !== "InProgress") {
      return;
    }

    const clickedUnit = this.findPlayerUnitNear(pointer.x, pointer.y);
    if (clickedUnit) {
      this.selectedUnitId = clickedUnit.unitId;
      this.hud.setStatus(`${clickedUnit.unitType} selected.`);
      return;
    }

    if (!this.selectedUnitId) {
      this.hud.setStatus("Select a player unit first.");
      return;
    }

    const unit = this.session.state.units.find((candidate) => candidate.unitId === this.selectedUnitId);
    if (!unit || !isUnitAlive(unit)) {
      this.hud.setStatus("That unit is waiting to respawn.");
      return;
    }

    const targetPosition = this.screenToWorld(pointer.x, pointer.y);
    this.session.applyCommand({
      commandType: "MoveUnit",
      team: "Player",
      unitId: this.selectedUnitId,
      targetPosition
    });
    this.hud.setStatus(`${unit.unitType} moving.`);
  }

  private handleBuild(): void {
    if (this.session.state.result !== "InProgress") {
      return;
    }
    if (!this.selectedUnitId) {
      this.hud.setStatus("Select a player unit before building.");
      return;
    }

    const unit = this.session.state.units.find((candidate) => candidate.unitId === this.selectedUnitId);
    if (!unit || unit.mode !== "Active" || !isUnitAlive(unit)) {
      this.hud.setStatus("Only active player units can build.");
      return;
    }

    this.session.applyCommand({
      commandType: "BeginElementalBuild",
      team: "Player",
      unitId: this.selectedUnitId
    });
    this.hud.setStatus(`${unit.unitType} is building an elemental.`);
  }

  private handleSummon(): void {
    if (this.session.state.result !== "InProgress") {
      return;
    }
    if (!this.session.canSummon("Player")) {
      this.hud.setStatus(this.summonBlockerText());
      return;
    }

    this.session.applyCommand({ commandType: "Summon", team: "Player" });
    this.hud.setStatus("Summoned unit deployed.");
  }

  private summonBlockerText(): string {
    const completed = this.session.countCompletedElementals("Player");
    const required = this.session.config.requiredElementalsToSummon;
    if (completed < required) {
      return `Need ${required - completed} more elemental${required - completed === 1 ? "" : "s"} to summon.`;
    }
    const cooldown = this.session.state.playerSummonCooldownSeconds;
    if (cooldown > 0) {
      return `Summon cooldown: ${cooldown.toFixed(1)}s.`;
    }
    return "Cannot summon while the leader is defeated.";
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
    this.drawField();
    this.drawArea("Player");
    this.drawArea("Cpu");
    this.drawLeaders(state.leaders);
    this.drawElementals(state.elementals);
    this.drawSummonedUnits(state.summonedUnits);
    this.drawUnits(state.units);
    this.drawAttackEvents(state);

    this.hud.update(state, this.selectedUnitId);
  }

  private drawField(): void {
    const bounds = this.fieldBounds();
    this.battlefield.fillStyle(0x111c31, 1);
    this.battlefield.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.battlefield.lineStyle(1, 0x334155, 1);
    this.battlefield.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    const centerX = bounds.x + bounds.width / 2;
    this.battlefield.lineStyle(2, 0x475569, 0.7);
    this.battlefield.lineBetween(centerX, bounds.y, centerX, bounds.y + bounds.height);
    for (let offset = -3; offset <= 3; offset += 1) {
      const y = bounds.y + bounds.height / 2 + offset * (bounds.height / 7);
      this.battlefield.lineStyle(1, 0x1f2a44, 0.9);
      this.battlefield.lineBetween(bounds.x, y, bounds.x + bounds.width, y);
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

  private drawLeaders(leaders: LeaderState[]): void {
    for (const leader of leaders) {
      const screen = this.worldToScreen(leader.position);
      const color = leader.team === "Player" ? 0x3b82f6 : 0xef4444;
      this.updateLeaderSprite(leader, screen);
      this.battlefield.lineStyle(3, color, 0.75);
      this.battlefield.strokeCircle(screen.x, screen.y, 28);
      this.battlefield.lineStyle(3, 0xf8fafc, 0.9);
      this.battlefield.strokeCircle(screen.x, screen.y, 25);
      this.drawHpBar(screen.x - 30, screen.y - 38, 60, leader.currentHp / leader.maxHp, color);
    }
  }

  private drawElementals(elementals: ElementalState[]): void {
    this.destroyRemovedElementalSprites(elementals);
    for (const elemental of elementals) {
      const screen = this.worldToScreen(elemental.position);
      const color = elemental.team === "Player" ? 0x7dd3fc : 0xfda4af;
      this.updateElementalSprite(elemental, screen);
      this.battlefield.lineStyle(2, color, elemental.isComplete ? 0.85 : 0.45);
      this.battlefield.strokeCircle(screen.x, screen.y, 18);
      this.drawHpBar(screen.x - 18, screen.y + 18, 36, elemental.currentHp / elemental.maxHp, color);
    }
  }

  private drawSummonedUnits(summonedUnits: SummonedUnitState[]): void {
    this.destroyRemovedSummonedSprites(summonedUnits);
    for (const summoned of summonedUnits) {
      const screen = this.worldToScreen(summoned.position);
      const color = summoned.team === "Player" ? 0x22d3ee : 0xfb7185;
      this.updateSummonedUnitSprite(summoned, screen);
      this.battlefield.lineStyle(2, color, 1);
      this.battlefield.strokeCircle(screen.x, screen.y, 30);
      this.drawHpBar(screen.x - 28, screen.y + 34, 56, summoned.currentHp / summoned.maxHp, color);
    }
  }

  private drawUnits(units: UnitState[]): void {
    for (const unit of units) {
      const screen = this.worldToScreen(unit.position);
      const isSelected = unit.unitId === this.selectedUnitId;
      const color = unit.team === "Player" ? 0x60a5fa : 0xf87171;
      const alpha = unit.mode === "Defeated" ? 0.28 : 1;

      this.updateMeleeUnitSprite(unit, screen, alpha);
      this.updateRangedUnitSprite(unit, screen, alpha);
      this.updateSpeedUnitSprite(unit, screen, alpha);

      if (isSelected) {
        this.battlefield.lineStyle(3, 0xfacc15, 1);
        this.battlefield.strokeCircle(screen.x, screen.y, 24);
      }

      if (unit.unitType === "Melee" && !this.meleeUnitSprites.has(unit.unitId)) {
        this.battlefield.fillStyle(color, alpha);
        this.battlefield.fillCircle(screen.x, screen.y, 14);
      } else if (unit.unitType === "Speed" && !this.speedUnitSprites.has(unit.unitId)) {
        this.battlefield.fillStyle(color, alpha);
        this.battlefield.fillTriangle(screen.x, screen.y - 15, screen.x - 13, screen.y + 12, screen.x + 13, screen.y + 12);
      }

      if (unit.mode === "BuildingElemental") {
        this.battlefield.lineStyle(2, 0xfacc15, 0.95);
        this.battlefield.strokeCircle(screen.x, screen.y, 20);
      }
      this.drawHpBar(screen.x - 20, screen.y + 21, 40, unit.currentHp / unit.stats.maxHp, color);
    }
  }

  private createRangedAnimations(): void {
    this.ensureRangedAnimation("idle", 4, -1);
    this.ensureRangedAnimation("walk", 4, -1);
    this.ensureRangedAnimation("attack", 4, 0);
    this.ensureRangedAnimation("damage", 2, 0);
    this.ensureRangedAnimation("defeated", 4, 0);
  }

  private createMeleeAnimations(): void {
    this.ensureMeleeAnimation("idle", 4, -1);
    this.ensureMeleeAnimation("walk", 4, -1);
    this.ensureMeleeAnimation("attack", 4, 0);
    this.ensureMeleeAnimation("damage", 2, 0);
    this.ensureMeleeAnimation("defeated", 4, 0);
  }

  private createSpeedAnimations(): void {
    this.ensureSpeedAnimation("idle", 4, -1);
    this.ensureSpeedAnimation("walk", 4, -1);
    this.ensureSpeedAnimation("attack", 4, 0);
    this.ensureSpeedAnimation("damage", 2, 0);
    this.ensureSpeedAnimation("defeated", 4, 0);
  }

  private createSummonedAnimations(): void {
    this.ensureSummonedAnimation("walk", 4, -1);
    this.ensureSummonedAnimation("attack", 4, 0);
  }

  private ensureRangedAnimation(name: Parameters<typeof rangedAnimationKey>[0], frameCount: number, repeat: number): void {
    const key = rangedAnimationKey(name);
    if (this.anims.exists(key)) {
      return;
    }

    const start = rangedFrameStart(name);
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(rangedTextureKey, { start, end: start + frameCount - 1 }),
      frameRate: rangedAnimationFrameRate(name),
      repeat
    });
  }

  private ensureMeleeAnimation(name: Parameters<typeof meleeAnimationKey>[0], frameCount: number, repeat: number): void {
    const key = meleeAnimationKey(name);
    if (this.anims.exists(key)) {
      return;
    }

    const start = meleeFrameStart(name);
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(meleeTextureKey, { start, end: start + frameCount - 1 }),
      frameRate: meleeAnimationFrameRate(name),
      repeat
    });
  }

  private ensureSpeedAnimation(name: Parameters<typeof speedAnimationKey>[0], frameCount: number, repeat: number): void {
    const key = speedAnimationKey(name);
    if (this.anims.exists(key)) {
      return;
    }

    const start = speedFrameStart(name);
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(speedTextureKey, { start, end: start + frameCount - 1 }),
      frameRate: speedAnimationFrameRate(name),
      repeat
    });
  }

  private ensureSummonedAnimation(name: Parameters<typeof summonedAnimationKey>[0], frameCount: number, repeat: number): void {
    const key = summonedAnimationKey(name);
    if (this.anims.exists(key)) {
      return;
    }

    const start = summonedFrameStart(name);
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(summonedTextureKey, { start, end: start + frameCount - 1 }),
      frameRate: summonedAnimationFrameRate(name),
      repeat
    });
  }

  private createRangedUnitSprites(): void {
    for (const unit of this.session.state.units) {
      if (unit.unitType !== "Ranged") {
        continue;
      }

      const sprite = this.add.sprite(0, 0, rangedTextureKey, rangedFrameStart("idle"));
      sprite.setDisplaySize(rangedSpriteDisplaySize, rangedSpriteDisplaySize);
      sprite.setDepth(1);
      sprite.setFlipX(spriteFlipXForMovement(unit.team, unit.position, unit.destination));
      sprite.play("ranged-idle");
      this.rangedUnitSprites.set(unit.unitId, sprite);
    }
  }

  private createMeleeUnitSprites(): void {
    for (const unit of this.session.state.units) {
      if (unit.unitType !== "Melee") {
        continue;
      }

      const sprite = this.add.sprite(0, 0, meleeTextureKey, meleeFrameStart("idle"));
      sprite.setDisplaySize(meleeSpriteDisplaySize, meleeSpriteDisplaySize);
      sprite.setDepth(1);
      sprite.setFlipX(spriteFlipXForMovement(unit.team, unit.position, unit.destination));
      sprite.play("melee-idle");
      this.meleeUnitSprites.set(unit.unitId, sprite);
    }
  }

  private createSpeedUnitSprites(): void {
    for (const unit of this.session.state.units) {
      if (unit.unitType !== "Speed") {
        continue;
      }

      const sprite = this.add.sprite(0, 0, speedTextureKey, speedFrameStart("idle"));
      sprite.setDisplaySize(speedSpriteDisplaySize, speedSpriteDisplaySize);
      sprite.setDepth(1);
      sprite.setFlipX(spriteFlipXForMovement(unit.team, unit.position, unit.destination));
      sprite.play("speed-idle");
      this.speedUnitSprites.set(unit.unitId, sprite);
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

  private updateRangedUnitSprite(unit: UnitState, screen: Vec2, alpha: number): void {
    const sprite = this.rangedUnitSprites.get(unit.unitId);
    if (!sprite) {
      return;
    }

    const key = rangedAnimationKeyForUnit(unit, this.session.state.recentAttackEvents);
    const currentKey = sprite.anims.currentAnim?.key;
    const currentAttackOrDamage = currentKey === "ranged-attack" || currentKey === "ranged-damage";

    sprite.setPosition(screen.x, screen.y);
    sprite.setAlpha(alpha);
    sprite.setFlipX(spriteFlipXForMovement(unit.team, unit.position, unit.destination));

    if (unit.mode === "Defeated") {
      if (currentKey !== key) {
        sprite.play(key);
      }
      return;
    }

    if (currentAttackOrDamage && sprite.anims.isPlaying) {
      return;
    }

    if (currentKey !== key || !sprite.anims.isPlaying) {
      sprite.play(key);
    }
  }

  private updateMeleeUnitSprite(unit: UnitState, screen: Vec2, alpha: number): void {
    const sprite = this.meleeUnitSprites.get(unit.unitId);
    if (!sprite) {
      return;
    }

    const key = meleeAnimationKeyForUnit(unit, this.session.state.recentAttackEvents);
    const currentKey = sprite.anims.currentAnim?.key;
    const currentAttackOrDamage = currentKey === "melee-attack" || currentKey === "melee-damage";

    sprite.setPosition(screen.x, screen.y);
    sprite.setAlpha(alpha);
    sprite.setFlipX(spriteFlipXForMovement(unit.team, unit.position, unit.destination));

    if (unit.mode === "Defeated") {
      if (currentKey !== key) {
        sprite.play(key);
      }
      return;
    }

    if (currentAttackOrDamage && sprite.anims.isPlaying) {
      return;
    }

    if (currentKey !== key || !sprite.anims.isPlaying) {
      sprite.play(key);
    }
  }

  private updateSpeedUnitSprite(unit: UnitState, screen: Vec2, alpha: number): void {
    const sprite = this.speedUnitSprites.get(unit.unitId);
    if (!sprite) {
      return;
    }

    const key = speedAnimationKeyForUnit(unit, this.session.state.recentAttackEvents);
    const currentKey = sprite.anims.currentAnim?.key;
    const currentAttackOrDamage = currentKey === "speed-attack" || currentKey === "speed-damage";

    sprite.setPosition(screen.x, screen.y);
    sprite.setAlpha(alpha);
    sprite.setFlipX(spriteFlipXForMovement(unit.team, unit.position, unit.destination));

    if (unit.mode === "Defeated") {
      if (currentKey !== key) {
        sprite.play(key);
      }
      return;
    }

    if (currentAttackOrDamage && sprite.anims.isPlaying) {
      return;
    }

    if (currentKey !== key || !sprite.anims.isPlaying) {
      sprite.play(key);
    }
  }

  private updateSummonedUnitSprite(summoned: SummonedUnitState, screen: Vec2): void {
    let sprite = this.summonedUnitSprites.get(summoned.summonedUnitId);
    if (!sprite) {
      sprite = this.add.sprite(0, 0, summonedTextureKey, summonedFrameStart("walk"));
      sprite.setDisplaySize(summonedSpriteDisplaySize, summonedSpriteDisplaySize);
      sprite.setDepth(1);
      sprite.play("summoned-walk");
      this.summonedUnitSprites.set(summoned.summonedUnitId, sprite);
    }

    const enemyTeam = oppositeTeam(summoned.team);
    const enemyTargets = [
      findLeader(this.session.state, enemyTeam),
      ...this.session.state.units.filter((unit) => unit.team === enemyTeam && isUnitAlive(unit)),
      ...this.session.state.summonedUnits.filter((candidate) => candidate.team === enemyTeam && candidate.currentHp > 0)
    ];
    const key = summonedAnimationKeyForUnit(summoned, enemyTargets, this.session.config.contactSlowRadius);
    const currentKey = sprite.anims.currentAnim?.key;
    const currentAttack = currentKey === "summoned-attack";

    sprite.setPosition(screen.x, screen.y);
    sprite.setAlpha(summoned.currentHp > 0 ? 1 : 0.25);
    sprite.setFlipX(spriteFlipXForMovement(summoned.team, summoned.position, summoned.destination));

    if (currentAttack && sprite.anims.isPlaying) {
      return;
    }

    if (currentKey !== key || !sprite.anims.isPlaying) {
      sprite.play(key);
    }
  }

  private destroyRemovedSummonedSprites(summonedUnits: SummonedUnitState[]): void {
    const activeIds = new Set(summonedUnits.map((summoned) => summoned.summonedUnitId));
    for (const [id, sprite] of this.summonedUnitSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.summonedUnitSprites.delete(id);
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
    this.battlefield.fillStyle(0x020617, 0.9);
    this.battlefield.fillRect(x, y, width, 5);
    this.battlefield.fillStyle(color, 1);
    this.battlefield.fillRect(x, y, width * clampedRatio, 5);
  }

  private worldToScreen(position: Vec2): Vec2 {
    const bounds = this.fieldBounds();
    const { battlefieldMin, battlefieldMax } = this.session.config;
    return {
      x: Phaser.Math.Linear(bounds.x, bounds.x + bounds.width, (position.x - battlefieldMin.x) / (battlefieldMax.x - battlefieldMin.x)),
      y: Phaser.Math.Linear(bounds.y + bounds.height, bounds.y, (position.y - battlefieldMin.y) / (battlefieldMax.y - battlefieldMin.y))
    };
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
    return new Phaser.Geom.Rectangle(34, 56, this.scale.width - 68, this.hud.top - 76);
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
