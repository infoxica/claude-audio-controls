# Deployment

Production publishing remains gated. The development website can be deployed to the isolated staging Worker without publishing the extension or enabling the production domain.

Staging: https://claude-audio-controls-staging.anand224patel.workers.dev/ (noindex, analytics disabled).
The dedicated production website stream is `G-XSDHJ2SBTF` under the Infoxica Analytics account. Enhanced measurement is disabled. No extension analytics property is used.

Both Workers, D1 databases, migrations and Turnstile widgets are provisioned. The production Worker has no route, no workers.dev endpoint and no version preview URLs. Its assets are a candidate awaiting acceptance; the production domain is not launched. The staging feedback test saved one fictional record, while production D1 remains empty.

```sh
bun run build:site
bun scripts/prepare-web-assets.ts --staging
bun scripts/build-feedback-copy.ts
bunx wrangler deploy --config feedback/worker/wrangler.jsonc --env staging
```

Staging uses `claude-audio-controls-staging` and its own D1 database and Turnstile widget. Production uses `claude-audio-controls` and separate resources. Public resource identifiers are in Wrangler configuration; secret keys stay in ignored `.dev.vars.*` files and Worker secret bindings. Never place a Turnstile secret in `vars`, release configuration, browser bundles or GitHub artifacts.

Set each environment's secret with `wrangler secret put TURNSTILE_SECRET_KEY --config feedback/worker/wrangler.jsonc --env staging` (or production). Apply migrations only to the matching named database. Staging rewrites website links to its own origin, disables analytics, and disallows indexing. It cannot write to production D1.

The compatibility date is 2026-08-06, the maximum supported by the installed Miniflare/workerd runtime. Wrangler was updated to 4.158.0; the registry's latest standalone Miniflare was still 4.20260730.0. Advance the date with a runtime upgrade and passing tests.

For production: configure the new store IDs and dedicated GA4 measurement ID in `config/release.json`, complete `config/acceptance.json`, and run `bun run release:check`. Add the custom domain route only after acceptance. The workflow does not deploy on push.

The GitHub deployment workflow uses the environment-scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. Configure GitHub's `production` environment with a reviewer before enabling production dispatch. Extension publication is a separate manual, gated workflow. No store upload credential is inherited from the original project.

## Production website launch — 2026-11-06

The owner explicitly authorized launching the website before the extension release. Deployed version `fd51bcf4-b580-47c5-8a73-60e54f8baf0f` to the custom domain `claude-audio-controls.infoxica.com`. The homepage rendered successfully in the in-app browser. Command-line requests received a Cloudflare managed challenge (403), so automated store/crawler accessibility still needs checking. No security rules were changed. Store links remain disabled and the extension remains 0.1.0. The GitHub privacy policy at `https://github.com/infoxica/claude-audio-controls/blob/main/PRIVACY.md` was verified through the GitHub API. Earlier statements in this document about the production domain being unlaunched are superseded by this entry.

## Website branding update — 2026-11-06

Deployed version `ecbe650e-450d-4733-aff0-297cc8066b66` with the owner-supplied icon, editorial system-font pairing, and links to the assigned Chrome/Edge listings. Production homepage visually verified in the in-app browser, including both store URLs. Store publication remains pending; review links remain gated. No security rules, database bindings, or secrets changed.

## Homepage and carousel refinements — 2026-11-06

Production version `140a0287-8a19-4aab-9f01-ad6f1cdde8a0`: removed the hero Installation CTA and preview/version text; matched the reference site's desktop/store-availability note using existing localized copy. Carousel previous/next controls now use Lucide SVG arrows, and the native select has a decorative chevron inset 16 px with 44 px logical end padding. Existing responsive, localized, RTL and keyboard carousel browser check passed. Live homepage and rendered carousel icon count/spacing verified.

## Tour placement and support heading — 2026-11-06

Production website version `e43e3ff8-d922-4704-bae5-07cf96303916` applies the editorial serif font to the reviews heading; live computed style verified. Extension tour replay moved from above the popup tabs into an About action and the settings sidebar. Fixed the About introduction's inherited two-column layout and used the supplied brand icon there. Extension build, settings/popup browser check and ZIP packaging passed. Extension remains a local development build.

## Public Markdown access — 2026-11-06

With explicit owner approval, added `claude-audio-controls.infoxica.com` alongside the ChatGPT hostname in the existing public GET/HEAD exception within the `Block HTTP/1.1 Traffic` custom rule. All remaining rule conditions and other security rules were retained. This supersedes the launch entry's unresolved command-line 403.

Verified production requests: `Accept: text/markdown` returns 200 and `Content-Type: text/markdown; charset=utf-8`; `Accept: text/html` and `Accept: */*` return 200 HTML. Responses include `Vary: Accept`. The external isitagentready scan reports Markdown negotiation passing (local evidence: `build/agent-ready-scan.json`). Optional `x-markdown-tokens` is absent.

The existing Worker performs negotiation; no Worker deployment was needed. Cloudflare's native Markdown for Agents toggle remains disabled because it requires a paid plan on this zone. No plan upgrade was made.
