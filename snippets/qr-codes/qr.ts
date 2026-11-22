/**
 * QR codes, generated from a list.
 *
 *   npx tsx qr.ts --base-url https://example.com
 *
 * One card per active item, each as a standalone SVG, plus an HTML print sheet
 * that lays them out four to an A4 page. Switch another item on in `items.ts`,
 * run it again, and you get one more card, in the right colour, pointing at the
 * right address, with the numbers still running 1…n. Nothing to keep in sync by
 * hand.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { toString as qrToString } from "qrcode";
import { contrastRatio, DISPLAY, darkenTo, INK, PAPER } from "./colour.ts";
import { ACTIVE_ITEMS, type NumberedItem } from "./items.ts";

/** The card's own coordinate system. Printed size is set on the outer <svg>. */
const CARD = { width: 100, height: 100, padding: 6 };

const TRAILING_SLASHES = /\/+$/;

/**
 * How much of the code the centre badge may cover before it gets a warning.
 * Level H tolerates around 30%; stopping well short of that leaves room for a
 * scratched laminate and a cheap camera.
 */
const BADGE_WARN = 0.2;

/** Blank modules around the code. Scanners need them to find it at all. */
const QUIET_ZONE = 4;

/** Printed width of a standalone card. */
const CARD_MM = 90;

type Options = {
  baseUrl: string;
  out: string;
  centre: string;
  contrast: number;
  mono: boolean;
  perPage: 1 | 4;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.out, { recursive: true });

  const cards: string[] = [];
  console.log(
    `\n  ${"#".padStart(3)}  ${"item".padEnd(18)}  ${"colour".padEnd(9)}  contrast  badge`,
  );
  console.log(`  ${"─".repeat(58)}`);

  for (const item of ACTIVE_ITEMS) {
    const url = `${options.baseUrl}/s/${item.slug}`;
    const ink = options.mono ? INK : darkenTo(item.colour, options.contrast);
    const centre = options.centre.replaceAll("{n}", String(item.number));

    const card = await drawCard({item, url, ink, centre});

    const name = `${String(item.number).padStart(2, "0")}-${item.slug}.svg`;
    await writeFile(join(options.out, name), standalone(card.svg));
    cards.push(card.svg);

    const ratio = contrastRatio(ink, PAPER);
    const coverage = `${Math.round(card.badgeCoverage * 100)}%`;
    const warning = card.badgeCoverage > BADGE_WARN ? "  ⚠ large" : "";
    console.log(
      `  ${String(item.number).padStart(3)}  ${item.slug.padEnd(18)}  ` +
      `${ink.padEnd(9)}  ${ratio.toFixed(1).padStart(6)}:1  ` +
      `${coverage.padStart(5)}${warning}`,
    );
  }

  const sheet = join(options.out, "index.html");
  await writeFile(sheet, printSheet(cards, options));

  console.log(`\n  ${ACTIVE_ITEMS.length} cards in ${options.out}/`);
  console.log(`  Print: open ${sheet} and print at 100% (no scaling).`);
  console.log("  Test every code with the oldest phone you can find.\n");
}

/** One card: the background, the code and the badge in the middle. */
async function drawCard({
  item,
  url,
  ink,
  centre,
}: {
  item: NumberedItem;
  url: string;
  ink: string;
  centre: string;
}) {
  const {width, height, padding} = CARD;
  const size = width - padding * 2;

  const qr = await qrToString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: QUIET_ZONE,
    color: {dark: ink, light: PAPER},
  });
  const {modules, body} = unwrap(qr);
  const scale = size / modules;

  // The code itself, without the quiet zone the generator adds on each side.
  // That is what the badge has to stay inside, and what its coverage is worth
  // measuring against.
  const codeModules = modules - QUIET_ZONE * 2;
  const codeSize = codeModules * scale;
  const badge = centre
    ? layOutBadge(centre, codeSize, (codeModules - 3) * scale)
    : null;

  return {
    badgeCoverage: badge
      ? (badge.width * badge.height) / (codeSize * codeSize)
      : 0,
    svg: `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${item.number}: ${escaped(item.title)}">
	<rect width="${width}" height="${height}" rx="3" fill="${PAPER}" stroke="#E7D9BD" stroke-width="0.3"/>
	<g transform="translate(${padding} ${padding}) scale(${scale})" shape-rendering="crispEdges">${body}</g>
${badge ? badgeSvg(badge, ink, padding, padding, size) : ""}
</svg>`,
  };
}

/**
 * The badge over the middle of the code.
 *
 * Sized from the code rather than in millimetres, so it stays the same
 * fraction of whatever it covers, and kept inside the innermost square of
 * the code.
 *
 * That last part matters. Error correction will happily rebuild the data
 * modules the badge sits on, but the timing patterns (the dashed row and
 * column six modules in from the edges) have no error correction at all:
 * they are how a scanner works out where the grid is. A badge wide enough to
 * cross them takes the whole code with it.
 *
 * So a long label shrinks its text rather than growing towards the edges.
 */
