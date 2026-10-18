# Citizen reports (sightings)

Developer reference for the module behind `/for-citizens`. Code name in paths and tables: `sightings`. Introduced in #465; `create_sighting` reworked for the Supabase CLI in #469; reporting flow, place search, early filing and the review alert in #471. Checked against the code on 17 Oct 2026, including the updates, notifications, department channel, nods, follows, groups and clean-ups (migration 063).

## 1. What it is

- A signed-in citizen sends a photo-backed observation about water at a place: trash or sewage in a lake, unsafe tap water, a burst pipe, an encroachment, a home water-test result, or good news.
- The server binds the GPS point to a covered place (city ward, district Gram Panchayat, or river basin). A reviewer approves or rejects it.
- Approved reports appear on that place's public pages: ward page, water-body panel, district and GP pages, basin atlas.
- Each report kind maps to a role, and the role maps to the public body that handles it, with that body's official complaint channels. The citizen files there if they choose, then records the reference number and status (reported, marked done, fixed, still there) on the report.
- Out of scope (`src/lib/sightings/taxonomy.ts`, header): tankers, water bills, supply timings. They arrive as "other" reports and are kept, not routed.

## 2. Switch and switch-on checklist

### The flag

`NEXT_PUBLIC_CITIZEN_REPORTS=on`. A `NEXT_PUBLIC_` variable is inlined at build time, so a change needs a redeploy.

| Surface | Flag off |
|---|---|
| "For citizens" nav link, `src/components/layout/header.tsx` | hidden |
| `/for-citizens`, `src/app/for-citizens/page.tsx` | 404 |
| `/admin/sightings`, `src/app/admin/sightings/page.tsx` | 404 |
| `PlaceReports` on place pages | renders nothing, sends no request |
| API routes | gated by `reportsEnabled()` in `src/lib/sightings/auth.ts` (below) |

`reportsEnabled()` needs all four: the flag is `on`, `NEXT_PUBLIC_SUPABASE_URL` is set, `SUPABASE_SERVICE_ROLE_KEY` is set, and `SIGHTINGS_REPORTER_KEY_SECRET` is at least 32 characters. When it is false, signed-in routes return 404 `Not available` and the public `GET /api/sightings` returns `{ data: [] }`. The pages check only the flag, so "page renders, sign-in works, every API call 404s" means one of the other three is missing.

### Environment variables

| Variable | Read in | Secret | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_CITIZEN_REPORTS` | header, both pages, `place-reports.tsx`, `auth.ts` | no | `on` turns the module on |
| `NEXT_PUBLIC_SUPABASE_URL` | `auth.ts`, `photos.ts` (`publicPhotoUrl`), `use-citizen.ts` | no | Supabase project URL. Must be the host listed in the CSP |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `use-citizen.ts` | no (public by design) | Browser sign-in only. Without it the page shows "Reporting is unavailable right now." |
| `SUPABASE_SERVICE_ROLE_KEY` | `auth.ts` `adminClient()` (the only reader under `src/`) | yes | Every table, RPC and storage call, plus `auth.getUser` and `auth.admin.deleteUser` |
| `SIGHTINGS_REPORTER_KEY_SECRET` | `auth.ts` `reporterKey()` | yes; never change once live | HMAC key that turns an account id into the stored reporter tag. Generate with `openssl rand -hex 32` |
| `SIGHTINGS_REVIEWER_IDS` | `auth.ts` `isReviewer()` | keep private | Comma-separated Supabase auth user ids allowed to review |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | `locate-server.ts` `getJson()` | yes | Sent as `x-vercel-protection-bypass` when the server fetches its own geometry. Needed on any deployment behind Vercel Deployment Protection; without it every point resolves as "outside" |
| `SIGHTINGS_DEPARTMENT_LINK_SECRET` | `departments.ts` | yes | Signs each department's private status link (`openssl rand -hex 32`). Missing or under 32 characters: the department channel is off. Changing it replaces every link |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `notify.ts`, `notify-toggle.tsx` | private key yes | Web Push keys for opt-in notifications. The public key is inlined at build time; without both keys the toggle hides and notices are skipped |
| `CRON_SECRET` (Vercel and GitHub) | `/api/cron/sightings-nudges` | yes | Bearer token for the daily nudge; the same value in Vercel and the repository secret |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (GitHub Actions secrets) | `.github/workflows/citizen-reports-review.yml` | yes | Daily review-queue count (section 2, Review alert) |

None of the `SIGHTINGS_*` variables or the flag are in `.env.example`.

### Why `SIGHTINGS_REPORTER_KEY_SECRET` must never change

`reporterKey(userId)` is `HMAC-SHA256(secret, auth user id)` as 64 hex characters (`src/lib/sightings/auth.ts`). The database stores only this tag, and every request recomputes it from the current secret:

- `GET /api/sightings/mine` selects `reporter_key = reporterKey(user.id)`.
- `POST /api/sightings/[id]/events` treats the caller as owner only if `row.reporter_key === key`.
- Caps, the trusted flag and suspension live on `sighting_reporters.reporter_key`; `create_sighting` counts rows by it.
- The duplicate-photo index is `(reporter_key, sha256)`.
- `DELETE /api/sightings/mine` finds what to delete by it.

A new secret gives every account a new tag. Reporters lose their list and cannot update status; suspensions and trusted status are lost; and delete-account no longer finds old rows, so unpublished reports and their photos would survive the deletion the privacy page promises. There is no mapping back, by design. No rotation script exists. A rotation would have to compute old and new tags for every auth user and rewrite `reporter_key` (three tables) and `actor_key` (`sighting_events`) in one transaction.

If the secret leaks, anyone holding it and the auth user list can link reports to accounts.

### Supabase setup

1. Apply `supabase/migrations/062_citizen_reports.sql` (one file at a time: `supabase db query --linked -f <file>`, see `docs/architecture/database-reconciliation-2026-08-20.md`). Then reload the PostgREST schema cache (`notify pgrst, 'reload schema';`), or the API sees neither the tables nor the RPC.
2. Check both buckets exist: `sightings-intake` (private) and `sightings-public` (public), 2 MB limit, `image/webp` only. 062 inserts them with `ON CONFLICT DO NOTHING`, so a bucket that already existed keeps its old settings.
3. Auth, Providers: enable Google. Auth, URL configuration: add `<origin>/for-citizens` for every origin in use (production, `http://localhost:3000`, any preview), because `signInWithOAuth` redirects there (`use-citizen.ts`).
4. Turn anonymous sign-ins off, and any other provider not meant for citizens (email, phone). `requireUser` accepts any valid Supabase access token and never checks the provider, so each anonymous or email account would get its own tag and a fresh set of caps.
5. Reviewer: sign in once at `/for-citizens`, copy the user id from Auth, Users, add it to `SIGHTINGS_REVIEWER_IDS`, redeploy.
6. Set the variables in Vercel (Production, and Preview if previews should take reports) and redeploy with the flag on.

`.env.local` points at the same Supabase project as production (the CSP host). Reports sent from local dev land in the production tables and count toward the site-wide caps.

### Review alert

`.github/workflows/citizen-reports-review.yml` runs daily at 09:00 IST (and on demand). It counts `received` reports and unpublished `fixed` photos through PostgREST with the service key, reading no row's content, and keeps one GitHub issue, "Citizen reports waiting for review", labelled `citizen-reports` and assigned to the repository owner so GitHub notifies them:

