## What changed

Describe the user-observable change and the surface it affects.

## Product and privacy boundaries

- [ ] NOW remains singular and belongs to Focus.
- [ ] Standard MCP Apps behavior still works without the experimental global entry point.
- [ ] No prompts, transcripts, credentials, or private task content were added.
- [ ] Canonical thread IDs remain source-namespaced and provider sessions stay in their owning apps.
- [ ] New source behavior is explicit, bounded, failure-isolated, and documented.
- [ ] No claim is made that the floating utility is WidgetKit or that Gajendra changes native provider pins.

## Verification

- [ ] `npm run check`
- [ ] Relevant observable behavior test
- [ ] Light/dark and Reduce Motion evidence for UI changes
- [ ] `npm run gauntlet` for release-impacting changes

## Release truth

State whether this is local, reviewed, merged, tagged, hosted-CI green, notarized, or publicly released. Do not collapse those states.
