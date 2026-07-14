// Ported (trimmed to what the MVP needs for rendering + row/col/encoder
// extraction) from vial-gui's kle_serial.py, itself based on
// https://github.com/ijprest/kle-serial

export interface KleKey {
  labels: (string | null)[];
  x: number;
  y: number;
  width: number;
  height: number;
  x2: number;
  y2: number;
  width2: number;
  height2: number;
  rotationX: number;
  rotationY: number;
  rotationAngle: number;
  decal: boolean;
}

export interface KleKeyboard {
  keys: KleKey[];
}

type KleRowItem = string | Record<string, unknown>;
type KleRow = KleRowItem[];
export type KleData = (KleRow | Record<string, unknown>)[];

// prettier-ignore
const LABEL_MAP: number[][] = [
  [ 0, 6, 2, 8, 9,11, 3, 5, 1, 4, 7,10], // 0 = no centering
  [ 1, 7,-1,-1, 9,11, 4,-1,-1,-1,-1,10], // 1 = center x
  [ 3,-1, 5,-1, 9,11,-1,-1, 4,-1,-1,10], // 2 = center y
  [ 4,-1,-1,-1, 9,11,-1,-1,-1,-1,-1,10], // 3 = center x & y
  [ 0, 6, 2, 8,10,-1, 3, 5, 1, 4, 7,-1], // 4 = center front (default)
  [ 1, 7,-1,-1,10,-1, 4,-1,-1,-1,-1,-1], // 5 = center front & x
  [ 3,-1, 5,-1,10,-1,-1,-1, 4,-1,-1,-1], // 6 = center front & y
  [ 4,-1,-1,-1,10,-1,-1,-1,-1,-1,-1,-1], // 7 = center front & x & y
];

function reorderLabelsIn(labels: (string | null)[], align: number): (string | null)[] {
  const ret: (string | null)[] = new Array(12).fill(null);
  for (let i = 0; i < labels.length; i++) {
    if (labels[i]) {
      const dest = LABEL_MAP[align][i];
      if (dest >= 0) {
        ret[dest] = labels[i];
      }
    }
  }
  return ret;
}

class MutableKey {
  x = 0;
  y = 0;
  width = 1;
  height = 1;
  x2 = 0;
  y2 = 0;
  width2 = 1;
  height2 = 1;
  rotationX = 0;
  rotationY = 0;
  rotationAngle = 0;
  decal = false;

  clone(): MutableKey {
    return Object.assign(new MutableKey(), this);
  }
}

export function deserialize(rows: KleData): KleKeyboard {
  const current = new MutableKey();
  const clusterOrigin = { x: 0, y: 0 };
  const keys: KleKey[] = [];
  let align = 4;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) {
      // Keyboard metadata object (only valid as the first element) — not needed for the MVP.
      continue;
    }

    for (let k = 0; k < row.length; k++) {
      const item = row[k];
      if (typeof item === "string") {
        const newKey = current.clone();
        newKey.width2 = current.width2 === 0 ? current.width : current.width2;
        newKey.height2 = current.height2 === 0 ? current.height : current.height2;
        const labels = reorderLabelsIn(item.split("\n"), align);

        keys.push({
          labels,
          x: newKey.x,
          y: newKey.y,
          width: newKey.width,
          height: newKey.height,
          x2: newKey.x2,
          y2: newKey.y2,
          width2: newKey.width2,
          height2: newKey.height2,
          rotationX: newKey.rotationX,
          rotationY: newKey.rotationY,
          rotationAngle: newKey.rotationAngle,
          decal: newKey.decal,
        });

        current.x += current.width;
        current.width = current.height = 1;
        current.x2 = current.y2 = current.width2 = current.height2 = 0;
        current.decal = false;
      } else {
        const props = item;
        if ("r" in props) current.rotationAngle = props.r as number;
        if ("rx" in props) {
          current.rotationX = clusterOrigin.x = props.rx as number;
          current.x = clusterOrigin.x;
          current.y = clusterOrigin.y;
        }
        if ("ry" in props) {
          current.rotationY = clusterOrigin.y = props.ry as number;
          current.x = clusterOrigin.x;
          current.y = clusterOrigin.y;
        }
        if ("a" in props) align = props.a as number;
        if ("x" in props) current.x += props.x as number;
        if ("y" in props) current.y += props.y as number;
        if ("w" in props) current.width = current.width2 = props.w as number;
        if ("h" in props) current.height = current.height2 = props.h as number;
        if ("x2" in props) current.x2 = props.x2 as number;
        if ("y2" in props) current.y2 = props.y2 as number;
        if ("w2" in props) current.width2 = props.w2 as number;
        if ("h2" in props) current.height2 = props.h2 as number;
        if ("d" in props) current.decal = props.d as boolean;
      }
    }

    current.y += 1;
    current.x = current.rotationX;
  }

  return { keys };
}