- queue fills: the issue opens;
- new items since the last run (the issue's own update time): a comment;
- every run: the body is rewritten with the counts and how many whole days the oldest has waited;
- queue empty: the issue closes.

The repository is public, so the issue carries counts and whole days only, never an id, place, type, photo or hour. That is also why it runs once a day: an hourly public signal would date a report to its hour, and `/for-citizens` promises the time of day is never shown.

### Headers that matter (`next.config.ts`)

| Header | Entry | Why this module needs it |
|---|---|---|
| CSP `img-src` | `https://qlwnafrcfajosvbdswyf.supabase.co` | Public photos and 1-hour signed URLs for unpublished photos |
| CSP `img-src` | `https://*.tile.openstreetmap.org` | Location map tiles (`useMapTiles` in `src/lib/utils/map-tiles.ts`) |
| CSP `connect-src` | the same Supabase host | Browser auth: PKCE code exchange and token refresh |
| `Permissions-Policy` | `geolocation=(self)` | "Use my location" in the report flow (the comment in `next.config.ts` cites only the basin atlas) |
| `Permissions-Policy` | `camera=()` | Kept: photos come from `<input type="file" accept="image/*" capture="environment">`, which hands off to the device camera app, not `getUserMedia` |

The Supabase host is hard-coded in the CSP. Pointing the app at another project needs the CSP changed too. Place search needs no CSP entry: the browser calls `/api/sightings/search`, and the server calls Nominatim.

## 3. Architecture at a glance

```
Browser: /for-citizens, /admin/sightings
  |  Google sign-in through Supabase Auth (anon key, PKCE) ------> Supabase Auth
  |  every API call: Authorization: Bearer <access token>
  v
Next API routes, Node runtime: src/app/api/sightings/**
  requireUser       auth.getUser(token) with the service role
  reporterKey       HMAC(secret, user.id): the only identity stored
  placePoint        GET own static files: /geojson/*, /data/atlas/*, /data/basins/*
  viewOf            same files: where the map opens for a report started on a place page
  search            proxy to nominatim.openstreetmap.org (India, 5 hits, cached per instance)
  storePhotos       magic bytes, EXIF read, sharp -> WebP
  |  service-role client only (RLS on, no policies: anon and authenticated keys get nothing)
  v
Supabase Postgres                              Supabase Storage
  rpc create_sighting (caps + insert)            sightings-intake  (private)
  sightings, sighting_photos,                       | approve: copy, then remove
  sighting_events, sighting_reporters               v
                                                 sightings-public  (public URLs)

Public read path
  place page -> PlaceReports -> GET /api/sightings?place=..  -> toPublic() -> ReportCard
  ReportCard <img> -> sightings-public object URL (no API hop)
  handler -> resolveAuthority() over src/lib/sightings/routing (static TS, no DB)
  PlaceReports link -> /for-citizens?place=..  (query kept in sessionStorage across sign-in)
                    -> GET /api/sightings/locate?place=..  -> map opens there

Review alert
  .github/workflows/citizen-reports-review.yml, daily 09:00 IST
  counts received reports and unpublished fixed photos through PostgREST (service key)
  one GitHub issue labelled citizen-reports, assigned to the repo owner:
  opened when the queue fills, commented when new items arrive, closed when empty
```

- The anon key is used only for sign-in. No browser code reads or writes a sightings table or bucket.
- Placement is resolved at write time and stored on the row. Changing geometry later does not move old reports.
- Routing is resolved at read time from TypeScript; only `authority_role` is stored. A routing fix reaches every existing report on the next deploy.

### Component map

| File | Renders or does |
|---|---|
| `src/app/for-citizens/page.tsx` | Page shell (404 unless flag), header copy, "How it works" (`GUIDE`), "Where you can report" (built from the same city, district and basin lists `placePoint` uses) and "How we protect you" (`PROMISES`); mounts `CitizenApp`. `PROMISES` is the public privacy text: keep it in step with section 5. `GUIDE` quotes `REVIEW_WITHIN_DAYS` |
| `src/components/sightings/citizen-app.tsx` | Signed-out vs signed-in; "New report", "My reports" and "Groups" views (keeps `?join=` across sign-in); review-queue link for reviewers; loads `/api/sightings/mine`; keeps a place page's `?place=` query across sign-in and asks `/locate?place=` where to open the map |
| `src/components/sightings/report-flow.tsx` | The capture flow: photos, type tiles (`ICONS` maps group icon names), location (GPS, map, place search), readings, submit; after sending, shows the handler and lets the reporter record filing at once |
| `src/components/sightings/photo-blur.tsx` | Pixelates faces, plates or house names on the phone before upload |
| `src/components/sightings/reminder.tsx` | Builds an `.ics` reminder in the browser; nothing is sent |
| `src/components/sightings/location-map.tsx` | Leaflet map with a draggable pin (import with `ssr: false`) |
| `src/components/sightings/handler-card.tsx` | `HandlerCard` (body, channels, "what to expect" once per system) and `NationalOnly` |
| `src/components/sightings/my-reports.tsx` | Reporter's own list, status updates, two-week stale prompt, CSV/JSON download |
| `src/components/sightings/groups-panel.tsx` | Start, join, leave a group; the host's invite link; `useMyGroups` (also used by the Send step and `FixitActions`) |
| `src/components/sightings/account-actions.tsx` | Sign out; delete account (optionally with published reports) |
| `src/components/sightings/review-app.tsx` | Review queue at `/admin/sightings`: approve (with reclassify and candidate label), reject, suspend, publish or discard fixed photos. Flags a photo taken over 30 days before sending or over 1 km from the pin |
| `src/components/sightings/place-reports.tsx` | `PlaceReports`: public cards for a place, plus a "Report something" link to `/for-citizens` with the same query (call sites in section 6) |
| `src/components/sightings/report-card.tsx` | `ReportCard`, `Status`, `Readings`, `History`, `day()`; a quiet line with the group and the counts |
| `src/components/sightings/community-actions.tsx` | `CommunityActions` on every public card: "I've seen it too", "It's gone", "I want to help" (follow, clean-up) on open reports; "Thank you" on fixed ones; nothing on home reports |
| `src/components/sightings/fixit-actions.tsx` | A planned clean-up with "I'll come", or "Plan a clean-up" for a host of a reviewed group |
| `src/components/sightings/share-guide.tsx` | Share sheet, WhatsApp, copy link |
| `src/components/sightings/use-citizen.ts` | Browser Supabase client (storage key `nv-citizen-auth`), Google sign-in, `authFetch`, `readPhotoMeta`, `shrinkPhoto` |
| `src/components/sightings/action-feedback.tsx`, `ui.ts`, `display-font.ts` | Busy buttons and "Saved" flashes, shared classes, Newsreader as `--font-display` |

### The reporting flow

**Signed out** (`citizen-app.tsx`): the headline, Google's own sign-in button (Google's branding rules fix its mark and wording), one privacy line, how many cities, districts and basins are covered with a link to the list, and three steps. "How it works" and "How we protect you" are closed lists below.

**Signed in**: New report or My reports; a Review queue link for reviewers; Sign out and Delete account at the top right.

**New report** (`report-flow.tsx`): one decision per screen. `blockers` names why a screen cannot move on; it shows beside Next on wide screens and inside the sticky bottom bar on phones.

| Step | What happens |
|---|---|
| Photo | Phones: Take a photo (camera) or Choose from gallery. Desktops: choose or drop. Up to 3, each removable and each can be blurred (`photo-blur.tsx`). The pin comes from the photo's GPS; else from the phone's location, but only for a camera photo, since a gallery photo may be from anywhere; else the reporter chooses "I am at the spot: use my location" or places it on the map in step 3. The place is named from `/locate` as soon as there is a pin. A point outside coverage blocks Next, with "The location is wrong" to clear the pin. A photo over 30 days old gets a warning |
| What | Eight group tiles plus Something else, and a "Have water test results? Add them" shortcut to Tap & drinking water, Water test results. Then the closest type; water source for tap water; for a test, the readings, each checked against BIS IS 10500 as it is typed |
| Where | Place search, then a tap-or-drag map. The map opens on a search result, else the place page the report started from, else the pin, else India. Photo's location and My location buttons. Tap-water reports say they show at ward or village level only |
| Send | The summary (built live beside the steps on wide screens), an optional note for the reviewer (never published), one privacy line |

**After sending**: the review time (`REVIEW_WITHIN_DAYS`), any readings, who handles it and their channels, "Filed it already? Save the reference number" (an early `reported` event), and "Remind me in two weeks" (`reminder.tsx`, a calendar file built in the browser).

**My reports** (`my-reports.tsx`): counts (being checked, open, fixed); reports with no update for 14 days first. Each opens to its updates: I reported it (body and reference), Department says it's done, It is fixed (a new photo, reviewed before it is published), Still there. The two one-tap updates wait 5 seconds (`UNDO_MS`) with an Undo, and save at once if the report closes meanwhile (closing the browser tab in those 5 seconds drops the update). A report being checked offers only I reported it. Each report also offers the two-week reminder; the list downloads as CSV or JSON.

