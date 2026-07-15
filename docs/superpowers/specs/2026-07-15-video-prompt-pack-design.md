# Pavalon Video Prompt Pack — Design & Prompts

**Date:** 2026-07-15 (rev 3 — spectacle pass: dragons, armies, epic spells)
**Status:** Approved design; prompts ready for Veo generation
**Deliverable:** 12 AI-video generation prompts (3 intro chapters + 9 in-game cut-ins) for Google Veo, as a dark painterly 2D animated fantasy epic.

---

## Decisions (approved)

- **Art style:** Dark painterly 2D animated film — hand-painted textures, dramatic lighting, epic-fantasy spectacle (Castlevania / Arcane-adjacent). Recurring characters, army-scale battles, dragons, showpiece magic.
- **Tool:** Google Veo (8s clips, native audio, reference-image support via Flow).
- **Intro:** 3 chapter clips of 8s each, played back-to-back with existing back/skip controls.
- **Cut-ins:** Vote approved/rejected, quest success/fail, assassin phase, 4 endgame outcomes. Score/SFX only, no speech. Auto-dismiss, tap-to-skip, never block game state.
- **Format:** 16:9, 8s. For mobile portrait variants, rerun at 9:16 and reframe to closer character/dragon shots.

## The story: "The Empty Seat"

Same skeleton as rev 2 — a shadow hides among the victors, Merlin can't see the traitors' faces, the player fills the last seat — but told at war scale:

> The war against the Shadow was won with dragonfire and Merlin's last great spell. But the Shadow did not die on the battlefield — it hid inside the victors, and some knights came home changed. Merlin climbed the stars and saw treason coming to the Round Table, every traitor's face hidden from him. So the last silver dragon was sent to fetch one knight the Shadow has never touched. The empty seat at the Round Table is yours.

