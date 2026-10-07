# Product evals

Evals describe what someone needs Gajendra to do, then check the observable outcome. They run
without model API calls, provider accounts, private conversations or an LLM judge. They complement
unit tests and UI journeys; passing them does not establish real-host tool selection or native UI latency.

```sh
npm ci
npm run build
npm run evals
```

The versioned dataset is [`evals/scenarios.json`](../evals/scenarios.json). Each case has a user
intent and explicit acceptance criteria. [`evals/run.mts`](../evals/run.mts) evaluates those criteria
against isolated synthetic state. Five scenarios exercise the real service and persistence code;
the sixth uses the compiled MCP server and native CLI through the shared workflow verifier.
The seventh runs the packaged lifecycle hook with the host environment and checks the shared reader.
All seven must pass. Unknown, missing and duplicate case IDs fail the suite rather than silently
reducing its coverage. CI runs the suite after building and uploads the JSON report as `product-evals`; the release
gauntlet includes it too.

| Scenario | Decision it protects |
| --- | --- |
| Prepared work | Frequent reads and local changes reuse metadata while showing the current state revision. |
| Concurrent intent | A retry cannot duplicate a write, and a stale client cannot replace the chosen NOW. |
| Response review | Opening is not acknowledgement; Undo and later responses remain reviewable. |
| Hook shared scope | The packaged hook reaches the native/MCP default data scope even with host-injected `PLUGIN_DATA`; state and content boundaries remain intact. |
| Explicit lifecycle | Finish clears Ready without acknowledging response evidence; a closing reply stays in History. Reopen restores pending review. Exact continuation preserves prior history. Existing target priorities cannot be overwritten. |
| Private restart | Saved metadata is neutral, account-scoped and private; the priority store excludes provider titles. |
| Cross-client | MCP and native CLI agree on revisions and work lifecycle across interleaved changes. |

## Development loop

1. Write down the user-visible failure or intended behavior. Add a small synthetic case, or extend
   the relevant case's acceptance criteria. Keep actual provider data out of fixtures and reports.
2. Run the case against the baseline and retain the failed assertion or existing behavior. If the
   change is only documentation or presentation, do not invent a failing product case.
3. Make the smallest change, run focused tests and the eval suite, then inspect the affected
   interface. Add a negative case when stale evidence, ambiguity or retries could change intent.
4. Include the report and exact tested revision/build in the PR. Explain changed expectations;
   do not weaken an acceptance criterion just to get a passing score.
5. Keep hosted CI, local synthetic results, real-host acceptance and published release receipts
   separate. A failed critical invariant blocks release; unavailable manual checks remain not run.

The runner writes `.artifacts/evals/report.json` with each criterion, outcome, elapsed time,
synthetic evidence, Git revision/dirty flag and compiled server SHA-256. It exits nonzero on failure.
The wrapper replaces any old result before typechecking or loading the dataset, so an initialization
failure cannot leave an old pass behind. The report is generated locally and can be attached to a PR after checking it for private data.
Sanitized release receipts live under `evidence/evals/`.

## Performance evidence

The prepared-work scenario gates on provider collection count and state parity: one initial
collection followed by eight reads and seven writes must not trigger another listing. This is a
portable regression check. Seven service read/write samples and medians are recorded for diagnosis,
not compared to an arbitrary machine-specific millisecond threshold. They exclude provider/network
delay, CLI startup and UI rendering and cannot reproduce the real-source improvement percentage.

The separate [before/after receipt](../worksheets/2026-10-05-backend-cache-performance.md) measures
the real CLI/backend path: three samples per operation, 15.0501 s to 0.7969 s median refresh (94.7%
lower), and 15.9177 s to 0.1128 s local write (99.3% lower). Repeat that method with the same source
scope, runtime and private copied state before making a new real-source performance claim.

## Native Space and launcher journey

On a Mac, verify the installed native surface separately from the deterministic service evals:

1. Open the card with one launcher click, switch between a desktop and a full-screen app, and
   confirm that both launcher and card remain visible and usable without activating Gajendra.
2. Dismiss the card, repeat the transition, and confirm only the launcher follows. Reopen it with
   one click and use search immediately. Repeat close/reopen while metadata refreshes.
3. Check the launcher in light/dark themes: no refractive glass ripple or refresh opacity pulse;
   keep its full click target and Reduce Motion behavior.

The existing `companion:ui-fullscreen-test` journey now opens the card **before** the full-screen
transition and checks actual active-Space membership and full opacity. Its bounded Space receipt
is emitted only with the existing UI probe enabled and an isolated test defaults suite/data path.
Retain native UI evidence separately: compiling that harness is not running its journey.

## Codex host evals

The plugin's [reviewer cases](CODEX_PLUGIN_PUBLICATION.md) include tool choice, ambiguous requests,
source availability and mutation intent. Run these manually in a fresh host conversation and record
the host/model version, prompt, expected tool/action, actual outcome and any owner intervention.
Treat private session data as local-only. These host cases are **not run by `npm run evals`**;
the deterministic suite has no model quality score and does not certify directory approval.
