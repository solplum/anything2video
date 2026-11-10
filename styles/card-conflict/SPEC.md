# 卡牌对抗 / Card Conflict

Status: original local prototype. A manually composed deterministic kit, **not** a `config.style` runtime skin. No claim of publication, upstream parity, final film approval, or factual measurements.

## What makes this a production method

A card is an action with a cost and an effect. The opponent is a scheduled threat. The target is a visible object that can survive or be damaged. Work backwards from that causal relationship before designing a card face.

1. Name the goal, visible target and opposing force.
2. Define initial resource, integrity, card cost, protection and optional reward. These examples are invented game rules, not empirical statistics.
3. Define the choice and its counterfactual. Both must begin from the same state.
4. Schedule `decision → payment/effect → opposition contact → resolution` as separate events. Hover/highlight cannot spend resources. Impact cannot occur before contact.
5. Build original art for the action, opponent and target. Artwork must visibly change with the state; a changing number or caption alone is insufficient.
6. Give each event an anticipation, contact and settling window. The illustrative object remains on screen throughout the conflict.
7. Test random-access rendering, reverse seeks, repeated choices, delayed selection, missing text and altered rule values.
8. Compare the successful and failed outcomes. If hiding all text makes them indistinguishable, revise the action rather than adding another label.

## Rules and time

The engine is a pure function of a validated scenario, chosen card, frame, fps and selection time. No random generator, animation timers, accumulated mutation or frame-history dependence exists in the renderer. The UI clock only selects a frame.

Default 30fps timing, all **zero-based**:

- 0–119: deal/read; a decision has not been made.
- 120: choose one card. The resource and target are unchanged.
- 120–179: the chosen card lifts and moves into its play area.
- 180: commit. Pay the cost once and grant protection/reward.
- 180–269: protection appears and the cost is readable.
- 270–299: the threat approaches; no target damage yet.
- 300: impact. `blocked = min(guard, threat)`; `damage = threat − blocked`; `integrity = max(0, maxIntegrity − damage)`.
- 300–359: contact ripple/recoil and shield depletion.
- 360–479: hold the changed world and result.

`selectSec` accepts 3–5s and shifts all downstream events together. fps accepts 1–120 and contact times are rounded to whole frames. Beyond-end requests return the end state. Unsupported portrait and invalid rules fail explicitly.

## Two scenario variants and the counterfactual

- **最后一盏灯**: 2 supply, 3 integrity, storm 3. 加固 costs 2, protects 3 and preserves the lit lighthouse. 赶航 costs 1, recovers 1 cargo and leaves no protection: the same storm extinguishes and cracks the lighthouse.
- **种子守夜**: 3 supply, 2 integrity, frost 2. 暖房 costs 2, protects 2 and preserves the upright seedling. 抢收 costs 1, recovers 1 seed parcel and leaves the seedling wilted under frost. Both choices are playable; the delivered second-variant MP4 uses 暖房.

The two scenarios share rules and layout, but have different costs, thresholds, illustrations, target geometry and consequences. Their result and rule captions are derived from the rules/state, so changing numbers cannot silently retain a contradictory prewritten outcome.

## Art and motion grammar

Deep felt, fine inlaid rings, cream stock, reserved gold and one opposing accent. Original SVG artwork: anchor/boat versus storm and greenhouse/basket versus frost. No upstream card face, poster, screenshot, soundtrack, mascot or font file was copied.

Cards have named action roles, readable costs and deliberate movement into a play area. The target lives between them. A protection outline is tied to the committed effect, a threat travels toward that target, and contact causes the physical result. This is distinct from a generic product-card entrance or low-resolution arcade skin.

## Reuse contract

Edit `scenarios.mjs` for plain data; use `engine.mjs` for rules/events; use `scene.mjs` for original visual treatment. Supported art keys are intentionally explicit. A new topic requiring new imagery must add original art instead of pretending that a new title makes the old lighthouse suitable.

`renderDuel({frame, scenario, choice, fps, selectSec, width, height, showCaptions})` is shared by the standalone HTML, `CardConflictFrame` React adapter and offline SVG render. The engine also exports `duelState`, `resolveDuel`, `duelEvents` and `duelTiming`.

All text is escaped. `showCaptions:false` removes **every SVG text element**, including card names and numbers, while keeping physical target art and state unchanged. It is a comprehension audit, not a second story.

## Evidence and limits

The offline MP4s use system librsvg/cairo + ffmpeg, 1280×720, 30fps, 480 frames, silent H.264. They do not by themselves prove a native Remotion render. Consult the separate delivery verification and any independent browser/render report. Desktop and mobile browser interaction must be distinguished from mock-DOM tests. No sound, narration, portrait re-layout or final-film quality approval is claimed.

## Research provenance

Reference distinction came from the existing reviewed research map and these documents:

- https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/cards/STYLE.md
- https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/rpg/STYLE.md
- https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/pixel-rpg/STYLE.md

Prior research inspected card/RPG stills, not continuous card-demo playback. It identified rules, decisions and causal consequences as the reusable idea. This implementation is independent original source/art under the containing project's MIT license. Upstream demo artwork and media licenses are not treated as transferable production-asset permission.
