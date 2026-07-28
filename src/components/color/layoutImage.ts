import { toCanvas } from "html-to-image";

// The board's shaded case draws a `box-shadow` that spills outside the
// fit-content wrapper's box; without room the capture crops it. Pad the cloned
// node on every side (and grow the capture rect to match) so the shadow renders
// in full. The band is transparent, so the white frame behind it shows through.
const SHADOW_PAD = 28;

/**
 * Selection styling that must never be baked into an exported image: the
 * highlight ring on the right-clicked cap and the dimming
 * (`keyboard-layout-has-selection`) it applies to every other cap. The preview
 * board on the 个性化 page is both the interactive surface *and* the node
 * rasterized here, so a capture taken while the right-click cascade is open
 * would otherwise save a half-lit keyboard.
 */
const SELECTION_CLASSES = ["keyboard-layout-has-selection", "selected"] as const;

/**
 * Strip {@link SELECTION_CLASSES} from `node` and its descendants for the
 * duration of `run`, restoring exactly the elements that had them.
 *
 * Done on the live DOM rather than via React state because html-to-image reads
 * the real nodes: a state update wouldn't be guaranteed to have painted before
 * the clone runs, and this is a plain synchronous mutation around the capture.
 *
 * `.export-static` goes on first and is what actually makes this work. The
 * dimmed caps carry `transition: opacity 0.2s`, so merely dropping the class
 * starts a fade rather than resetting opacity — and html-to-image samples
 * computed styles immediately, catching them still dimmed. Freezing transitions
 * and animations first makes the strip land in the same frame; the forced
 * reflow below guarantees the new styles are resolved before the capture reads
 * them.
 */
async function withoutSelectionStyling<T>(
  node: HTMLElement,
  run: () => Promise<T>,
): Promise<T> {
  const hadExportStatic = node.classList.contains("export-static");
  node.classList.add("export-static");
  const stripped: { el: Element; cls: string }[] = [];
  for (const cls of SELECTION_CLASSES) {
    for (const el of [node, ...node.querySelectorAll(`.${cls}`)]) {
      if (el.classList.contains(cls)) {
        el.classList.remove(cls);
        stripped.push({ el, cls });
      }
    }
  }
  // Force a synchronous style/layout flush so the capture can't observe the
  // pre-strip values.
  void node.offsetHeight;
  try {
    return await run();
  } finally {
    for (const { el, cls } of stripped) {
      el.classList.add(cls);
    }
    if (!hadExportStatic) {
      node.classList.remove("export-static");
    }
  }
}

/**
 * Rasterize a live DOM node (a rendered keyboard preview) to a canvas. Uses a 2×
 * pixel ratio so the exported PNG stays crisp, and `skipFonts` so html-to-image
 * doesn't try to fetch/embed web-font CSS (the keycap labels are system fonts and
 * the on-cap glyphs are inline iconify SVG, so nothing needs embedding — skipping
 * avoids a network round-trip that can hang or fail on a cross-origin stylesheet).
 * A {@link SHADOW_PAD} border is added around the node so the case's drop shadow
 * isn't clipped, and any transient selection highlight is stripped for the
 * duration of the capture (see {@link withoutSelectionStyling}).
 */
export function nodeToCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  return withoutSelectionStyling(node, () =>
    toCanvas(node, {
      pixelRatio: 2,
      skipFonts: true,
      width: node.offsetWidth + SHADOW_PAD * 2,
      height: node.offsetHeight + SHADOW_PAD * 2,
      style: { boxSizing: "content-box", padding: `${SHADOW_PAD}px` },
      // Skip UI chrome that overlays the board (e.g. the hover save-actions scrim),
      // which lives inside the captured node but must not be baked into the export.
      filter: (el) =>
        !(el instanceof HTMLElement && el.hasAttribute("data-export-hidden")),
    }),
  );
}

