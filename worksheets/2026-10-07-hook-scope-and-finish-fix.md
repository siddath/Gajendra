# Hook refresh and explicit Finish repair

## Contract and cause

The owner expected an explicit conversational goodbye to finish the exact current chat and clear
Ready for Review. A farewell response alone had not dispatched the completion tool. Separately,
the trusted hook accepted events but wrote its epoch under host-injected `PLUGIN_DATA`, while the
native/MCP readers used the shared app directory. Existing Finish semantics retained the chat in Ready.

## Change

- Hook ingestion uses the shared app default rather than hook-only `PLUGIN_DATA`; explicit
  `GAJENDRA_DATA_DIR` still isolates it. Payload content remains ignored and authoritative state untouched.
- Explicit Finish excludes a chat from Ready and Continue while preserving unacknowledged response
  evidence in History. A later closing reply does not resurrect it. Reopen restores pending review.
  This amends the previous Ready-independent-of-completion product contract at the owner's request.
- Skill/tool guidance covers explicit “I'm done with this thread”, reliable current host identity,
  revision checks, and the negative cases of bare thanks, quoted examples, and provider events.
  Provider conversations are neither archived nor deleted.
- Host preflight reports effective plugin hook trust/enablement and shared signal presence without
  treating installation or token presence as proof of a recent event.

## Verification

- `VITEST_MAX_WORKERS=1 npm run check`: 170 source tests passed; typecheck, build and plugin validation passed.
- `npm run evals`: 7/7 synthetic product cases, including the packaged hook with host-injected data scope.
- `npm run test:e2e`: 32/32 browser journeys, including Finish on a Ready row and Reopen restoring it.
- Native self-test, build, companion validation and local bundle readiness passed; ad-hoc signature only.
- Installed plugin matched all 17 installer artifacts; all 9 native bundle files matched the verified build.
- Local Codex `hooks/list` reported all four events enabled and trusted before and after the repair.
  No trust or global feature settings were changed.
- A synthetic event through the installed hook produced a token seen by the installed native sync reader;
  priority-state bytes were unchanged by the hook. This proves installed invocation, not a future host event.
- The explicit completion mutation applied with CAS. Private before/after comparison changed only
  completion IDs, revision and the idempotency ledger; priorities and review receipts were preserved.
- Installed native live snapshot placed the selected chat in History and outside Ready. A transient
  shared-service provider error recovered after restarting only the identified Gajendra service;
  an independent provider read also passed. Its original cause was not established.
- Native live UI automation became stale after bundle replacement and could not verify the final
  visible queue. Browser behavior, native projection self-tests and installed backend results are
  separate receipts; no final native visual claim or full release-gauntlet claim is made.

The app and state backups remain local and private. Reload Codex to adopt updated skill/tool copy.
The existing v0.4.0 tag and published release artifacts are unchanged by this repair.

## CI follow-up

The first Linux CI run passed 169/170 tests, but a process-tree fixture missed its 1.5-second
startup deadline under concurrent file execution. The test runner now runs files sequentially;
all process termination assertions and time budgets remain unchanged. `VITEST_MAX_WORKERS`
is not a supported setting in this installed Vitest version, so the earlier command did not
actually bound concurrency. The runner configuration makes that bound explicit.
