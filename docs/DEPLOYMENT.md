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
