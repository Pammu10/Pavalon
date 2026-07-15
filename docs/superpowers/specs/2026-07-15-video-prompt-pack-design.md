# Pavalon Video Prompt Pack — Design & Prompts

**Date:** 2026-07-15 (rev 2 — card style dropped in favor of cinematic animation)
**Status:** Approved design; prompts ready for Veo generation
**Deliverable:** 12 AI-video generation prompts (3 intro chapters + 9 in-game cut-ins) for Google Veo, as a dark painterly 2D animated fantasy film.

---

## Decisions (approved)

- **Art style:** Dark painterly 2D animated film — hand-painted textures, dramatic torchlight, mature epic-fantasy tone (Castlevania / Arcane-adjacent). Real characters, cinematic camera work.
- **Tool:** Google Veo (8s clips, native audio, reference-image support via Flow).
- **Intro:** 3 chapter clips of 8s each, played back-to-back with existing back/skip controls.
- **Cut-ins:** Vote approved/rejected, quest success/fail, assassin phase, 4 endgame outcomes. Ambient SFX/score only, no speech. Auto-dismiss, tap-to-skip, never block game state.
- **Format:** 16:9, 8s. For mobile portrait variants, rerun at 9:16 and reframe to closer character shots.

## The story: "The Empty Seat"

A three-act cold open with a recurring cast. The player is the knight summoned to fill the last seat at the Round Table.

> On the night Camelot celebrated its greatest victory, a shadow walked among friends — and some knights came home changed. Merlin foresaw the treason to come, but not the faces of the traitors. So a summons rode out across the realm, to a knight the shadow has never touched. The empty seat at the Round Table is yours.

