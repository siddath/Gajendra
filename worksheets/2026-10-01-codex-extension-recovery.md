# Codex extension recovery — 1 October 2026

Owner: Sid. No deadline specified. Authorized outcome: a usable local Gajendra
extension, recovery of the blank view and provider navigation, preserving private
priorities and unrelated work. Stop when the local flows are proven or a concrete
execution/host boundary remains. No publication, merge, provider-state edits, or
new background automation is included.

## Evidence before edits

- Owning checkout was clean on main; work branch: `codex/gajendra-extension-recovery`.
- Private primary and last-known-good state match, with saved entries and a valid
  NOW. No restore or reset is justified.
- The installed service, outside the development sandbox, resolves the active saved
  entries from Codex. A source failure inside the sandbox is not data-loss proof.
- Claude discovery rejects the entire source when directory entries exceed its
  2,000-entry budget even though session candidates remain below 2,000. Session
  sidecar folders consume the same budget as session files.
- Native refresh clears its client error on a valid JSON snapshot even when that
  snapshot reports provider errors. The card can therefore look empty without
  explaining what failed.
- Codex desktop moved its bundled CLI to `Resources/codex-cli/bin/codex`; native
  discovery and host preflight still use the earlier path.
- The embedded app ignores the initial tool result while connecting, calls the
  expensive snapshot tool again, and its connection retry does not reconnect.
- Current OpenAI extension specification supports global and thread entrypoints,
  resource display modes, and first rendering from the initial tool result.
  Reference: https://developers.openai.com/plugins/build/extensions

## Implementation and acceptance plan

1. Separate bounded directory overhead from session candidate limits; preserve
   existing privacy, content, row, and byte limits. Surface known scan errors safely.
2. Resolve the current bundled Codex CLI with explicit override precedence.
3. Advertise sidebar and conversation-panel entrypoints using the existing MCP
   App, preserve inline use, and make connection/result/navigation failures visible.
4. Explain unavailable saved entries in both UI surfaces without altering storage.
5. Run source checks, behavior regressions, browser journeys, native checks/build,
   and live metadata-only service checks. Verify private state hashes unchanged.
6. Update the local installed plugin/companion with recoverable backups and parity
   checks after validation. Native Codex UI inspection is denied by computer use;
   do not claim in-host clicks verified without an allowed host surface.

## Results

- Implemented and installed local version 0.3.2 of the plugin and native companion.
  The existing private store was neither restored nor reset. Read-only checks left
  primary and recovery bytes unchanged; owner-only permissions remain intact.
- The installed native card visibly renders the existing NOW, Focus and Important
  entries, source search, and an explicit warning for an unavailable saved entry.
  A bounded metadata-only provider read identified that entry as archived; the
  provider archive was left unchanged.
- Both enabled sources return live metadata in the installed service. One native
  refresh initially reported Codex unavailable; a later visible refresh recovered.
  A direct probe with the native process environment also succeeded. No permanent
  environment failure or data loss is inferred from that transient result.
- `npm run check`: passed, including 117 tests, type checking, build and plugin
  validation. `npm run test:e2e`: 21/21 browser journeys passed, including the
  initial result, reconnect, missing-result retry, and host navigation errors.
- Native self-tests, build, companion validation and local bundle readiness passed.
  Strict ad-hoc signature checks passed; distribution readiness remains false.
- The live MCP probe passed with both extension entrypoints. Host preflight confirms
  version 0.3.2, nine matching installed artifacts, registered MCP tools, and valid
  private state. The already-running Codex host still requires a reload.
- The current chat's installed `gajendra_open` MCP tool also returned both enabled
  sources as ready with the original saved priorities. No expanded MCP App panel
  was exposed to the browser inspection tool, so this is service evidence only.
- Native **Open in Codex** was clicked without a visible Gajendra error. Destination
  acceptance is unverified: computer-use inspection of Codex's native interface is
  denied. Browser bridge tests and a successful system-open request do not prove
  that the exact conversation became visible.
- Backups of the previous plugin, app and private store, plus local validation
  logs, are retained in ignored `.artifacts/extension-recovery-20261001/`. The old
  app is additionally retained as a hidden sibling of the installed app.

## Remaining acceptance boundary

Superseded on October 5: the 0.4.0 reload and rendered panel were verified, and Sid confirmed the
requested Open thread and return/NOW-preservation journey. See the completion audit in
[the product experience worksheet](2026-10-03-product-experience.md). The following records the
earlier October 1 boundary.

Sid should reopen Codex when ongoing work permits, open **Gajendra priorities**,
confirm the saved lanes render, and open one exact task. Codex host reload and
actual destination verification remain open; no public release, provider resume,
merge, publication, notarization or full gauntlet completion is claimed.

Rejected claims: the saved data was erased; the archived entry should be recreated;
an installed manifest proves current-host UI behavior; a source-only or ad-hoc
build is a signed public distribution.

## Codex usability refinement

Follow-up owner request: make the custom plugin feel more seamless inside Codex.
Owner: Sid; no deadline specified. Acceptance is a bounded improvement to the
existing embedded UI, preservation of priorities and manual appearance choices,
and browser behavior proof. First-party ownership and unavailable host APIs are
outside the plugin's control.

- Native/Auto appearance consumes the host's standard color and font variables,
  including live updates. Manual appearances and Focus Deck retain their styles.
- Search query and matching rows survive refreshes and priority actions. A host
  result preserves search focus and caret. Command/Control+K, `/` outside editable
  fields, and Escape provide scoped keyboard search controls.
- Provider chips are connection indicators. Source changes use explicit switches
  under **Manage sources**; source-switch focus and open settings survive updates.
- The required source check passed. All 24 browser journeys passed, including
  the three new host styling, search continuity and source-switch regressions.
  The settings popover was inspected in the in-app browser using synthetic data.
- The same 0.3.2 local candidate is being refined; this is not a separate release.
  The pre-refinement plugin is backed up under ignored
  `.artifacts/codex-seamless-20261001/`.
- The refined plugin is installed: all nine installed artifacts match source, and
  saved-priority bytes are unchanged. Logs and synthetic screenshots are retained
  beside the backup. Codex host rendering and navigation remain unverified.

Documentation correction: OpenAI's current extension guide describes sidebar and
conversation surfaces for ChatGPT. Gajendra advertises those extension capabilities;
their presence in a specific Codex build is not established by the metadata alone.
The standard MCP tools remain usable in Codex independently of custom UI support.
