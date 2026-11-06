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
