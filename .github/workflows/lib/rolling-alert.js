/**
 * One rolling issue per alert channel, instead of one issue per run.
 *
 * WHY. Both alert workflows put the run date in the issue title, so their
 * "does an issue already exist" check could only ever match a run from the
 * same day. Every run therefore opened a NEW issue. By 2026-08-14 the
 * freshness channel had 16 open issues covering 30 Jul to 14 Aug, and every
 * one of them reported the SAME two stale feeds - madurai wris-groundwater
 * and bangalore cauvery-rainfall-deviation. Nothing had changed in sixteen
 * days; the channel just restated itself daily.
 *
 * That is worse than no alert. Three real Headwaters edition detections were
 * sitting in the same pile, unread, because the label they arrive under had
 * been trained to mean "ignore me".
 *
 * THE RULE HERE: an issue being open means "this is true right now". A
 * notification means "this changed". So:
 *
 *   - one open issue per channel, body rewritten in place each run
 *   - a comment ONLY when the set of flagged items differs from last run,
 *     naming what appeared and what cleared
 *   - the issue closes itself when nothing is flagged
 *
 * The state is a sorted, newline-joined key list in an HTML comment in the
 * body, so it survives edits and needs no external store.
 */

const MARKER_OPEN = "<!--alert-state:";
const MARKER_CLOSE = "-->";

