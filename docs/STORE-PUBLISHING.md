# Store publishing

Workflow: `.github/workflows/release.yml` (CI & Release), following the reference extension's release policy with main in place of master.

- Pushes to main/develop and PRs targeting them run validation.
- A numeric version increase in public/manifest.json on a push to main automatically submits both stores after verification and release:check.
- Ordinary same-version commits do not submit anything.
- A v* tag creates a GitHub release after validation; it does not independently submit stores.
- A version-increase push to main also creates the GitHub release.
- Manual dispatch defaults to publish_to_stores=no; choose yes and a store for an explicit retry.

The previous standalone manual publishing workflow has been removed. The GitHub draft stays unchanged until an eligible release trigger runs.

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
2. Open Actions → CI & Release → Run workflow on main.
3. Leave publish_to_stores=no to run validation/package generation only. Neither store job runs in this mode.
4. When ready to submit, choose publish_to_stores=yes and choose chrome, edge or both. This is an explicit submission request, not a draft-only upload. Store approval may make the extension public.
5. Wait for upload and submission status. A successful API call is not certification or proof of public availability. Verify the dashboards separately.
6. For one failed store, retry only that store to avoid submitting the successful store again.

## First release and limitations

Edge's Update API requires an existing published extension. Complete the first Edge publication in Partner Center, verify it is live, then set edgeListingLive=true. Until then the Edge submission script refuses to call the API. Chrome and Edge jobs run independently, as in the reference. Chrome can be selected independently.

Listings, descriptions, screenshots, privacy declarations and logos are managed in the store dashboards. Edge API updates do not fill metadata. The workflow uploads localized Edge listing inputs as a review artifact.

No credentials are embedded and no store submission was performed while adding this automation. The current 1.0.0 GitHub draft is unchanged.

## References

- https://developer.chrome.com/docs/webstore/using-api
- https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api
