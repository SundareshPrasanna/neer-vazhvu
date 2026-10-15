/**
 * No lost spaces in hand-wrapped JSX prose.
 *
 * JSX drops whitespace that contains a line break next to an element, so
 * "word\n<strong>x</strong>" renders "word<strong>x" and
 * "</strong>\nword" renders "</strong>word". Next's SWC also drops the
 * same-line space in "</em> records" when that text runs onto another line and
 * contains an HTML entity (&apos;, &ldquo;, ...). The fix is an explicit {" "}
 * at the join. This walks every src/**\/*.tsx with the TypeScript parser and
 * fails on a join where a space belongs and none renders.
 */
import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const ROOT = process.cwd();

/** Joins that are meant to touch. `join` is matched against "left|right". */
const ALLOWED: { file: string; join: string; why: string }[] = [
  { file: "src/components/basin/station-readings-panel.tsx", join: "at the station|{compareKeys.length > 1", why: "plural s" },
  { file: "src/components/dashboard/regional-water-system.tsx", join: "|{footnotes(", why: "superscript footnote marker" },
];

const BLOCK = new Set(
  "address article aside blockquote br button canvas dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr iframe img input li main nav ol option p picture pre section select summary svg table tbody td textarea tfoot th thead tr ul video".split(" "),
);
const ENTITY = /&(#x[0-9a-f]+|#\d+|\w+);/i;
const ENTITIES: Record<string, string> = {
  amp: "&", apos: "'", quot: '"', nbsp: "\u00a0", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  mdash: "—", ndash: "–", minus: "−", rarr: "→", larr: "←", middot: "·", bull: "•", times: "×", asymp: "≈",
};
const decode = (s: string) =>
  s.replace(new RegExp(ENTITY, "gi"), (m, e: string) =>
    e[0] !== "#" ? (ENTITIES[e] ?? "\u0000") : String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : +e.slice(1)));
// A space belongs where the left side ends like a word, a clause or a spaced dash,
// and the right side starts like a word or a spaced dash or arrow.
const ENDS = /([\p{L}\p{N}\p{M}.,;:!?)\]%”"’]|\s[-–—−→←·•|&=+×≈])$/u;
const STARTS = /^([\p{L}\p{N}(\[“"₹$]|[-–—−→←·•|&=+×≈](\s|$))/u;
const WORD = "\u0001"; // text only known at runtime: an identifier, a call

/** What a JsxText renders (Babel's cleanJSXElementLiteralChild, as SWC ships it). */
function rendered(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/);
  let last = 0;
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) last = i; });
  let out = "";
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, " ");
    if (i > 0) t = t.replace(/^ +/, "");
    if (i < lines.length - 1) t = t.replace(/ +$/, "");
    if (t) out += i === last ? t : t + " ";
  });
  return swcDropsLead(raw) ? decode(out).replace(/^ +/, "") : decode(out);
}
const swcDropsLead = (raw: string) => raw.includes("\n") && ENTITY.test(raw);

/** The class tokens and inline-style string values an element sets. */
function classes(el: ts.JsxOpeningLikeElement): string[] {
  const out: string[] = [];
  for (const a of el.attributes.properties) {
    if (!ts.isJsxAttribute(a) || !a.initializer || !["className", "style"].includes(a.name.getText())) continue;
    const walk = (x: ts.Node): void => {
      if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || ts.isTemplateLiteralToken(x)) out.push(...x.text.split(/\s+/));
      ts.forEachChild(x, walk);
    };
    walk(a.initializer);
  }
  return out;
}

type Edge = string[]; // possible first or last two rendered characters; [] = nothing, or a block edge

function edge(n: ts.Node, side: "first" | "last"): Edge {
  const pick = (s: string) => (s ? [side === "first" ? s.slice(0, 2) : s.slice(-2)] : []);
  if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)) return edge(n.expression, side);
  if (ts.isJsxExpression(n)) return n.expression ? edge(n.expression, side) : [];
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return pick(n.text);
  if (ts.isTemplateExpression(n)) {
    const s = side === "first" ? n.head.text : n.templateSpans.at(-1)!.literal.text;
    return s ? pick(s) : [WORD];
  }
  if (ts.isNumericLiteral(n)) return ["0"];
  if (ts.isConditionalExpression(n)) return [...edge(n.whenTrue, side), ...edge(n.whenFalse, side)];
  if (ts.isBinaryExpression(n)) {
    const op = n.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return edge(n.right, side);
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return [...edge(n.left, side), ...edge(n.right, side)];
    if (op === ts.SyntaxKind.PlusToken) return edge(side === "first" ? n.left : n.right, side);
    return [WORD];
  }
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
    const name = n.expression.name.text;
    if (name === "join" && ts.isCallExpression(n.expression.expression)) return edge(n.expression.expression, side);
    if (name === "map" || name === "flatMap") {
      const fn = n.arguments[0];
      if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return [];
      if (!ts.isBlock(fn.body)) return edge(fn.body, side);
      const ret = fn.body.statements.filter(ts.isReturnStatement).at(-1);
      return ret?.expression ? edge(ret.expression, side) : [];
    }
  }
  if (ts.isJsxSelfClosingElement(n)) return []; // icons, swatches, widgets
  if (ts.isJsxElement(n)) {
    const cls = classes(n.openingElement);
    if (BLOCK.has(n.openingElement.tagName.getText()) || cls.some((c) => /^(block|flex|grid|table)$/.test(c))) return [];
    if (cls.some((c) => (side === "first" ? /^-?m[xls]-/ : /^-?m[xre]-/).test(c))) return []; // a margin spaces it
    return childEdge(n.children, side);
  }
  if (ts.isJsxFragment(n)) return childEdge(n.children, side);
  if (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isCallExpression(n))
    return n.getText() === "children" ? [] : [WORD];
  return [];
}