**Public cards** (`report-card.tsx`, `place-reports.tsx`): photo, type, place and date. Status words name no body (`CASE_LABELS`: Not yet reported, Reported, Department says done, Fixed, Closed), because the reporter records them, and a named body beside "not yet reported" would read as blame. A footnote says updates come from the resident who reported it. A place with no reports yet shows only "Seen something here? Report it". Its link carries the place, ward, water body or panchayat, which survive the Google sign-in round trip in `sessionStorage` (`nv-report-from`) and open the map there through `/locate?place=`.

User-facing text in this module uses no em dashes and no middle dots as separators.

## Updates after publishing: residents, departments, notifications (migration 063)

`supabase/migrations/063_citizen_reports_updates.sql` must be applied before switch-on. It widens `sighting_events.actor_role` to `resident` and `department`, adds the events `fix_submitted`, `fix_rejected`, `action_taken`, `not_ours`, `seen_too` and `thanks`, creates `sighting_push_subscriptions` (endpoint, reporter_key, keys; RLS on, no policies), adds `sightings.nudged_at`, `sightings.test_meta` and `sightings.group_id`, and creates `sighting_follows`, `sighting_groups`, `sighting_group_members`, `sighting_fixits` and `sighting_fixit_rsvps` (all RLS on, no policies).

**Who can move a report** (`POST /api/sightings/[id]/events`, `POST /api/sightings/department`):

| Who | How | Can say | Limits |
|---|---|---|---|
| The reporter | My reports | reported (also while being checked), department says done, fixed (with a photo), still there | 5 per report per day |
| Anyone else signed in | the card on the place's page or map | still there (recorded by "I've seen it too"); it's gone (a fixed photo) | 1 per report per day, 20 a day in all; published, open, community reports only |
| The handling department | its private link | action taken (status: department says done), not ours (recorded only), closed | 5 per report and 300 a day per department |
| Our reviewer | review queue | approve, reject, publish or discard a fixed photo, close, reopen | none |

A fixed claim from anyone but a reviewer is recorded as `fix_submitted` and does not move the status. Publishing its photo in the review queue records `fixed` and moves the status; discarding it records `fix_rejected` and tells whoever sent it. Only one fixed photo can wait at a time. Public history labels each update by who made it (", by someone nearby", ", by the department"); `fix_submitted`, `fix_rejected` and `not_ours` stay private.

**Notifications** (`src/lib/sightings/notify.ts`, `push.ts`, `public/citizen-sw.js`, `notify-toggle.tsx`): opt-in Web Push, keyed to the reporter tag only; no email, no phone. Permission is asked only on tap; iPhone needs the site on the home screen. Notices: published, not published, someone nearby says it is still there, fixed (after the photo is checked), a fixed photo not accepted (to its sender), a department update, and a nudge after 14 days with no update from anyone. Notices are sent after the response (`after()`), never fail the action, and carry nothing personal. `POST/DELETE /api/sightings/push` saves or removes this browser's subscription (5 per reporter, push services of Google, Mozilla, Apple and Microsoft only). Signing out unsubscribes the browser; deleting the account deletes the rows. The nudge runs daily at 10:00 IST (`.github/workflows/citizen-reports-nudges.yml` calls `POST /api/cron/sightings-nudges` with `CRON_SECRET`); it only considers reporters with notifications on and sets `nudged_at` once a browser received it.

**Department channel** (`src/lib/sightings/departments.ts`, `/department/[token]`, `department-app.tsx`): one department per handling body, keyed by a hash of state code and body name. Its link is `<origin>/department/<key>.<sig>` (HMAC under `SIGHTINGS_DEPARTMENT_LINK_SECRET`); the page is unlisted, noindex, no-referrer, and disallowed in `robots.ts`. It lists that body's checked reports (open first) with photos, type, place text, India date, status and history, never anything about the reporter; the same rounded point as public pages, with an "Open in map" link; each item can be marked, and the page prints as a summary to hand over. The reviewer copies each department's link from the Departments section at `/admin/sightings` (`GET /api/sightings/department/links`). One link cannot be revoked on its own; rotating the secret replaces them all. Matching loads approved rows and resolves each in memory (fine to about 20,000 rows; store the key on the row before then).

## Taking part: nods, follows, groups and clean-ups (migration 063)

Reasons to come back without turning reports into a feed: no likes, comments, names or ranks. Everything here needs sign-in, and nothing here applies to a home report (tap water, water tests; `isCommunityReport` in `taxonomy.ts`), in the UI or on the server.

**Nods** (`POST /api/sightings/[id]/events` with `seen_too` or `thanks`; `CommunityActions`):

- "I've seen it too": open community reports, not by their own reporter (403). Once per person (unique index `uq_sighting_events_once`; a repeat is a success that changes nothing). The first tap also records `still_there` for that person unless they recorded one in the last 24 hours, moving the status as `still_there` does. The reporter is told at 1, 3, 10 and 25 people (`community.ts`), never on every tap.
- "Thank you": fixed community reports, anyone signed in including the reporter, once per person, no notice.
- Both return `{ seenCount, thanksCount }`. Counts appear on public cards ("Seen by 12 people", "Thanked by 3 people"); nods never appear in the history. Public cards are cached and carry nothing about the viewer, so after a reload the button is back and a second tap is a no-op.
- Limits: a nod counts once toward the resident 20-a-day cap (the cap leaves out `seen_too` and counts the `still_there` it records). The `still_there` it records uses the one-update-per-report-per-day limit, so "It's gone" from the same person waits a day.

**Follows** (`/api/sightings/follows`, table `sighting_follows`): "I want to help" > "Follow this place" stores the report's most specific place key (`followTarget`: `body:<id>`, `<place>:gp:<code>`, `<place>:ward:<n>` or the place id; `follows.ts`). At most 50 per person. `notifyFollowers` tells followers when a report there is published, its fixed photo is published, a department updates it or a clean-up is planned; at most 200 notices per event; never for home reports. My reports lists "Places you follow" with "Stop following", and a private line ("Your reports were seen by 23 people nearby and thanked 4 times").

**Groups** (`/api/sightings/groups`, `groups.ts`, `groups-panel.tsx`, the "Groups" tab): colleges, schools, residents' associations, lake groups, NGOs. A group is a name; its members are tags.

- Start: name 3 to 80 characters with a letter, one of six kinds, optional city or district. At most 3 started (rejected ones count) and 10 joined per person; suspended accounts cannot start one. The starter hosts. A group waits for a reviewer (review queue, "Groups waiting for review"; the daily review alert counts them); hosts are told the outcome.
- Join: by invite link `/for-citizens?join=XXXX-XXXX-XXXX` (12 characters from crypto random bytes, no I, O, 0 or 1), which survives the Google sign-in. Pending and approved groups can be joined; rejected ones cannot. Hosts can make a new link.
- Leave (and account deletion, via `settleGroup`): an empty group never reviewed is deleted; a reviewed one stays so its reports keep its name; a group left without a host gets its longest-standing member as host. Account deletion also sets `created_by` on groups and clean-ups to `deleted`.
- "Send with": on the Send step, for members of an approved group, community reports only (a group name beside a ward-level home report would narrow down who sent it). The submit route checks membership, approval and the category again. Public cards show "Sent with <group>"; `/for-citizens` lists "Groups taking part" with reports sent, how many are fixed and clean-ups done (no members), revalidated every 5 minutes, empty on a database error.

**Clean-ups** (`/api/sightings/fixits`, `fixit-actions.tsx`, table `sighting_fixits` and `sighting_fixit_rsvps`):

