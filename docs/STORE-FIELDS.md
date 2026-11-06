# Claude store draft fields

Reference: the existing ChatGPT Audio Controls listing and its `docs/STORE-LAUNCH-CHECKLIST.md`; adapted to Claude's native audio integration. Do not copy ChatGPT identifiers, ratings, install counts or OpenAI affiliation text.

## Chrome and Edge

- Name: Claude Audio Controls & Read Aloud
- Summary: Claude Read Aloud controls: pause, seek, speed, volume, audio downloads, shortcuts.
- Detailed English description: `docs/STORE-LISTING-EN.txt` (omit its first title line). The draft-ready version with reachable staging URLs is `build/edge-store-listings/en/description.txt`.
- Category: Productivity on Edge; Tools on Chrome (verified against the reference listing).
- Distribution: free, public listing when released. Keep version 0.1.0 unpublished.
- Mature content: no. This is an audio playback utility, not a provider of adult content.
- Draft website: https://claude-audio-controls.infoxica.com/
- Draft privacy: https://github.com/infoxica/claude-audio-controls/blob/main/PRIVACY.md
- Support: https://github.com/infoxica/claude-audio-controls/issues
- Production website: https://claude-audio-controls.infoxica.com/ (replace staging URLs only after verifying this is reachable).
- Search terms: Claude, read aloud, audio controls, playback speed, text to speech, audio download, seek

## Privacy fields

### Single purpose

Adds local playback controls to audio started with Claude's native Read Aloud button: play/pause, resume, seek, speed, volume and download. Runs only on claude.ai, preserves Claude's generated voice, and does not control live voice conversations.

### Storage justification

Saves playback, language, theme, shortcut and layout preferences using browser storage. Optional browser sync synchronizes preferences. Local aggregate counters and reminder choices control optional support prompts; session storage prevents duplicate counts. No conversation text, audio or listening history is stored in extension storage or uploaded to Infoxica.

### Site access justification (if asked)

Runs only on https://claude.ai/* to capture the native Read Aloud stream initiated by the user, provide local playback controls, synchronize the native response action, detect chat navigation, and position the player around Claude's composer. It does not request access to other sites or create a separate speech request.

### Remote code

No. Executable code and media packaging dependencies are bundled in the extension. Claude's incoming speech is media data, not remotely executed code. No external script or WebAssembly is fetched for execution.

### Data-use categories and explanation

Declare Website content and Personal communications for local handling of the selected Claude reply's audio; declare User activity for local playback/reminder counters. These disclosures describe local handling, not developer telemetry or server collection. Do not select unrelated identity, health, payment, authentication, location or browsing-history categories. The extension does not read cookies, passwords or microphone input.

All three limited-use statements are supported by the current implementation: no sale or unrelated third-party transfer; no use beyond the extension's purpose; no creditworthiness or lending use.

Audio is memory-only until a user requests a download. Navigation, session replacement and tab closure clear the active audio buffers. Preferences may sync through browser storage. Optional reminders retain aggregate local counters and choices, not per-chat records. The separate voluntary feedback form stores only explicitly submitted feedback and technical context; it is not required for playback. Website analytics require consent and are absent from feedback forms.

## Reviewer testing instructions

1. Install the submitted extension in a current supported browser. No extension account, API key or paid extension subscription is required.
2. Sign in to Claude using your own account with native Read Aloud available. No test credentials are supplied or required by this extension; Claude's account and feature availability requirements still apply.
3. Start a new chat and ask: “Explain how a seed becomes a tree in three short paragraphs.” Wait for the reply to finish.
4. Use Claude's native Read Aloud action. Verify that one audible player is active, with the extension's controls above the composer.
5. Test pause/resume, seeking within received audio, speed, volume and mute. After generation completes, download WAV; for an Opus response, also test the native WebM option.
6. Try a corner/side layout, collapse/expand, and settings changes. Switch to a new chat and confirm the previous audio position resets.
7. Optional feedback/donation links are separate website actions and not required for playback. Store Review links remain disabled in 0.1.0 while listings are drafts.

## Images

- Store icon: `public/icons/icon-128.png` (Chrome) and `assets/store/logo-300.png` (Edge).
- Small promotional tile: `assets/store/small-tile.png`, 440×280.
- Marquee: `assets/store/marquee.png`, 1400×560.
- Four screenshots: `assets/store/screenshots/`, 1280×800 each.
- Player screenshots render the real built player over a repeatable fictional Claude-style chat. Settings screenshot renders the actual options page. They are product illustrations, not evidence of live platform acceptance.
- Localized Edge descriptions/logos: `build/edge-store-listings/`. Apply each provider-supported locale; duplicate the shared logo and screenshots using Partner Center's built-in Duplicate action where available.

## Publication status

These are draft metadata and assets. No review submission or production publication is authorized by completing these fields alone. Replace the package with the accepted 1.0.0 build and verify all production links before submission.

Sources: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension and https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (local-only data handling still requires disclosure).
