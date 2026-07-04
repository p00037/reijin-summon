# Local COM Battle MVP Design

## Goal

Build the first playable browser MVP for the project by migrating the Unity MVP's local player-versus-CPU battle loop to TypeScript and Phaser. The MVP focuses on a local COM match. Online play and Colyseus synchronization remain outside this milestone, aside from preserving the existing starter server.

## Source Material

- `docs/deep-research-report.md`
- `docs/phaser-migration-spec.md`
- Unity reference project at `C:\10.Github\TheEternalWheel`

The implementation will use original names, abstract visuals, and local rule references only. It will not copy original arcade assets, ROMs, audio, character art, logos, or protected presentation material.

## Scope

The playable MVP includes:

- Title/start flow for `The Eternal Wheel MVP`.
- A 960x540 Phaser battle scene with a two-sided 2D battlefield.
- Player and CPU leaders.
- Three normal units per side: melee, speed, and ranged.
- Player unit selection and click-to-move commands.
- Elemental building from a selected player unit.
- Summoning when enough completed elementals exist and cooldown permits.
- CPU planning on a simple one-second cadence.
- Normal unit combat, direct leader damage, respawn, leader healing area, elemental damage/removal, summoned unit movement, contact damage, health decay, and match result.
- HUD for player HP, CPU HP, time, selected unit, summon status, cooldown, result, build, summon, and retry.

The MVP does not include:

- Online matchmaking or synchronized multiplayer.
- Persistent progression, card collection, account state, or scenario unlocks.
- Production art, animation polish, sound, or original IP assets.
- Server-authoritative simulation.

## Architecture

The client will own the MVP. Game rules will be pure TypeScript modules under `src/client/src/game`, and Phaser will consume those modules for input and rendering.

Core modules:

- `core/types.ts`: ids, commands, state interfaces, and battle event shapes.
- `core/battleConfig.ts`: default tuning values from the migration spec and Unity reference.
- `core/battleState.ts`: default battle state factory and lookup helpers.
- `core/vector.ts`: distance, move-towards, clamp, and world coordinate helpers.

Rule modules:

- `rules/areaCalculator.ts`: convex hull and polygon area for summon area.
- `rules/unitSystem.ts`: movement, contact slow, attacks, leader healing, defeats, and respawns.
- `rules/elementalSystem.ts`: build start, build progress, elemental completion, and removal.
- `rules/summonSystem.ts`: summon eligibility, cooldowns, summoned unit creation, movement, collision damage, and decay.
- `rules/gameSession.ts`: command application, fixed order ticking, and result calculation.

AI module:

- `ai/cpuPlanner.ts`: issue CPU commands every second. It summons first if possible, otherwise builds elementals until capped, otherwise sends active units toward the player leader.

Scene/UI modules:

- `scenes/TitleScene.ts`: title screen and start button.
- `scenes/BattleScene.ts`: owns `GameSession`, maps Phaser pointer input to battle commands, runs CPU planning, ticks the game, and renders abstract pieces.
- `ui/battleHud.ts`: lightweight DOM or Phaser text/buttons for HUD actions.

The existing server workspace remains buildable but is not part of the gameplay path for this MVP.

## Data Flow

1. `TitleScene` starts `BattleScene`.
2. `BattleScene` creates a `GameSession` using the default config.
3. Pointer input creates `BattleCommand` values:
   - select a player unit by clicking near it;
   - click the battlefield to move the selected unit;
   - press build to start elemental building with the selected unit;
   - press summon to execute player summon.
4. Every frame, `BattleScene` ticks the session with `deltaSeconds`.
5. Every one second, `BattleScene` asks `CpuPlanner` for CPU commands and applies them.
6. `BattleScene` reads state and redraws leaders, units, elementals, summoned units, HP bars, area lines, and attack events.
7. When result changes from `InProgress`, input commands stop mutating battle state and the HUD shows the result with retry.

## Visual Direction

The MVP uses readable abstract sprites, not finished art. The battlefield should feel like a tactical board:

- Dark neutral background with a lighter rectangular battlefield.
- Player side and CPU side differentiated by position and accent color.
- Leaders as larger symbols.
- Normal units as small type-coded pieces.
- Elementals as smaller amber points connected by an area outline.
- Summoned units as larger high-contrast pieces.
- HP bars above pieces, scaled consistently.

No decorative landing page is needed. The first useful screen is the title/start flow, followed by the battle.

## Error Handling And Edge Cases

- Commands after match end are ignored.
- Move targets are clamped to battlefield bounds.
- Only active, alive units can move or build.
- Building is canceled by movement, defeat, or elemental destruction rules where applicable.
- Summon commands fail silently when requirements are unmet, but HUD status should explain current blockers.
- Destroyed elementals are removed during the tick.
- Defeated normal units respawn after the configured delay.
- If time expires, remaining leader HP determines the result; equal HP is a draw.

## Testing

Pure rule tests will cover the highest-risk behavior before production implementation:

- Area calculation for simple triangles and interior points.
- Default state and config values.
- Unit movement and battlefield clamping.
- Elemental build completion and build cancellation.
- Summon eligibility, cooldown, HP calculation, and summoned unit contact damage.
- CPU planner command priority.
- Game session result calculation.

Phaser UI will be verified with typecheck/build and a local manual play pass. Automated scene tests are not required for this MVP because the rule layer holds the critical behavior.

## Acceptance Criteria

- `npm run build` succeeds from the repository root.
- Browser MVP starts from the client and enters the battle scene.
- Player can select each friendly unit, move it, build elementals, summon, and retry.
- CPU builds/summons/attacks without manual input.
- HP, cooldown, timer, selected unit, blockers, and result are visible.
- Player win, CPU win, and draw are representable by the game session.
- Rule modules have focused tests for the critical behaviors listed above.