**Note:** New narration lines mean the existing `narration1–3` audio needs re-recording (or use Veo's generated narration). The three beats map 1:1 onto the existing 3-slide structure in `StorybookScene.tsx`.

## The cast (repeat these blocks VERBATIM in every prompt that features them)

> **[MERLIN]** an ancient wizard with a long silver beard, deep indigo hooded robe embroidered with constellations that actually glow and drift like living stars, luminous amber eyes, carrying a gnarled blackwood staff crowned with a blazing blue crystal

> **[THE KNIGHT]** a young knight with windswept dark hair and storm-grey eyes, wearing a dented silver breastplate over dark leather, a royal-blue cloak clasped with a silver stag brooch

> **[THE HOODED ONE]** a tall figure in a matte-black hooded cloak that unravels at the edges into living smoke, face hidden in darkness except a pale sharp jaw, gloved hand holding a curved obsidian dagger etched with pulsing red runes

> **[ARGENT]** a colossal silver dragon with mirror-bright scales that reflect the sky, sweeping ice-blue wing membranes veined with light, intelligent pale-gold eyes, and breath of radiant blue starfire

> **[THE WYRM]** a monstrous black dragon seemingly built from cooling lava — obsidian scales split by glowing red-ember cracks, tattered wings of solid smoke, six burning crimson eyes, and breath of black fire edged in red

## Shared style block

Paste this at the START of every prompt (already included, marked `[STYLE]`):

> **[STYLE]** Dark painterly 2D animated fantasy epic, in the style of a prestige adult animated series. Hand-painted textures, dramatic god-ray lighting, deep shadows, rich palette of slate blue, iron grey, molten gold and blood crimson. Sweeping cinematic camera moves, army-scale composition, atmospheric fog, drifting embers and magical particles. 2D animation with painterly depth — NOT photorealistic, NOT 3D render.

**Consistency tips for Veo/Flow:**
- First generate approved portrait stills of all five cast members (style block + character block + "character portrait, three-quarter view" — for the dragons, "full-body portrait in flight"). Attach them as **reference/ingredient images** to every clip featuring that character.
- Keep the `[STYLE]` and character blocks word-for-word identical across prompts; paraphrasing causes drift.
- Generate everything in one Flow project. If a clip drifts photorealistic, append: "flat painted cel shading, visible brush texture."

---

## Intro chapter 1 — "The Last Battle" (8s, narration)

**Narration:** *"The war was won with dragonfire and one last great spell… but the Shadow hid inside the victors."*

> **[STYLE]** A cataclysmic night battle on a burning plain: ten thousand knights in silver armor crash against a tide of faceless shadow-soldiers under a sky torn open by war. **[ARGENT]** dives through the clouds and carpets the shadow army in a tidal wave of radiant blue starfire while **[MERLIN]** stands on a hilltop, robes whipping, and slams his staff down — a colossal rune-circle of golden light, a mile wide, ignites across the entire battlefield and vaporizes the shadow horde into black mist. But as the mist dies, thin ribbons of living shadow snake silently INTO the armor seams of cheering knights in the foreground. Audio: roaring armies, dragon scream, a cathedral-sized magical detonation, then eerie quiet. A grave, wise elderly male narrator: "The war was won with dragonfire and one last great spell… but the Shadow hid inside the victors."

## Intro chapter 2 — "Merlin Climbs the Stars" (8s, narration)

**Narration:** *"Merlin climbed the stars and saw treason at the Round Table — every face hidden."*

> **[STYLE]** **[MERLIN]** stands atop his tower at midnight and walks UP an unfurling staircase made of constellations, stars rearranging themselves into steps beneath his feet, his glowing robe streaming galaxies. At the summit the night sky becomes an immense living vision: Camelot burning under the wings of **[THE WYRM]**, and around a floating spectral Round Table, three seated knights whose armor cracks open to leak black smoke — but where each face should be, the vision boils into a smear of shadow. Merlin reaches toward the faces and the whole starfield shatters like glass around him, stars raining down. Audio: vast celestial choir, crystalline chimes warping into a dragon's distant roar, a glass-shatter cascade. A grave, wise elderly male narrator: "Merlin climbed the stars and saw treason at the Round Table — every face hidden."

## Intro chapter 3 — "The Last Dragon Comes For You" (8s, narration)

**Narration:** *"So the last dragon was sent for you. The empty seat at the Round Table… is yours."*

> **[STYLE]** Dawn over an endless cloud sea: **[ARGENT]** rockets between towering sunlit thunderheads with **[THE KNIGHT]** standing fearlessly on the dragon's back, blue cloak cracking like a banner, as they dive through a waterfall of golden light toward Camelot — a city of impossible spires rising out of the clouds on a mountain crowned by rainbows of morning mist. The dragon banks low over the ramparts as thousands of soldiers look up and raise their spears in salute, then the great hall's roof irises open in interlocking stone petals and the knight leaps off, cloak flaring, landing in a shaft of light before the Round Table — where the final empty chair slides back on its own, waiting. Audio: rushing wind, a triumphant dragon cry, massed horns swelling into a heroic theme. A grave, wise elderly male narrator: "So the last dragon was sent for you. The empty seat at the Round Table… is yours."

---

## Cut-in 4 — Team approved (5–8s, score/SFX only)

> **[STYLE]** The Round Table hall. Five chosen knights slam their swords point-down into the stone floor in unison — and five pillars of brilliant blue light erupt through the roof into the night sky, visible for miles above Camelot. Inside the light, each knight's armor ignites with glowing golden sigils, and a colossal spectral silver stag formed of aurora light gallops a full circle around the hall above their heads, showering sparks, before bursting into a dome of falling star-motes. Camera: fast low orbit around the five knights, then whip up the light pillars into the sky. Audio: five sword-strikes like bells, a rising choir, a thunderous triumphant horn blast. No speech.

## Cut-in 5 — Team rejected (5–8s, score/SFX only)

> **[STYLE]** The Round Table hall. Five knights stand as glowing golden sigils begin to form over their armor — then every sigil fractures at once like struck glass and detonates into red sparks. A shockwave of crimson lightning arcs across the ceiling, every torch in the hall blows out sideways, and the great table itself groans and rotates a quarter-turn on its own, grinding sparks from the stone floor, as the five knights are shoved back into their seats by invisible force. Camera: crash-zoom on the first shattering sigil, then a wide shot of the darkened, lightning-lit hall. Audio: crystalline shatter, a falling discordant brass sting, deep stone grinding. No speech.

## Cut-in 6 — Quest success (5–8s, score/SFX only)

> **[STYLE]** Night assault on a mountain fortress of black iron: knights surge up the slopes behind a wall of tower shields while **[ARGENT]** streaks overhead and drowns the fortress gates in a hurricane of radiant blue starfire. The gates vaporize; a wave of golden spell-light rolls out across the battlefield from the breach and every shadow-soldier it touches disintegrates into drifting motes of light that rise into the sky like inverted snowfall. On a ridge, a knight thrusts a sword into the air and the whole army roars. Camera: sweeping aerial following the dragon's dive, ending on the sword raised against the light. Audio: dragon roar, an ocean of battle cries, a triumphant orchestral wall of brass and choir. No speech.

## Cut-in 7 — Quest fail (5–8s, score/SFX only)

> **[STYLE]** The same night battlefield mid-victory — then one armored knight in the army's heart quietly clenches a fist wreathed in black flame. The golden spell-light sweeping the field corrupts in a heartbeat: gold curdles to blood red, and the disintegrating shadow-soldiers REVERSE, reassembling from ash into a towering tidal wave of shadow that crashes over the silver army's banners. Above, storm clouds coil into the vast burning silhouette of **[THE WYRM]** opening six crimson eyes, and its black-fire breath splits the battlefield in two. Camera: push through the chaos to the traitor's burning fist, then crane up into the Wyrm's eyes. Audio: the victory theme warping downward into dissonance, a wall of screams, an earth-cracking dragon bellow. No speech.

## Cut-in 8 — The assassin stirs (5–8s, score/SFX only)

> **[STYLE]** The Round Table hall at dead midnight. Every torch flame simultaneously turns black. **[THE HOODED ONE]** does not walk in — the figure assembles out of the room's own shadows, pooling up from the floor like ink poured in reverse, and glides the length of the table as every empty chair's shadow twists to face it. The obsidian dagger rises, and its red runes flare so bright they paint the entire vaulted ceiling with a web of burning glyphs; in the darkness under the hood, a constellation of tiny red eyes blinks open. Hard cut to black. Camera: slow dolly down the table into the hood. Audio: all sound draining away to a heartbeat, whispering in reverse, one sub-bass pulse on the cut. No speech.

## Cut-in 9 — Endgame: Good triumphs (8s, score/SFX only)

> **[STYLE]** Dawn breaks over Camelot like a detonation of light. **[MERLIN]** rises off the castle's highest tower into the sky, robes and beard streaming upward, and spreads his arms: the sunrise itself bends into a colossal phoenix of golden fire that spirals around the city, while **[ARGENT]** flies loops through its flaming wings trumpeting in triumph. Below, ten thousand knights raise their swords and every blade catches fire with harmless golden light; the last shreds of shadow peel off the streets and burn away like paper. Blue banners the size of ships unfurl down every tower. Camera: vast ascending spiral from the cheering army up around the phoenix to Merlin haloed by the sun. Audio: full orchestral-and-choir apotheosis, pealing bells, dragon song. No speech.

## Cut-in 10 — Endgame: Evil conquers (8s, score/SFX only)

> **[STYLE]** The sky above Camelot is a rotating black hurricane lit by crimson lightning. **[THE WYRM]** coils its entire lava-cracked body around the tallest tower like a serpent and SQUEEZES — the spire crumbles as its black-fire breath pours down the streets in rivers. In the great hall, the Round Table splits down the middle with a cannon-crack, and **[THE HOODED ONE]** ascends a staircase of frozen screaming shadows to sit upon a throne of a thousand fused, melted swords, as every torch in the kingdom turns blood red at once. Under the hood, a constellation of red eyes opens. Camera: fall from the storm down the tower, through the breaking roof, ending in a slow push-in on the throne. Audio: apocalyptic drums, a dark choir at full roar, one colossal bell strike. No speech.

## Cut-in 11 — Endgame: Merlin slain (assassin wins) (8s, score/SFX only)

> **[STYLE]** **[MERLIN]** stands alone on his tower's peak at night, holding a dome of golden light over all of Camelot — a shield of interlocking rune-rings covering the whole sky. Behind him, **[THE HOODED ONE]** condenses out of his own moon-shadow and hurls the obsidian dagger in slow motion, red runes screaming. Merlin turns a half-second too late. The dagger's flash whites out the frame — and we see only the aftermath: the sky-dome of golden runes cracking apart like an eggshell and raining down as dying embers over the dark city, while his blackwood staff tumbles end over end down the tower, its blue crystal guttering out. The moon slides behind the Wyrm's winged silhouette. Camera: slow-motion throw, whiteout, then the falling staff against the collapsing sky-shield. Audio: a whistling throw, a heart-stop of pure silence, then a mournful choir as a million embers fall. No speech.

## Cut-in 12 — Endgame: Merlin endures (assassin misses) (8s, score/SFX only)

> **[STYLE]** **[THE HOODED ONE]** hurls the obsidian dagger across Merlin's tower chamber at the robed figure by the window — and the figure detonates into a supernova of silver starlings, an illusion, the dagger freezing mid-air inside the flock. The real **[MERLIN]** steps out of a fold in space itself behind the assassin, amber eyes blazing like twin suns, and slams his staff down: a spiral galaxy of golden spell-work blooms across the entire floor, chains of pure starlight erupt from its rings and lash the Hooded One into the air, and the black cloak burns away layer by layer into shreds of screaming shadow that the spell-galaxy inhales like a whirlpool. The frozen dagger drops and shatters. Camera: whip-pan with the dagger, reverse reveal of Merlin, then overhead shot of the galaxy-spell swallowing the shadow. Audio: birdwing thunder, one seismic staff-strike, an ecstatic orchestral surge with choir, a glass-shatter button. No speech.

---

## Usage notes

1. **Character stills first:** Generate approved reference stills of all five cast members — Merlin, the Knight, the Hooded One, Argent, and the Wyrm — before any video, and attach them as reference images in Flow to every clip featuring that character. This is what keeps 12 clips looking like one film.
2. **Generation:** One Flow project, 16:9, 8s per clip. Expect 3–5 attempts on the heavy-spectacle clips (1, 7, 9, 10, 12) — judge takes on character consistency first, spectacle second. If a battle scene comes out sparse, append: "epic scale, thousands of soldiers, extreme wide shot."
3. **Audio strategy:** Intro clips include narration lines for Veo's generated voice. If the voice drifts between the three chapters, drop the narrator sentence, generate silent, and record the three lines with one TTS/voice actor to replace `narration1–3` assets. Cut-ins are score/SFX only by design.
4. **Trimming:** Cut-ins 4–8 read best at ~5s; trim in-app or with ffmpeg rather than asking Veo for shorter clips.
5. **Content note:** Violence stays fantasy-abstract — shadow-soldiers disintegrate into mist/light, and Merlin's death is a whiteout plus falling staff, never an on-screen wound. Keeps the all-ages rating despite the war scale.
6. **Integration (separate task):** `StorybookScene.tsx` swaps `<Image>` for `<video>` per chapter, keeping skip/back. Cut-ins: a new overlay component playing over a dimmed backdrop, auto-dismiss on `ended`, tap-to-skip, never gating game-state transitions. Flutter mobile mirrors with its video player.
