# Initial store drafts

Use `dist-zip/claude-audio-controls-v0.1.0.zip` to create the initial Chrome and Edge drafts. Keep these uploads unpublished while obtaining identifiers and completing the production release.

1. Chrome Developer Dashboard: add a new item and upload the ZIP. Record the assigned 32-character item ID.
2. Edge Partner Center: create a new extension and upload the ZIP. Record both the dashboard product ID and, when available, the 32-character add-on ID. The product ID is not the public add-on ID.
3. Save public item/add-on IDs in `config/release.json`. Do not use the unpacked development extension ID. Keep `chromeListingLive` and `edgeListingLive` false while the listings are drafts so installation and review links stay unavailable.
4. Finish the remaining acceptance checks in `docs/ACCEPTANCE.md`, prepare version 1.0.0, rebuild all deliverables, and replace the draft packages before submission.
5. Once a listing is publicly available, verify its URL and enable its corresponding `ListingLive` flag. Rebuild the extension/userscript and website so Review and installation links become available.

The initial drafts do not establish production acceptance. The existing release checks remain in place.

## Recorded identifiers

- Chrome item ID (provided by the owner): `phpfodemdjccejlpchbeeehjdgaldldi`.
- Edge CRX/add-on ID (verified in Partner Center): `gabdlfkfofnclhnpcmdfikijmmckpcee`.
- Edge Store ID: `0RDCKB1MGZ72`.
- Edge product ID: `f1731e82-6348-48bb-94a2-58ae42b06efa`.
- Edge overview confirms version 0.1.0 is **In draft**, with the package step complete. Availability, properties, privacy, and store listings remain incomplete. Its public URL is unavailable until publication.

Chrome's draft was created by the owner; browser automation cannot inspect that dashboard. Both public-link flags remain false.

References: [Chrome upload workflow](https://developer.chrome.com/docs/webstore/publish), [Edge upload workflow](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).