- Only a host of an approved group, only on an approved community report of a `FIXIT_TYPES` type (litter, floating trash, plastic, ritual waste) whose status is open (`OPEN_STATUSES`). Never sewage, drains, hazardous, medical or burning waste, dead animals or debris: unsafe for volunteers, and manual scavenging is illegal.
- Start 2 hours to 60 days ahead, entered and shown in India time. One active clean-up per report (one that started over 3 hours ago no longer counts; two hosts at once, the earlier stands); 10 upcoming per group. The planner is counted as coming.
- On planning, the reporter and followers are told. Anyone signed in can say "I'll come" or "Not coming" until it is over (start plus 3 hours). Hosts can cancel (everyone coming is told) or mark it done after the start.
- The card shows "Clean-up planned by <group>, <day, time>, meet at <point>", how many are coming and the safety line (`SAFETY_LINE`); the "I want to help" panel opens by itself when one is planned. The department page shows "A community clean-up is planned here on <date> by <group>" and the thanks count.
- Reminders (the daily nudge run): people coming and the group's hosts, for clean-ups starting within 24 hours; hosts, 6 hours after one is over and the report is still open (past week only), asking for an "It's gone" photo. Each once; `reminded_at` before the start means the reminder went, after it means the photo request went. Browser notifications only, so a clean-up planned less than a day ahead of the 10:00 IST run may get no reminder.

## How a water test was done (`test_meta`)

A water test (`water_test`, the only type that takes readings) also asks two things, both required: what it was tested with (digital meter, test kit or strips, lab report) and whether the water was filtered (straight from the source, after a filter or RO, don't know). Under a closed "More about this test" it optionally asks when the meter was calibrated, and, for a borewell or open well, whether the pump ran a few minutes first and the well's depth in feet, plus the meter's brand and model. Options and the public line are in `src/lib/sightings/test-meta.ts`; `parseSubmit` validates them; the submit route stores them in `sightings.test_meta` (JSONB, added in migration 063) after the row is created, so `create_sighting` is unchanged.

Public pages show only the instrument and the filtering, as one line under the readings (`testLabel`, e.g. "Home test with a digital meter, water straight from the borewell"; a kit reading says it is approximate; a filtered reading says it does not describe the source). Calibration, pump run, depth and model stay with the reporter (My reports, the download) and the reviewer, for analysis. Rule for any area figure later: use only readings from water straight from the source, and weigh meters, kits and lab reports differently.

## Where reports appear (map layer and links)

`src/lib/sightings/place-url.ts` `placeUrl(row)` gives each report's public page, carried as `placeHref` and `placeLabel` on every public report and on the submit response. The thank-you screen says "Once checked, it appears on the map for ..." and My reports links "See it on the map".

| Placement | Page | Map layer |
|---|---|---|
| City, in a water body | `/<city>/water-bodies?layer=reports` | yes |
| City, in a ward (cities with a ward page) | `/<city>/my-ward?ward=<n>` | no (list) |
| District, in a gram panchayat | `/atlas/<state>/<district>/panchayats/<lgd>` | no (list) |
| District, elsewhere | `/atlas/<state>/<district>` | no (list) |
| Basin hosted by a city's rivers page (e.g. Arkavathi on Bengaluru's) | `/<city>/rivers?basin=<id>&layer=reports`, which opens the deep dive | yes |
| Other basin | `/embed/basins/<id>?layer=reports` | yes |

`src/components/sightings/citizen-reports-layer.tsx` is one generic Leaflet layer, used by the basin atlas (a "Citizen reports" row in its Layers list, with legend rows and a PDF legend entry) and the water-bodies map (a toggle in its layers card). It is off by default and on with `?layer=reports`. It reads `GET /api/sightings?bbox=w,s,e,n` for the view (up to 500 newest published reports with a point; nothing when the view is over 12 degrees) and draws one dot per report in its group's colour; a dot opens the photo, type, place, date, status and the card's actions (`CommunityActions`).

## 4. Data model

All in `supabase/migrations/062_citizen_reports.sql`; TypeScript mirror in `src/lib/sightings/types.ts`. No later migration touches these tables. No table references `auth.users`.

| Table | Purpose | Key columns |
|---|---|---|
| `sighting_reporters` | One row per reporter tag, created by `create_sighting` on the first report | `reporter_key` PK; `trusted` (set on first approval, raises caps); `suspended_at`, `suspended_reason` (280) |
| `sightings` | One row per report | see below |
| `sighting_photos` | One row per stored photo | `sighting_id` (FK, cascade); `reporter_key`; `kind` `report` or `fixed`; `storage_path` `<placeId>/<sightingId>/<kind>-<random uuid>.webp` (random, so a public URL carries no time); `public_path` (same string, set once published); `sha256` of the uploaded bytes; `bytes`, `width`, `height` of the WebP; `ordinal` |
| `sighting_events` | History of review decisions and status changes | `sighting_id` (FK, cascade); `actor_key` (tag of whoever acted, reviewers included); `actor_role` `reporter`, `reviewer`, `system`; `event`; `authority_body` (160, reporter-typed); `reference` (80); `reason` (280); `category`, `subcategory` (on `reclassified`) |

`sightings` columns:

| Group | Columns |
|---|---|
| Identity | `id` uuid, `created_at`, `updated_at`, `reporter_key` (tag, or `deleted`) |
| Place, server-resolved | `place_kind` (`city`, `district`, `basin`), `place_id` (cityId, district scope id, basinId), `state_code`, `corporation_id`, `ward_id`, `ward_name`, `block_code`, `panchayat_code`, `panchayat_name`, `water_body_id`, `water_body_name`, `locality` |
| Point | `lat`, `lng` NUMERIC(9,6), `location_accuracy_m` |
| What | `category`, `subcategory` (text, validated by `taxonomy.ts`, so a new type needs no migration); `note` (280); `readings` JSONB object keyed by `parameters.ts`; `water_source` (`piped`, `borewell`, `open_well`, `handpump`); `candidate_label` (80, reviewer tag on "other"); `authority_role` |
| Status | `review_status`, `case_status`, `reviewed_at` |
| Reviewer hint | `exif_captured_at`, `exif_lat`, `exif_lng` (cleared at review) |

Indexes: `sightings (reporter_key, created_at)`, `(review_status, created_at)`, `(place_id, review_status)`, `(created_at)`; `sighting_photos (sighting_id)` and unique `(reporter_key, sha256) WHERE reporter_key <> 'deleted'`; `sighting_events (sighting_id, created_at)`.

RLS is enabled on all four tables with no policy, so only the service role reads or writes them. `create_sighting` is executable by `service_role` only.

### `review_status`

| From | Action (`POST /api/sightings/review`) | To |
|---|---|---|
| `received` | `approve` | `approved` |
| `received` | `reject` | `rejected` |
| `received` | `suspend` on the reporter | `rejected`, reason "Account suspended" |
| `needs_info` | none | in the schema, the type, the pending cap and the UI's "being checked", but no route sets it |

`approve` and `reject` return 409 from any status other than `received`. There is no un-approve or un-reject action.

### `case_status`

Set at approval. With no `authority_role` it stays null: no status to follow (good news, `borewell_quality`, `water_test` unless piped and over a limit, and "other"). With a role it is `reported` if the reporter already recorded filing while the report was being checked, else `open`.

Filing early: while a report is `received`, its own reporter may post `reported` (only that event, and only if the report has a role). The event is stored and counts toward the update cap; `case_status` stays null until approval. Every other event on a null status returns 409.

Transitions from `src/lib/sightings/status.ts` (`NEXT`); a dash is not allowed (409):

| Event | from `open` | from `reported` | from `authority_done` | from `fixed` | from `closed` | Who | Needs |
|---|---|---|---|---|---|---|---|
| `reported` | reported | reported | - | - | - | reporter, reviewer | authority body |
| `authority_done` | authority_done | authority_done | - | - | - | reporter, reviewer | |
| `fixed` | fixed | fixed | fixed | - | - | reporter, reviewer | a photo |
| `still_there` | open | reported | reported | - | - | reporter, reviewer | |
| `closed` | closed | closed | closed | closed | - | reviewer only | |
| `reopened` | - | - | - | open | open | reviewer only | |

The `fixed` event moves the status at once; its photo waits in the private bucket for `publish_fixed` or `discard_fixed`. Neither of those writes an event or changes the status.

### Who sees what (`src/lib/sightings/serialize.ts`, review route)

