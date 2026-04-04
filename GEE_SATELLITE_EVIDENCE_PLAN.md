# GEE Satellite Evidence Plan

Current implementation reference:

- [GEE_PHASE1_METHODS.md](GEE_PHASE1_METHODS.md)

Related research:

- [GEE_RESEARCH.md](GEE_RESEARCH.md)

This document covers the planned "satellite evidence" layer for Neer Vazhvu's water-body experience. It is a forward-looking research and implementation note, not a description of behavior already shipped in the app.

## Why this needs its own plan

The current `Satellite Context` block gives readable insights, but it still asks the public to trust a derived number.

For a public-facing water product, that is not enough on its own. We should also preserve a visible chain of evidence:

- what underlying satellite imagery the summary comes from
- when the imagery was captured
- whether the water mask is a direct image or a derived model layer
- what we are confident the image does show, and what it does not show

The goal is not to turn Neer Vazhvu into a remote-sensing explorer. The goal is to let users inspect a small, well-explained slice of evidence behind the summary.

## Product goal

Add a lightweight "evidence layer" that helps users answer:

- "Is this spread estimate grounded in a real satellite scene?"
- "What did the lake actually look like at a few moments over the last year?"
- "How does the visual evidence relate to the chart and the seasonal comparison?"

## Non-goals

This feature should not:

- become a live Earth Engine tile viewer
- expose every raw scene for every water body
- imply that true-color imagery alone can measure storage volume
- show low-quality cloudy frames just to fill a timeline
- compete with the chart for attention inside the main detail panel

## Data lineage

The evidence layer should make the existing measurement chain easier to understand.

### Measurement path already in Phase 1

1. `Sentinel-2` captures an optical satellite scene.
2. `Dynamic World` derives a 10 m land-cover prediction from a matching Sentinel-2 scene.
3. Neer Vazhvu uses the Dynamic World `water` signal over a recent 45-day window to estimate recent visible spread.
4. `JRC Global Surface Water Monthly Recurrence` provides the month-level historical seasonal baseline.

### Visual evidence path proposed here

1. Use `Sentinel-2 Harmonized` true-color imagery as the primary visual evidence users can inspect.
2. Optionally overlay the `Dynamic World` water class or water probability on the same or nearest matching scene.
3. Show the acquisition date, source dataset, and asset linkage in the UI and in a metadata manifest.

This is the most honest framing:

- `Sentinel-2` is the picture people can visually inspect
- `Dynamic World` is the derived model layer we use for water measurement
- `JRC` is the historical baseline, not the current image

## Official source notes

These are the core source facts we should cite publicly:

- Google documents `Dynamic World V1` as a near-real-time 10 m land-use / land-cover dataset derived from `Sentinel-2 L1C` imagery, with one Dynamic World image corresponding to one Sentinel-2 asset.
- Google documents `Sentinel-2 Harmonized` as a 5-day revisit optical mission and the recommended harmonized collection for consistent use across time.
- Earth Engine supports single-image thumbnails with `ee.Image.getThumbURL()` and animated GIF thumbnails with `ee.ImageCollection.getVideoThumbURL()`.
- Earth Engine's image-visualization guide notes that `getThumbURL()` is intended for preview images and that the authorization token lasts 2 hours, which makes direct public linking unsuitable for a stable production UI.
- Earth Engine supports `Export.video.toCloudStorage()` for MP4 generation if we later decide to ship curated short videos.

## Recommended public UX

The chart should remain the primary explanatory element. The imagery should support trust, not replace the analysis.

### Recommended interaction

- Keep the current `Satellite Context` block in the water-body panel.
- Add a secondary action like `See Satellite Evidence`.
- Open a modal or drawer with:
  - a short explainer
  - 6 to 8 dated frames over the last 12 months
  - a scrubber or frame picker
  - a water-body outline overlay
  - an optional `Water signal` overlay toggle
  - explicit source, date, and confidence labels

### What the user should learn from that modal

- what the water body looked like in real imagery
- that the water overlay is derived, not hand-drawn
- that the spread chart is based on repeated satellite observations over time
- that different months can look very different even for the same lake

## Why not lead with a GIF

A looping GIF sounds attractive, but it is not the best default product choice.

Problems with a GIF-first approach:

- it can feel decorative rather than evidentiary
- it hides exact dates unless we label every frame aggressively
- it is harder to pause and compare carefully
- it makes it easier to miss cloud contamination or a misleading frame

Recommended default:

- use still frames with a scrubber first
- consider a short MP4 only as a secondary enhancement later

## Recommended media format

### Phase 1.2 recommendation

Start with:

- `6 to 8` still frames per flagship water body
- `jpg` or `webp`
- one frame picker / scrubber UI
- optional outline overlay
- optional Dynamic World water overlay

This gives us:

- lower storage
- easier QA
- easier date labeling
- cleaner mobile UX

### Possible later enhancement

After the still-frame version is stable:

- add a short `mp4` timelapse
- keep the still frames as the inspectable source of truth

## Storage strategy

Do not store raw Sentinel scenes.

Instead, store a small derived evidence package per reviewed water body:

- cropped, display-ready frame images
- optional derived overlay images
- one metadata record per frame

### Scope recommendation

Start only with the existing `flagship-history` cohort:

- 12 flagship water bodies
- 6 to 8 frames each over the latest 12 months

That keeps the footprint manageable while still covering the lakes most users will inspect.

### Estimated scale

This is an engineering estimate, not a source-backed quota figure:

- `12 water bodies x 8 frames = 96 images`
- at roughly `200 KB` to `600 KB` per optimized frame, this is in the tens of megabytes, not hundreds

That is small enough to treat as curated product media rather than as a satellite archive.

## Recommended serving approach