/** Trigger a browser download of a canvas as a PNG file. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/** One board image plus the caption drawn above it in a composed grid. */
export interface LayerCell {
  canvas: HTMLCanvasElement;
  label: string;
}

// All layout constants are in the composed canvas's device pixels, matching the
// 2× cell canvases produced by nodeToCanvas so captions read at a similar weight.
const COLS = 2;
// Outer margin around the whole canvas, enlarging the image so the content isn't
// flush to the edge.
const OUTER_MARGIN = 50;
const GAP = 40;
const LABEL_HEIGHT = 52;
const LABEL_FONT = "600 30px system-ui, sans-serif";
const BG = "#ffffff";
const LABEL_COLOR = "#333333";

// Site credit stamped into the bottom-right of every exported image, as a
// three-line right-aligned block (site name / domain / keyboard name, top to
// bottom — see drawCreditBlock). CREDIT_GAP is the space between the board
// content and the block; the per-line *_LINE_HEIGHT constants below are each
// line's own reserved band, all in the same device pixels.
const SITE_NAME = "Vialite";
const SITE_URL = "https://vialite.viii.me";
const CREDIT_GAP = 30;
const URL_COLOR = "#9aa0a6";

// 20% larger than the site name's old single-line size (28px).
const SITE_NAME_FONT = "700 33.6px system-ui, sans-serif";
const SITE_NAME_LINE_HEIGHT = 40;

const URL_FONT = "400 24px system-ui, sans-serif";
const URL_LINE_HEIGHT = 32;

// Keyboard name: smaller and unbolded compared to the old single-line stamp,
// with a small "link" glyph in front standing in for "connected to" the site
// name above it — stamped only when the caller knows the connected device's
// name.
const NAME_FONT = "400 22px system-ui, sans-serif";
const NAME_LINE_HEIGHT = 30;
const NAME_ICON_SIZE = 18;
const NAME_ICON_GAP = 6;

// mdi:link (from @iconify-json/mdi), 24x24 viewBox — reused here as a raw SVG
// path since the credit block is drawn on a canvas, not the DOM, so the
// <Icon> component used elsewhere in the app isn't an option.
const LINK_ICON_PATH =
  "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7a5 5 0 0 0-5 5a5 5 0 0 0 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1M8 13h8v-2H8zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4a5 5 0 0 0 5-5a5 5 0 0 0-5-5";
const LINK_ICON_VIEWBOX = 24;

/** Draw the mdi:link glyph, `size` px square, its top-left corner at (x, y). */
function drawLinkIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / LINK_ICON_VIEWBOX, size / LINK_ICON_VIEWBOX);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(LINK_ICON_PATH));
  ctx.restore();
}

/**
 * Total height of the bottom-right credit block drawn by {@link
 * drawCreditBlock} — callers use this to reserve vertical space below the
 * board instead of duplicating the block's own line-height math.
 */
function creditBlockHeight(hasKeyboardName: boolean): number {
  return SITE_NAME_LINE_HEIGHT + URL_LINE_HEIGHT + (hasKeyboardName ? NAME_LINE_HEIGHT : 0);
}

/**
 * Draw the bottom-right credit block, right-aligned so its right edge sits at
 * `right` and its bottom edge at `bottom`: "Vialite" on top, its domain below
 * that, and — when `keyboardName` is given — the connected keyboard's name on
 * a third line at the bottom, smaller and unbolded, prefixed by a small link
 * glyph. Shared by both export paths so the current-layer and all-layers
 * images carry an identical stamp.
 */
