# Candidate section guides — TESTED AND REJECTED (2026-08-23)

Three replacements for `SECTION_GUIDE` in `prompts/gespraech.ts`, written to fix
two defects in the shipped guide: a fact appearing in both `Diagnosen` and
`Anamnese`, and an `Anamnese` roughly twice the length of his real ones.

**All three were rejected. The shipped guide stays.** Keeping this here so the
work is not repeated blindly — the idea is reasonable and the result is not.

## What the numbers said

Measured on `openai/gpt-5.6-terra`, three fixtures, matched sample sizes.

| guide | denied concepts surviving | duplicated concepts per letter | Anamnese |
|---|---|---|---|
| **shipped** | **51/51** | 1.3 | ~630 ch |
| exemplar | 31/34 | 0 | ~290 ch |
| ownership | 29/34 | 0 | ~300 ch |
| composed (ownership, no length cap, + negation checklist) | 47/51 | 0 | ~400 ch |

Every version that shortens the `Anamnese` loses spoken negations, and the ones
it loses are the ones a cardiologist cares about: *Druck auf der Brust verneint*,
*keine Myalgien unter dem Statin*, *keine Orthopnoe*, *nie geraucht*. The
composed version — ownership's allocation with the hard 250-character cap
removed and an explicit "a negation is a finding, never cut it" rule appended —
got closer but still lost 4 in 51.

The trade is bad in both directions of severity. A duplicated line is visible
and takes two seconds to delete. A missing negative is **invisible**: the next
doctor reads it as a question never asked.

## What the adversarial pass found, that the numbers could not

Two independent agents attacked `ownership` and `exemplar` over 9 runs each.
Both returned *reject*, on grounds worse than the negation counts:

- **Drug invention.** G3 corrects a misheard "Atorvastatin" into "Simvastatin".
  Both candidates printed **both statins as concurrent therapy** in 2 of 9 runs —
  a drug the patient does not take, in a medication list.
- **Fabricated attributions.** `(nach Angabe des Patienten)` / `(nach Angabe der
  Ehefrau)` appended to medication lines that were never attributed to anyone.
- **Lay-to-technical substitution**, which CORE_RULES rule 5 forbids: "mal kurz
  weg gewesen? Nein, nie" rendered as "Synkopen werden verneint".
- **An inferred year**: `Z.n. Infarkt 3/25` in 8 of 9 runs, where G1 says only
  "im März". The shipped guide writes "im März" and stops.
- `ownership` also **exceeded its own hard character cap** in every run, so the
  budget was never doing the work it was written to do.

Neither candidate invented a *cardiac diagnosis* on the first-visit fixture,
which was the risk I expected. The real damage was in the medication list.

## The battery had a blind spot, now fixed

Every one of those double-statin runs printed **`clean`**. The medication checks
validated the *shape* of the lines that were present and said nothing about
which drugs should be present at all — so a vanished drug and an invented one
were both invisible.

`eval/gespraech-battery.mts` now pins, per fixture, which preparations must
appear and which must not (`MED_MISSING` / `MED_FABRICATED`). Verified: it
flags the exemplar run that drops a drug, and the shipped guide passes 9/9.

## If you pick this up again

The duplication is real but small — 1.3 concepts per letter, mostly the smoking
history and one diagnosis echoed into the history. Any future attempt has to
clear these bars, in this order:

```
set -a; . ./.env.local; set +a
GUIDE=<candidate> npx tsx eval/gespraech-battery.mts eval/probe-gespraech 3
```

1. `51/51` denied concepts survive — anything less is lossy, and lossy loses.
2. No `MED_MISSING`, no `MED_FABRICATED`.
3. The G3 self-corrections still land: Metoprolol 50 not 95, Simvastatin not
   Atorvastatin, 2021 not 2022, and the wife/patient contradiction carried with
   a marker rather than silently resolved.

The most promising direction left is one nobody tried: fix the duplication by
changing **only the Diagnosen side** — tell it what belongs there — and leave the
`Anamnese` instruction completely untouched. Every attempt so far edited both,
and the Anamnese edit is what did the damage.
