/**
 * The list the QR codes are generated from.
 *
 * One entry per place a code should point at. `active` is the switch: on, the
 * item gets a card and a number; off, it is left out — still reachable at
 * `/s/<slug>` if you type it in, but nothing prints a code for it.
 *
 * Numbers are not written down here. They are handed out in order among the
 * active items, so switching one off closes the gap instead of leaving a hole
 * you have to renumber around by hand.
 */

export type Item = {
  /** The last part of the address: <base-url>/s/<slug> */
  slug: string;
  /** Shown to screen readers on the card. */
  title: string;
  /** Any hex colour. It will be darkened until it scans, see `colour.ts`. */
  colour: string;
  active: boolean;
};

const ITEMS: Item[] = [
  { slug: "first-item", title: "First item", colour: "#e0592f", active: true },
  { slug: "second-item", title: "Second item", colour: "#2f7d5c", active: true },
  { slug: "third-item", title: "Third item", colour: "#c98a0e", active: false },
  { slug: "fourth-item", title: "Fourth item", colour: "#2c6e9b", active: true },
];

export const ACTIVE_ITEMS = ITEMS.filter((item) => item.active).map(
  (item, index) => ({ ...item, number: index + 1 }),
);

export type NumberedItem = (typeof ACTIVE_ITEMS)[number];
