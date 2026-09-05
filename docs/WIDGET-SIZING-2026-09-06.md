# Independent widget size and task layout

The settings gear opens task layout and widget size together. Compact, Comfortable, and Expanded
control task spacing, text scale, and detail. The separate Minimum–Maximum slider controls the
outer floating widget, and neither control overwrites the other choice. The Organizer uses the same
settings view. Appearance, theme, launcher position, and source management remain available there.

Theme, Appearance, and Lotus position share an equally spaced, full-width dropdown column. Native
menus retain the selected-option checkmarks and accessible labels/values. Settings content enters
with a 180 ms fade and four-point movement; task layout changes use a 200 ms ease-in/out transition.
macOS Reduce Motion disables both added transitions. Animation does not drive outer window sizing.

## Cause and implementation

Previously the three presets selected both content scale and outer window dimensions. The AppKit
resize subscriber also read the model synchronously from an `@Published` notification, which fires
before the stored value changes. That allowed a resize to use the previous selection. Window sizing
now observes only the numeric widget preference, on the next main-queue delivery, without stacking
resize animations. During a pointer drag, the displayed value changes immediately and the widget
resizes on release, keeping the slider stationary under the pointer. The settings window is
explicitly identified as part of the widget for outside-click dismissal; a parent-window check alone
was insufficient during the full native journey.

The slider retains the existing preset dimensions as migration points: 0 = 560 × 570,
25 = 660 × 610, and 50 = 760 × 680 points on the reference display. Its new maximum is 960 × 850.
Interpolation is continuous, with the existing display scale and available-screen/launcher bounds
applied afterward. These are conservative product defaults based on the existing widget sizes;
the percentage describes the position in the size range, not text zoom. On smaller displays,
available space can cap the actual dimensions before the slider reaches 100%.

The existing `gajendra.visual.hover-card-size` preference remains the layout choice. A separate
`gajendra.visual.widget-size` preference is bounded to 0–100. Existing installations migrate their
starting dimensions once. Fresh installations do not manufacture prior preferences during
initialization, preserving first-launch source onboarding. Priority/provider data is not involved.

## Verification

Native self-tests cover independent persistence, legacy migration, non-finite/out-of-range values,
monotonic interpolation, and display bounds. The native UI journey checks actual layout selection,
fixed window geometry across modes, pointer slider movement, resizing in both directions, reopening,
and byte-identical synthetic priority state. Visual-preference mutations use a unique disposable
UserDefaults suite; CFFIXED_USER_HOME alone did not isolate cfprefsd writes on this host. This journey runs in the ordinary and
performance UI suites, and can be isolated with `GAJENDRA_UI_TEST_SCOPE=widget-sizing npm run companion:ui-test`.

### Initial sizing receipt (before settings polish)

Initial implementation/test commit: `13d8fa14d100a3efc695c6e779a10bcdf9d550ca`. The subsequently
requested dropdown alignment and motion changes require a new final receipt. The complete gauntlet passed all 21 gates from 2026-09-05 19:17:06 through 19:25:24
UTC (September 6 locally): 115 source tests plus five complete repeats, 17 browser journeys plus
85 repeated journeys, native self-test/build, full native interaction, full-screen reopen, widget
performance, live MCP, artifact validation, and zero production vulnerabilities. The preview
executable also compiled. See [the machine-readable report](../evidence/gauntlet/report.json).

| Final native journey | Prewarmed reveal | Cold open | Warm open |
| --- | ---: | ---: | ---: |
| Full interaction | 36 ms | 84 ms | 85 ms |
| Widget/performance | 38 ms | 89 ms | 84 ms |

The existing 200 ms budget was unchanged. An earlier gauntlet stopped on a 224 ms prewarmed reveal
(cold 85 ms, warm 90 ms). Its failure receipt is retained privately; the isolated unchanged-code
recheck passed at 63/88/85 ms with no AttributeGraph cycles, and the final complete run above passed.
The outlier's cause was not established by a controlled experiment. These observations are not a
cross-machine or provider-refresh performance guarantee.

### Initial installed result

The exact app was installed at `~/Applications/Gajendra.app`, with strict ad-hoc signature validation
and executable/service/runtime parity against the tested build. Native executable SHA-256:
`1e7e59ae2a5aa9a2cccd8cda85dc4382dc6745fbe1b5b4e443030818ce207550`.
The installed bottom-right sizing journey passed. A direct inspection of the live installed app
confirmed both independent controls and the migrated dimensions. Priority state remained byte-for-byte
unchanged with mode 0600. The previous app remains available as
`~/Applications/Gajendra-rollback-20260906-widget-sizing.app`; the redundant temporary replacement
was removed only after a complete file/symlink manifest comparison.

### Settings polish and publication

The owner explicitly authorized publication and merge of the sizing update plus aligned dropdowns
and settings/layout animation on September 6. The new native UI assertion checks equal dropdown
bounds and spacing, selection of Dark then Auto through the native menu, independent sizing,
reopening, and unchanged synthetic priority data. Final candidate checks and hosted CI must pass
before merge. Physical VoiceOver and signed/notarized distribution remain outside these receipts.
