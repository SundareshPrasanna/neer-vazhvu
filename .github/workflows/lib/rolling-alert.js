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
 * One issue per flagged item, for a channel where a long-lived item must not
 * hide a new one. The freshness channel's rolling issue stayed open 46 days on
 * one dead upstream while other feeds went stale inside it as comments nobody
 * read. Here:
 *
 *   - an item opens its own issue; the new issue is the notification
 *   - the body is rewritten each run; a comment only when the item's `level`
 *     rises (the checker decides what a level is)
 *   - the issue closes itself when the item is no longer flagged
 *
 * Issues are matched by the state marker in the body, not the title.
 *
 * @param {object} o
 * @param {{id: string, title: string, body: string, summary: string, level: number}[]} o.items
 * @param {string[]} [o.unknown]   ids that could not be checked this run: left as they are
 * @param {boolean} [o.complete]   false when `items` is not the full picture: nothing closes
 */
async function itemAlerts({ github, context, labels, items, unknown = [], complete = true, footer }) {
  const { owner, repo } = context.repo;
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const open = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, labels: labels[0], state: "open", per_page: 100,
  });
  const field = (issue, name) =>
    readState(issue.body).find((k) => k.startsWith(`${name}:`))?.slice(name.length + 1);
  const managed = open.filter((i) => field(i, "item") !== undefined);

  for (const item of items) {
    const body = [
      item.summary, "", item.body, "", footer, "", `**Run:** ${runUrl}`, "",
      "This issue is rewritten in place on every run and closes itself when the",
      "item clears. A comment here means it has got worse.",
      "",
      writeState([`item:${item.id}`, `level:${item.level}`]),
    ].join("\n");
    const existing = managed.find((i) => field(i, "item") === item.id);
    if (!existing) {
      await github.rest.issues.create({ owner, repo, title: item.title, labels, body });
      continue;
    }
    const before = Number(field(existing, "level"));
    await github.rest.issues.update({ owner, repo, issue_number: existing.number, body });
    if (item.level > before) {
      await github.rest.issues.createComment({
        owner, repo, issue_number: existing.number,
        body: `Still flagged: ${item.summary}\n\n**Run:** ${runUrl}`,
      });
    }
  }

  if (!complete) return;
  const keep = new Set([...items.map((i) => i.id), ...unknown]);
  for (const issue of managed.filter((i) => !keep.has(field(i, "item")))) {
    await github.rest.issues.createComment({
      owner, repo, issue_number: issue.number,
      body: `Cleared as of this run.\n\n**Run:** ${runUrl}`,
    });
    await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: "closed" });
  }
}

module.exports = { rollingAlert, itemAlerts, readState, writeState, diff };