| Data | Public (`toPublic`) | Reporter, own (`toOwn`) | Reviewer queue |
|---|---|---|---|
| id, place name, type label, case status, readings with BIS assessment, water source label, handler | yes | yes | yes |
| Dates | IST date only (`YYYY-MM-DD`) | full timestamps | full timestamps |
| `where` text | water body and ward, GP or locality; private categories: ward, GP or locality only | water body and unit | as own |
| Point | rounded to 3 decimals (about 100 m); none for private categories | exact | exact |
| Photos | published only | published, plus 1-hour signed URLs for unpublished | all, with kind and published flag |
| Events | `approved`, `reported`, `authority_done`, `fixed`, `still_there`, `closed`, `reopened`; date only; authority body blanked | all events, with the authority body | as own |
| Reference numbers, reject reason, national channels | no | yes | yes |
| Note | no | no | yes |
| EXIF hint, candidate label | no | no | yes |
| Reporter tag, trusted, suspended, total and rejected counts | no | no | yes |

The reporter cannot see their own note; `OwnReport` has no note field.

## 5. Privacy mechanics as built

**Identity.** The API turns the bearer token into a user with `auth.getUser`, then uses the user id for three things only: computing the tag, checking the reviewer allowlist, and `deleteUser` on account deletion. Module code never reads the email or profile. The reviewer sees the 64-hex tag, never a name or email.

**No link in the database.** No table references `auth.users`. A copy of the database links a report to a person only together with the secret and the auth user list.

**Photos and EXIF.**
1. Browser (`use-citizen.ts`): `readPhotoMeta` reads date and GPS from the first original photo; `shrinkPhoto` redraws each photo on a canvas as a JPEG of at most 1600 px (quality 0.82), which drops EXIF. The first photo's date and GPS go as form fields `takenAt`, `photoLat`, `photoLng`.
2. Server (`photos.ts`): rejects anything over 1.4 MiB or whose first bytes are not JPEG, PNG, WebP or HEIC; reads EXIF from the uploaded bytes (usually empty after step 1); re-encodes with sharp (`rotate`, fit inside 1600 px, WebP quality 80), which writes no metadata. Only the WebP is stored. The raw upload is never stored; its SHA-256 is.
3. The server's own EXIF wins, else the browser's fields (unverified). They are stored in `sightings.exif_*` for the reviewer and set to null on approve, reject, or reject-by-suspension.

**Review.** Approve copies each `report` photo from `sightings-intake` to the same path in `sightings-public`, sets `public_path`, then removes the intake copy. Reject deletes the photos from both buckets and their rows, and sets `note` to null. The rejected row stays, with its point, type and tag.

**Delete account** (`DELETE /api/sightings/mine`):
1. Every report not `approved` (received, needs_info, rejected) is deleted, with its photos in both buckets. With `?published=remove`, approved reports go too.
2. In what remains, `sightings.reporter_key`, `sighting_photos.reporter_key`, `sighting_events.actor_key`, `sighting_groups.created_by` and `sighting_fixits.created_by` become `deleted`.
3. The `sighting_reporters` row is deleted, with push subscriptions, follows, group memberships (each group then settles: a new host, or gone if never reviewed and empty) and clean-up sign-ups; then the Supabase auth user.

**Around the report.** Blurring (`photo-blur.tsx`) happens on the phone, so the unblurred image is never uploaded. Place search goes through `/api/sightings/search`, so Nominatim sees the server, never the device; queries are cached in memory per instance (cleared past 500) and not logged by the module. The calendar reminder is built in the browser. The review-queue workflow posts counts and the oldest item's wait in whole days to a public GitHub issue once a day, never an id, place, type, photo or hour.

**Public output omits** the tag, the exact point and its accuracy, the note, the time of day, reference numbers, the reporter-typed authority body, EXIF, the candidate label, and every report not approved. Public output carries the point rounded to 3 decimals (about 100 m), so reports can sit on a map; a private category (`private: true` in `taxonomy.ts`, today only "Tap & drinking water") gets no point at all and also drops the water body name from `where`, leaving the ward, GP or basin locality, or nothing.

**Groups and nods.** A report sent with a group shows the group's name, never the sender's; groups show no members anywhere public; a group tag is accepted only on community reports. Nod and follow counts are totals, never who. Home reports take no nods, follows, group tag or clean-up, and are never announced to followers.

Photo file names are random, so a public photo URL carries no upload time. `GET /api/sightings?body=` leaves out private categories, so a tap-water report is never listed under the water body its point fell in.

## 6. Placement and coverage

`placePoint(origin, lng, lat)` in `src/lib/sightings/locate-server.ts` runs on every submit and every `/locate` call. The first match wins:

| Step | Candidates | Match | Stored |
|---|---|---|---|
| 1. City | enabled cities whose `bbox` holds the point | point inside a ward polygon, or inside a region's corporation boundary | `city`, cityId; ward number and name; corporation (boundary file `corporation_id`, else the ward's `corporation` lowercased, else the nearest configured corporation box); water body by `osm_id` from `/geojson/<cityId>-water-bodies-current.geojson` |
| 2. District | published atlas districts whose `bbox` holds the point | nearest GP whose bounding box holds the point; else the nearest GP centre within 5 km (`DISTRICT_REACH_KM`) | `district`, scope id; block, GP code and name only when a GP box held the point |
| 3. Basin | all basins, smallest `areaKm2` first (no area sorts last) | point inside `boundary.geojson` | `basin`, basinId; water body (`tankId`) from `waterbodies-major`; locality from `admin-town`, else `admin-district` |
| 4. City fallback | cities from step 1 | city has no ward geometry, or a configured corporation box holds the point | `city` with no ward |

After a district or basin match with no water body, the point is tested against every enabled city's water-body file. A hit adds that lake's `osm_id` and name but keeps the district or basin for routing, so a city's lake panel also lists it (Red Hills and Chembarambakkam in Chennai are the cited cases).

GP matching uses bounding boxes, not GP polygons. Where boxes overlap, the GP with the nearer centre wins, which can credit a point near a boundary to the neighbouring GP.

**Outside** means no step matched. `POST /api/sightings` returns 422 "This location is outside the cities, districts and river basins we cover so far."; `GET /api/sightings/locate` returns `{ data: null }`. The 5 km reach is deliberately short: a point beyond it is a district not yet onboarded and is never credited to its neighbour. `/for-citizens` lists the covered places from the same three registries.

**Starting from a place page.** `viewOf()` in `locate-server.ts` turns `place` plus an optional `body`, `ward` or `panchayat` into `{ lat, lng, zoom }`: water body box centre (zoom 16), ward box centre (15), city centre (12); GP centroid (14), district box centre (10); basin boundary box centre (9). Unknown places return null and the map opens on its default view. This only positions the map; the report is still placed from its final point.

**Geometry source.** Files are fetched over HTTP from the deployment's own origin, not bundled, and cached per server instance (failed fetches are not cached). They come from `public/geojson` and `public/data`; with `CORPUS_SOURCE=remote` (`scripts/fetch-corpus.sh`) those are synced from the pinned data repo, so new geometry must be in the pin.

**Where reports show** (`PlaceReports`):

| Surface | File | Query |
|---|---|---|
| Ward page | `src/components/my-ward/my-ward-page.tsx` | `place=<cityId>&ward=<n>` |
| Water-body panel | `src/components/water-bodies/unified-detail-panel.tsx` | `place=<cityId>&body=<osm_id>` (the body filter replaces the place filter; private categories excluded) |
| District page | `src/app/atlas/[state]/[district]/page.tsx` | `place=<scopeId>` |
| GP page | `src/app/atlas/[state]/[district]/panchayats/[gpCode]/page.tsx` | `place=<scopeId>&panchayat=<lgdCode>` |
| Basin atlas | `src/components/basin/atlas/basin-atlas.tsx` | `place=<basinId>`, when a river or PRS is selected |

## 7. Routing: who handles this

### Roles and types (`src/lib/sightings/taxonomy.ts`)

Seven roles: `solid_waste`, `sewerage`, `water_supply`, `storm_drainage`, `water_body`, `pollution_control`, `land_revenue`. Each group has a role; a type can override it, or set `null` for "recorded only". `roleFor(category, subcategory)` returns the type's role, else the group's, else null ("other" is always null).