function childEdge(kids: ts.NodeArray<ts.JsxChild>, side: "first" | "last"): Edge {
  for (const k of side === "first" ? [...kids] : [...kids].reverse()) {
    if (ts.isJsxExpression(k) && !k.expression) continue;
    if (!ts.isJsxText(k)) return edge(k, side);
    const t = rendered(k.text);
    if (t) return [side === "first" ? t.slice(0, 2) : t.slice(-2)];
  }
  return [];
}

const snippet = (n: ts.Node, side: "first" | "last") => {
  const s = (ts.isJsxText(n) ? rendered(n.text) : n.getText()).replace(/\s+/g, " ");
  return side === "last" ? s.slice(-40) : s.slice(0, 40);
};

function lostSpaceJoins(file: string, src: string): { line: number; join: string }[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: { line: number; join: string }[] = [];
  const visit = (n: ts.Node) => {
    const flex = ts.isJsxElement(n) && classes(n.openingElement).some((c) => /^([\w-]+:)*(inline-)?(flex|grid)$/.test(c));
    if ((ts.isJsxElement(n) && !flex) || ts.isJsxFragment(n)) {
      const prose = n.children.some((c) => ts.isJsxText(c) && /\S/.test(c.text));
      let prev: ts.JsxChild | null = null;
      let lost = false; // the whitespace before the current child does not render
      for (const k of n.children) {
        if (ts.isJsxExpression(k) && !k.expression) continue; // a comment renders nothing
        if (ts.isJsxText(k)) {
          const lead = /^\s*/.exec(k.text)![0];
          if (!/\S/.test(k.text)) {
            if (lead.includes("\n")) lost = true;
            else [prev, lost] = [k, false];
            continue;
          }
          if (lead.includes("\n") || (lead && swcDropsLead(k.text))) lost = true;
        }
        if (prev && lost && (prose || ts.isJsxText(prev) || ts.isJsxText(k))) {
          const L = ts.isJsxText(prev) ? [rendered(prev.text).slice(-2)] : edge(prev, "last");
          const R = ts.isJsxText(k) ? [rendered(k.text).slice(0, 2)] : edge(k, "first");
          if (L.some((c) => c === WORD || ENDS.test(c)) && R.some((c) => c === WORD || STARTS.test(c)))
            found.push({ line: sf.getLineAndCharacterOfPosition(k.getStart()).line + 1, join: `${snippet(prev, "last")}|${snippet(k, "first")}` });
        }
        prev = k;
        lost = ts.isJsxText(k) && /\n\s*$/.test(k.text);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []);

test("detector: the ways a space is lost, and the ways it is kept", () => {
  const joins = (jsx: string) => lostSpaceJoins("t.tsx", `const x = ${jsx};`).length;
  assert.equal(joins(`<p>\n  a day\n  <strong>from</strong> b\n</p>`), 1);
  assert.equal(joins(`<p>\n  a <strong>day</strong>\n  from b\n</p>`), 1);
  assert.equal(joins(`<p>\n  a <em>X</em> records that &ldquo;b&rdquo;\n</p>`), 1);
  assert.equal(joins(`<a>\n  {label} &rarr;\n</a>`), 1);
  assert.equal(joins(`<p>a <em>X</em> records that &ldquo;b&rdquo;</p>`), 0);
  assert.equal(joins(`<p>\n  a <em>X</em>{" "}records that &ldquo;b&rdquo;\n</p>`), 0);
  assert.equal(joins(`<p>\n  a day{" "}\n  <strong>from</strong>{" "}\n  b <strong>c</strong>.\n</p>`), 0);
  assert.equal(joins(`<p>\n  a\n  <span className="ml-1">b</span>\n</p>`), 0);
});

test("JSX prose keeps its spaces at element joins", () => {
  const failures: string[] = [];
  const matched = new Set<number>();
  for (const path of tsxFiles(join(ROOT, "src"))) {
    const file = relative(ROOT, path);
    for (const j of lostSpaceJoins(file, readFileSync(path, "utf8"))) {
      const i = ALLOWED.findIndex((a) => a.file === file && j.join.includes(a.join));
      if (i >= 0) matched.add(i);
      else failures.push(`${file}:${j.line}  ${j.join}`);
    }
  }
  assert.equal(failures.length, 0, `Lost spaces (add {" "} at the join, or allowlist an intentional join):\n${failures.join("\n")}`);
  const stale = ALLOWED.filter((_, i) => !matched.has(i)).map((a) => `${a.file}: ${a.join}`);
  assert.deepEqual(stale, [], "Allowlist entries that no longer match a join; remove them.");
});
