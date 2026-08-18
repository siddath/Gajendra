# Toolchain and device readiness plan

**State:** plan_generated

**Authority:** [master plan](../GAJENDRA_MOBILE_APP_PLAN.md)

## Current observed baseline

Observed on 2026-08-17. Recheck every item when work resumes.

| Capability | Observed state | Consequence |
| --- | --- | --- |
| Xcode selector | CommandLineTools only | Cannot build/test iOS app |
| Full Xcode/CoreSimulator/simctl | Absent | No iOS simulator proof |
| Swift | 6.3.2, arm64 macOS target | Useful for Mac, insufficient for iOS proof |
| Android Studio/SDK/adb/emulator/Gradle | Absent | Cannot build/test Android app |
| Node | 26.3.0 | Desktop baseline available |
| npm | 11.16.0 | Desktop baseline available |
| Java | OpenJDK 25.0.4 | Future Android plugin compatibility unproven |
| CocoaPods/Flutter/Dart/Fastlane | Absent | Not automatically required; no proof |
| Physical iPhone/Android UAT | Not run | Mobile-ready blocked |

No installation, license acceptance, SDK download, simulator/emulator creation, signing setup,
device enrollment, or distribution configuration is authorized by this plan.

## Approval-gated prerequisites

### Shared

- Current clean repo baseline and package-lock integrity.
- Approved Capacitor/native fallback and supported dependency versions.
- Approved minimum/current iOS and Android targets from current vendor/dependency support.
- Approved same-LAN test environment that cannot expose the relay publicly.
- Synthetic fixture dataset and sanitized evidence location.
- CI/build-host ownership, retention, and secret-handling decision.
- E0 protocol/security amendment reviewed; D01 same-LAN listener, D03 Capacitor spike, D05 OS/API
  targets, and D07 devices/LAN remain separate approval receipts.

### iOS

- Full supported Xcode and command-line selection.
- Matching iOS SDK and CoreSimulator runtimes.
- Named compact phone, standard phone, and tablet simulator profiles.
- One physical iPhone with Local Network permission testing.
- `NSLocalNetworkUsageDescription` and any applicable `NSBonjourServices` declaration reviewed
  against [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy).
- If Bonjour/multicast is used, verify the service types and iOS multicast entitlement; do not
  hard-code `en0` or treat simulator behavior as local-network privacy proof.
- Development signing only if required for approved physical/internal proof.
- Keychain, backup, app-switcher, VoiceOver, Dynamic Type, Reduce Motion, rotation, and permission
  procedures.

### Android

- Supported Android Studio, command-line tools, SDK, platform tools, emulator, and build tools.
- Project-pinned Gradle wrapper, Android Gradle Plugin, Kotlin, and supported JDK matrix.
- Named compact phone, standard phone, and tablet AVDs at approved minimum/current APIs.
- One physical Android with applicable local-network permission behavior.
- If D05 selects target SDK 37 or higher (Android 17), declare and request
  `android.permission.ACCESS_LOCAL_NETWORK` before local-network traffic and test denial/revocation
  on a physical device. If the approved target is SDK 36 or lower, do not add or request that
  permission; record the lower-target behavior instead.
- Review the [Android local-network permission](https://developer.android.com/privacy-and-security/local-network-permission)
  and [Android 17 behavior changes](https://developer.android.com/about/versions/17/behavior-changes-17)
  pages at target selection time; no target/API is claimed by this plan.
- Keystore, backup, recent-apps, TalkBack, font scaling, animator scale, process death, Back,
  edge-to-edge, rotation, and permission procedures.

## Readiness states

| State | Meaning |
| --- | --- |
| absent | Tool/device not installed or discoverable |
| installed_unverified | Present without pinned version/license/path/build proof |
| build_ready | Approved spike builds on named target |
| test_ready | Automated unit/UI/instrumented tests run on named target |
| device_ready | Pairing, permission, secure storage, same-LAN pass physically |
| gauntlet_ready | Required targets run fail-closed from committed commands |

Readiness is recorded per host, target, and build. One platform never implies the other.

## Host validation

1. Record OS, architecture, developer paths, tools, SDKs, runtimes/APIs, disk space, and license
   state without private identifiers.
2. Confirm dependency compatibility from current primary docs and lock it.
3. Run a minimal native-plugin build before full UI.
4. Run native unit and UI/instrumented smoke.
5. Test local-network permission denial/recovery where supported while retaining physical gates.
6. Test Keychain/Keystore creation, deletion/loss, backup exclusion, and re-pair.
7. Confirm committed commands fail when targets are absent.
8. Store only sanitized readiness receipts.

For iOS, the local-network receipt must identify whether the path used direct TCP, Bonjour, or
multicast/broadcast and include the physical-device result. For Android, it must identify the
approved target SDK and whether `ACCESS_LOCAL_NETWORK` was required, denied, revoked, or avoided by
a qualifying system picker. A simulator/emulator render is never a substitute for either receipt.

## Device/viewport coverage

Exact models, OS versions, and API levels are selected after current support review; do not invent
durable floors in advance.

- iOS compact phone, standard phone, tablet; portrait/landscape and split view when applicable.
- Android compact phone, standard Pixel-class phone, tablet; portrait/landscape and split screen.
- Approved minimum and current supported OS/API targets.
- Light/dark, largest practical text scale, reduced motion, screen reader, keyboard/IME, safe
  areas/edge-to-edge, permission denied/revoked, offline/reconnect, and lifecycle.
- One physical iPhone and Android on the paired Mac's approved LAN.

## Signing/distribution boundary

Recommended first milestone: local development and internal physical-device proof. TestFlight,
Play internal testing, public store submission, certificates/profiles beyond approved testing,
privacy disclosures, store metadata, review accounts, analytics/crash reporting, and publication
are separate decisions/plans.

Unsigned simulator/emulator builds cannot support mobile-ready, distribution-ready, or store-ready
claims.

## Exit criteria

Both platforms reach gauntlet_ready on named hosts, both physical devices reach device_ready,
versions are reproducibly pinned, checks fail closed, and evidence contains no private data or
secrets. Until then, absence is a blocker, not a skipped pass.
