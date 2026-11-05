# Architecture

The `src/audio` boundary owns the Claude integration. `formats.ts` accepts only the observed `wss://claude.ai/api/ws/text_to_speech/text_stream` endpoint and PCM 16 kHz mono signed little-endian 16-bit or raw Opus 48 kHz mono. The initiating native button and current route associate a session without retaining message text or conversation identifiers.

`ClaudePlayback` records native user intent, installs an early WebSocket observer, and synchronizes the native action with an extension-owned proxy. It waits for native `data-state=paused` before starting owned playback. It leaves incoming events intact for Claude. Unknown formats, failed handoffs, disconnected sockets, stalled generation, removed messages and route changes release ownership. It never patches fetch, XMLHttpRequest, AudioContext or unrelated media.

`StreamPlayer` implements `PlaybackAdapter`; its state includes a session ID, buffering/playing/paused/ended/error status, buffered range, nullable final duration, capabilities and errors. MediaSource appends are serialized with backpressure. Mediabunny's append-only WebM writer serves streaming playback; a separate indexed writer finalizes Opus downloads. PCM downloads preserve the native sample bytes in WAV. Opus timing is derived from packet TOC framing, not network arrival times.

The 64 MiB budget reserves native frame copies, queued work, encoding input, MSE bytes and download output. It stops extension retention before the limit. There is no unbounded recording or listening-history persistence. A disposal signal cancels append waits, pending writers and event handlers, and revokes the owned object URL.

The MV3 isolated settings bridge owns extension storage and validates page messages. MAIN-world UI has no extension privileges. The service worker routes browser commands only to the active tab's top frame. The manifest grants `storage`, matches only `https://claude.ai/*`, and requests no microphone or broad host permission.

The player is plain DOM/CSS; popup and settings use React. `ThemeSnapshot` resolves Claude's `--cds-*` semantic colors and observes `data-mode` changes. Extension pages use system fonts and warm light/charcoal fallback palettes. Layout and locale modules are reused across extension and generated userscript.

The website uses static rendering plus small React islands for navigation, preferences, FAQ and consent. The Worker serves the static assets and private feedback routes. D1 primary keys and payload hashes make retrying a feedback submission idempotent. Turnstile validation is server-side, scoped to the current hostname and feedback action. Logs exclude feedback bodies and challenge tokens.

Protocol reference inspected on 2026-11-05: https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/cb17312fe-C2V5L0KT.js. This is research evidence, not a runtime import. No Anthropic source code, fonts, logos or private conversation content are distributed.

Media packaging reference: https://mediabunny.dev/guide/output-formats. Opus framing reference: https://www.rfc-editor.org/rfc/rfc6716.html#section-3.1.
