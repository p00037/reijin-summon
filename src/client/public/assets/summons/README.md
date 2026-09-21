# 召喚獣イラスト

このフォルダーの `raphael.png`、`jackpot.png`、`yggdrasil.png`、`leviathan.png`、`bahamut.png`、`dullahan.png` は、Codex の組み込み `image_gen` ツールを使い、各画像につき1回の独立した生成呼び出しで作成した。API／CLIフォールバック、参照画像、既存作品の画像は使用していない。既存の `summon01.png` は変更していない。

共通方針は、縦長の召喚選択カード向け、統一感のある高品質な手描き風ファンタジーイラスト、文字・数値・ロゴ・透かし・枠・UIなし、とした。

## 生成プロンプト

### `raphael.png`

```text
Use case: stylized-concept
Asset type: vertical summon selection card illustration for a fantasy strategy game
Primary request: Raphael, a majestic healing angel with luminous white wings and elegant white-and-gold armor, descending with a serene protective presence
Scene/backdrop: radiant celestial clouds and soft shafts of sacred light
Subject: one full-body white-and-gold angel, centered and immediately readable at small card size
Style/medium: polished hand-painted high fantasy trading-card illustration, rich painterly detail, dramatic but tasteful, consistent premium game art
Composition/framing: portrait orientation, strong centered silhouette, subject fills most of frame, clear head and wings, safe margins
Lighting/mood: pearlescent white and warm gold light, hopeful and divine
Color palette: ivory, pearl white, pale gold, subtle sky blue
Constraints: original character design; no text, no letters, no numbers, no logos, no watermark, no frame, no border, no UI, no modern objects; single subject
```

### `jackpot.png`

```text
Use case: stylized-concept
Asset type: vertical summon selection card illustration for a fantasy strategy game
Primary request: Jackpot, a mysterious primordial chaos egg with a cracked obsidian shell containing violent molten lava and unstable inner energy
Scene/backdrop: black volcanic basin, drifting embers, heat distortion and smoke
Subject: one enormous levitating molten chaos egg, centered and immediately readable at small card size
Style/medium: polished hand-painted high fantasy trading-card illustration, rich painterly detail, dramatic and ominous, consistent premium game art
Composition/framing: portrait orientation, strong centered oval silhouette, egg fills most of frame, safe margins
Lighting/mood: intense orange-red internal glow against deep shadow, volatile and uncanny
Color palette: obsidian black, molten orange, crimson red, hints of sulfur gold
Materials/textures: cracked stone shell, viscous lava seams, sparks
Constraints: original creature/object design; no faces, no characters, no text, no letters, no numbers, no logos, no watermark, no frame, no border, no UI, no modern objects; single subject
```

### `yggdrasil.png`

```text
Use case: stylized-concept
Asset type: vertical summon selection card illustration for a fantasy strategy game
Primary request: Yggdrasil, an impossibly vast ancient world tree whose luminous roots and colossal branches bind earth and heavens
Scene/backdrop: primordial enchanted forest fading into starry upper skies, mist around gigantic roots
Subject: one monumental world tree, centered and immediately readable at small card size
Style/medium: polished hand-painted high fantasy trading-card illustration, rich painterly detail, mythic scale, consistent premium game art
Composition/framing: portrait orientation, low viewpoint, powerful centered trunk silhouette, crown and roots both visible, safe margins
Lighting/mood: emerald and warm golden bioluminescence, ancient, serene, awe-inspiring
Color palette: deep forest green, moss, amber gold, teal mist
Materials/textures: deeply ridged bark, glowing sap veins, dense foliage, exposed roots
Constraints: no people, no animals, no text, no letters, no numbers, no logos, no watermark, no frame, no border, no UI, no modern objects; single dominant tree
```

### `leviathan.png`

```text
Use case: stylized-concept
Asset type: vertical summon selection card illustration for a fantasy strategy game
Primary request: Leviathan, an immense serpentine deep-sea dragon rising from a midnight ocean trench, armored in ancient blue-black scales with bioluminescent fins
Scene/backdrop: abyssal underwater chasm, swirling currents, bubbles and distant shafts of cold light
Subject: one deep-sea dragon, coiling upward, centered and immediately readable at small card size
Style/medium: polished hand-painted high fantasy trading-card illustration, rich painterly detail, powerful creature design, consistent premium game art
Composition/framing: portrait orientation, dynamic S-curve silhouette, head clearly visible near upper center, body fills frame, safe margins
Lighting/mood: cold blue bioluminescence, crushing depth, ancient menace
Color palette: midnight blue, deep teal, cyan glow, touches of silver
Materials/textures: layered wet scales, translucent fins, coral-like horns
Constraints: original creature design; no ships, no people, no text, no letters, no numbers, no logos, no watermark, no frame, no border, no UI; single dragon, no extra heads
```

### `bahamut.png`

```text
Use case: stylized-concept
Asset type: vertical summon selection card illustration for a fantasy strategy game
Primary request: Bahamut, a regal colossal sky dragon soaring above a sea of clouds, broad wings spread and fiery breath gathering in its jaws
Scene/backdrop: storm-lit high atmosphere above cloud kingdoms, distant lightning and sunrise
Subject: one powerful winged sky dragon, centered and immediately readable at small card size
Style/medium: polished hand-painted high fantasy trading-card illustration, rich painterly detail, majestic creature design, consistent premium game art
Composition/framing: portrait orientation, dynamic frontal three-quarter flight pose, wings create a strong crown-like silhouette, head clearly visible, safe margins
Lighting/mood: brilliant sunlit edges, warm internal fire, sovereign and fearsome
Color palette: charcoal and bronze scales, amber fire, cobalt sky, white clouds
Materials/textures: armored scales, leathery wings, glowing chest and jaws
Constraints: original creature design; no riders, no people, no text, no letters, no numbers, no logos, no watermark, no frame, no border, no UI; single dragon, no extra heads
```

### `dullahan.png`

```text
Use case: stylized-concept
Asset type: vertical summon selection card illustration for a fantasy strategy game
Primary request: Dullahan, a formidable headless knight of the underworld in ancient blackened plate armor, holding a spectral violet greatsword; the empty gorget emits ghostly purple flame
Scene/backdrop: ruined underworld citadel, ash, grave mist and dim violet portals
Subject: one full-body headless knight, centered and immediately readable at small card size
Style/medium: polished hand-painted high fantasy trading-card illustration, rich painterly detail, dark heroic fantasy, consistent premium game art
Composition/framing: portrait orientation, commanding upright battle stance, complete armor silhouette and sword visible, safe margins
Lighting/mood: cold moonless gloom with vivid purple rim light, solemn and terrifying
Color palette: iron black, tarnished silver, deep violet, muted crimson accents
Materials/textures: scarred plate armor, torn cloak, ethereal flame, worn steel
Constraints: clearly headless with empty armored neck opening; original character design; no severed head, no gore, no horse, no other figures, no text, no letters, no numbers, no logos, no watermark, no frame, no border, no UI; single subject
```

## 確認内容

生成後に各画像を目視し、指定した主題、縦長構図、画風の統一、文字・枠・UIが描かれていないことを確認した。プロジェクトへ配置後、6枚すべてが破損なく読み込める 1024×1536 ピクセルのPNGであることも確認した。