| Group | Default role | Overrides |
|---|---|---|
| `dumping` | solid_waste | `hazardous_waste` pollution_control |
| `sewage` | sewerage | `effluent_discharge` pollution_control |
| `surface` | water_body | `oil_film`, `dead_fish` pollution_control |
| `drinking` (private) | water_supply | `borewell_quality`, `water_test` null |
| `infrastructure` | water_supply | |
| `flooding` | storm_drainage | `bund_breach`, `inlet_blocked`, `sluice_damaged` water_body |
| `encroachment` | land_revenue | |
| `recovery` (good news) | null | |

### Three layers

`resolveAuthority(role, { stateCode, placeId, placeKind, corporationId })` in `src/lib/sightings/routing/index.ts`:

1. Corporation: `STATE_ROUTING[state].places[placeId].corporations[corporationId][role]`, only when the row has a corporation.
2. Place: `places[placeId].roles[role]`.
3. State: `STATE_ROUTING[state].roles[role]`, for bodies the whole state shares (the pollution control board, usually).
4. Otherwise `authority: null`; the UI shows only national channels (`NationalOnly`).

National channels (`routing/national.ts`) are added after, filtered by role: Swachhata-MoHUA (solid_waste, sewerage, storm_drainage; cities only) and CPGRAMS (all roles).

### Shapes (`routing/types.ts`)

- `StateRouting`: `stateCode` (ISO 3166-2, matches `PlaceConfig.stateCode`), `checked` date, `roles`, `places` keyed by cityId or district scope id, each `{ roles, corporations? }`.
- `Authority`: `body`, `acronym?`, `channels`, `source` (the official https page that names the body).
- `Channel`: `kind` (`app`, `portal`, `helpline`, `whatsapp`, `email`), `label`, `url?` (https or mailto), `phone?`, `tracked?`. `tracked` means the channel issues a reference number the citizen can track.
- Corporation keys must match what `locate-server.ts` resolves: Bengaluru `central`, `north`, `south`, `east`, `west`; Mumbai `bmc`, `tmc`, `kdmc`, `nmmc`, `mbmc`, `vvcmc`, `bncmc`, `umc`, `pmc`; Kolkata `kmc`, `bidhannagar`, `budge_budge`.

Coverage on this branch: 10 state files (AP, DL, GJ, HR, KA, KL, MH, TG, TN, WB), 30 places (12 cities, 18 districts), 299 authority entries, corporation overrides for 3 places, 2 national channels, 55 "what to expect" entries. All dated 2026-10-16.

### `expectations.ts`

What happens after filing with each complaint system, from that system's own pages. Each entry has `system`, `keys` (channel `url`, or `tel:<phone>`), `expect` (one or two sentences), `needsPhone`, `source`. `withExpectations()` attaches `system`, `expect` and `needsPhone` to matching channels at resolve time. A system shared by an app, a portal and a helpline is described once.

### How a report gets its handler

1. Submit: `role = roleFor(category, subcategory)`. If that is null, the water source is `piped` and any reading is above its BIS acceptable limit, the role is `water_supply`. The role is stored as `authority_role`, and the response carries `handler` and `national`.
2. Approval keeps the stored role, or takes `roleFor()` of the new type if the reviewer reclassified the report (which drops the piped-test fallback).
3. Read: `serialize.ts` resolves `authority_role` with the row's stored place fields against the deployed routing tables.

### The routing files are generated

`src/lib/sightings/routing/states/*.ts` and `states/index.ts` are written by `convert_routing.py` from research JSON. The converter and its inputs live in the main checkout at `docs/research/citizen-reports-routing-2026-10-16/`, which `.gitignore` excludes (`docs/research/*`), so they are not in version control. `expectations.ts` comes from the sibling `convert_expect.py`.

The converter holds the hand corrections:

| Table | Holds |
|---|---|
| `DISTRICTS`, `PLACE_STATE` | Research slug to scope id, and place to state code |
| `CORP_KEY` | Bengaluru corporation names to the keys `locate-server` produces |
| `DENY` | Compromised or refusing hosts: never linked; a denied source falls back to the first https channel |
| `DROP_EMAILS`, `DROP_URLS` | Inferred emails, and links that are not complaint channels (tanker booking, staff apps, test forms) |
| `LABEL_FIX`, `BODY_FIX` | Label and body-name corrections |
| inline | Hyderabad's corporations dropped (one shared system; nothing locates a point in one) |

It also orders channels (tracked first, then app, portal, whatsapp, helpline, email), de-duplicates them, and hoists repeated channels and bodies into constants.

Rule: do not hand-edit `states/*.ts`. Change the research JSON or the converter's tables, regenerate, and commit the output. A hand edit is lost on the next run. Regenerating into a scratch directory on 17 Oct produced output byte-identical to this branch, so no hand edits exist today.

```
cd <main checkout>/docs/research/citizen-reports-routing-2026-10-16
python3 -I convert_routing.py . <repo root>     # rewrites states/*.ts and states/index.ts, prints NOTE lines
```

## 8. Abuse limits

Caps live in `src/lib/sightings/limits.ts`. `create_sighting` enforces the report caps under one transaction-scoped advisory lock (`hashtext('sightings:intake')`), so parallel requests cannot overshoot; it serialises all intake site-wide. "Day" is a rolling 24 hours. A reporter is "new" until their first approved report, then `trusted`.

`create_sighting` checks in this order and stops at the first hit; the API returns 429 with the `CAP_MESSAGES` text:

| Reason | Cap | API text |
|---|---|---|
| `suspended` | account suspended | "This account can no longer send reports." |
| `site_paused` | 3,000 reports site-wide (cost backstop) | "Reporting is paused for today. Please try again tomorrow." |
| `new_paused` | 500 reports from new accounts site-wide; applies to new accounts only | "New accounts are paused for today because of unusual volume. Please try again tomorrow." |
| `daily_cap` | 5 per reporter (new), 20 (trusted) | "You have reached today's limit. Please try again tomorrow." |
| `pending_cap` | 10 received or needs_info per reporter (new), 30 (trusted) | "You have several reports waiting for review. Please wait until they are reviewed." |

Caps run before any image work. A report whose photos then fail is deleted, so it does not count.

Other limits:

