import type { Metadata } from "next";
import Link from "next/link";
import { Newsreader } from "next/font/google";

import {
  chembarambakkamImage,
  chokkarasanapalliRecord,
  kelavarapalliRecord,
  puneChainStorage,
  registryFacts,
  vandiyurSeries,
} from "@/lib/for-organisations/data";
import { CopyAddress } from "./copy-address";
import s from "./page.module.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "For organisations | Neer Vazhvu",
  description:
    "The open record is free. For a place of your own: water readings, a registry for your water data, seasonal re-reads and high-resolution imagery, kept private.",
  alternates: { canonical: "/for-organisations" },
};

const display = Newsreader({ subsets: ["latin"], weight: ["300", "500"], variable: "--font-display", display: "swap" });

const CONTACT = "contact@neervazhvu.org";
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => WORDS[n] ?? String(n);

const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
// Fixed month names: en-GB in current ICU prints "Sept", which the rest of the site never uses.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (iso: string) => `${MON[utc(iso).getUTCMonth()]} ${utc(iso).getUTCFullYear()}`;
const day = (iso: string) => `${utc(iso).getUTCDate()} ${month(iso)}`;
const frac = (d: Date, d0: Date, d1: Date) => (d.getTime() - d0.getTime()) / (d1.getTime() - d0.getTime());

function Gauge({ pct }: { pct: number }) {
  const [top, bot, x, w] = [12, 312, 14, 46];
  const y = bot - ((bot - top) * pct) / 100;
  return (
    <svg viewBox="0 0 100 324" role="img" aria-label={`Gauge: ${pct.toFixed(1)} percent of live capacity`}>
      <g className={s.gaugeWater}>
        <rect className={s.gaugeFill} x={x} y={y} width={w} height={bot - y} />
        <path className={s.gaugeSurface} d={`M${x} ${y} C ${x + 8} ${y - 4}, ${x + 15} ${y + 4}, ${x + 23} ${y} S ${x + 38} ${y - 4}, ${x + w} ${y}`} />
      </g>
      <rect className={s.gaugeFrame} x={x} y={top} width={w} height={bot - top} strokeWidth={1.5} />
      {Array.from({ length: 11 }, (_, k) => {
        const i = k * 10;
        const ty = bot - ((bot - top) * i) / 100;
        return (
          <g key={i}>
            <line className={s.tick} x1={x + w} x2={x + w + (i % 50 === 0 ? 14 : 7)} y1={ty} y2={ty} strokeWidth={1} />
            {i % 50 === 0 && <text className={s.tickLabel} x={x + w + 18} y={ty + 4}>{i}</text>}
          </g>
        );
      })}
    </svg>
  );
}

type Box = { L: number; R: number; T: number; B: number; d0: Date; d1: Date; ymax: number };
const X = (b: Box, iso: string) => b.L + (b.R - b.L) * frac(utc(iso), b.d0, b.d1);
const Y = (b: Box, v: number) => b.B - ((b.B - b.T) * v) / b.ymax;

