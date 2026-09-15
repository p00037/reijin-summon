# 召喚士の肖像

`summoner-illustrated.png` は戦闘画面の召喚士に使用する透過PNGです。
青緑のフード、三日月型の金の冠、発光する瞳と胸の宝石で、カードアートと画面の配色に合わせています。
2026-09-15に組み込みの `image_gen` で、写実的な原案をイラスト調に編集しました。
輪郭線と整理した陰影で、ゲーム内の小さな表示でも表情と装具を読み取りやすくしています。
元の `summoner.png` と写実的な原案 `summoner-ocean-archmage.png` は保持しています。

ゲーム内では56×56の論理サイズで表示し、金の細枠と陣営色の装飾を重ねます。
上下端で肖像が切れないよう表示位置を盤面内に調整します。戦闘・回復・復活の判定座標は変更しません。

## イラスト版の編集プロンプト

Use case: style-transfer. Edit the supplied summoner portrait. User request: the current image is too realistic; make it distinctly more illustrated while retaining a cool, dignified fantasy-game character. Preserve the recognizable adult male summoner, front-facing centered head-and-shoulders composition, deep teal hood, gold crescent diadem, turquoise glowing eyes, gold-trimmed shoulder armor, and turquoise chest gem. Redraw the ENTIRE portrait as polished hand-drawn Japanese fantasy RPG character illustration: confident clean dark linework, elegant stylized facial proportions, simplified flowing hair shapes, smooth cel-painted skin, two or three broad shadow values with soft selective painted transitions, graphic gold highlights and clearly designed cloth folds. Simplify the beard into a subtle neatly drawn dark shape. Remove photographic pores, skin wrinkles, individual beard hairs, realistic cloth grain and metallic microtexture. More drawn and expressive, slightly softer and more approachable but still mature and heroic. Not chibi, not a mascot, not flat vector clipart, not photorealistic, not 3D rendered. Retain deep ocean teal and warm gold palette with a brighter readable face for a 56px game token. Preserve the full uncropped silhouette and transparent padding on all sides. Square image with genuine transparent alpha outside the character, no background, no checkerboard pattern, no frame, no text. Deliver only one final transparent PNG.

## 原案の生成プロンプト

Use case: stylized-concept. Asset type: production-ready transparent PNG portrait token for a refined dark ocean-fantasy real-time card battle game, displayed at only 64 x 64 pixels. Primary request: create ONE exceptionally cool, regal adult arcane summoner bust, head and broad shoulders, centered frontal near-symmetrical composition. A mysterious human archmage with a deep midnight-teal hood, an elegant antique-gold crescent diadem integrated into the hood, a shadowed dignified face with two luminous turquoise eyes, sculpted dark armor, broad clean gold-trimmed shoulder silhouette, a single bright aquamarine jewel at the chest. Painterly semi-realistic premium fantasy trading-card art, sophisticated and serious, never chibi or cartoon. Strong readable silhouette, restrained details, high contrast on face and main gold shapes, teal rim light. Composition: the ENTIRE head, hood and shoulders fully visible within a roughly circular footprint centered in a square canvas, occupying 82 percent of the image width and height with generous transparent padding on ALL sides. Bust ends cleanly around upper chest; no hands, no staff, no floating accessories. Genuine transparent alpha background outside the character. NO opaque background, NO floor, NO checkerboard pattern, NO border, NO circular frame, NO text, NO watermark, NO surrounding large glow cloud. The silhouette must work against a dark blue-green battlefield. Generate square 1024x1024 PNG with actual transparent background.