function drawCreditBlock(
  ctx: CanvasRenderingContext2D,
  right: number,
  bottom: number,
  keyboardName?: string,
) {
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  let cursorY = bottom;

  if (keyboardName) {
    cursorY -= NAME_LINE_HEIGHT / 2;
    ctx.font = NAME_FONT;
    ctx.fillStyle = LABEL_COLOR;
    const textWidth = ctx.measureText(keyboardName).width;
    ctx.fillText(keyboardName, right, cursorY);
    drawLinkIcon(
      ctx,
      right - textWidth - NAME_ICON_GAP - NAME_ICON_SIZE,
      cursorY - NAME_ICON_SIZE / 2,
      NAME_ICON_SIZE,
      LABEL_COLOR,
    );
    cursorY -= NAME_LINE_HEIGHT / 2;
  }

  cursorY -= URL_LINE_HEIGHT / 2;
  ctx.font = URL_FONT;
  ctx.fillStyle = URL_COLOR;
  ctx.fillText(SITE_URL, right, cursorY);
  cursorY -= URL_LINE_HEIGHT / 2;

  cursorY -= SITE_NAME_LINE_HEIGHT / 2;
  ctx.font = SITE_NAME_FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(SITE_NAME, right, cursorY);
}

/**
 * Expand a single board canvas onto a margined white canvas and stamp the site
 * credit in the bottom-right. Used for the current-layer export, whose raw node
 * canvas otherwise hugs the board with no margin. The credit sits below the
 * board separated by {@link CREDIT_GAP}, mirroring {@link composeLayers}' image.
 * When `keyboardName` is given, it's stamped as the bottom line of the same
 * bottom-right block.
 */
export function frameBoard(source: HTMLCanvasElement, keyboardName?: string): HTMLCanvasElement {
  const blockHeight = creditBlockHeight(!!keyboardName);
  const out = document.createElement("canvas");
  out.width = source.width + OUTER_MARGIN * 2;
  out.height = OUTER_MARGIN + source.height + CREDIT_GAP + blockHeight + OUTER_MARGIN;

  const ctx = out.getContext("2d");
  if (!ctx) {
    return source;
  }
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, OUTER_MARGIN, OUTER_MARGIN);
  drawCreditBlock(ctx, out.width - OUTER_MARGIN, out.height - OUTER_MARGIN, keyboardName);

  return out;
}

/**
 * Stitch per-layer board canvases into one image, two per row, each captioned
 * with its layer name. Cells are sized to the widest/tallest board so every board
 * is centered in a uniform cell (boards can differ in size if a layout option
 * changed geometry, though in practice they match). When `keyboardName` is
 * given, it's stamped as the bottom line of the bottom-right credit block,
 * mirroring {@link frameBoard}. Returns the composed canvas.
 */
export function composeLayers(cells: LayerCell[], keyboardName?: string): HTMLCanvasElement {
  const cellW = Math.max(...cells.map((c) => c.canvas.width));
  const boardH = Math.max(...cells.map((c) => c.canvas.height));
  const cellH = LABEL_HEIGHT + boardH;
  const rows = Math.ceil(cells.length / COLS);
  const blockHeight = creditBlockHeight(!!keyboardName);

  const out = document.createElement("canvas");
  out.width = OUTER_MARGIN * 2 + COLS * cellW + (COLS - 1) * GAP;
  out.height =
    OUTER_MARGIN + rows * cellH + (rows - 1) * GAP + CREDIT_GAP + blockHeight + OUTER_MARGIN;

  const ctx = out.getContext("2d");
  if (!ctx) {
    return out;
  }
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, out.width, out.height);

  ctx.font = LABEL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  cells.forEach(({ canvas, label }, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cellX = OUTER_MARGIN + col * (cellW + GAP);
    const cellY = OUTER_MARGIN + row * (cellH + GAP);

    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(label, cellX + cellW / 2, cellY + LABEL_HEIGHT / 2);

    // Center each board horizontally within its cell (heights are top-aligned
    // under the caption band).
    const boardX = cellX + (cellW - canvas.width) / 2;
    ctx.drawImage(canvas, boardX, cellY + LABEL_HEIGHT);
  });

  drawCreditBlock(ctx, out.width - OUTER_MARGIN, out.height - OUTER_MARGIN, keyboardName);

  return out;
}
