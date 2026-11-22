/**
 * Paper, ink and the one rule that keeps a coloured QR code scannable.
 *
 * A colour that looks lovely on a screen can be far too light on paper once a
 * phone camera, some glare and an overcast afternoon get involved. So instead
 * of trusting the colour as given, it is darkened until it clears a minimum
 * contrast against the paper.
 */

/** The background the codes are printed on, and a plain dark fallback. */
export const PAPER = "#FEFAF0";
export const INK = "#2B2118";

/** The display font, with fallbacks for a printer that has no network. */
export const DISPLAY = "'Your Font', ui-rounded, 'Segoe UI', system-ui, sans-serif";

/**
 * The same hue, taken down until it clears `target` against the paper. Mixed
 * towards black rather than swapped for another colour, so the code still
 * reads as "the orange one".
 */
export function darkenTo(hex: string, target: number) {
  const [r, g, b] = channels(hex);

  for (let k = 1; k > 0; k -= 0.01) {
    const shade = rgb(r * k, g * k, b * k);
    if (contrastRatio(shade, PAPER) >= target) {
      return shade;
    }
  }

  return "#000000";
}

/** WCAG contrast ratio between two hex colours, from 1:1 up to 21:1. */
export function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG relative luminance. */
function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((c) => {
    const channel = c / 255;
    return channel <= 0.040_45
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgb(r: number, g: number, b: number) {
  const hex = (c: number) =>
    Math.round(Math.min(255, Math.max(0, c)))
      .toString(16)
      .padStart(2, "0");

  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
