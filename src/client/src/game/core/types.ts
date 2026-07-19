export type TeamId = "Player" | "Cpu";
export type UnitType = "Melee" | "Speed" | "Ranged";
export type PlayerUnitId =
  | "PlayerMelee"
  | "PlayerSpeed"
  | "PlayerRanged";
export type CpuUnitId =
  | "CpuMelee"
  | "CpuSpeed"
  | "CpuRanged";
export type UnitId = PlayerUnitId | CpuUnitId;
export type LeaderId = "Player" | "Cpu";
export type ElementalId =
  | "Elemental1"
  | "Elemental2"
  | "Elemental3"
  | "Elemental4"
  | "Elemental5"
  | "Elemental6"
  | "Elemental7"
  | "Elemental8"
  | "Elemental9"
  | "Elemental10"
  | "Elemental11"
  | "Elemental12";
export type CommandType = "MoveUnit" | "BeginElementalBuild" | "Summon";
export type MatchResult = "InProgress" | "PlayerWin" | "CpuWin" | "Draw";
export type UnitMode = "Active" | "BuildingElemental" | "Defeated";

export type Vec2 = {
  x: number;
  y: number;
};

export type UnitStats = {
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackIntervalSeconds: number;
};

export type BattleConfig = {
  matchDurationSeconds: number;
  leaderMaxHp: number;
  elementalBuildSeconds: number;
  elementalPlacementRadius: number;
  elementalContactRadius: number;
  maxElementalsPerTeam: number;
  summonGaugeSecondsAtMaxElementals: number;
  summonedUnitBaseHp: number;
  summonedUnitHpPerFieldPercent: number;
  summonedUnitAttackDamage: number;
  summonedUnitLeaderAttackDamage: number;
  summonedUnitAttackIntervalSeconds: number;
  summonedUnitHealthDecayPerSecond: number;
  summonedUnitMoveSpeed: number;
  unitRespawnSeconds: number;
  elementalMaxHp: number;
  directLeaderDamageMultiplier: number;
  playerLeaderPosition: Vec2;
  cpuLeaderPosition: Vec2;
  battlefieldMin: Vec2;
  battlefieldMax: Vec2;
  contactSlowRadius: number;
  contactSlowMultiplier: number;
  leaderVisualSize: number;
  leaderHealingRadius: number;
  statsByType: Record<UnitType, UnitStats>;
};

export type BattleCommand =
  | { commandType: "MoveUnit"; team: "Player"; unitId: PlayerUnitId; targetPosition: Vec2 }
  | { commandType: "MoveUnit"; team: "Cpu"; unitId: CpuUnitId; targetPosition: Vec2 }
  | { commandType: "BeginElementalBuild"; team: "Player"; unitId: PlayerUnitId }
  | { commandType: "BeginElementalBuild"; team: "Cpu"; unitId: CpuUnitId }
  | { commandType: "Summon"; team: TeamId };

export type LeaderState = {
  leaderId: LeaderId;
  team: TeamId;
  position: Vec2;
  maxHp: number;
  currentHp: number;
};

export type UnitState = {
  unitId: UnitId;
  team: TeamId;
  unitType: UnitType;
  position: Vec2;
  spawnPosition: Vec2;
  destination: Vec2;
  stats: UnitStats;
  currentHp: number;
  mode: UnitMode;
  buildTimerSeconds: number;
  respawnTimerSeconds: number;
  attackTimerSeconds: number;
  pendingElementalId: ElementalId | null;
};

export type ElementalState = {
  elementalId: ElementalId;
  team: TeamId;
  position: Vec2;
  maxHp: number;
  currentHp: number;
  isComplete: boolean;
};

export type SummonedUnitState = {
  summonedUnitId: number;
  team: TeamId;
  position: Vec2;
  destination: Vec2;
  maxHp: number;
  currentHp: number;
  attackDamage: number;
  leaderAttackDamage: number;
  attackIntervalSeconds: number;
  attackTimerSeconds: number;
  moveSpeed: number;
  healthDecayPerSecond: number;
};

export type AttackEvent = {
  attackerUnitId: UnitId;
  origin: Vec2;
  targetPosition: Vec2;
};

export type BattleState = {
  remainingSeconds: number;
  playerSummonGauge: number;
  cpuSummonGauge: number;
  result: MatchResult;
  leaders: LeaderState[];
  units: UnitState[];
  elementals: ElementalState[];
  summonedUnits: SummonedUnitState[];
  recentAttackEvents: AttackEvent[];
  nextSummonedUnitId: number;
};
