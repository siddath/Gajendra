# Compact priority action performance receipt

**Date:** 2026-08-24

**Scope:** same logged-in Mac, real Gajendra window, synthetic isolated test state

**Budget:** each measured launcher-to-card path must remain below 200 ms

The initial menu-per-row implementation was rejected after repeat measurements showed a material
popup regression. The final interaction keeps the two-choice native menu only for unprioritized
Running/Ready rows and uses a direct one-click button for the single Focus/Important lane swap.

Three independent widget journeys were run at the exact pre-change revision `185f9f3769cc` and
three more against the final working candidate. Every journey also exercised inactive-first-click
recovery, reopen, long-press/drag, dock controls, search, NOW double-click, and isolated Running and
Ready-for-Review priority mutation paths.

| Build | Prewarmed samples | Cold samples | Warm samples | Median (prewarmed/cold/warm) |
| --- | --- | --- | --- | --- |
| Pre-change `185f9f3769cc` | 72, 58, 43 ms | 86, 82, 86 ms | 85, 92, 85 ms | 58 / 86 / 85 ms |
| Final working candidate | 44, 52, 47 ms | 85, 83, 86 ms | 83, 87, 86 ms | 47 / 85 / 86 ms |

**Verdict:** no material popup regression remains; all 18 measured paths stayed below the 200 ms
local budget. This is a same-host regression receipt, not a cross-machine performance claim. The
system accessibility tree did not expose the status item, so status-item presentation remains a
separate physical/manual gate.

The final 20-gate release gauntlet repeated both native paths after the source deadline and
Running-to-Ready transition work. Its full journey measured 33/84/89 ms
(prewarmed/cold/warm); the strict compact-widget journey measured 64/83/92 ms. Both retained the
same 200 ms budget, and the strict compact journey emitted no dependency-cycle diagnostic.
