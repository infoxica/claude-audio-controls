# Feedback service

## Optional feature and symptom answers

Bug/broken reports may include optional feature and symptom choices. Neither choice nor a note is required. Choosing a category and pressing Send remains sufficient; GET, Skip, close and choosing a chip never submit. Changing away from bug/broken clears optional context. These are categorical user answers, not automatically observed diagnostics. No new permissions, installation identifiers, telemetry, attachments or external messaging are added.

Older payloads omit `form_version` or use 1 and keep their exact canonical hash: `JSON.stringify([source,reason,comment,locale,version,browser,os,1])`. V2 uses `JSON.stringify([source,reason,comment,locale,version,browser,os,2,featureOrNull,symptomOrNull,2])`. Omitted optional values and null canonicalize identically. A symptom requires a feature. Only bug/broken answers may carry context. The new form sends v1 unless a feature is selected. Retry identity, Turnstile and changed-answer conflicts are unchanged. Diagnostic and consent attachment keys are rejected while that capability is disabled.

For a later reviewed deployment, back up the intended source database using its approved process, apply additive migration `0002_optional_feedback_context.sql` in staging, then deploy the compatible Worker/form and verify old/new submissions. Repeat only through the owner-approved production process. No remote migration is part of this PR. Nullable columns can remain when rolling Worker code back to v1; do not drop columns during rollback. V1 requests also continue to work on the old schema. A v2 request before migration fails closed without reporting success.

New optional labels use existing feature translations and a separate complete prompt/symptom catalog for every supported locale. Translation review is welcome; no language silently falls back to English. Diagnostics require a separate privacy/consent/manifest review and remain disabled.
