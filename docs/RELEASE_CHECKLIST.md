# Open-source release checklist

## Source release

- [ ] Review `git diff --check`, rename state, and untracked files; exclude private content and machine-only artifacts.
- [ ] Confirm example catalogs contain synthetic data only.
- [ ] Run `npm ci` and `npm run gauntlet` from a clean clone.
- [ ] Install Gaja locally from `Gajendra.app`; verify the bottom-right pill, hover card, resizable organizer, and source health.
- [ ] Verify Codex live; label Claude/Cursor proof exactly as observed.
- [ ] Set the actual clone URL in `README.md` only after the remote exists.
- [ ] Create/push the public repository, then confirm hosted GitHub Actions.
- [ ] Enable private security advisories and choose issue/discussion policy.
- [ ] Tag 0.3.1 only after the release commit and hosted checks pass.

## macOS binary release — separate

- [ ] Configure a Developer ID Application identity outside the repository.
- [ ] Archive, sign, notarize, staple, and verify Gatekeeper on a clean account/machine.
- [ ] Re-prove Launch at Login on the final signed bundle.
- [ ] Publish checksums and the minimum macOS version.

## Truth gates

- Do not call the floating utility a WidgetKit extension.
- Do not advertise Codex’s experimental global destination as stable.
- Do not imply Gaja changes native pins or owns provider sessions.
- Do not claim live Cursor compatibility without a real CLI receipt.
- Do not distribute external reference images or private conversation metadata.
- Keep local, public, hosted-CI, signed, notarized, and released states distinct.
