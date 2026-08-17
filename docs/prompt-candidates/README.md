# Candidate section guides — NOT shipped, NOT verified

Three independently written replacements for `SECTION_GUIDE` in
`prompts/gespraech.ts`, each aimed at the two known defects in the shipped
guide:

1. **Duplication.** Risk factors, past operations and family history currently
   appear in both `Diagnosen` and `Anamnese`, so he has to delete half of one.
2. **Length.** The generated `Anamnese` runs ~850 characters. In his own letters
   it is ~150.

Each author ran the live battery twelve times while iterating, so these are not
untested ideas — but **none was verified end to end**: the Vercel AI Gateway ran
out of credit (HTTP 402) before the adversarial pass and the judging pass could
run. Nothing here has been checked for the failure that matters, which is a
terser Anamnese bought by silently dropping a spoken negation.

**Do not ship one of these without running the attack first:**

```
set -a; . ./.env.local; set +a
GUIDE=docs/prompt-candidates/gespraech-guide-ownership.txt \
  npx tsx eval/gespraech-battery.mts eval/probe-gespraech 3 --print
```

and then reading every output for: dropped negations ("Luftnot? Nein",
"Nie geraucht", "In Ruhe keine Beschwerden"), the Metoprolol 50-not-95 and
Simvastatin-not-Atorvastatin self-corrections, the 2021-not-2022 year, the
wife/patient stairs contradiction, and dosing schemes surviving as N-N-N.

`ownership` is the most promising: it fixes duplication by giving each section
exclusive ownership of categories of fact. Note it deliberately drops height,
weight and patient-quoted lab values from all three sections, on the grounds
that they belong to the examination section this feature does not produce. That
is a real judgement call and worth checking against what HJ expects.