### Do not serve live Earth Engine thumbnail URLs to the browser

Reason:

- `getThumbURL()` tokens expire after 2 hours according to the official Earth Engine image-visualization guide
- that makes them fragile for a public product
- it also pushes rendering and latency risk into the end-user experience

### Recommended production path

1. Generate curated frames server-side.
2. Download and persist them as stable public assets.
3. Serve them from app-controlled storage with predictable URLs.

### Suggested storage target

Use `Supabase Storage` for the final public assets so the frontend stays inside the existing app stack.

Possible future exception:

- if we later export MP4 directly from Earth Engine, a `Google Cloud Storage` bucket can be used as an intermediate generation target
- the final public URL can still be mirrored or fronted in a way that keeps the app experience consistent

## Recommended metadata model

We should store enough metadata to support public provenance and internal QA.

Suggested metadata fields:

- `gee_target_id`
- `frame_date`
- `reference_month`
- `source_dataset`
- `source_asset_id`
- `dynamic_world_asset_id`
- `image_url`
- `overlay_url`
- `usable_coverage_pct`
- `cloud_note`
- `geometry_version`
- `is_same_scene_as_overlay`
- `generated_at`
- `notes`

This can live in:

- a new Supabase table, or
- a generated JSON manifest if we want to start lighter

The important part is not where it lives. The important part is that we keep it.

## Frame selection rules

The evidence layer will be more trustworthy if the selection rules are explicit.

Recommended rules:

- prefer one reviewed frame every 1 to 2 months over the last 12 months
- prefer dates close to the monthly history snapshot dates already stored for the flagship cohort
- require good usable coverage before publishing a frame
- allow a nearby substitute date if the target month is too cloudy
- always show the actual acquisition date, never only the reference month
- do not publish a frame if cloud contamination makes the lake unreadable

Recommended initial quality threshold:

- only publish frames with `usable_coverage_pct >= 80%`

If a water body does not meet that threshold often enough, the evidence layer should gracefully show fewer frames rather than lower-quality ones.

## Visual design rules

The evidence layer should feel like product evidence, not GIS debugging output.

Recommended display elements:

- true-color Sentinel image
- water-body outline
- optional blue water overlay toggle
- acquisition date
- source label
- short interpretation note

Recommended note copy:

- `True-color Sentinel-2 image`
- `Optional water overlay derived from Dynamic World`
- `Visual evidence of surface spread, not storage volume`

## Public credibility rules

To make this genuinely credible, not just visually impressive, the public UI should preserve the following:

- exact acquisition dates
- source dataset names
- plain-English explanation that Dynamic World is derived from Sentinel imagery
- a public methods note explaining what the imagery can and cannot prove
- attribution for Dynamic World and Sentinel / Copernicus where required

For flagship bodies, we should also consider exposing a lightweight `image metadata` link or expandable note so a skeptical user can see that the asset lineage is real.

## What this evidence can and cannot prove

This section should be repeated in product copy and About-page docs.

What it can support:

- whether open water is visibly present
- whether recent spread looks larger or smaller than other reviewed dates
- whether a derived water overlay broadly matches the visible scene

What it cannot prove:

- exact storage volume
- bathymetry or water depth
- water quality
- whether every part of the scene is cloud-free or haze-free
- exact water edge under dense vegetation or shadow

## Key risks

### Optical limitations

- clouds
- haze
- sunglint
- shallow-water color variation
- aquatic vegetation masking visible water

### Interpretation risks

- users may confuse visible spread with storage volume
- users may assume every image is from the exact same day as the chart point unless we label it clearly
- users may over-trust the overlay if we do not label it as model-derived

### Operational risks

- generating too many images for too many water bodies too early
- serving expiring Earth Engine URLs directly
- shipping unreviewed frames that weaken trust instead of building it

## Recommended phased delivery

### Phase A: provenance-first prototype

- choose the `flagship-history` cohort only
- generate 6 reviewed true-color frames per body
- store a metadata manifest with dates and source asset IDs
- no public UI yet except internal QA

### Phase B: evidence modal

- add `See Satellite Evidence` to the water-body panel
- show frames, scrubber, outline, and source/date labels
- optionally show Dynamic World overlay as a toggle

### Phase C: chart + evidence alignment

- align the history chart points with the nearest reviewed evidence dates
- help users compare `recent visible spread` with `what the lake looked like`

### Phase D: heavier media only if needed

- optional MP4 timelapse
- optional public metadata endpoint
- optional Sentinel-1 support for cloudy months

## Recommended first implementation decision

If we build this next, the best first cut is:

- still frames, not GIF
- Sentinel-2 true color as the default view
- optional Dynamic World overlay toggle
- flagship-history cohort only
- stable stored assets, not live Earth Engine URLs

That gives us the cleanest trust gain for the least product risk.

## Sources

Primary sources used for this note:

- [Dynamic World V1 - Earth Engine dataset page](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1)
- [Dynamic World paper (Scientific Data, 2022)](https://doi.org/10.1038/s41597-022-01307-4)
- [Sentinel-2 Harmonized - Earth Engine dataset page](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED)
- [Earth Engine image visualization guide](https://developers.google.com/earth-engine/guides/image_visualization)
- [ee.Image.getThumbURL()](https://developers.google.com/earth-engine/apidocs/ee-image-getthumburl)
- [ee.ImageCollection.getVideoThumbURL()](https://developers.google.com/earth-engine/apidocs/ee-imagecollection-getvideothumburl)
- [Earth Engine exporting data guide](https://developers.google.com/earth-engine/guides/exporting)
- [Earth Engine exporting video guide](https://developers.google.com/earth-engine/guides/exporting_video)
- [Dynamic World project site](https://dynamicworld.app/)
