# 1.0.0 release candidate

Prepared for review; not published or submitted.

## Before publication

- Complete the outstanding real-browser, native PCM, single-player, Android/macOS and userscript checks in ACCEPTANCE.md.
- Record version-specific evidence in config/acceptance.json; do not copy preview approvals to 1.0.0 without verification.
- Upload Edge artwork; review both store drafts and localized descriptions.
- Verify production sitemap.xml, sitemap.md, agents.md and Markdown page URLs return 200 from external clients; rerun the external scan.
- Run typecheck, unit/browser tests, site HTTP tests, package and release:check.
- Review the candidate ZIP and userscript before store submission.

Store publication, Git tags, GitHub releases and listing-live flags remain unchanged.

## Validation on 2026-11-06

- Extension build, version consistency and ZIP packaging passed; candidate: dist-zip/claude-audio-controls-v1.0.0.zip.
- 51 unit tests and 3 site HTTP tests passed.
- Browser suite: 27/28 passed initially; remaining reminder test passed after waiting for asynchronous persistence with expect.poll.
- Production sitemap.xml, sitemap.md, index.md, guide/index.md and installation/index.md returned HTTP 200.
- Public agents.md was generated and deployed, but its external request still returns HTTP 403. The edge access rule must be diagnosed before claiming the agent scan is fixed; no security rule was changed.
- release:check remains blocked by incomplete version-specific live acceptance. Both store listings remain drafts.

## Readiness review — 2026-11-10

### Prepared

- Rebuilt 1.0.0 ZIP and userscript from the working tree, including Split · Bottom. SHA-256 checksums: dist-zip/SHA256SUMS.txt.
- Build/typecheck, 53 unit tests, 30 browser tests, 3 site HTTP tests, feedback typecheck, and exact distribution/ZIP audit passed.
- User-facing release notes: RELEASE-NOTES-1.0.0.md.
- Last pushed branch commit c8b0c40 passed CI: https://github.com/infoxica/claude-audio-controls/actions/runs/42353772433 . This does not cover the uncommitted split-layout changes.

### Before launch

1. Commit/push the current layout changes and release documents; require CI on that exact commit. Main remains at fb882dc.
2. Complete and record version-specific live acceptance. config/acceptance.json is still for 0.1.0; native PCM, single audible playback, Windows/macOS browsers, physical Edge Android, real userscript operation, and translation review remain incomplete. Do not relabel old evidence as 1.0.0 acceptance.
3. Verify store dashboards, Edge artwork, and the uploaded package version. Public listing retrieval was inconclusive today; saved listing-live flags remain false. Do not assume publication or submission from IDs alone.
4. Resolve production agents.md HTTP 403 and rerun external discovery scan. sitemap.xml, sitemap.md and index.md returned 200 today.
5. Decide separately whether open feedback PRs #1 and #2 belong in the first release. They were not merged into this candidate.
6. Once release:check passes, merge the reviewed release branch, prepare the GitHub draft with the version-specific release notes and checksums, and review store submissions. Enable listing-live flags only after public availability is verified.

No store submission, merge, tag, release publication, or website deployment was performed in this review.

### Artifact SHA-256

```
3d707a07151d44fa762da071d651b06892cb92ade4dc41f68591ce3b0c65a2ad  claude-audio-controls-v1.0.0.zip
0fd4985301d13b910c30720733247ec3355a4dbe286a08f3506f7a1ff43f14d1  claude-audio-controls.user.js
```
