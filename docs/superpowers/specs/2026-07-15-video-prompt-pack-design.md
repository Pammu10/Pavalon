# Pavalon Video Prompt Pack — Design & Prompts

**Date:** 2026-07-15
**Status:** Approved design; prompts ready for Veo generation
**Deliverable:** 12 AI-video generation prompts (3 intro chapters + 9 in-game cut-ins) for Google Veo, in Pavalon's vintage playing-card art style.

---

## Decisions (approved)

- **Art style:** Animated card style — the existing vintage playing-card / medieval woodcut look, brought to life. The card frame stays static; only the illustration inside animates.
- **Tool:** Google Veo (8s clips, native audio, image-to-video / reference-image support via Flow).
- **Intro:** 3 chapter clips of 8s each, played back-to-back with existing back/skip controls.
- **Cut-ins:** Vote approved/rejected, quest success/fail, assassin phase, 4 endgame outcomes. Ambient SFX only, no speech. Auto-dismiss, tap-to-skip, never block game state.
- **Format:** 16:9. For mobile portrait variants, rerun the same prompt at 9:16 and change the framing line to "a single tall tarot-proportioned card fills the frame."

## The story: "The Deck of Avalon"

The onboarding story is rewritten so the card aesthetic is part of the lore, not just decoration:

> Camelot's fate is bound to an enchanted deck. Every soul in the realm is a card. But a shadow has crept into the deck — some cards have turned two-faced, loyal in the light, traitor beneath. Merlin, keeper of the deck, deals one final hand to save the kingdom. The last card dealt... is you.