function Frame({ b, yticks, years, unit }: { b: Box; yticks: number[]; years: number[]; unit: string }) {
  return (
    <>
      {yticks.map((v) => (
        <g key={`y${v}`}>
          <line className={s.axis} x1={b.L} x2={b.R} y1={Y(b, v)} y2={Y(b, v)} strokeWidth={1} />
          <text className={s.axisLabel} x={b.L - 6} y={Y(b, v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      <text className={s.axisLabel} x={b.L - 6} y={b.T - 10} textAnchor="end">{unit}</text>
      {years.map((yr) => {
        const xx = X(b, `${yr}-01-01`);
        return (
          <g key={`x${yr}`}>
            <line className={s.axis} x1={xx} x2={xx} y1={b.B} y2={b.B + 5} strokeWidth={1} />
            <text className={s.axisLabel} x={xx} y={b.B + 19} textAnchor="middle">{yr}</text>
          </g>
        );
      })}
    </>
  );
}

function BodChart({ r }: { r: NonNullable<ReturnType<typeof chokkarasanapalliRecord>> }) {
  const b: Box = { L: 44, R: 548, T: 28, B: 262, d0: utc("2017-07-01"), d1: utc("2026-06-30"), ymax: 160 };
  const bx0 = X(b, "2022-04-01");
  const bx1 = X(b, "2024-03-31");
  const cy = Y(b, r.criterion);
  return (
    <svg viewBox="0 0 560 300" role="img" aria-label={`Biochemical oxygen demand in each laboratory sample at Chokkarasanapalli, ${day(r.first)} to ${day(r.last)}`}>
      <rect className={s.band} x={bx0} y={Y(b, r.rangeHi)} width={bx1 - bx0} height={Y(b, r.rangeLo) - Y(b, r.rangeHi)} />
      <text className={s.axisLabel} x={(bx0 + bx1) / 2} y={Y(b, r.rangeHi) - 8} textAnchor="middle">filed as a range</text>
      <Frame b={b} yticks={[0, 40, 80, 120, 160]} years={[2018, 2020, 2022, 2024, 2026]} unit="mg/L" />
      <line x1={b.L} x2={b.R} y1={cy} y2={cy} strokeWidth={1.5} strokeDasharray="4 4" style={{ stroke: "var(--ink)" }} />
      <text className={s.axisLabel} x={b.R} y={cy - 6} textAnchor="end">bathing criterion</text>
      {r.bod.map(([d, v]) => <circle key={d} className={s.dot} cx={X(b, d)} cy={Y(b, v)} r={3.2} />)}
    </svg>
  );
}

function TankChart({ v }: { v: ReturnType<typeof vandiyurSeries> }) {
  const b: Box = { L: 44, R: 548, T: 40, B: 262, d0: utc("1992-07-01"), d1: utc("2027-01-01"), ymax: 320 };
  const refs: [number, string][] = [
    [v.registerHa, `WRD register, full tank: ${v.registerHa} ha`],
    [v.boundaryHa, `Tank boundary as mapped: ${Math.round(v.boundaryHa)} ha`],
  ];
  const first = v.landsat[0][0];
  const last = v.radar[v.radar.length - 1][0];
  return (
    <svg viewBox="0 0 560 300" role="img" aria-label={`Vandiyur tank water spread in hectares, ${month(first)} to ${month(last)}`}>
      <Frame b={b} yticks={[0, 100, 200, 300]} years={[1995, 2000, 2005, 2010, 2015, 2020, 2025]} unit="ha" />
      {refs.map(([val, label]) => (
        <g key={label}>
          <line x1={b.L} x2={b.R} y1={Y(b, val)} y2={Y(b, val)} strokeWidth={1} strokeDasharray="3 4" style={{ stroke: "var(--muted)" }} />
          <text className={s.axisLabel} x={b.L + 6} y={Y(b, val) - 5}>{label}</text>
        </g>
      ))}
      {v.landsat.map(([d, ha]) => <circle key={d} cx={X(b, d)} cy={Y(b, ha)} r={2.2} style={{ fill: "var(--muted)" }} />)}
      <polyline
        points={v.radar.map(([d, ha]) => `${X(b, d).toFixed(1)},${Y(b, ha).toFixed(1)}`).join(" ")}
        fill="none" strokeWidth={1.6} strokeLinejoin="round" style={{ stroke: "var(--accent)" }}
      />
      <circle cx={b.L + 4} cy={14} r={2.6} style={{ fill: "var(--muted)" }} />
      <text className={s.axisLabel} x={b.L + 12} y={18}>Landsat, one dot a month</text>
      <line x1={b.L + 196} x2={b.L + 216} y1={14} y2={14} strokeWidth={2} style={{ stroke: "var(--accent)" }} />
      <text className={s.axisLabel} x={b.L + 222} y={18}>Sentinel-1 radar</text>
    </svg>
  );
}

function Waterline({ flip = false }: { flip?: boolean }) {
  const [a, c] = flip ? [13, 1] : [1, 13];
  return (
    <svg className={s.waterline} viewBox="0 0 1200 14" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M0 7 C 60 ${a}, 120 ${c}, 180 7 S 300 ${a}, 360 7 S 480 ${c}, 540 7 S 660 ${a}, 720 7 S 840 ${c}, 900 7 S 1020 ${a}, 1080 7 S 1170 11, 1200 7`} />
    </svg>
  );
}

function RegistryCard({ kel }: { kel: NonNullable<ReturnType<typeof kelavarapalliRecord>> }) {
  const kp = kel.p;
  const srcs = Object.fromEntries(kel.envelope.provenance.sources.map((x) => [x.id, x]));
  return (
    <div className={s.splitProof}>
      <article className={s.record} aria-label="One entry from the registry">
        <div className={s.recordHead}>
          <span className={s.recordName}>Kelavarapalli reservoir</span>
          <span className={`${s.small} ${s.muted}`}>Krishnagiri district, Tamil Nadu</span>
        </div>
        <dl>
          <dt>Storage</dt><dd>{kp.storagePercentOfCapacity}% of capacity, {kp.storageMcft} Mcft</dd>
          <dt>Depth</dt><dd>{kp.storageDepthFt} ft ({kp.fullCapacityFt} ft when full)</dd>
          <dt>Water spread</dt><dd>{kp.waterspreadHa} ha</dd>
          <dt>Read on</dt><dd>{day(String(kp.storageReadOn))}</dd>
        </dl>
        <div className={s.recordBlock}>
          <span className={`${s.small} ${s.muted}`}>Registry entry</span>
          <dl>
            <dt>Dataset</dt><dd>{kel.envelope.dataset}</dd>
            <dt>Place</dt><dd>{kel.envelope.scope.id} ({kel.envelope.scope.kind}), sub-basin {kp.shedId}</dd>
            <dt>Sources</dt><dd>{kel.envelope.provenance.sources.length}, each with its publisher and licence</dd>
            <dt>Method</dt><dd>{kel.envelope.provenance.method}</dd>
            <dt>Produced</dt><dd>{day(kel.envelope.provenance.produced_at)}</dd>
            <dt>Level</dt><dd>{kel.level}: source, licence, date and method attached</dd>
          </dl>
        </div>
        <div className={`${s.recordBlock} ${s.small}`}>
          <span>
            <strong>Storage and depth:</strong> {srcs["tnsmart-rimes-reservoirs"]?.title.split(" (")[0]}, read daily. The dashboard
            states no terms of use, so the reading is shown as a dated fact with the dashboard named.
          </span>
          <span>
            <strong>Spread and basin:</strong> {srcs["tngis-open-geoserver"]?.publisher}, published with its permission and attribution.
          </span>
        </div>
      </article>
    </div>
  );
}

const COMPARE: [string, string, string][] = [
  ["Where", "The cities and districts on the site", "Any site, tank, lake, river or district you name"],
  ["What you get", "Maps and dashboards of public data", "A written answer to your question: is this site’s water secure, which tanks to restore first, did the restoration hold water"],
  ["Imagery", "Free satellite images", "Adds high-resolution imagery that cannot be published openly"],
  ["Over time", "Updated when public sources update", "Your places re-read every season, with a flag when something changes"],
  ["Who sees it", "Everyone", "Only you"],
  ["Format", "Web pages", "Reports and editable decks for your board, material for BRSR and CDP disclosures, data files for your systems"],
  ["Checks", "Every source cited", "Every number re-derived by an independent check before it reaches you"],
];

const WORK: [string, string, string][] = [
  ["Company sites", "A site water reading for a food factory in Karnataka and a first screen of the same company’s other sites, scoping for a warehouse portfolio across India, and a feasibility read for sites in Bangladesh.", "For companies and their consultants"],
  ["Rivers and canals", "A baseline of the Buckingham Canal from Ennore to Mahabalipuram: its course, widths, banks and how they have changed. The Cooum and the Thenpennai at Hosur are on the open site.", "For a state water project developer"],
  ["Lakes and tanks", "Records for Bengaluru lakes showing which restorations held water, record sheets for lakes funded by CSR, Chennai’s temple tanks read on high-resolution imagery, a dossier on Chembarambakkam, and a screen of tanks across three cities to find which to restore first.", "For funders and restoration partners"],
  ["Groundwater", "Groundwater stress block by block across the district atlases, a groundwater screen of an industrial area in Alwar, a parcel-level groundwater ledger in development, and evidence of seawater moving inland north of Chennai.", "For companies, funders and research partners"],
  ["Districts, basins and countries", "District atlases that open down to each gram panchayat, river-basin maps for Erode, Krishnagiri, Mumbai and the Vrishabhavathi built with local partners, and a water profile of Abu Dhabi and Dubai.", "On the open site, and for partners"],
  ["Flood risk", "A street-scale flood pilot for HSR Layout, Bengaluru: which streets go under in a design storm and in a downpour like September 2022, with drains working, half-blocked or blocked. We map where water spreads, never how deep it stands.", "With a Bengaluru water research group"],
];

export default function ForOrganisationsPage() {
  const pune = puneChainStorage();
  const kel = kelavarapalliRecord();
  const hosur = chokkarasanapalliRecord();
  const reg = registryFacts();
  const tank = vandiyurSeries();
  const img = chembarambakkamImage();
  const n = (x: number) => x.toLocaleString("en-IN");


  return (
    <div className={`${s.root} ${display.variable}`}>
      <div className={s.page}>
        <section className={`${s.split} ${s.hero}`} aria-labelledby="h-hero">
          <div className={s.splitText}>
            <h1 id="h-hero">India’s water, on the record.</h1>
            <p className={s.lede}>
              We join the reservoir bulletins, groundwater assessments, pollution samples, court filings and satellite images that
              already exist into one dated record. Then we read what is on the ground today.
            </p>
            <p className={`${s.forLine} ${s.muted}`}>
              Built for companies checking a site, funders restoring lakes and tanks, and departments watching rivers, canals and
              flood-prone streets.
            </p>
            <div className={s.actions}>
              <a className={s.chip} href="#brief">Get a water reading <span aria-hidden="true">→</span></a>
              <Link className={s.secondary} href="/">Open the public record</Link>
            </div>
          </div>
          {pune && (
          <div className={s.splitProof}>
            <figure className={s.gauge} aria-labelledby="gauge-cap">
              <Gauge pct={pune.pct} />
              <div className={s.gaugeRead}>
                <span className={s.gaugeValue}>{pune.pct.toFixed(1)}%</span>
                <span className={s.gaugeWhat} id="gauge-cap">
                  <strong>Live storage in the {word(pune.dams)} Khadakwasla-chain dams, Pune’s main city source</strong>
                  <br />
                  {day(pune.date)} · {pune.storage.toFixed(1)} of {pune.capacity.toFixed(1)} million m³
                  <br />
                  Maharashtra WRD daily dam bulletin
                </span>
              </div>
            </figure>
          </div>
          )}
        </section>

        <section className={s.stack} aria-labelledby="h-compare">
          <div className={`${s.stackHead} ${s.compareHead}`}>
            <h2 id="h-compare">The record is free. The answer for your place is the work.</h2>
            <p className={s.muted}>Everything on neervazhvu.org stays open. When you need a decision about a place of your own, this is what changes.</p>
          </div>
          <div className={s.sheetWrap}>
            <table className={s.sheet}>
              <thead>
                <tr>
                  <th scope="col"><span className={s.visuallyHidden}>What</span></th>
                  <th scope="col">The open record, free</th>
                  <th scope="col">Working with us</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([what, free, paid]) => (
                  <tr key={what}>
                    <th scope="row">{what}</th>
                    <td data-label="Free">{free}</td>
                    <td data-label="With us">{paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Waterline />

        <section className={`${s.split} ${s.flip}`} aria-labelledby="h-registry">
          <div className={s.splitText}>
            <h2 id="h-registry">The registry: one shape for every water dataset.</h2>
            <p>
              India has the water data, scattered across district PDFs, state dashboards, court filings and satellite archives, each
              with its own names, units and dates. Our data model gives every dataset the same shape: the place it describes, who
              published it, under what licence, how it was made and when.
            </p>
            <p>
              The registry holds {n(reg.files)} files today. {n(reg.enveloped)} carry their source, licence, date and method, and{" "}
              {n(reg.contracted)} are checked field by field against a published dataset contract. They cover the {reg.cities} cities and{" "}
              {reg.districts} districts live on the site, across {reg.places} registered places, and we watch {reg.sources} upstream sources for a new edition.
            </p>
            <h3>The registry as a service</h3>
            <ul className={s.ruleList}>
              <li>Bring your own water data: a utility’s meters, a programme’s works, a research group’s samples. We put each dataset into the standard with its source, licence, date and method attached.</li>
              <li>We join it to the places it describes, with the official codes for wards, villages, blocks, districts and basins.</li>
              <li>Every file is checked against the standard, and you get a conformance level you can show a funder or an auditor.</li>
              <li>We watch your sources, flag a new edition when it lands, and give every release a version number.</li>
              <li>
                The data model is an <a href="https://github.com/SundareshPrasanna/neer-vazhvu/tree/main/schemas/nvdm">open standard under CC BY 4.0</a>, so your data is never locked to us.
              </li>
            </ul>
            <span className={s.forWhom}>For agencies, utilities, research groups, funders and platforms that hold water data of their own.</span>
          </div>
          {kel && <RegistryCard kel={kel} />}
        </section>

        <section className={s.split} aria-labelledby="h-layers">
          <div className={s.splitText}>
            <h2 id="h-layers">Four layers, each built on the one below.</h2>
            <ol className={s.layers}>
              {[
                ["The registry", "Every source joined into one standard shape, released in public with a version number. We watch each source and flag a new edition when it lands."],
                ["Readings", "What is there today: reservoir storage and days of supply, groundwater stress by block, river quality, flood extents, shoreline change, and how often each part of a tank bed holds water. Each reading says whether it comes from a gauge, a bulletin or a satellite. Tank readings are in pilot."],
                ["Ledgers", "Who promised what, and what happened since: water allocations, public commitments and restoration works, set against the readings."],
                ["Briefings", "Plain-language summaries of what changed, in English and regional languages."],
              ].map(([title, text], i) => (
                <li key={title}>
                  <span className={s.layerN}>{i + 1}</span>
                  <div className={s.layerBody}><h3>{title}</h3><p>{text}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <div className={s.splitProof}>
            <figure className={s.figure}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized satellite composite */}
              <img src={img.src} width={img.px[0]} height={img.px[1]} alt="Chembarambakkam reservoir near Chennai seen from space in natural colour, full to its shorelines, with town and farmland around it." loading="lazy" />
              <figcaption>
                Chembarambakkam reservoir, Chennai, in natural colour: a cloud-free composite of {word(img.scenes)} Sentinel-2 scenes from{" "}
                {utc(img.window[0]).getUTCDate()}–{day(img.window[1])}. Readings start from images like this one.
              </figcaption>
            </figure>
          </div>
        </section>

        <Waterline flip />

        <section className={s.stack} aria-labelledby="h-work">
          <div className={s.stackHead}>
            <h2 id="h-work">Work we have done.</h2>
            <p className={s.muted}>For companies, funders, research groups and public agencies. Names appear here only with each client’s agreement.</p>
          </div>
          <ul className={s.workList}>
            {WORK.map(([title, text, who]) => (
              <li key={title}><h3>{title}</h3><p>{text}</p><span className={s.forWhom}>{who}</span></li>
            ))}
          </ul>
        </section>

        {hosur && (
        <section className={s.split} aria-labelledby="h-hosur">
          <div className={s.splitText}>
            <span className={s.place}>Hosur, Krishnagiri district, Tamil Nadu</span>
            <h2 id="h-hosur">The river record that was in court filings.</h2>
            <p>
              Where the Thenpennai enters Tamil Nadu from Karnataka, at Chokkarasanapalli, the Tamil Nadu Pollution Control Board
              samples the river every month. We found those results in filings before the National Green Tribunal, read each one, and
              put {hosur.samples} dated samples, from {month(hosur.first)} to {month(hosur.last)}, on the Krishnagiri district map beside{" "}
              {hosur.points} monitoring points from the joint sampling rounds.
            </p>
            <Link className={s.linkArrow} href="/embed/basins/krishnagiri-rivers">Open the Krishnagiri map →</Link>
          </div>
          <div className={`${s.splitProof} ${s.chart}`}>
            <figure className={s.figure}>
              <BodChart r={hosur} />
              <figcaption>
                Biochemical oxygen demand (BOD), a measure of sewage load, in each laboratory sample, mg/L. The dashed line is the outdoor
                bathing criterion of {hosur.criterion} mg/L. The board reported 2022–23 and 2023–24 only as a range, {hosur.rangeLo} to{" "}
                {hosur.rangeHi} mg/L, shown as the band.
              </figcaption>
            </figure>
          </div>
        </section>
        )}

        <section className={`${s.split} ${s.flip}`} aria-labelledby="h-tanks">
          <div className={s.splitText}>
            <span className={s.place}>Vandiyur tank, Madurai, Tamil Nadu</span>
            <h2 id="h-tanks">Tanks as they are today.</h2>
            <p>
              A tank register records each tank as it was designed: its full level, its spread, its capacity. Satellites show how it
              fills now. For Vandiyur we read {tank.landsat.length} months of Landsat from {month(tank.landsat[0][0])} and{" "}
              {tank.radar.length} radar scenes from {tank.radar[0][0].slice(0, 4)} to {tank.radar[tank.radar.length - 1][0].slice(0, 4)}, and
              mapped how often each part of the bed holds water. The same method has run on four more tanks in Tamil Nadu and Karnataka.
            </p>
            <p className={`${s.small} ${s.muted}`}>
              It shows where a tank holds water and how often. Turning that into a volume needs one surveyed water level, which is the
              next step. Pilot work, not yet on the open maps.
            </p>
          </div>
          <div className={`${s.splitProof} ${s.chart}`}>
            <figure className={s.figure}>
              <TankChart v={tank} />
              <figcaption>
                Vandiyur water spread, hectares. Dots: Landsat monthly water history, {month(tank.landsat[0][0])} to{" "}
                {month(tank.landsat[tank.landsat.length - 1][0])}, months with a clear view only. Line: Sentinel-1 radar,{" "}
                {month(tank.radar[0][0])} to {month(tank.radar[tank.radar.length - 1][0])}. Radar does not count water hidden under hyacinth.
              </figcaption>
            </figure>
          </div>
        </section>

        <Waterline />

        <section className={s.rules} aria-labelledby="h-rules">
          <div>
            <h2 id="h-rules" className={s.pull}>We never correct an agency’s figure. We put a dated reading beside it.</h2>
          </div>
          <ul className={s.ruleList}>
            <li>Every number shows its source and its date. Older figures are labelled as history, not as today.</li>
            <li>We check a source’s licence before we use it, and say so when a source states none.</li>
            <li>A satellite reading says what it cannot see, and every classification goes through manual review.</li>
            <li>We do not rank, score or grade the people who run India’s water.</li>
            <li>The code is open under the MIT licence, and the method is written down.</li>
          </ul>
        </section>

        <section className={s.brief} id="brief" aria-labelledby="h-brief">
          <div className={s.briefHead}>
            <h2 id="h-brief">Tell us a place.</h2>
            <p className={s.briefSub}>We’ll tell you where its water stands.</p>
          </div>
          <div className={s.briefAsk}>
            <ol>
              <li>The place: a name, an address or coordinates.</li>
              <li>The decision it supports.</li>
              <li>When you need it.</li>
            </ol>
            <p className={s.muted}>We reply with what the record already holds for that place, and what a reading would add.</p>
            <div className={s.contactBox}>
              <span className={s.contactLabel}>Write to us</span>
              <div className={s.contactActions}>
                <a className={s.emailButton} href={`mailto:${CONTACT}?subject=${encodeURIComponent("Water reading")}`}>
                  <span id="contact-address">{CONTACT}</span> <span aria-hidden="true">→</span>
                </a>
                <CopyAddress address={CONTACT} className={s.copy} targetId="contact-address" />
              </div>
            </div>
          </div>
        </section>

        <section className={s.sources} aria-label="Sources on this page">
          <p>
            Readings on this page: Maharashtra WRD Pravah daily dam bulletin (Pune); Tamil Nadu reservoir dashboard (TN-SMART, RIMES)
            and TNGIS (Kelavarapalli); TNPCB reports of analysis filed before the NGT Southern Zone in O.A. 111 of 2020 and O.A. 14 of
            2025 (Chokkarasanapalli); EC JRC Global Surface Water and Copernicus Sentinel-1 (Vandiyur); {img.credit.replace(", processed by Neer Vazhvu.", "")} (Chembarambakkam image).
            Registry figures from the NVDM conformance report. The code is on{" "}
            <a href="https://github.com/SundareshPrasanna/neer-vazhvu">GitHub</a> under the MIT licence, and each dataset keeps its publisher’s licence.
          </p>
        </section>
      </div>
    </div>
  );
}
