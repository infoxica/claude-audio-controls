# Development acceptance — 0.1.0

This file records evidence, not a production approval. `config/acceptance.json` is version-specific and gates release publication.

## Verified on 2026-11-05

- Unit suite: 50 tests, including 67 locale catalogs, shortcut routing, settings validation, layout geometry, format validation and D1 idempotency/validation.
- Isolated Chromium: PCM and Opus MediaSource streaming, early pause, rapid toggles, buffered seeking, rate/volume, completion, memory failure and malformed frames. Both downloads independently decode through Web Audio.
- Built extension and generated userscript: composer docking, typing protection, native-action synchronization and downloads.
- All 67 runtime locale changes, RTL, narrow portrait/landscape and keyboard-sized viewport; semantic theme update.
- Browser fixtures also verify reply replacement, stale frame rejection, navigation cleanup and unknown-format fallback. These do not replace live-device acceptance.
- Automated Chromium suite: 21 tests across audio, built extension/userscript, settings and website. ZIP verification compares every archived byte with the built distribution and checks scope, versions and dependency notices.
- Completed PCM and Opus playback can be disposed repeatedly without finalized-output warnings; the regression was reproduced before the fix.
- Website: all 335 localized pages build; three HTTP/link checks pass. Browser checks confirm consent, withdrawal, disabled staging analytics, hidden unavailable store links, localized navigation and narrow RTL layout.
- Staging health and indexing checks pass at https://claude-audio-controls-staging.anand224patel.workers.dev/.
- Live Edge staging feedback form completed its Turnstile flow and displayed a saved confirmation. Remote D1 verification found exactly one fictional staging test record and zero production records.
- Dedicated Infoxica GA4 web stream created for the Claude website: `G-XSDHJ2SBTF`, stream `16278448585`. Enhanced measurement is off; the extension and feedback forms have no analytics.
- Live signed-in Edge on Windows: native Read aloud capture, native paused while owned playback advances, seek backward, replay, rapid pause/resume, 1.5× rate, and successful native Opus download.
- Independent FFprobe/FFmpeg verification of that private local download: WebM, Opus, 48 kHz mono, 26.960 seconds, 121,920 bytes, full decode without errors. The private file is not copied into this repository.

## Required before a production release

### Carousel and draft listing follow-up

- Player layouts use a manual 17-image carousel with buttons, a layout picker, Left/Right and Home/End keys. Keyboard navigation also works inside the enlarged image dialog; Escape restores focus to the current image. Narrow RTL navigation is covered by the website browser test.
- Production build, type checking, 12 engagement unit tests, and three focused browser checks pass (website consent, carousel/localization/RTL, and disabled Review action).
- Chrome's draft item ID was supplied by the owner. Edge's 0.1.0 draft and CRX ID were verified in Partner Center. Identifiers are recorded in `config/release.json` and `docs/STORE-DRAFTS.md`.
- Listing-live flags keep installation/review links unavailable while identifiers belong to unpublished drafts. Store identifiers alone do not satisfy the remaining live-device acceptance gates.

### Playback regression follow-up (2026-11-05)

- The reported 124.86-second private WebM had no packet timestamp gaps and played to completion in isolated Edge, both as a downloaded file and through the streaming adapter. This does not establish Windows Media Player compatibility.
- Added a bounded local Opus-to-WAV compatibility download, three-second speed-adjusted startup/rebuffering, and pause cancellation during buffering.
- Browser suite now has 14 passing tests, including burst delivery, underrun recovery and independent WAV decoding. Unit suite remains 50 passing tests.
- Inspected live Claude tokens: clay `#d97757`, emphasized clay `#c6613f`, 14px composer corners and 8px control corners. Player styling now uses those native tokens.
- The original tab was unresponsive to browser diagnostics; a fresh Claude tab played normally. The exact cause of that original-tab symptom is not yet established.
- Updated live Edge playback advanced past 1:47 with buffering clear; the WAV control exported a 142.8-second, 48 kHz mono PCM16 file that FFmpeg decoded completely. Windows Media Player's actual output still needs confirmation.

### UI alignment follow-up, 2026-11-05

- Popup and settings share Claude-inspired warm/charcoal semantic palettes, clay accents, 8 px button corners, quiet selected navigation and 44 px targets. Playback preferences come first; all 67 languages remain available in a native select.
- Extension and userscript browser fixtures check seekbar/control bounds with left and right sidebars, resize without composer resize, clipped collapsed navigation, artifact panels, and narrow overlay navigation. Both normal and fallback docks reserve the visible chrome area.
- Popup and settings render in light/dark modes without horizontal overflow at 360/390 px. Fictional screenshots are regenerated under `assets/demo`.
- This follow-up uses Claude's previously measured colors/radii. The signed-in browser automation connection is detached; visual verification of these latest changes on the live Claude page remains pending. No new physical-device acceptance is claimed.

### Native UI follow-up, 2026-11-05

- Re-inspected the live Claude sidebar, `chat-header` / Page tools toolbar, appearance settings, and empty composer. Measured a ~45 px composer with 14 px corners, 8 px buttons, and a neutral gray light-mode theme track. No conversation content is included in release screenshots.
- Reworked the popup and settings into compact native-style rows with neutral surfaces; fixed the light theme selector and detected-language contrast. Floating rails are 46 px, preserving 44 px targets within their borders.
- One Download control opens WAV / WebM choices for Opus; PCM downloads directly. Volume opens on hover or keyboard focus, supports pointer travel to its slider, and dismisses with Escape. Drag handles, launcher and target outlines use matching rectangular corners.
- Chat-only gating handles initial loads, History navigation and settings hash overlays. Audio capture also declines ownership outside chat routes. Left-side and top-corner fixtures cover expanded sidebars and Claude's native toolbar structure.
- Validation: 50 unit tests; 21 browser cases across audio, product, settings and website, including format-menu exports, hover/focus/Escape behavior, drag outlines, route transitions, and a measured 4.5:1 minimum for the detected-language hint. Type checking and exact ZIP audit pass.
- Browser reload through the native Edge window could not be completed (`coordinate input geometry is unavailable`). The build must be reloaded before claiming these latest changes pass live installed-extension acceptance. Staging website preview was opened for review; it has not been redeployed in this follow-up.

### Remaining acceptance

- Live PCM capture and complete download in a browser where Claude selects PCM.
- Chrome on Windows; Chrome and Edge on macOS.
- Edge Android on a physical device: portrait, landscape, keyboard, touch, background/foreground and native media-session interactions.
- Tampermonkey in actual Chrome/Edge, including document-start injection under Claude's CSP.
- Live reply/conversation replacement, disconnected generation, multi-tab isolation, long replies and memory budget behavior.
- Audible single-player confirmation on all target browsers, plus native fallback after failure.
- Screen-reader/keyboard checks, composer resize, sidebars, artifacts, zoom and human review of rewritten translations.
- Confirm production analytics delivery after the approved domain launch; consent and withdrawal are already tested with network requests intercepted locally.
- New Chrome/Edge listing identifiers and final store assets. No inherited install counts or ratings.

Automated fixtures are not evidence of physical macOS/Android acceptance. Do not change a gate to true without recording the corresponding browser/device and evidence here.
