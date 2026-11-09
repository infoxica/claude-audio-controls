# Manual store publishing

Workflow: `.github/workflows/publish-stores.yml`. Pushes, tags, PRs and GitHub releases never trigger it. Existing release.yml remains draft-only.

## Credentials

Create the GitHub environment **store-publishing** under Settings → Environments. Restrict deployment branches to main; add a required reviewer if available for the repository plan. Add these environment secrets (repository Actions secrets also work):

| Secret | Source |
| --- | --- |
| CHROME_CLIENT_ID | Google Cloud OAuth client with Chrome Web Store API enabled |
| CHROME_CLIENT_SECRET | Secret for that OAuth client |
| CHROME_REFRESH_TOKEN | Refresh token authorized by the publisher account with https://www.googleapis.com/auth/chromewebstore scope |
| CHROME_PUBLISHER_ID | Publisher ID from Chrome Web Store Developer Dashboard |
| EDGE_CLIENT_ID | Partner Center → Microsoft Edge → Publish API client ID |
| EDGE_API_KEY | API key from the same Publish API credentials (v1.1 authentication) |

Never put credentials in source, release notes, or chat. Use the GitHub secrets UI or `gh secret set NAME --env store-publishing` interactively. Existing account-scoped credentials may work for both projects if their account has permission, but GitHub secret values cannot be read back/copied from the other repository.

Extension/product IDs are already read from config/release.json: Chrome phpfodemdjccejlpchbeeehjdgaldldi; Edge product f1731e82-6348-48bb-94a2-58ae42b06efa. No extra ID secrets are needed. The Edge product GUID is different from its public extension ID.

## Run

1. Complete live acceptance and store listing metadata. The workflow retains release:check for actual submissions.
2. Open Actions → Publish to browser stores (manual) → Run workflow on main.
3. Leave publish_to_stores unchecked to run validation/package generation only. Neither store job runs in this mode.
4. When ready to submit, check publish_to_stores and choose chrome, edge or both. This is an explicit submission request, not a draft-only upload. Store approval may make the extension public.
5. Wait for upload and submission status. A successful API call is not certification or proof of public availability. Verify the dashboards separately.
6. For one failed store, retry only that store to avoid submitting the successful store again.

## First release and limitations

Edge's Update API requires an existing published extension. Complete the first Edge publication in Partner Center, verify it is live, then set edgeListingLive=true. Until then Edge submissions (including both) fail before either publishing job starts. Chrome can be selected independently.

Listings, descriptions, screenshots, privacy declarations and logos are managed in the store dashboards. Edge API updates do not fill metadata. The workflow uploads localized Edge listing inputs as a review artifact.

No credentials are embedded and no store submission was performed while adding this automation. The current 1.0.0 GitHub draft is unchanged.

## References

- https://developer.chrome.com/docs/webstore/using-api
- https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api
