# Browser test boundaries

These tests load the unmodified production extension into a disposable Chrome for Testing profile.
The supported website URLs are fulfilled with self-authored, redacted HTML fixtures; passing these tests is
not evidence of real-site or signed-in compatibility.

`permissions.spec.ts` uses an ungranted profile and checks that installation grants no website access
and that the background rejects unauthorized activation. Other tests grant the five declared hosts in
the disposable profile through Chromium's extension-management page before exercising the real UI,
background, storage, registered content scripts and permission removal. This avoids the native
permission bubble, which Playwright cannot accept in headless mode. No production permissions are
added and no browser APIs in the shipped extension are mocked.

Native permission acceptance/refusal remains a manual acceptance item in `docs/VALIDATION.md`.

To run the same fixtures against an installed Microsoft Edge, build with `npm run build:edge`
and set `QUIETFEED_EDGE_EXECUTABLE` to the local `msedge.exe` path before `npm run test:e2e`.
The default uses Chrome for Testing and the Chrome build. Both modes use disposable profiles.