| Limit | Value | Where | Response |
|---|---|---|---|
| Photos per report | 1 to 3 | `parseSubmit` | 400 "Add at least one photo." / "Add at most 3 photos." |
| Photo size as uploaded | 1.4 MiB (3 fit Vercel's 4.5 MB body limit) | `processPhoto` | 400 "A photo is too large." |
| Photo type | JPEG, PNG, WebP, HEIC by first bytes | `processPhoto` | 400 "Only photos can be uploaded." |
| Decodable, at most 50 M pixels | sharp `limitInputPixels` | `processPhoto` | 400 "This photo could not be read." |
| Same photo twice per account | unique `(reporter_key, sha256)` | DB, code 23505 | 409 "You have already sent this photo." |
| Location | lat 6 to 38, lng 68 to 98 | `parseSubmit` | 400 "We could not read a location in India." |
| Reading range | 0 to `Parameter.max` | `parseSubmit` | 400 "<name> looks out of range." |
| Note, reason | 280 characters | `validate.ts` truncates silently; DB CHECK | none |
| Authority body, reference | 160, 80 characters | `validate.ts` truncates | none |
| Status updates per report per reporter | 5 per day; the `submitted` event counts | events route | 429, the `daily_cap` text |
| Fixed photos per report | 3 | events route | 429 "This report already has its fixed photos." |
| Suspended account updating status | | events route | 403, the `suspended` text |
| Place search | signed in; query 3 to 120 characters; 5 results, India only; one Nominatim request a second per server instance, queued; 8 s timeout | search route | under 3 characters: empty list; Nominatim failure: 502 "Search is not working right now. Tap the map instead." |

`REVIEW_WITHIN_DAYS` (3) in `limits.ts` is not a cap but a promise: `/for-citizens` tells reporters reports are usually checked within that many days. Change it when the real review pace changes.

Reviewers skip the events-route caps and the suspension check. Suspension (`action: "suspend"`) sets `suspended_at`, rejects the account's `received` reports and deletes their photos; approved reports stay. Un-suspending is manual SQL. Suspension binds the tag, not the person: deleting the account and signing in again with the same Google account yields a new auth user id, a new tag, and new-account caps.

## 9. API reference

All routes run on the Node runtime. "User" means a valid Supabase bearer token; "reviewer" means a user whose id is in `SIGHTINGS_REVIEWER_IDS`. When `reportsEnabled()` is false, every authenticated route returns 404 `Not available`. Missing or invalid token: 401 `Sign in required`. Unexpected errors: 500 through `internalServerError()`, logged by `logRouteError`.

| Route | Method | Auth | Input | Output | Errors |
|---|---|---|---|---|---|
| `/api/sightings` | POST | user | multipart: `photos` (1-3), `lat`, `lng`, `accuracy?`, `category`, `subcategory` (none for `other`), `note` (required for `other`), `waterSource` (drinking only; required with readings), `reading.<key>` (`water_test`: at least one), `takenAt?`, `photoLat?`, `photoLng?` | `{ data: { id, placeName, role, handler, national, readings } }` | 400 validation or photo; 409 duplicate photo; 422 outside; 429 caps |
| `/api/sightings` | GET | none | `place` (`[a-z0-9-]{2,40}`) with `body?`, `ward?`, `panchayat?`; or `bbox=w,s,e,n` (inside India, at most 12 degrees a side; private categories left out) | `{ data: PublicReport[] }`: newest 50 approved; `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`; `{ data: [] }` when off | 400 invalid place |
| `/api/sightings/locate` | GET | user | `lat`, `lng`; or `place` with optional `ward`, `body`, `panchayat` | point: `{ data: { placeName, where } }` or `{ data: null }` (outside); place: `{ data: { lat, lng, zoom } }` or `{ data: null }` | 400 invalid location (point mode) |
| `/api/sightings/search` | GET | user | `q` (trimmed, at most 120 characters) | `{ data: [{ name, lat, lng }] }`, at most 5; empty under 3 characters | 502 search failed |
| `/api/sightings/mine` | GET | user | none | `{ data: OwnReport[] (newest 100), reviewer: boolean }` | |
| `/api/sightings/mine` | DELETE | user | `?published=remove` (optional) | `{ data: { deleted: <count> } }` | |
| `/api/sightings/[id]/events` | POST | owner or reviewer | multipart: `event`, `authorityBody` (required for `reported`), `reference?`, `reason?`, `photos` (`fixed` only: one file, required; ignored on other events) | `{ data: { caseStatus } }` (unchanged, so null, for an early `reported`) | 400 validation or photo; 403 reviewer-only event or suspended; 404 bad id or not owner; 409 not published (except the owner's early `reported`), transition not allowed, duplicate photo; 429 caps |
| `/api/sightings/[id]/events` (nods) | POST | user | `event` `seen_too` or `thanks` | `{ data: { seenCount, thanksCount } }` | 403 home report, own report (`seen_too`), suspended; 409 not open (`seen_too`) or not fixed (`thanks`); 429 caps |
| `/api/sightings/follows` | GET, POST, DELETE | user | JSON `{ target }` (POST, DELETE) | GET the person's follows with a name and page link each; POST, DELETE `{ data: { ok } }` | 400 bad target; 429 over 50 |
| `/api/sightings/groups` | GET | none; `?scope=mine` user; `?scope=pending` reviewer | | public: approved groups with counts, cached 5 minutes; mine: groups with role, status, members, the host's invite link, and clean-ups; pending: groups waiting | 403 not reviewer |
| `/api/sightings/groups` | POST | user; approve and reject reviewer | JSON `{ action, ... }`: `create { name, kind, placeId? }`, `join { code }`, `leave { groupId }`, `rotate { groupId }`, `approve`/`reject { groupId }` | per action | 400 validation; 403 suspended, not host, not reviewer; 404; 409 rejected group or already reviewed; 429 limits |
| `/api/sightings/fixits` | POST | user | JSON `{ action, ... }`: `create { sightingId, groupId, startsAt, meetingPoint, note? }`, `rsvp`/`unrsvp`/`cancel`/`done { fixitId }` | create: the `PublicFixit`; rsvp: `{ going, mine }`; cancel, done: `{ status }` | 400 time or text; 403 not a host of an approved group, suspended; 404; 409 type or status not allowed, one already planned, no longer planned; 429 10 per group |
| `/api/sightings/push` | POST, DELETE | user | JSON subscription `{endpoint, keys}` / `{endpoint}` | `{ data: { ok } }` | 400 bad subscription |
| `/api/sightings/department` | GET, POST | signed department link (`token`) | GET `?token=`; POST JSON `{ token, id, event, note? }` | GET `{ body, acronym, asOf, open[], done[] }`; POST the new status | 404 bad link, 409 not this department's or not fitting, 410 body gone, 429 limits |
| `/api/sightings/department/links` | GET | reviewer | none | each body with counts and its link path | 503 secret unset |
| `/api/cron/sightings-nudges` | POST | `Authorization: Bearer CRON_SECRET` | none | counts only | 401, 500 secret unset |
| `/api/sightings/review` | GET | reviewer | none | `{ data: [...] }`: up to 50 `received` (oldest first) plus approved reports with an unpublished fixed photo; each is `OwnReport` plus `note`, `candidateLabel`, `exif`, `photos`, `reporter` | 403 not reviewer |
| `/api/sightings/review` | POST | reviewer | JSON `{ action, id?, reporterKey?, category?, subcategory?, candidateLabel?, reason? }`; actions `approve`, `reject`, `publish_fixed`, `discard_fixed`, `suspend` | `{ data: { ok: true } }`; `suspend` returns `{ data: { rejected: <count> } }` | 400 bad id, bad reporter, invalid type, unknown action; 403; 404; 409 already reviewed |

Review action details:

- `approve`: optional `category` and `subcategory` reclassify the report (a `reclassified` event records the new type); `candidateLabel` is kept only for `other`. Publishes report photos, sets `authority_role` and `case_status` (section 4), clears EXIF, marks the reporter trusted.
- `reject`: `reason` becomes the reporter's `rejectReason`. Deletes photos, nulls the note, clears EXIF.
- `publish_fixed`, `discard_fixed`: act on the report's unpublished `fixed` photos only.
- `suspend`: takes `reporterKey` (64 hex) and `reason`.
- An update on one's own report by a reviewer is recorded with `actor_role: reporter`.

## 10. Extending the module

### A new report type

1. Add `t("key", "Label", role?)` to its group in `src/lib/sightings/taxonomy.ts`. Omit the role to inherit the group's; `null` means recorded only (no handler, no status). Add `readings: true` for a type that takes water-test values.
2. No migration: types are text. Never rename or remove a key existing rows use. `labelFor` falls back to the group label, and approving such a row fails with 400 "Invalid type".
3. A new group also needs `key`, `label`, `hint`, `icon` (a lucide-react name, mapped in the UI's `ICONS` in `report-flow.tsx`), `color`, `role`, and `private` if its public `where` must drop the water body.
4. A new role: add it to `AUTHORITY_ROLES`, to the converter's `ROLES`, and to the national channels it fits; then every enabled city and published district needs a body for it, or the contract test fails.
5. `npm test`.

Recurring "other" reports point to candidates: `select candidate_label, count(*) from sightings where category = 'other' and review_status = 'approved' group by 1 order by 2 desc;`

### A new city

1. Place config (`src/lib/cities`): `enabled`, `stateCode`, `bbox`, `wardsVintage` (ward file `/geojson/<cityId>-wards-<vintage>.geojson` with a ward number readable by `wardNumberOf`, and `ward_name` or `ward_label`). For a region: `corporations[]` with `corporationId`, `bbox`, `center`, `wardCount`, and a boundary file registered in `CORPORATIONS_VINTAGE` (`src/lib/cities/data-paths.ts`) whose features carry `corporation_id`.
2. `/geojson/<cityId>-water-bodies-current.geojson` with `osm_id` and `name`, so reports bind to lakes.
3. Routing: a place entry covering all seven roles through the place and state layers, plus `corporations` for a region. Add the research JSON and the converter's `PLACE_STATE` (and `CORP_KEY` if names differ), regenerate. A new state also gets its file and an `index.ts` entry from the converter.
4. Nothing else: the ward page and water-body panel already render `PlaceReports` by cityId.
5. `npm test` runs the contract (below).

### A new district

1. `src/lib/atlas/registry.ts`: `published: true`, `scopeId`, `stateCode`, and a `bbox` around every GP (the contract test prints the bbox to set).
2. `public/data/atlas/<stateSlug>/<slug>/directory.json` with `panchayats[]`, each `lgdCode`, `name`, `blockCode`, `boundary.centroid`, `boundary.bbox`. A GP with no boundary is never a match.
3. Routing under the scope id: research JSON plus the converter's `DISTRICTS` map; rural bodies per `docs/methodology/district-atlas-v1.md`.
4. District and GP pages already render `PlaceReports`.

### A new basin

1. A manifest in `src/lib/basins` with `basinId`, `displayName`, `stateCode`, and `areaKm2` (smaller basins win; missing area sorts last).
2. `/data/basins/<basinId>/boundary.geojson` (required), `admin-town.geojson` and `admin-district.geojson` (`name`), `waterbodies-major.geojson` (`tankId`, `name`).
3. Routing: basins have no place entries, only the state layer, and the contract test does not check them. Today these roles resolve to no body: arkavathi, cauvery-ka, kabini (solid_waste, sewerage, water_supply, storm_drainage); chennai-rivers, cauvery-tn, erode-rivers, krishnagiri-rivers (solid_waste, storm_drainage); mumbai-rivers (solid_waste, sewerage, storm_drainage); palakkad-rivers (sewerage).

### A new or corrected routing entry

1. Edit the research JSON, or the converter's fix tables, in `docs/research/citizen-reports-routing-2026-10-16/` (main checkout).
2. Run `convert_routing.py` (section 7) and read its NOTE lines.
3. If a channel URL or phone changed, update its `keys` in `expectations.ts` (through `convert_expect.py`); the test fails on a key that matches no channel.
4. `npm test` checks: every body cites an https `source`; every channel has a url or phone; urls are https or mailto; every expectation key is a real channel, described once, with an https source, `expect` at most 240 characters and no en or em dash.

### What the onboarding contract enforces

`src/lib/cities/onboarding-contract.test.ts`:

- Every enabled city and published district resolves a body for all seven roles, for each corporation in its config or its routing file (`CONTRIBUTING.md`, step 7).
- Every published district's `bbox` encloses all its GP boxes, since placement filters districts by bbox before fetching any directory.

## 11. Testing

| Command | Covers |
|---|---|
| `npm test` | Every `*.test.ts` under `src` and `.github`, through `tsx --test`; CI runs it (`.github/workflows/ci.yml`) |
| `npx tsx --test src/lib/sightings/sightings.test.ts src/lib/cities/onboarding-contract.test.ts` | This module only: 20 tests, all passing on 17 Oct |
| `npm run lint` | ESLint |

`src/lib/sightings/sightings.test.ts` covers: unique type keys and known roles; type validity and role overrides; case transitions; point-in-polygon and nearest-centroid; routing layer order and urban-only Swachhata; link and source formats; BIS assessments (2015 amendment); water-test validation; expectation keys.

Not covered by any test: the API routes, `create_sighting`, photo processing, `locate-server.ts` against real geometry, `serialize.ts`, delete-account.

### Manual end-to-end (local, flag on)

Setup: `.env.local` with every variable in section 2, the tester's auth user id in `SIGHTINGS_REVIEWER_IDS`, `http://localhost:3000/for-citizens` allowed as a redirect, `npm run dev`. This writes to production tables: clean up afterwards.

1. `/for-citizens`: the nav link shows; Google sign-in returns to the page signed in.
2. Drop the pin in a covered ward: the place name shows. Drop it at sea: "outside". Search for a place name: up to 5 hits move the map.
3. Send a report with a phone photo that has GPS, blurring part of it first: the handler card and national channels appear. Record filing with a reference straight away; after approval the report starts as `reported`.
4. My reports: the report shows as being checked, with its photo (signed URL).
5. Send the same photo again: 409 "You have already sent this photo."
6. `/admin/sightings`: the report is queued with its EXIF hint; approve with a different type: a `reclassified` event appears.
7. Open the ward page or water-body panel: the card shows a date only, no note, and the photo loads (CSP). Signed out, follow its "Report something" link and sign in: the map opens at that ward or lake.
8. Mark it reported (with a body and reference), then fixed with a photo: the fixed photo appears in the review queue; publish it.
9. As reviewer, close and reopen it.
10. Send and reject another report: its photos are gone from both buckets; the reporter sees the reason.
11. Water test from a piped tap, TDS 640: the submit response names the water-supply body; after approval the public card shows the reading, the handler and only the ward.
12. A point in a published district village, and one in a basin outside any city or district: the GP and basin locality resolve.
13. Delete the account with and without `?published=remove`: unpublished rows gone, kept rows show `deleted`, the auth user is gone.
14. Flag off and restart: page 404, nav link hidden, API 404.

### Debugging

| Symptom | Likely cause |
|---|---|
| Page renders, every API call 404 `Not available` | `reportsEnabled()` false: secret under 32 characters, or service-role key or URL missing |
| Every point "outside" on a preview | Geometry fetch blocked by Deployment Protection: set `VERCEL_AUTOMATION_BYPASS_SECRET` |
| Every point "outside" locally | `public/geojson` or `public/data` files missing from the checkout |
| 500 on submit right after the migration | PostgREST schema cache not reloaded |
| Sign-in fails or lands on an error | `<origin>/for-citizens` missing from Supabase redirect URLs |
| Public photo broken | CSP host differs from `NEXT_PUBLIC_SUPABASE_URL`, or `publishPhotos` failed between copy and update (it is not transactional) |
| A routing fix disappeared | `states/*.ts` regenerated over a hand edit |
| Place search always fails (502) | Nominatim down or refusing the server; the route logs `sightings/search` |
| No review-queue issue appears | Workflow secrets missing; the run log shows the PostgREST error |

## 12. Open questions

1. **`needs_info` is unused.** It is in the schema, the types, the pending cap and the reporter's "being checked" state, but no route sets it. The same goes for `actor_role: system`. Planned, or remove?
2. **The routing converter is not in version control.** `CONTRIBUTING.md` step 7, `docs/methodology/district-atlas-v1.md` and each state file's header comment all say to edit `states/*.ts` directly, which contradicts the generated-file rule. Either commit the converter (for example under `scripts/`) and point the docs at it, or declare the files hand-maintained and retire the converter.
3. **`convert_expect.py` needs a `channels-keep.json`** that is not in the research folder, so `expectations.ts` could not be confirmed to regenerate identically.
4. **Basins have no contract check.** Several roles resolve to no body (section 10), so those reports show national channels only.
5. **Basin tank ids such as `KA06LH0006 ( NRLD 2019)`** fail the `body` parameter's pattern (`[A-Za-z0-9:_-]{1,40}`). No UI queries basins by body today.
6. **Suspension can be shed** by deleting the account and signing in again.
7. **Reports that appear on no public page:** tap-water reports in cities without a ward page (Mumbai, Hyderabad, Kolkata, Gurugram, Pune, Surat, Visakhapatnam), and reports placed in an overview basin (the whole Cauvery), which has neither the list nor the layer. `placeUrl` returns null for them.
8. **The reporter cannot see their own note** (`toOwn` omits it).
9. **Not checked from the code:** whether anonymous sign-in is off in Supabase Auth; whether `VERCEL_AUTOMATION_BYPASS_SECRET` is set for Preview; whether `capture="environment"` opens the camera under `camera=()` on iOS Safari and Android Chrome; whether sharp on Vercel decodes HEIC (the browser's JPEG re-encode usually makes this moot); how often phone browsers strip GPS from gallery photos. Migration 062 and the buckets were applied and verified in production on 16 Oct 2026, Google sign-in is configured, and the workflow's `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` repository secrets exist.
10. **`.env.example`** lacks the flag and the `SIGHTINGS_*` variables.
11. **No rotation procedure** exists for `SIGHTINGS_REPORTER_KEY_SECRET` (section 2).
12. **"Not ours" notes:** the reviewer sees each department's count of items marked "not ours" but not its note, which would help correct the routing data.
