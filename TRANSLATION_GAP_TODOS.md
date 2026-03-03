# Tamil Translation Gap TODOs

Last updated: 2026-03-03
Scope: translation quality and i18n implementation for Tamil (`ta`) across the current branch.

## Completed In This Branch

- [x] Localized About page forecast technique prose and bullets via `about.*` translation keys.
  - Files: `src/app/about/about-content.tsx`, `src/lib/i18n/translations.ts`
  - Done when: Tamil mode has no leftover English sentence fragments in this section.

- [x] Fixed semantic mismatch in Tamil CMWSSB reservoir list (`Red Hills` included).
  - File: `src/lib/i18n/translations.ts`

- [x] Replaced hardcoded map loading strings with i18n keys.
  - Files: `src/app/groundwater/page.tsx`, `src/app/rivers/page.tsx`, `src/app/water-bodies/page.tsx`, `src/components/groundwater/ward-map.tsx`, `src/components/rivers/combined-rivers-map.tsx`, `src/components/water-bodies/water-bodies-map.tsx`

- [x] Localized Rivers and Water Bodies source overlays.
  - Files: `src/app/rivers/page.tsx`, `src/app/water-bodies/page.tsx`, `src/lib/i18n/translations.ts`

- [x] Localized water-bodies tooltip fragments and category values (`water_type`, `type`, `replaced_by`).
  - Files: `src/components/water-bodies/water-bodies-map.tsx`, `src/components/water-bodies/water-body-panel.tsx`, `src/lib/i18n/translations.ts`

- [x] Localized river names in pollution panel and stretch labels in river map/panel.
  - Files: `src/components/pollution/pollution-panel.tsx`, `src/components/rivers/combined-rivers-map.tsx`, `src/components/rivers/river-panel.tsx`, `src/lib/i18n/translations.ts`

- [x] Added translations for additional stretch values (`North Chennai`, `South Chennai`, `Lower (Ennore)`).
  - Files: `src/components/rivers/combined-rivers-map.tsx`, `src/components/rivers/river-panel.tsx`, `src/lib/i18n/translations.ts`

- [x] Localized `N/A`, `cusecs`, close-panel ARIA labels, theme toggle ARIA label, and language-toggle labels.
  - Files: `src/components/rivers/river-panel.tsx`, `src/components/dashboard/*`, `src/components/layout/*`, `src/lib/i18n/translations.ts`

- [x] Made date formatting locale-aware (`ta-IN`/`en-IN`) in key UI surfaces.
  - Files: `src/app/groundwater/page.tsx`, `src/components/dashboard/storage-trend-chart.tsx`, `src/components/dashboard/reservoir-detail-dialog.tsx`, `src/components/groundwater/ward-history-chart.tsx`

- [x] Removed hardcoded year from current-year legend and made it dynamic.
  - Files: `src/lib/i18n/translations.ts`, `src/components/dashboard/storage-trend-chart.tsx`

- [x] Localized remaining hardcoded UI strings in Reservoir Detail dialog.
  - File: `src/components/dashboard/reservoir-detail-dialog.tsx`
  - Includes: section titles, KPI labels, quick-fact labels, demo-note text.

- [x] Localized Groundwater ward history chart strings.
  - File: `src/components/groundwater/ward-history-chart.tsx`
  - Includes: chart title, empty/error states, tooltip labels, y-axis explainer.

- [x] Localized remaining hardcoded chart copy in river quality chart.
  - File: `src/components/rivers/river-quality-chart.tsx`
  - Includes: empty state and reference-line labels.

- [x] Localized groundwater snapshot stacked-bar tooltip text.
  - File: `src/components/dashboard/groundwater-snapshot.tsx`

- [x] Added i18n validation script and npm command.
  - Files: `scripts/check-i18n.mjs`, `package.json`
  - Command: `npm run i18n:check`

## Remaining TODOs

### P1: Translation parity edge case

- [x] Localize reusable dialog default close labels.
  - File: `src/components/ui/dialog.tsx`
  - Done:
    - Default close labels now resolve via i18n (`common.close`) in `DialogContent` and `DialogFooter`.
    - Added optional `closeLabel` / `closeText` props for explicit per-dialog overrides.

### P2: Quality and maintainability

- [ ] Introduce typed translation keys for compile-time safety.
  - Files: `src/lib/i18n/translations.ts`, `src/lib/i18n/context.tsx`
  - TODO:
    - Export `TranslationKey = keyof typeof translations`.
    - Change `t` signature to typed key usage (with controlled escape hatch for dynamic keys).
  - Done when:
    - Invalid translation keys fail TypeScript checks.

- [ ] Strengthen i18n static checks for dynamic and JSX hardcoded strings.
  - File: `scripts/check-i18n.mjs`
  - TODO:
    - Add heuristics for likely user-facing hardcoded strings in JSX text nodes and ARIA attributes.
    - Keep false positives manageable via allowlist.
  - Done when:
    - CI warns/fails on newly introduced obvious hardcoded UI text.

- [ ] Add CI gate for i18n checks.
  - Files: project CI config + `package.json`
  - TODO:
    - Run `npm run i18n:check` in PR pipeline before merge.
  - Done when:
    - Translation regressions fail CI automatically.

### P3: UX polish

- [ ] Avoid first-paint language flash for Tamil users.
  - Files: `src/lib/i18n/context.tsx`, `src/app/layout.tsx`
  - TODO:
    - Server/bootstrap initial language from cookie or inline script.
  - Done when:
    - Returning Tamil users do not briefly see English on initial paint.

- [ ] Add a Tamil QA checklist for release validation.
  - Suggested file: `docs/i18n-qa-checklist.md`
  - TODO:
    - Cover all pages: headers, loaders, tooltips, charts, overlays, ARIA labels.
    - Include data-backed Tamil fields (`*_ta`) validation.
  - Done when:
    - QA can execute a repeatable pass before each deploy.