function readState(body) {
  if (!body) return [];
  const i = body.indexOf(MARKER_OPEN);
  if (i === -1) return [];
  const j = body.indexOf(MARKER_CLOSE, i);
  if (j === -1) return [];
  return body
    .slice(i + MARKER_OPEN.length, j)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

function writeState(keys) {
  return `${MARKER_OPEN}${[...keys].sort().join("|")}${MARKER_CLOSE}`;
}

function diff(before, after) {
  const b = new Set(before);
  const a = new Set(after);
  return {
    appeared: after.filter((k) => !b.has(k)),
    cleared: before.filter((k) => !a.has(k)),
  };
}

/**
 * @param {object} o
 * @param {object} o.github            authenticated octokit (actions/github-script)
 * @param {object} o.context           actions context
 * @param {string} o.title             stable title, NO date
 * @param {string[]} o.labels          labels to apply on create
 * @param {string} o.report            markdown body from the checker
 * @param {string[]} o.keys            stable ids of the flagged items ([] = all clear)
 * @param {string} o.footer            channel-specific handling notes
 */
async function rollingAlert({ github, context, title, labels, report, keys, footer }) {
  const { owner, repo } = context.repo;
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const { data: open } = await github.rest.issues.listForRepo({
    owner, repo, labels: labels[0], state: "open", per_page: 100,
  });
  const existing = open.find((i) => i.title === title);
  const previous = existing ? readState(existing.body) : [];
  const current = [...keys].sort();

  // All clear: close the issue if one is open, say so, and stop.
  if (current.length === 0) {
    if (existing) {
      await github.rest.issues.createComment({
        owner, repo, issue_number: existing.number,
        body: `All clear as of this run - every item previously flagged has cleared.\n\n**Run:** ${runUrl}`,
      });
      await github.rest.issues.update({
        owner, repo, issue_number: existing.number, state: "closed",
      });
    }
    return;
  }

  const body = [
    report,
    "",
    footer,
    "",
    `**Run:** ${runUrl}`,
    "",
    "This issue is rewritten in place on every run. It is open because the",
    "items above are flagged RIGHT NOW. You are only notified when that set",
    "changes, so a comment here always means something is different.",
    "",
    writeState(current),
  ].join("\n");

  if (!existing) {
    await github.rest.issues.create({ owner, repo, title, labels, body });
    return;
  }

  await github.rest.issues.update({ owner, repo, issue_number: existing.number, body });

  const { appeared, cleared } = diff(previous, current);
  if (appeared.length === 0 && cleared.length === 0) return; // unchanged: stay silent

  const lines = [];
  if (appeared.length) lines.push(`**Newly flagged (${appeared.length}):**`, ...appeared.map((k) => `- ${k}`), "");
  if (cleared.length) lines.push(`**Cleared (${cleared.length}):**`, ...cleared.map((k) => `- ${k}`), "");
  lines.push(`**Run:** ${runUrl}`);
  await github.rest.issues.createComment({
    owner, repo, issue_number: existing.number, body: lines.join("\n"),
  });
}

/**
 * ONE digest issue for every pipeline alert, with a known-blocked state.
 *
 * WHY. itemAlerts gave each stale feed its own issue, so a long-lived item
 * could not hide a new one (the rolling freshness issue had stayed open 46 days
 * on one dead upstream while new stale feeds went by as comments). By
 * 2026-10-23 that meant 28 open issues, most of them for sources already known
 * to be blocked - the JJM login wall in front of ten Atlas directories, Satara
 * since 2 Oct, Hyderabad's reservoirs - and the two that needed a person (a
 * migration never applied, a BMC fetch that failed) sat in the pile.
 *
 * Here:
 *   - the freshness check and the Atlas refresh each write into the same
 *     issue; a run replaces only its own channel's items, and
 *     with `scope` only the items it actually looked at
 *   - an item matched by an entry in known-blocked.json is listed under that
 *     entry's reason and never notifies; on the entry's review date it counts
 *     as new again, so a block cannot go quiet for good
 *   - every other item needs a look: named in the title, listed first, and a
 *     comment (the notification) only when one appears or its level rises
 *   - the issue closes itself when nothing is flagged
 *
 * State is JSON in an HTML comment at the end of the body. Two channels
 * writing in the same second would drop the earlier update until that channel
 * runs again; the schedules (06:30 UTC daily, Atlas on the 2nd, one district
 * at a time) keep that unlikely.
 */
const DIGEST_OPEN = "<!--alert-digest:";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS, loaded by actions/github-script
const KNOWN_BLOCKED = require("./known-blocked.json");

function readDigest(body) {
  const i = body ? body.indexOf(DIGEST_OPEN) : -1;
  if (i === -1) return null;
  return JSON.parse(body.slice(i + DIGEST_OPEN.length, body.indexOf(MARKER_CLOSE, i)));
}

// "--" only occurs inside JSON strings, where - reads back the same.
const writeDigest = (state) => `${DIGEST_OPEN}${JSON.stringify(state).replace(/--/g, "-\\u002d")}${MARKER_CLOSE}`;

const pattern = (p) => new RegExp(`^${p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);

/**
 * @param {object} o
 * @param {string} o.channel          freshness | atlas-refresh
 * @param {{id: string, summary: string, detail?: string, level: number}[]} o.items  flagged now
 * @param {string[]} [o.scope]        ids this run looked at; the channel's other items are kept.
 *                                    Omitted = the whole channel.
 * @param {string} o.note             handling notes for the channel
 */
async function digest({
  github, context, channel, items, scope, note,
  register = KNOWN_BLOCKED,
  today = new Date().toISOString().slice(0, 10),
}) {
  const { owner, repo } = context.repo;
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const open = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, labels: "pipeline-alert", state: "open", per_page: 100,
  });
  const existing = open.find((i) => readDigest(i.body));
  const state = existing ? readDigest(existing.body) : { channels: {}, needs: {} };

  const before = state.channels[channel]?.items ?? {};
  state.channels[channel] = {
    note, run: runUrl, ran: today,
    items: Object.fromEntries([
      ...(scope ? Object.entries(before).filter(([id]) => !scope.includes(id)) : []),
      ...items.map((i) => [i.id, { summary: i.summary, detail: i.detail, level: i.level, since: before[i.id]?.since ?? today }]),
    ]),
  };

  const all = Object.values(state.channels).flatMap((c) => Object.entries(c.items).map(([id, i]) => ({ id, ...i })));
  if (all.length === 0) {
    if (existing) {
      await github.rest.issues.createComment({
        owner, repo, issue_number: existing.number,
        body: `All clear as of this run - nothing is flagged.\n\n**Run:** ${runUrl}`,
      });
      await github.rest.issues.update({ owner, repo, issue_number: existing.number, state: "closed" });
    }
    return;
  }
  for (const i of all) {
    const entry = register.entries.find((e) => e.match.some((p) => pattern(p).test(i.id)));
    if (entry && entry.review >= today) i.block = entry;
    else if (entry) i.lapsed = entry;
  }
  const needs = all.filter((i) => !i.block);
  const blocked = all.filter((i) => i.block);
  const worse = needs.filter((i) => !(i.id in state.needs) || i.level > state.needs[i.id]);
  state.needs = Object.fromEntries(needs.map((i) => [i.id, i.level]));

  const head = needs.length === 0 ? "nothing new" : needs.length <= 3 ? needs.map((i) => i.id).join(", ") : `${needs.length} need a look`;
  const title = `Pipeline alerts: ${head}${blocked.length ? ` (+${blocked.length} known blocked)` : ""}`;
  const line = (i) =>
    `- **${i.id}** - ${i.summary}${i.detail ? ` ${i.detail}` : ""} (${i.since === today ? "new today" : `since ${i.since}`})` +
    (i.lapsed ? ` Known blocked until ${i.lapsed.review}: ${i.lapsed.reason} Recheck, then move the review date or remove the entry.` : "");
  const lines = [
    `**${needs.length} need a look, ${blocked.length} known blocked.** Updated ${today}.`,
    "",
    "### Needs a look",
    ...(needs.length ? needs.map(line) : ["Nothing. Everything flagged is known blocked."]),
  ];
  if (blocked.length) {
    lines.push("", `<details><summary>Known blocked (${blocked.length})</summary>`, "");
    for (const e of register.entries) {
      const its = blocked.filter((i) => i.block === e);
      if (its.length)
        lines.push(`**${e.reason}** Since ${e.since}, review ${e.review}${e.issue ? `, tracked in #${e.issue}` : ""}.`, "", ...its.map((i) => `- ${i.id} - ${i.summary}`), "");
    }
    lines.push("</details>");
  }
  const unused = register.entries.filter((e) => !all.some((i) => i.block === e || i.lapsed === e));
  lines.push(
    "", "### Notes",
    "- To mark an item known blocked, add it to `.github/workflows/lib/known-blocked.json` with the reason and a review date. On that date it comes back here as needing a look.",
    ...unused.map((e) => `- Matches nothing flagged, so it can come out of known-blocked.json: ${e.reason}`),
    ...Object.entries(state.channels).map(([name, c]) => `- **${name}** (last run ${c.ran}, [log](${c.run})): ${c.note}`),
    "",
    "This issue is rewritten in place by every alert run and closes itself when nothing is flagged. A comment here means something new needs a look.",
    "",
    writeDigest(state),
  );
  const body = lines.join("\n");

  if (!existing) {
    await github.rest.issues.create({ owner, repo, title, labels: ["pipeline-alert"], body });
    return;
  }
  await github.rest.issues.update({ owner, repo, issue_number: existing.number, title, body });
  if (worse.length)
    await github.rest.issues.createComment({
      owner, repo, issue_number: existing.number,
      body: [`**Needs a look (${worse.length}):**`, ...worse.map(line), "", `**Run:** ${runUrl}`].join("\n"),
    });
}

module.exports = { rollingAlert, digest, readState, writeState, readDigest, diff };
