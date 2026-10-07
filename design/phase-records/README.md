# Stage K — Phase record index

One file per wave. Named for the wave, zero-padded, never overwritten.
Superseded entries are marked, never deleted.

| Phase | Wave | Scope | Commit | Deploy | Status |
|---|---|---|---|---|---|
| [PHASE_00_tokens.md](./PHASE_00_tokens.md) | Wave 0 | Token layer, font loading, base styles, token scan, contrast measurement | see file | not deployed | **OPEN — awaiting operator verification** |
| [PHASE_01_wave1_signature_devices.md](./PHASE_01_wave1_signature_devices.md) | Wave 1 | Signature devices, framing, motion helper, gallery route | see file | deployed | **OPEN — awaiting operator verification** |
| [PHASE_02_batch_session.md](./PHASE_02_batch_session.md) | Waves 1–3 batch | Framing, controls, data primitives, landing, pass detail, trader profile | see file | deployed | **OPEN — awaiting operator verification** |
| [PHASE_03_discover.md](./PHASE_03_discover.md) | Wave 7 | §10.2 Discover | see file | deployed | **OPEN — awaiting operator verification** |
| [PHASE_04_take_create_errors.md](./PHASE_04_take_create_errors.md) | Wave 7 | §10.5 Create Pass, §10.6 Take flow, §10.12 errors | see file | deployed | **OPEN — awaiting operator verification** |
| [PHASE_05_take_route_verification.md](./PHASE_05_take_route_verification.md) | Wave 7 | Take route 404 root cause | see file | deployed | **CLOSED** |
| [PHASE_06_env_og_closure.md](./PHASE_06_env_og_closure.md) | Wave 7 | `NEXT_PUBLIC_API_URL` / OG investigation | see file | deployed | **CLOSED** |
| [PHASE_07_my_passes_attempt.md](./PHASE_07_my_passes_attempt.md) | Wave 7 | §10.8 attempt, **not landed** — recorded as superseded | none | n/a | **SUPERSEDED** by the landed §10.8 commit |
| [PHASE_08_stage_k3_rebuild.md](./PHASE_08_stage_k3_rebuild.md) | Stage K.3 | Wallet control, §14 rebuild of Pass detail, Trader profile, Take flow | see file | deployed | **OPEN — awaiting operator verification** |
| Stage K completion summary | Waves 0–7 | Ratchet closure, screen inventory, Tailwind decision | see [`../BUILD_CONTINUATION.md`](../BUILD_CONTINUATION.md) | deployed | **OPEN — awaiting the operator checklist** |

## Phase status

**Stage K is OPEN.** Every wave and every screen is built, the token ratchet is
clean, and the whole thing is deployed — but no phase in this track can close
until an operator or a browser-capable agent completes the agent-as-user pass,
because this environment has no browser automation (see
[PHASE_00_tokens.md](./PHASE_00_tokens.md) §1). The checklist to run is
[`../BUILD_CONTINUATION.md`](../BUILD_CONTINUATION.md) §4.

## Deferred findings

See [`findings/deferred.md`](./findings/deferred.md) for the named
`nice-to-fix-later` backlog. Empty so far; the first entry will be the
Executions horizontal-scroller anti-pattern when that screen is rebuilt.
