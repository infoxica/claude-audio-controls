# Development acceptance — 0.1.0

This file records evidence, not a production approval. `config/acceptance.json` is version-specific and gates release publication.

## Verified on 2026-11-05

- Unit suite: 50 tests, including 67 locale catalogs, shortcut routing, settings validation, layout geometry, format validation and D1 idempotency/validation.
- Isolated Chromium: PCM and Opus MediaSource streaming, early pause, rapid toggles, buffered seeking, rate/volume, completion, memory failure and malformed frames. Both downloads independently decode through Web Audio.
- Built extension and generated userscript: composer docking, typing protection, native-action synchronization and downloads.
- All 67 runtime locale changes, RTL, narrow portrait/landscape and keyboard-sized viewport; semantic theme update.
- Browser fixtures also verify reply replacement, stale frame rejection, navigation cleanup and unknown-format fallback. These do not replace live-device acceptance.
- Website: all 335 localized pages build; three HTTP/link checks pass. Browser checks confirm consent, withdrawal, disabled staging analytics, hidden unavailable store links, localized navigation and narrow RTL layout.
- Staging health and indexing checks pass at https://claude-audio-controls-staging.anand224patel.workers.dev/.
- Live Edge staging feedback form completed its Turnstile flow and displayed a saved confirmation. Remote D1 verification found exactly one fictional staging test record and zero production records.
- Dedicated Infoxica GA4 web stream created for the Claude website: `G-XSDHJ2SBTF`, stream `16278448585`. Enhanced measurement is off; the extension and feedback forms have no analytics.
- Live signed-in Edge on Windows: native Read aloud capture, native paused while owned playback advances, seek backward, replay, rapid pause/resume, 1.5× rate, and successful native Opus download.
- Independent FFprobe/FFmpeg verification of that private local download: WebM, Opus, 48 kHz mono, 26.960 seconds, 121,920 bytes, full decode without errors. The private file is not copied into this repository.

## Required before a production release

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
