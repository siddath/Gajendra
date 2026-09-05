# Independent widget size and task layout

The settings gear opens task layout and widget size together. Compact, Comfortable, and Expanded
control task spacing, text scale, and detail. The separate Minimum–Maximum slider controls the
outer floating widget, and neither control overwrites the other choice. The Organizer uses the same
settings view. Appearance, theme, launcher position, and source management remain available there.

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
UserDefaults suite; CFFIXED_USER_HOME alone did not isolate cfprefsd writes on this host. This journey runs in the ordinary and performance UI
suites, and can be isolated with `GAJENDRA_UI_TEST_SCOPE=widget-sizing npm run companion:ui-test`.

Final gauntlet, hosted CI, merge, and installation receipts are recorded in the PR and current status.
These checks do not establish physical VoiceOver or signed/notarized distribution readiness.