function layOutBadge(text: string, codeSize: number, safeSpan: number) {
  const height = Math.min(codeSize * 0.18, safeSpan);
  const maxWidth = safeSpan;

  let fontSize = height * 0.55;
  let width = Math.max(
    height * 1.5,
    text.length * fontSize * 0.62 + height * 0.7,
  );

  if (width > maxWidth) {
    fontSize *= Math.max(
      0.2,
      (maxWidth - height * 0.7) / (width - height * 0.7),
    );
    width = maxWidth;
  }

  return {text, width, height, fontSize};
}

function badgeSvg(
  badge: ReturnType<typeof layOutBadge>,
  ink: string,
  x: number,
  y: number,
  qrSize: number,
) {
  const cx = x + qrSize / 2;
  const cy = y + qrSize / 2;

  return `	<rect x="${(cx - badge.width / 2).toFixed(2)}" y="${(cy - badge.height / 2).toFixed(2)}" width="${badge.width.toFixed(2)}" height="${badge.height.toFixed(2)}" rx="${(badge.height * 0.28).toFixed(2)}" fill="${ink}" stroke="${PAPER}" stroke-width="1.2"/>
	<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" fill="${PAPER}" font-family="${DISPLAY}" font-size="${badge.fontSize.toFixed(2)}" font-weight="700" text-anchor="middle" dominant-baseline="central">${escaped(badge.text)}</text>
`;
}

const VIEW_BOX = /viewBox="0 0 (\d+) \d+"/;
const SVG_BODY = /<svg[^>]*>([\s\S]*)<\/svg>/;

/**
 * The generator hands back a whole `<svg>`. The card wants what is inside it,
 * and the module count to scale it by.
 */
function unwrap(svg: string) {
  const box = VIEW_BOX.exec(svg);
  const body = SVG_BODY.exec(svg);
  if (!(box && body)) {
    throw new Error("Unexpected SVG from the qrcode package.");
  }

  return { modules: Number(box[1]), body: body[1] };
}

/** A card on its own, sized in millimetres so a print lands at scale. */
function standalone(svg: string) {
  const heightMm = (CARD.height / CARD.width) * CARD_MM;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg.replace(
    "<svg ",
    `<svg width="${CARD_MM}mm" height="${heightMm.toFixed(1)}mm" `,
  )}\n`;
}

/** All the cards on A4. */
function printSheet(cards: string[], options: Options) {
  const columns = options.perPage === 1 ? 1 : 2;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>QR codes</title>
<style>
	@page { size: A4 portrait; margin: 10mm; }
	body { margin: 0; background: #fbf3dc; font-family: ${DISPLAY}; }
	.sheet { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 6mm; padding: 10mm; max-width: 210mm; margin: 0 auto; }
	.sheet svg { width: 100%; height: auto; display: block; }
	.card { break-inside: avoid; }
	.note { max-width: 190mm; margin: 10mm auto 0; padding: 0 10mm; color: #8a7b6b; font-size: 10pt; line-height: 1.5; }
	@media print {
		body { background: #fff; }
		.sheet { padding: 0; gap: 4mm; max-width: none; }
		.note { display: none; }
	}
</style>
</head>
<body>
<div class="sheet">
${cards.map((card) => `	<div class="card">${card}</div>`).join("\n")}
</div>
<p class="note">
	Print at 100% ("actual size"), the codes are measured in millimetres.
	Cut along the card's edge: the light frame around each code is the quiet
	zone and has to stay. This line does not go to the printer.
</p>
</body>
</html>
`;
}

function parseArgs(argv: string[]): Options {
  const args = parseFlags(argv);

  const baseUrl = args.get("base-url");
  if (!baseUrl) {
    console.error(`
  Where should the codes point?

    npx tsx qr.ts --base-url https://example.com

  Flags:
    --base-url <url>   where the site lives (required)
    --out <dir>        where the cards end up (qr)
    --centre <text>    text in the middle of the code, {n} = the number (#{n})
                       --centre "" for none at all
    --contrast <n>     minimum contrast against the paper (5)
    --mono             plain dark codes instead of each item's colour
    --per-page <1|4>   cards per A4 page on the print sheet (4)
`);
    process.exit(1);
  }

  const perPage = Number(args.get("per-page") ?? 4);
  if (perPage !== 1 && perPage !== 4) {
    console.error("  --per-page takes 1 or 4.");
    process.exit(1);
  }

  return {
    baseUrl: baseUrl.replace(TRAILING_SLASHES, ""),
    out: resolve(args.get("out") ?? "qr"),
    centre: args.get("centre") ?? "#{n}",
    contrast: Number(args.get("contrast") ?? 5),
    mono: args.has("mono"),
    perPage,
  };
}

/** `--flag value`, `--flag=value` and bare `--flag`, in one pass. */
function parseFlags(argv: string[]) {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }

    const [flag, inline] = arg.slice(2).split("=", 2);
    args.set(flag, inline ?? (argv[i + 1]?.startsWith("--") ? "" : argv[++i]));
  }

  return args;
}

function escaped(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

await main();
