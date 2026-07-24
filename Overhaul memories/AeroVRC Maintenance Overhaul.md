# AeroVRC Maintenance Page — Overhaul Memories

A complete record of the maintenance-page overhaul project (built 2026-07-22 → 2026-07-23).
Goal: turn the plain "under construction" splash into a premium, immersive, interactive 3D experience
for aerovrc.com — on-brand for a VRChat companion app, and safe to run on everything from a 4090 to a laptop.

---

## 1. Where everything lives

- **The page:** `VRChat Watchdog\Maintenance\index.html` — one self-contained file (~81 KB), no build step.
  - It started life as `maintenance.html`; it was **promoted to `index.html`** (the folder's default entry) so
    previewing/deploying the folder serves the current page. There is now a single source of truth — edit `index.html`.
  - The **old v1 glass-card** splash that used to be `index.html` is backed up at
    `docs\superpowers\maintenance-snapshots\maintenance-v1-glasscard-index.html`.
- **`Maintenance\` folder** = the staging copy of the site (full page set: home/features/download/etc.). Work happens here.
- **`Website\` folder** = the LIVE site (its own git repo → GitHub Pages → aerovrc.com). Only put things here that
  are meant to go live. (This memories doc lives here because you asked — see the note at the bottom.)
- **Spec:** `docs\superpowers\specs\2026-07-22-maintenance-page-v3-phased-design.md` (the phased design + every gate revision).
- **Rollback snapshots:** `docs\superpowers\maintenance-snapshots\`
  - `maintenance-v1-glasscard-index.html` — the original glass-card splash
  - `maintenance-v2.2-pre-phase1.html` — the first 3D rebuild, before the phased feature work
  - `maintenance-v3-postphase1.html`, `-postphase2.html`, `-postphase3.html` — end of each phase

**To take the site down:** copy `Maintenance\index.html` over `Website\index.html`, commit, push.
Note: `Website\index.html` is currently the **welcome splash**, not a maintenance page — so that swap replaces the
welcome page with the maintenance page (the point of going down), and you'd restore the welcome splash afterward.

---

## 2. Tech stack

- **three.js 0.166.1** + addons (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`) via a pinned CDN
  **import map** — no bundler, works on GitHub Pages.
- **GSAP 3.12.5** (CDN) for all timeline/easing/micro-interaction work.
- **Chakra Petch** (Google Fonts) for the display headline; body text stays on **Segoe UI** to match the app.
- Everything else is inline. Fully self-contained single file. Reduced-motion and no-WebGL both degrade gracefully.

Why not React Three Fiber or Spline: R3F would bolt a build pipeline onto a zero-build Pages repo; Spline is a
heavy third-party iframe with availability risk and a watermark. A hand-written three.js scene keeps it self-contained
and fully controllable.

---

## 3. What's in the scene (the 3D)

- **The star ("Aero Core"):** a molten, marbled sphere — procedural noise gives it navy seas, aero-blue cloud cells,
  icy highlights, and faint cyan filaments, lit by a key light from the **upper-left** to match the highlight on the
  2D orb logo (so the 3D star and the brand mark read as the same object). The core keeps full shader quality at every
  performance tier — it's the focal point.
- **Atmosphere:** additive back-face glow around the core, with a `uBoost` uniform that flares are/eclipses/supernova drive.
- **Wireframe shell:** slow-rotating icosahedron "engineering" cage; vanishes and re-forms with the star during the supernova.
- **The dust ring (one unified ring, three particle layers):**
  - fine dust band (~3400 motes at ultra) — this *is* the orbit line; there is no solid ring mesh
  - coarse sparkle grains (~900) with a slight shear over the fine band
  - a head-plume "trail" (~620) of dense dust chasing an orbiting **cyan tracer** sphere + glow
- **Starfield:** twinkling shader points (~2600 at ultra), depth-spread.
- **Nebula:** an fbm-noise backdrop plane (octave count scales per tier).
- **Solar flares:** dense **particle plumes** (~520 motes) erupting off the camera-facing limb every ~12–28 s, each
  with a brief core brightness swell. (These replaced an earlier "tube" version that read as bad lines.)