**Note:** This replaces the old narration lines, so `narration1–3` audio will need re-recording (or use Veo's generated narration). The three story beats map 1:1 onto the existing 3-slide player structure in `StorybookScene.tsx`.

---

## Shared style block

Paste this at the START of every prompt below (it is written into each prompt already, marked `[STYLE]`):

> **[STYLE]** Vintage playing-card illustration in the style of hand-inked medieval woodcut engraving. Aged parchment texture, ornate scrollwork border in gold, crimson and black with heraldic corner pips. Muted heraldic palette: deep crimson, royal blue, antique gold, ivory parchment, ink black. The ornate card border remains perfectly static at the edges of frame for the entire clip; only the illustrated scene inside the card animates, as if the ink itself has come alive. Subtle candlelight flicker across the parchment. 2D animated engraving, NOT photorealistic.

**Consistency tips for Veo/Flow:**
- Use the existing `client/public/story/slide1–3.jpeg` as **reference/ingredient images** so Veo locks onto the exact border style and linework.
- Generate all clips in one Flow project/session, reusing the same reference images, to minimize style drift.
- If a clip drifts photorealistic, append: "flat 2D illustration, visible engraving hatching lines, no depth of field."

---

## Intro chapter 1 — "A Kingdom of Cards" (8s, narration)

**Narration line:** *"In Avalon, every soul is a card in Merlin's deck… and a shadow has entered the deck."*

> **[STYLE]** Slow overhead camera drifts across a massive candlelit oak table where an enchanted deck of cards lies spread out like a map of a medieval kingdom — one card shows a castle, another a knight on horseback, another a village, their inked illustrations gently moving within each card: banners ripple, chimney smoke curls, tiny inked birds cross a parchment sky. Then a spreading pool of black ink seeps across the table from the edge of frame, and where its shadow passes over a card, the card's colors drain to grey and its inked figure's posture turns subtly crooked. Candle flames bend as if in wind. Deep, ominous fantasy ambience; a low choral drone; the wet creep of ink. A wise elderly male narrator says: "In Avalon, every soul is a card in Merlin's deck… and a shadow has entered the deck."

## Intro chapter 2 — "The Two-Faced Cards" (8s, narration)

**Narration line:** *"Merlin read the deck and saw the truth: some cards now wear two faces."*

> **[STYLE]** Inside a single ornate playing card: an inked Merlin with a long white beard and star-embroidered robe, drawn in medieval woodcut style, holds a glowing card up to candlelight. As the candle flame passes behind the card he holds, a hidden second face bleeds through the parchment — beneath the noble knight's smiling inked face, a second sneering face with hollow eyes emerges in red ink, overlapping like a watermark. Merlin's inked eyes widen; the candle gutters. Camera slowly pushes in on the two-faced card. Tense strings; a single low bell toll; whispering voices just below hearing. A wise elderly male narrator says: "Merlin read the deck and saw the truth: some cards now wear two faces."

## Intro chapter 3 — "The Final Hand" (8s, narration)

**Narration line:** *"So Merlin deals one final hand to save the realm. The last card dealt… is you."*

> **[STYLE]** An aged, weathered hand in a star-embroidered sleeve deals ornate cards one by one onto a candlelit round table, each card landing with a soft thump and its inked figure — a knight, a lady, a squire — coming alive and turning to face the viewer. Then the final card slides across the table directly toward the camera, face-down, its gilded back filling the frame. It flips: the card's face is a polished silver mirror set in the parchment frame, reflecting warm candlelight directly at the viewer. Gold light flares from the card's border. Rising heroic orchestral swell that resolves on a bright, resolute chord; the crisp snap of dealt cards. A wise elderly male narrator says: "So Merlin deals one final hand to save the realm. The last card dealt… is you."

---

## Cut-in 4 — Team approved (5–8s, SFX only)

> **[STYLE]** Five ornate playing cards stand upright in an arc on a candlelit table like a raised fellowship. A royal wax seal stamps down in the center of frame onto a parchment scroll beneath them — the seal glows warm gold and sends a ripple of golden light through each card, whose inked knights raise their swords in unison and whose tiny banners lift. Candle flames flare brighter. Camera: single slow push-in. Audio: a firm ceremonial stamp, a swell of horns, a murmur of approval from an unseen court. No speech.

## Cut-in 5 — Team rejected (5–8s, SFX only)

> **[STYLE]** A parchment scroll bearing five inked card portraits lies on the candlelit table. A gauntleted inked hand sweeps in and tears the scroll cleanly down the middle; the two halves curl and the card portraits on them slump, their inked figures lowering their heads as their colors dim to grey. A candle at frame edge is snuffed, its smoke curling into a faint question-mark shape. Camera: static, slight slow zoom out. Audio: harsh parchment tear, a discordant low string sting, disapproving murmurs. No speech.

## Cut-in 6 — Quest success (5–8s, SFX only)

> **[STYLE]** A single ornate quest card lies at the center of the dark table. It ignites in brilliant BLUE flame — the fire burns across the card without consuming it, and the inked scene inside transforms: a grey ruined tower redrawn in gold ink, stroke by stroke, into a triumphant standing spire with a blue pennant. Sparks of gold ink drift upward like embers. Surrounding face-down cards glow faintly blue in sympathy. Camera: slow push-in on the burning card. Audio: a whoosh of flame, a triumphant brass fanfare, distant cheering. No speech.

## Cut-in 7 — Quest fail (5–8s, SFX only)

> **[STYLE]** A single ornate quest card lies at the center of the dark table. Black-and-red flame crawls across it from one corner; where the fire passes, the card's noble inked scene corrupts — the knight's face is redrawn in jagged red strokes into a horned, sneering visage, and the gold border tarnishes to black. A drop of red ink falls onto the table and spreads like blood. The candles around the table dim to embers. Camera: slow push-in, slight tilt. Audio: crackling fire, a dissonant choir sting, a low mocking laugh echoing. No speech.

## Cut-in 8 — The assassin stirs (5–8s, SFX only)

> **[STYLE]** Total darkness except one candle. A row of face-down ornate cards on the table. An inked dagger — drawn in the same woodcut style, dripping red ink — slides slowly along the row, its point hovering over each card's gilded back in turn, as if choosing. The candle flame shrinks. On the final card it pauses, and the card trembles. Hard cut to black on the last frame. Camera: low tracking shot along the table following the dagger's point. Audio: near-silence, a slow heartbeat, the scrape of metal on wood, one sharp inhale at the end. No speech.

## Cut-in 9 — Endgame: Good triumphs (8s, SFX only)

> **[STYLE]** The whole deck rises from the table and assembles itself midair into a great card-mosaic of Camelot at dawn — each card one tile of the castle. Golden sunlight floods the parchment sky, blue pennants ripple on every inked tower, and the two-faced cards are pushed out of the mosaic, fluttering down to the table face-down, defeated and grey. A gold laurel wreath draws itself in ink around the whole scene. Camera: slow rising crane shot. Audio: full triumphant orchestral fanfare with choir, bells ringing. No speech.

## Cut-in 10 — Endgame: Evil conquers (8s, SFX only)

> **[STYLE]** Black ink floods across the great candlelit table like a tide, swallowing card after card; each card it touches flips to reveal a sneering red second face. The card-mosaic of Camelot collapses, cards fluttering down into the ink. The last candle is reflected in the spreading ink, then drowns. A crooked crown, drawn in dripping red ink, draws itself over the darkness. Camera: slow overhead descent toward the black table. Audio: rumbling low drone, dark choir rising to a cruel crescendo, a final deep bell. No speech.

## Cut-in 11 — Endgame: Merlin slain (assassin wins) (8s, SFX only)

> **[STYLE]** A single ornate card stands upright in candlelight: the inked Merlin with star-embroidered robe. An inked dagger flies in from off-frame and pierces the card dead center. The card's colors drain instantly to grey, cracks of red ink spider outward from the wound, and the card tips over in slow motion, falling flat with a heavy thud that snuffs every candle at once. In the darkness, two hollow red eyes open. Camera: static, locked on the card. Audio: a whistling throw, a deep impact, total silence, then a slow cruel exhale. No speech.

## Cut-in 12 — Endgame: Merlin endures (assassin misses) (8s, SFX only)

> **[STYLE]** In near-darkness an inked dagger strikes a single upright ornate card — and shatters like glass into drops of black ink. The card is a decoy: its inked figure dissolves, and behind it the true Merlin card rises glowing gold, the old wizard's inked eyes calm and knowing. Warm golden light cascades outward, relighting every candle on the table in a wave and turning all the surrounding cards face-up, their inked knights bowing. Camera: push-in through the shattering dagger to Merlin's card. Audio: a sharp glass-shatter, a beat of silence, then a warm swelling orchestral resolve with soft choir. No speech.

---

## Usage notes

1. **Generation:** In Flow/Gemini, create one project; add `slide1.jpeg`–`slide3.jpeg` as reference images; paste each prompt (including its `[STYLE]` opening) as a separate generation. 16:9, 8s.
2. **Selection:** Expect 2–4 attempts per clip; keep the take with the most stable border and least photorealism.
3. **Audio strategy:** Intro clips use Veo's generated narration (lines are in the prompts). If the generated voice is inconsistent across the three chapters, generate silent (drop the narrator sentence) and record the three narration lines with one TTS/voice actor, replacing `narration1–3` assets.
4. **Trimming:** Cut-ins 4–8 read best at ~5s; trim in-app or with ffmpeg rather than asking Veo for shorter clips.
5. **Integration (separate task):** `StorybookScene.tsx` swaps `<Image>` for `<video>` per chapter, keeping skip/back. Cut-ins: a new overlay component that plays over a dimmed backdrop, auto-dismisses on `ended`, tap-to-skip, and never gates game-state transitions. Mobile client mirrors this with Flutter's video player.
