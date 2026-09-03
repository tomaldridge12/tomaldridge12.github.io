# Landing screen plan

## Core idea

Build a portfolio that feels like a live instrument panel for intelligent systems: a calm, precise editorial layer wrapped around a beautiful procedural visualisation.

The page should immediately answer three questions:

- **Who is Tom?** A Senior Engineer working at the boundary of custom silicon, computer vision, and customer-facing software.
- **What does he actually do?** Turns specialised compute into deployable systems — from kernels and pipelines to APIs and production applications.
- **Why is he interesting?** He moves comfortably between low-level performance, applied research, and independent systems-building.

## Hero copy direction

Primary line:

> The layer between the chip and the problem.

Supporting line:

> Tom Aldridge is a Senior Engineer building real-time video intelligence on custom AI hardware — from accelerator kernels and model pipelines to the APIs that make them useful.

Small status line:

> Leeds, UK / Blaize / video analytics / building at the edge

Primary action: **Explore the work**

Secondary action: **Get in touch**

Do not lead with a long biography. Let the hero establish the point of view, then let the rest of the page prove it.

## Visual direction — “signal atlas”

Use a near-black graphite canvas with a very restrained technical grid. The hero visual is a procedural WebGL2 scene, not a stock image:

- A field of luminous points represents incoming video observations.
- Thin paths connect observations into tracks and events.
- A bright accelerator core compresses the field into a clean, directional flow.
- The path subtly changes as the pointer moves, giving the impression of a system responding to input.
- A few labels sit in the scene like instrument readouts: `FRAME`, `TRACK`, `EVENT`, `GSP`, `0-COPY`, `REAL-TIME`.
- Fine amber accents reference signal and attention; cyan/green accents reference edge compute and live telemetry.

The visual language should be technical but not cyberpunk: generous negative space, low bloom, clear typography, and just enough motion to feel alive.

## Landing layout

### 1. Persistent navigation

Minimal top bar with `TOM ALDRIDGE` on the left and four anchors on the right: `Work`, `Research`, `Beyond`, `Contact`. Add a small “available for interesting systems” or “currently at Blaize” indicator only if it is accurate at launch.

### 2. Hero / first viewport

Two-column composition on desktop:

- Left: eyebrow, large statement, short supporting copy, actions.
- Right: full-height interactive WebGL visual.

On mobile, stack the visual below the copy while keeping the first action visible without excessive scrolling.

The hero should occupy roughly 88–94vh, with a small “scroll to inspect the system” cue at the bottom.

### 3. Proof strip

Immediately below the hero, use four concise proof points rather than generic skill badges:

- `Custom silicon` — OpenCL / OpenVX / quantisation
- `Real-time vision` — tracking / events / zero-copy pipelines
- `Product surface` — Python APIs / integrations / delivery
- `Research` — neuroimaging / tractography / HPC

Each point can animate a single line or node in the hero visual as it enters the viewport.

### 4. “What I build” section

Three large editorial cards matching the three-part role:

- **Make it possible** — framework and platform engineering.
- **Make it fast enough** — custom silicon and performance engineering.
- **Make it real** — solutions, integrations, and customer delivery.

Each card should have a short paragraph, a compact technical stack, and one concrete outcome. This is the clearest section for the Blaize story.

### 5. Selected work / evidence

Start with three case-study treatments:

- Video analytics framework and reusable component library.
- Optimised VLM Usage hackathon entry with Milestone / Project Hafnia.
- MSc research project on TBI, Alzheimer’s disease, and white-matter connectivity.

Use diagrams and interactive media where available. Keep proprietary details abstracted; show architecture, constraints, and outcomes rather than confidential implementation.

### 6. Beyond the day job

A warmer, less corporate section for Football Manager reverse engineering, local LLM hosting, chronicleandledger.com, home networking/automation, and hardware builds. The visual can shift from grid to a looser constellation to signal curiosity and independent making.

### 7. Closing contact panel

End with a direct line such as “Have a hard systems problem?” and one clear contact route. Include GitHub, LinkedIn, and email only once they are confirmed.

## Rendering and interaction architecture

- Use semantic HTML and CSS for all content and layout.
- Use a small vanilla WebGL2 / GLSL renderer for the procedural hero field; keep the scene deterministic and asset-free so it deploys cleanly on GitHub Pages.
- Use CSS `@property`, layered gradients, `mix-blend-mode`, `backdrop-filter`, and scroll-linked transitions where browser support is strong.
- Prefer a lightweight custom renderer over a large 3D engine for the hero. This keeps the bundle small and makes the visual feel authored rather than template-like.
- Add a graceful Canvas 2D or static-gradient fallback when WebGL2 is unavailable.
- Use `IntersectionObserver` for section reveals and lazy work media.
- Honour `prefers-reduced-motion`; disable pointer turbulence, particles, and scroll choreography when requested.
- Keep every important message, action, and link in the DOM so the visual layer remains enhancement rather than a dependency.

## Quality bar

- First meaningful paint should be fast on GitHub Pages.
- No loading screen before the name and headline appear.
- Responsive at narrow mobile widths, large desktop monitors, and high-DPI displays.
- WCAG-conscious contrast, keyboard-visible focus, reduced-motion support, and readable text over the shader.
- No fake live metrics, unverifiable claims, or proprietary screenshots.
- The page should feel premium because of composition, typography, motion restraint, and specificity — not because every element is animated.

## Suggested build sequence

1. Create the semantic page and typography system.
2. Build the hero visual as a deterministic WebGL2 shader with fallback.
3. Add the proof strip and three-part engineering story.
4. Add case-study panels and the research / independent-building sections.
5. Tune responsive behaviour, accessibility, motion preferences, and GitHub Pages deployment.
6. Test with a production build and a static preview at mobile and desktop breakpoints.