- **Debris belt:** ~70 instanced, faceted, individually-tinted low-poly rocks riding high across the scene.
- **Comets:** occasional glowing streaks across deep space.
- Plus exponential fog, an edge vignette, animated film grain, blurred aurora ribbons, and a cursor-following glow.

---

## 4. Interactions & motion

- **Boot + entrance:** a boot curtain (pulsing orb, "AEROVRC", filling bar) irises open into a camera **arrival dolly**,
  then the headline reveals line-by-line out of clip masks. All page text does a **decrypt/scramble-in** on entrance.
- **Camera:** damped pointer-parallax rig + slow autonomous drift + gentle breathing, so it's alive with no input.
- **Custom cursor** (desktop pointers only): fast dot + lagging ring (expands cyan over links) + a 7-dot **spark trail**.
- **Magnetic buttons:** pull toward the cursor and spring back elastically; a sheen sweeps across on hover; the Discord
  button has a rotating conic highlight tracing its border.
- **Click pings:** clicking empty space fires a soft expanding ring sprite. Rapid clicks **stack** (pooled — each click
  gets its own ring) instead of resetting one another.
- **Supernova easter egg:** 5 clicks **on the star** within 3 s → implode → detonate (~900-particle burst, screen flash,
  double shockwave) → **~10 seconds of genuine empty void** where the star, ring, orbit, and glow all smoothly fade to
  nothing → then a smooth elastic **re-form**. Re-entry is guarded (`novaBusy`).
- **Ambient sound toggle** (bottom-right): **off by default**, choice persisted in localStorage, hidden under
  reduced-motion. Fully synthesized in WebAudio — a detuned oscillator pad through an LFO-swept lowpass, an airy noise
  bed, chimes on clicks/flares, and a deep double-boom for the supernova. **No audio files** (nothing to license).
  Audio suspends with the background freeze and resumes on focus.
- **Letter-repel** (headline): characters shy ≤6 px away from the cursor and spring back. *Prototype — still in, pending
  a final "does it help or feel gimmicky" verdict.*

---

## 5. Final copy

- **H1:** "AeroVRC is Down for **Maintenance**" / "See you **Soon**" (both bold words are the gradient).
- **Lead (4 short paragraphs):**
  1. The website and its downloads have been temporarily taken down.
  2. We are working behind the scenes to bring you something **better**.
  3. We aren't going anywhere.
  4. Looking for live updates, or have a question? Feel free to join our Discord or send me a message!
