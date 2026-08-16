# Provider spike — browser-direct viability

SPEC constraint 1 disqualifies any provider that cannot be called directly from
the browser, because there is no backend and never will be. This documents what
was actually tested rather than what the vendor docs claim.

**Method.** CORS preflight against each endpoint:

```bash
curl -i -X OPTIONS "<endpoint>" \
  -H "Origin: https://arztbrief.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type,x-api-key"
```

A preflight needs no API key, so this is cheap and repeatable. **Date: 2026-08-15.**
Re-run before shipping — CORS policy is a vendor decision that can change without notice.

## Results

| Provider | Endpoint | `Access-Control-Allow-Origin` | Verdict |
|---|---|---|---|
| AssemblyAI (EU) | `api.eu.assemblyai.com/v2/{transcript,upload}` | `*` | ✅ viable, EU |
| Mistral Voxtral | `api.mistral.ai/v1/audio/transcriptions` | `*` | ✅ viable, EU |
| ElevenLabs Scribe | `api.elevenlabs.io/v1/speech-to-text` | `*` (headers `*`) | ✅ viable, non-EU |
| OpenAI Whisper | `api.openai.com/v1/audio/transcriptions` | echoes origin | ✅ viable, non-EU |
| Anthropic | `api.anthropic.com/v1/messages` | `*` — **conditionally** | ✅ viable, non-EU |
| Corti | `api.eu.corti.app/v2/transcribe` | `*` | ⚠️ data plane OK |
| Corti (auth) | `auth.corti.app/.../openid-connect/token` | **no preflight response** | ❌ disqualifying |

## Two findings that matter

### 1. Anthropic gates CORS behind the opt-in header

A preflight that does **not** list `anthropic-dangerous-direct-browser-access`
in `Access-Control-Request-Headers` comes back **HTTP 400 with no
`Access-Control-Allow-Origin`**. Listing it returns 200 with `ACAO: *`.

```
# without the header requested
HTTP/2 400            (no ACAO -> browser blocks)

# with it requested
HTTP/2 200
access-control-allow-origin: *
access-control-allow-headers: content-type,x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access
```

The official SDK with `dangerouslyAllowBrowser: true` sets this for you. Raw
`fetch` must send it explicitly, or you get an opaque CORS failure that reads
like a network bug.

### 2. Corti is out on auth, not on data

Corti's API host sends permissive CORS headers, so the data plane would work.
But Corti authenticates via Keycloak client-credentials at `auth.corti.app`,
and that token endpoint **returned no preflight response at all**. If a browser
cannot mint the token, the open data plane is irrelevant — and minting it
server-side is exactly what SPEC constraint 1 forbids.

Corti is therefore **not implemented**. This was tested against a non-existent
tenant realm, so a real tenant may behave differently; re-test before writing it
off permanently. If the token endpoint turns out to be CORS-enabled, add the
adapter to `src/lib/providers/`.

## What this does and does not settle

Settled: **connectivity is not the risk it looked like.** Four providers are
browser-callable today, two of them EU-hosted.

Not settled: **accuracy on German cardiology dictation.** That is decided by the
trap-set eval (`npm run eval`), not by this table, and not by vendor benchmarks.
Run it with keys before choosing a default:

```bash
npm run eval:tts          # once — renders the fixtures to synthetic German audio
npm run eval              # all providers you hold a key for
npm run eval -- --repeat=3 --gate=voxtral
```

## Open decision: EU-only vs. best-quality

SPEC constraint 2 says patient data may only reach "the configured EU AI
endpoints", but the SPEC's own default drafting model is Anthropic, which is
US-served. There is no EU-region first-party Anthropic endpoint. **These cannot
both hold.** It needs an explicit decision:

- **Relax the constraint** to "EU where available; US only under a signed DPA
  with zero retention and no training" — keeps Anthropic for drafting quality.
- **Hold the constraint** and draft with Mistral (Paris, CORS confirmed) — an
  eval question, not an assumption.

Either way, HJ is a `Berufsgeheimnisträger` under §203 StGB. Since the 2017
amendment, §203 Abs. 3 permits involving service providers, but they must be
contractually obliged to secrecy, and an AVV is required per provider. That is
paperwork, not code, and it gates real patient use — track it as a checklist
item, not a launch-day discovery.

The UI reflects this openly: every provider in Einstellungen carries an
EU-Server / Server außerhalb der EU badge, and non-EU selections show a warning.
