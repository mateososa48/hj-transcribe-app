# Motion lab repair ledger

## Round 1 — retained

**Evidence:** the initial desktop and Computer Use captures.

1. Narrow control labels had enough intrinsic width to compete inside two equal columns.
2. Prozesslinie animated `border-color` and `box-shadow` for its node glow, creating avoidable paint work.

**Repair:** below 440 px, controls become one column with left-aligned 46 px targets; node emphasis moved to opacity and transform on the inner dot.

**Regression gates:** desktop control hierarchy, exact 390 px geometry, pause/reduced selectors, motion performance.

**Decision:** retained. Desktop is visually unchanged; the exact 390 px pass is composed and the node animation stays compositor-safe.

## Round 2 — retained

**Evidence:** Computer Use reduced-motion preview.

The shared reduced-motion rule set `transform: none`, unintentionally erasing transforms used for static positioning as well as movement.

**Repair:** disable animation and retain authored base transforms. The whole canvas receives a gentle opacity indication so processing remains perceptible without travel.

**Regression gates:** all ten static compositions, pause behavior, system `prefers-reduced-motion`, exact narrow geometry.

**Decision:** retained. The corrected preview preserves each composition and the normal-motion path remains unchanged.

## Acceptance limitation

The compiler and visual inspector were the same agent because independent agent delegation was not authorized for this task. Hard gates and evidence captures were completed, but blinded A/B and B/A taste acceptance was not. The lab is therefore an evaluated prototype, not a proven winning treatment.