- **Buttons:** Join the Discord (placeholder `href="#"` — needs the real invite) · Email Support (`mailto:ajordan120906@gmail.com`).
- **Removed:** the Site/Downloads/Discord status ledger, and the "Already running AeroVRC?" footer note.
- `user-select: none` on the body (no text highlighting — it's an immersive splash).

---

## 6. Performance system (the part that makes it safe to ship)

The scene is **fill-rate bound** — its cost scales with pixels × passes (DPR and bloom), not with the fancy math or
particle counts. So it must adapt to the visitor's GPU.

- **Adaptive quality tiers:** `ultra / high / balanced / lite`. Each tier scales DPR, bloom (full-res / half-res / off),
  particle counts, nebula octaves, and aurora richness (blur → soft → flat).
  - **Auto-detected at load** from the GPU name via WebGL `WEBGL_debug_renderer_info`
    (4090/3080+ → ultra, 20/30-series & 16-series → high, 1080/older → balanced, Intel/mobile/software → lite;
    unknown → high; phones capped at balanced).
  - A **runtime fps watchdog** steps the tier DOWN (DPR first, then bloom) if frames sag — so a mis-detected weak GPU
    self-corrects within a couple seconds.
- **60 fps render cap** (a 144/240 Hz monitor would otherwise draw 3–4× more frames than the scene needs).
- **30 fps idle throttle** after 8 s without pointer activity.
- **Blur/hidden freeze — the single biggest win:** when the tab loses focus OR is hidden, the render loop stops AND a
  `body.frozen` class pauses **every CSS animation**. A fully-static page recomposites nothing.
  - **Measured on the RTX 4090: ~32% GPU focused (ultra, amplified), 0.00% GPU when unfocused.**
  - Because unfocused is free, the focused-tab visuals were deliberately cranked back up ("add all the fancy shit back").

### Dev tooling baked into the file (all inert without the query string)
- `?perf` → HUD showing tier · ms/frame · draw calls · tris/points · bloom · DPR, plus `window.__frames` and
  `window.__dbg` (`isNovaBusy()`, `starScreen()`, `orbitState()`).
- Ablation flags: `nobloom nostars noring nonebula nodebris nofx noevents`.
- Force a tier: `?tier=ultra|high|balanced|lite`.

---

## 7. Things we built, then removed (and why)

- **Cursor gravity on the starfield** — built, tuned twice, then removed by request. The custom cursor + spark trail
  carry the pointer presence instead.
- **Moons + solar eclipse** — built (ambient moons; then a *staged* large-moon transit because the orbital version was
  invisible). Removed entirely by request.
- **Click-and-hold warp / hyperspace + gravitational-lens stretch** — built (starfield rush, FOV widen, bloom swell,
  star/ring smeared like light around a mass), then **removed entirely** by request. Input is now just click → ping.

Each of these is recoverable from git history / the phase snapshots if ever wanted again.

---

## 8. Hard-won lessons & gotchas (read before touching the render code)

1. **NaN "black boxes" near the orb** = a shader `pow(base, e)` where float error made `base` slightly negative →
   NaN → one NaN pixel smears through the UnrealBloom mip chain into a black rectangle for a frame.
   **Fix / rule:** guard every GLSL `pow` with `pow(max(base, 0.0), e)` when bloom is in the chain.
2. **CSS `mix-blend-mode` and `filter: blur()` over an animating WebGL canvas cost ~7% GPU** (they force full-viewport
   render surfaces recomposited every frame) — far more than any 3D subsystem. They're fine to keep because the freeze
   zeroes their cost when unwatched; just never assume they're cheap while the page animates.
3. **The freeze must pause BOTH the render loop AND CSS animations.** Stopping only the WebGL loop still left the
   compositor at ~14% because grain/aurora/border-spin kept animating. `animation-play-state: paused` on everything =
   0.00%.
4. **Never GSAP-tween a property that the render loop reassigns every frame.** The supernova's cyan "leftover spot" was
   the tracer glow: its per-frame "dim behind the orb" write clobbered the fade tween every frame.
   **Fix / rule:** route such fades through a `state.*` factor the tick multiplies in (we added `state.orbitFade`).
5. **DPR + bloom are the big performance levers**, not particle counts — because it's fill-rate bound.
6. **GSAP fast-forwards when the tab backgrounds** under headless/automation, so verifying the supernova "void" needs
   `gsap.globalTimeline.pause()` (or a rAF keep-alive) before screenshotting; numeric state readouts via a keep-alive
   loop are reliable.
7. **Browser-pane screenshots time out on this machine.** Verify with headless Chrome over the DevTools Protocol, or
   the chrome-devtools MCP (real GPU-accelerated Chrome).

---

## 9. How it was verified

- Local preview: `python -m http.server` in the `Maintenance\` folder (the folder's `.claude\launch.json` names it "site").
- **chrome-devtools MCP** drove a real, GPU-accelerated Chrome for screenshots, console checks, and synthetic input
  (dispatching pointer events to test pings/supernova).
- **Real GPU measurement** via Windows perf counters:
  `Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage'`, summed over the Chrome process family, per config.
- Ablation-driven attribution using the `?perf` flags (turn subsystems off one at a time, watch the counter).

---

## 10. Open items / what's left

- **Discord widget + invite link.** The "Join the Discord" button is still `href="#"` (with `target="_blank"`, so
  clicking it just opens a stray blank tab). Needs: a real `discord.gg/...` **server invite** (not a `/channels/@me/...`
  DM link), the server's **widget enabled** in Server Settings, and optionally the live member widget iframe.
- **Beta-test judgments** (need real hardware / your ears):
  - sound feel (pad volume is one number),
  - the supernova on a real GPU,
  - confirm the GPU numbers on your monitor,
  - the letter-repel verdict (keep or cut).

---

## 11. One-line status

A fully self-contained, GPU-adaptive, 3D maintenance splash with a boot sequence, decrypt text, a molten star with a
unified dust ring, solar flares, a debris belt, stacking click-pings, a 10-second supernova easter egg, synthesized
ambient sound, and a background freeze that drops it to 0% GPU when unwatched — waiting only on a Discord invite link.
