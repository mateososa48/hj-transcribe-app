# Motion lab QA results

| Gate | Result | Evidence |
| --- | --- | --- |
| Ten concepts | Pass | Accessibility tree exposed concepts 01–10 with exact German names. |
| Pointer controls | Pass | Computer Use activated replay, pause/resume, 1×→2× speed, and reduced motion; pressed states updated correctly. |
| Keyboard controls | Pass | Tab reached all four controls in order; Enter/Space activated each; focus ring is visible in the Computer Use capture. |
| Desktop geometry | Pass | `round-2/desktop-1440.png`; no clipped header, controls, or card pair. |
| Short-window geometry | Pass | `round-0/short-1024x700.png`; controls remain above the concept field and no horizontal crop is present. |
| Exact narrow geometry | Pass | Chrome responsive mode at 390×844; `round-2/mobile-devtools-390.png` and `mobile-devtools-390-scrolled.png` show the header, one-column controls, and concept cards without collision or horizontal crop. |
| Reduced motion | Pass after repair | Computer Use found and verified the corrected fallback: movement animations stop while each concept retains its authored positioning transform. |
| Runtime | Pass | Chrome console contained only React's development-mode DevTools suggestion; no error or warning from the lab. |
| Build/type safety | Pass | `npm run typecheck`, `npm run build`, and the dedicated model tests pass. Existing Vite bundle-size and Anthropic browser-externalization warnings remain unrelated to the standalone lab. |
| Network policy | Pass with scope note | The lab itself makes no API call. Vite HMR and the browser's own update/translation services are environment traffic, not lab code. |

## Taste critique

- The oversized editorial heading establishes the lab before the glass surfaces appear, so glass reads as material rather than the entire idea.
- Repeated card chrome creates comparison consistency; the ten internal silhouettes remain structurally distinct: morph, typesetting, handoff, scan, rail, assembly, weave, proofing, pulse, and margin progression.
- The strongest first-pass product candidates are Signal → Satz, Klinischer Setzer, and Prozesslinie. This is a self-evaluation, not a blinded independent preference test, so no production winner is claimed.