**Note:** New narration lines mean the existing `narration1–3` audio needs re-recording (or use Veo's generated narration). The three beats map 1:1 onto the existing 3-slide structure in `StorybookScene.tsx`.

## The cast (repeat these blocks VERBATIM in every prompt that features the character)

> **[MERLIN]** an ancient wizard with a long silver beard, deep indigo hooded robe embroidered with faint silver constellations, luminous amber eyes, carrying a gnarled blackwood staff crowned with a softly glowing blue crystal

> **[THE KNIGHT]** a young knight with windswept dark hair and storm-grey eyes, wearing a dented silver breastplate over dark leather, a royal-blue cloak clasped with a silver stag brooch

> **[THE HOODED ONE]** a tall figure in a matte-black hooded cloak that seems to drink the light, face hidden in darkness except a pale sharp jaw, gloved hand holding a curved obsidian dagger etched with faintly pulsing red runes

## Shared style block

Paste this at the START of every prompt (already included, marked `[STYLE]`):

> **[STYLE]** Dark painterly 2D animated fantasy film, in the style of a prestige adult animated series. Hand-painted textures, rich chiaroscuro lighting from torches and candlelight, deep shadows, muted medieval palette of slate blue, iron grey, candlelight gold and blood crimson. Expressive character animation, cinematic composition, atmospheric fog and drifting embers. 2D animation with painterly depth — NOT photorealistic, NOT 3D render.

**Consistency tips for Veo/Flow:**
- First generate one high-quality still of each cast member (prompt: the `[STYLE]` block + the character block + "character portrait, three-quarter view"). Approve the stills you like, then attach them as **reference/ingredient images** to every clip featuring that character.
- Keep the `[STYLE]` and character blocks word-for-word identical across prompts; paraphrasing causes drift.
- Generate everything in one Flow project. If a clip drifts photorealistic, append: "flat painted cel shading, visible brush texture."

---

## Intro chapter 1 — "The Victory Feast" (8s, narration)

**Narration:** *"On the night Camelot celebrated its greatest victory… a shadow walked among friends."*

> **[STYLE]** A grand medieval feast hall at night, long tables crowded with laughing knights raising goblets, firelight and drifting embers, a minstrel playing in the corner. The camera glides slowly through the celebration at shoulder height. Unnoticed by everyone, **[THE HOODED ONE]** walks calmly between the tables against the flow of the crowd — and every knight the figure's shadow brushes falls silent for a heartbeat, their smile fading just slightly before the laughter resumes. The camera follows the black cloak until the figure passes behind a pillar and simply is not there anymore. Warm feast ambience — laughter, lute, clinking goblets — slowly swallowed by a cold low drone as the shadow passes. A grave, wise elderly male narrator: "On the night Camelot celebrated its greatest victory… a shadow walked among friends."

## Intro chapter 2 — "Merlin's Vision" (8s, narration)

**Narration:** *"Merlin foresaw the treason to come — but not the faces of the traitors."*

> **[STYLE]** A round stone tower chamber at midnight, shelves of ancient books, moonlight through a tall window. **[MERLIN]** stands over a wide silver basin of water in which a vision glows: the Round Table with knights seated around it. The camera dives slowly INTO the vision: one by one, the shadows cast by three of the seated knights rise up off the floor and stand behind their owners — while the knights themselves keep talking, unaware. Merlin's amber eyes flare; he grips the basin's edge and the vision shatters into ripples before he can see the shadowed knights' faces. His staff's blue crystal gutters like a candle in wind. Audio: deep resonant hum of magic, whispering voices under the surface, a sharp crystalline crack as the vision breaks. A grave, wise elderly male narrator: "Merlin foresaw the treason to come — but not the faces of the traitors."

## Intro chapter 3 — "The Summons" (8s, narration)

**Narration:** *"So a summons rode out, to a knight the shadow has never touched. The empty seat at the Round Table… is yours."*

> **[STYLE]** Dawn mist on a forest road: **[THE KNIGHT]** rides hard toward the distant silhouette of Camelot on its hill, blue cloak streaming, a sealed letter clutched in one gauntlet. Match cut: massive oak doors swing open and the knight strides into the Round Table hall, where seated knights turn their heads in unison to look — some warmly, some with unreadable eyes. At the far side, **[MERLIN]** rises and extends an open hand toward the camera, and the final empty chair at the Round Table slides back on its own, waiting, caught in a shaft of golden morning light. Audio: thundering hooves fading into echoing footsteps in a great hall, a low tense string note blooming into a resolute heroic theme. A grave, wise elderly male narrator: "So a summons rode out, to a knight the shadow has never touched. The empty seat at the Round Table… is yours."

---

## Cut-in 4 — Team approved (5–8s, score/SFX only)

> **[STYLE]** The Round Table hall in warm torchlight. Five knights rise from their seats in unison and strike their fists to their breastplates with a single resounding clang; royal-blue banners unfurl from the rafters above them and torch flames leap brighter. The camera sweeps in a fast low arc around the standing knights and ends on their determined faces. Audio: the unified clang of gauntlets on steel, a swelling horn fanfare, a rumble of approval from the surrounding knights. No speech.

## Cut-in 5 — Team rejected (5–8s, score/SFX only)

> **[STYLE]** The Round Table hall. A herald holds up a parchment listing five knights — and around the table, gauntleted fists come down on the oak one after another like slow drumbeats, each impact making the candle flames shudder. The herald lowers the parchment; the five named knights sink back into their chairs, jaws tight, as the torches dim and long shadows stretch across the table. Camera: slow push-in on the crumpling parchment in the herald's fist. Audio: heavy fists on oak in sequence, a falling discordant string phrase, uneasy murmurs. No speech.

## Cut-in 6 — Quest success (5–8s, score/SFX only)

> **[STYLE]** Night on a windswept cliff-top watchtower. A knight in a blue cloak thrusts a torch into a great iron beacon brazier — it erupts in brilliant BLUE flame that roars up into the dark sky. In the far distance, a second beacon answers with blue fire, then a third, a chain of blue lights running along the mountain ridges toward Camelot. The knights at the beacon raise their swords against the firelight. Camera: rising crane shot from the brazier up into the sky following the sparks. Audio: the whoomph of igniting flame, wind, a triumphant brass-and-choir swell. No speech.

## Cut-in 7 — Quest fail (5–8s, score/SFX only)

> **[STYLE]** The same cliff-top beacon at night, knights gathered around the blue flame — then a black-gloved hand in the foreground crushes a fistful of dark powder into the brazier from behind, unseen. The blue flame chokes, flickers, and turns a venomous BLOOD RED, washing every knight's shocked upturned face in crimson light. They spin around, searching each other's faces — and the camera slowly pulls back to show one cloaked silhouette at the edge of the group, perfectly still. Audio: the flame's tone warping from roar to hiss, a dissonant choir sting, a single low mocking exhale. No speech.

## Cut-in 8 — The assassin stirs (5–8s, score/SFX only)

> **[STYLE]** The Round Table hall, empty, past midnight, one guttering candle. **[THE HOODED ONE]** steps soundlessly out of the darkness between two pillars and walks the length of the table, trailing a gloved fingertip along its edge, the obsidian dagger's red runes pulsing brighter with each step. The figure stops behind one particular chair and slowly raises the dagger. The candle dies. Cut to black. Camera: slow dolly tracking the figure from across the table, ending in stillness. Audio: near-silence, a slow heartbeat, cloth whispering over stone, one metallic ring as the dagger rises. No speech.

## Cut-in 9 — Endgame: Good triumphs (8s, score/SFX only)

> **[STYLE]** Sunrise floods over Camelot. On the castle steps, **[MERLIN]** raises his staff and its blue crystal blazes like a star; ranks of knights below raise their swords with a roar as royal-blue banners cascade down every tower. Doves burst from the battlements through the golden light, and the last wisps of black shadow burn away off the flagstones like morning mist. Camera: sweeping ascent from the cheering knights up past Merlin to the sunlit towers. Audio: full triumphant orchestral fanfare with cathedral choir and pealing bells. No speech.

## Cut-in 10 — Endgame: Evil conquers (8s, score/SFX only)

> **[STYLE]** A storm of black clouds coils over Camelot as crimson lightning cracks the sky. Inside the hall, the Round Table itself splits down the middle with a thunderous crack, chairs toppling. **[THE HOODED ONE]** ascends the dais steps and sits slowly, deliberately, in the king's great chair, red-runed dagger laid flat across the armrests, as every torch in the hall turns blood red at once. Under the hood, two faint red eyes open. Camera: low slow push-in toward the throne. Audio: rolling thunder, a dark rising choir, a final colossal bell strike. No speech.

## Cut-in 11 — Endgame: Merlin slain (assassin wins) (8s, score/SFX only)

> **[STYLE]** Merlin's moonlit tower chamber. **[MERLIN]** stands at the window with his back turned — behind him, **[THE HOODED ONE]** materializes from the shadow of a bookshelf and hurls the obsidian dagger. Merlin turns a half-second too late; there is a flash of red runelight, and we cut to his blackwood staff clattering across the stone floor, its blue crystal flickering out. Outside, every lit window of the tower goes dark, floor by floor, and the moon slides behind clouds. Camera: the throw in slow motion, then the falling staff, then the darkening tower from outside. Audio: a whistling throw, a muffled impact, ringing silence, then a slow cruel exhale in the dark. No speech.

## Cut-in 12 — Endgame: Merlin endures (assassin misses) (8s, score/SFX only)

> **[STYLE]** Merlin's moonlit tower chamber. **[THE HOODED ONE]** hurls the obsidian dagger at the robed figure by the window — and the figure bursts into a swirl of silver starlings, an illusion, the dagger burying itself in the empty window frame. The real **[MERLIN]** steps calmly out of the shadows BEHIND the assassin, amber eyes blazing, and slams his staff onto the stone: a shockwave of golden light floods the chamber, hurling the hooded figure's cloak into rags of dissolving shadow. Camera: whip-pan following the dagger, then a dramatic reverse reveal of Merlin. Audio: the whistle and thunk of the dagger, an explosion of birdwing flutter, one deep resonant staff-strike with a warm orchestral resolve. No speech.

---

## Usage notes

1. **Character stills first:** Before any video, generate approved portrait stills of Merlin, the Knight, and the Hooded One (style block + character block + "character portrait, three-quarter view"). Attach them as reference images in Flow to every clip featuring that character — this is what keeps faces consistent across 12 clips.
2. **Generation:** One Flow project, 16:9, 8s per clip. Expect 2–4 attempts per clip; judge takes on character consistency first, spectacle second.
3. **Audio strategy:** Intro clips include narration lines for Veo's generated voice. If the voice drifts between the three chapters, drop the narrator sentence, generate silent, and record the three lines with one TTS/voice actor to replace `narration1–3` assets. Cut-ins are score/SFX only by design.
4. **Trimming:** Cut-ins 4–8 read best at ~5s; trim in-app or with ffmpeg rather than asking Veo for shorter clips.
5. **Content note:** Clip 11 implies the assassination off-screen (falling staff, darkening windows) — no on-screen violence, keeps the game's all-ages rating.
6. **Integration (separate task):** `StorybookScene.tsx` swaps `<Image>` for `<video>` per chapter, keeping skip/back. Cut-ins: a new overlay component playing over a dimmed backdrop, auto-dismiss on `ended`, tap-to-skip, never gating game-state transitions. Flutter mobile mirrors with its video player.
