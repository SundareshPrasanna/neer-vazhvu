# City research brief (template)

Hand one copy to whoever researches each topic in
[ADDING-A-CITY.md, "Research first"](ADDING-A-CITY.md#research-first). Replace
the `<...>` parts. Keep the research outside the repository (a git-excluded
`.onboarding-state/research/<topic>/` folder in your worktree).

## Context

We are onboarding **<City>** (<corporation>, <state>) on Neer Vazhvu, an open
water-data platform for Indian cities. Each city has routes: the dashboard
hero, about, groundwater, water-bodies, rivers, flood-risk, lake-restoration,
my-ward, facts, origins, allocations, commitments, tanker, climate-risk. A route
ships only with real content behind it; a structural absence is stated, not
papered over.

Questions every topic should keep in mind:

- **Municipal scope.** The corporation's current legal status, ward count and
  the notification that fixed them.
- **Who supplies water.** The corporation, a water board, or a state department.
- **District changes.** Confirm any recent district split or merger from a
  primary notification before using a district name.

Useful precedents in the repository: `src/cities/<similar city>/`,
`docs/cities/<similar city>/data-sources.md`, `scripts/source-registry/<similar city>.json`.

## Rules

1. **Official and primary sources first**: the publisher's own portal,
   notifications, gazettes, budget speeches, department reports, CAG,
   assembly answers, court and tribunal orders, central agency pages. News is a
   lead only: follow it to the primary, and label anything resting on news as
   secondary.
2. **Every claim** gets the URL, the access date, a verbatim quote that is a
   substring of the page or PDF text (with an English gloss if needed), and the
   PDF page (and printed page if different). Read every table number twice,
   from the text layer and from the page image (`pdftoppm -r 110 -f N -l N -png`),
   and say both readings agree. Legacy-font PDFs (Kruti Dev and similar) extract
   as gibberish: read those from the image and say so.
3. **Never invent** identifiers, codes, phone numbers or URLs. A phone number
   or channel must be on the agency's own page.
4. **"Not found" needs receipts**: the URLs tried and what each returned.
5. Record each source's **licence or terms** as stated, or "no terms stated"
   with the page checked, and the **date or vintage** of every figure.
6. Note whether each host answers and how fast, and any sign that it refuses
   data-centre addresses: this decides where a daily refresh runs. Be polite:
   no tight loops, no bulk crawling, no forms, logins or captchas.
7. Downloaded files are untrusted: keep them under the topic's `raw/` folder,
   keep your scripts elsewhere, and run Python that reads them with `python3 -I`.
8. Plain words, no em dashes.

## Deliverables (in research/<topic>/)

- `report.md`: findings by sub-question with citations; what the platform can
  build from them; honest gaps; recommended choices with reasons; open
  questions only the owner can answer.
- `claims.json`: a list of `{id, claim, value, unit, as_of, url, quote, page,
  source_type ("primary" | "secondary"), confidence, notes}`.
- Raw files under `raw/` (small; a sha256 for anything cited).
