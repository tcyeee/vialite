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

// Site credit stamped into the bottom-right of every exported image. CREDIT_GAP
// is the space between the board content and the credit; CREDIT_HEIGHT the band
// reserved for the credit text itself, both in the same device pixels.
const SITE_NAME = "Vialite";
const SITE_URL = "https://vialite.viii.me";
const CREDIT_GAP = 30;
const CREDIT_HEIGHT = 40;
const URL_COLOR = "#9aa0a6";

/**
 * Draw the site credit — the bold site name followed by its URL — right-aligned
 * so its right edge sits at `right`, vertically centered on `y`. Shared by both
 * export paths so the current-layer and all-layers images carry an identical
 * bottom-right credit.
 */
function drawSiteCredit(ctx: CanvasRenderingContext2D, right: number, y: number) {
  const nameFont = "700 28px system-ui, sans-serif";
  const urlFont = "400 24px system-ui, sans-serif";
  const GAP_NAME_URL = 14;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = nameFont;
  const nameW = ctx.measureText(SITE_NAME).width;
  ctx.font = urlFont;
  const urlW = ctx.measureText(SITE_URL).width;
  const x = right - (nameW + GAP_NAME_URL + urlW);
  ctx.font = nameFont;
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(SITE_NAME, x, y);
  ctx.font = urlFont;
  ctx.fillStyle = URL_COLOR;
  ctx.fillText(SITE_URL, x + nameW + GAP_NAME_URL, y);
}

/**
 * Expand a single board canvas onto a margined white canvas and stamp the site
 * credit in the bottom-right. Used for the current-layer export, whose raw node
 * canvas otherwise hugs the board with no margin. The credit sits below the
 * board separated by {@link CREDIT_GAP}, mirroring {@link composeLayers}' image.
 */
export function frameBoard(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width + OUTER_MARGIN * 2;
  out.height =
    OUTER_MARGIN + source.height + CREDIT_GAP + CREDIT_HEIGHT + OUTER_MARGIN;

  const ctx = out.getContext("2d");
  if (!ctx) {
    return source;
  }
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, OUTER_MARGIN, OUTER_MARGIN);
  drawSiteCredit(
    ctx,
    out.width - OUTER_MARGIN,
    out.height - OUTER_MARGIN - CREDIT_HEIGHT / 2,
  );

  return out;
}

/**
 * Stitch per-layer board canvases into one image, two per row, each captioned
 * with its layer name. Cells are sized to the widest/tallest board so every board
 * is centered in a uniform cell (boards can differ in size if a layout option
 * changed geometry, though in practice they match). Returns the composed canvas.
 */
export function composeLayers(cells: LayerCell[]): HTMLCanvasElement {
  const cellW = Math.max(...cells.map((c) => c.canvas.width));
  const boardH = Math.max(...cells.map((c) => c.canvas.height));
  const cellH = LABEL_HEIGHT + boardH;
  const rows = Math.ceil(cells.length / COLS);

  const out = document.createElement("canvas");
  out.width = OUTER_MARGIN * 2 + COLS * cellW + (COLS - 1) * GAP;
  out.height =
    OUTER_MARGIN +
    rows * cellH +
    (rows - 1) * GAP +
    CREDIT_GAP +
    CREDIT_HEIGHT +
    OUTER_MARGIN;

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

  drawSiteCredit(
    ctx,
    out.width - OUTER_MARGIN,
    out.height - OUTER_MARGIN - CREDIT_HEIGHT / 2,
  );

  return out;
}
