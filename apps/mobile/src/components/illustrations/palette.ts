/**
 * The colour vocabulary every generated unDraw illustration draws in.
 *
 * unDraw art is drawn for a white page: light-grey surfaces, near-black
 * figures, one swappable accent. On this app's dark theme — a near-black
 * ground — those figures would sit on top of their own colour and vanish.
 *
 * So the two schemes do not tint the same drawing, they invert its lighting.
 * `ink` and `paper` trade places: figures that were near-black on light grey
 * become near-white on dark grey, which preserves the contrast the artwork was
 * composed around instead of preserving its literal colours.
 *
 * SKIN TONES ARE THE EXCEPTION and stay fixed across both schemes. They are the
 * one part of the drawing depicting something real; lightening them for the
 * dark theme would change who is pictured rather than how the picture is lit.
 */

import { useTheme } from '../../theme';
import { coral, neutral } from '../../theme/ramps';

export type IllustrationPalette = {
  accent: string;
  accentDeep: string;
  /** Figures, hair, shoes — the darkest ink in the original drawing. */
  ink: string;
  /** Devices and furniture: one step softer than `ink`. */
  inkSoft: string;
  /**
   * Lit surfaces, as a three-step ladder rather than one value.
   *
   * This is not over-specification, it is the difference between a drawing and
   * a blob. unDraw builds panels out of a grey ladder — a near-white card face,
   * a slightly recessed square on it, a darker bar for an input field — and
   * collapsing those into a single colour merges every one of them into their
   * neighbour. The sign-in artwork lost its card, its two input fields and both
   * decorative squares that way; all that survived was the one button, because
   * the accent was the only colour that had not been flattened into the rest.
   */
  paper: string;
  /** One step in from `paper`: recessed panels, decorative blocks. */
  paperShade: string;
  /** Elements sitting ON a surface — input bars, chips, progress tracks. */
  paperDeep: string;
  /** Hairlines and edges between surfaces. */
  line: string;
  skin: string;
  skinShade: string;
};

export type IllustrationProps = {
  width: number;
  height: number;
};

const light: IllustrationPalette = {
  // 600 rather than 500: the accent lands on near-white paper here, and 500 is
  // the value that failed contrast on white elsewhere in this codebase.
  accent: coral[600],
  accentDeep: coral[700],
  ink: neutral[800],
  inkSoft: neutral[700],
  // Starts at 100 rather than 0: a white card on a white page is not a card.
  // unDraw gets away with it on its own site by outlining everything; here the
  // ladder does that job instead.
  paper: neutral[100],
  paperShade: neutral[200],
  paperDeep: neutral[300],
  line: neutral[400],
  skin: '#FFB8B8',
  skinShade: '#A0616A',
};

const dark: IllustrationPalette = {
  // 500 rather than 600: on a near-black ground the darker coral reads as
  // brown, and the accent is the one thing in the drawing that must not.
  accent: coral[500],
  accentDeep: coral[600],
  ink: neutral[200],
  inkSoft: neutral[400],
  /*
   * The ladder inverts as a whole, so the ORDER within it survives: the card
   * face is now the darkest surface and the bars sitting on it are lighter,
   * which is what keeps them visible against it. Preserving each colour's
   * absolute lightness instead would put light bars on a light card and lose
   * exactly the detail this ramp exists to protect.
   */
  paper: neutral[800],
  paperShade: neutral[700],
  paperDeep: neutral[600],
  line: neutral[500],
  skin: '#FFB8B8',
  skinShade: '#A0616A',
};

/*
 * Module constants rather than objects built per render. Three illustrations
 * mount at once on the onboarding screen, each one feeding this palette into
 * dozens of path elements, and the props are compared by identity.
 */
const byScheme = { light, dark } as const;

export const useIllustrationPalette = (): IllustrationPalette =>
  byScheme[useTheme().scheme];
