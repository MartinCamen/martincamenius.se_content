# QR codes from a list

A small script that turns a list of items into printable QR code cards: one
SVG per item, each in the item's own colour, with a number badge in the
middle, plus an HTML sheet that lays them out four to an A4 page.

It started life in a scavenger-hunt app, where every station had a code taped
to a wall somewhere. This is the same script with the project-specific bits
swapped for placeholders.

## Run it

```bash
npm install
npx tsx qr.ts --base-url https://example.com
```

Cards land in `qr/`. Open `qr/index.html` and print at 100%.

| Flag | What it does | Default |
|---|---|---|
| `--base-url <url>` | where the site lives, codes point at `<url>/s/<slug>` | required |
| `--out <dir>` | where the cards end up | `qr` |
| `--centre <text>` | text in the middle of the code, `{n}` = the number, `""` for none | `#{n}` |
| `--contrast <n>` | minimum contrast against the paper | `5` |
| `--mono` | plain dark codes instead of each item's colour | off |
| `--per-page <1\|4>` | cards per A4 page on the print sheet | `4` |

## The files

- [`items.ts`](items.ts): the list. Flip `active` to add or remove a card;
  numbers follow on their own.
- [`colour.ts`](colour.ts): paper, ink, and the contrast rule that darkens a
  colour until it scans.
- [`qr.ts`](qr.ts): generates the codes, places the badge, writes the SVGs and
  the print sheet.

## Things worth knowing

- The codes use error-correction level **H**, which can lose about 30% and
  still read. That is what makes the badge possible.
- The badge stays inside the code's innermost square. The timing patterns six
  modules in from the edge carry no error correction, and covering them breaks
  the code.
- Keep labels short. Longer badges cover more, and the script warns past 20%.
- Don't trim the light frame around a code when cutting cards out. It's the
  quiet zone, and scanners need it.
- Test every code with the oldest phone you can find before laminating.
