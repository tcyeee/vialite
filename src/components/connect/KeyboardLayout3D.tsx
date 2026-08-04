// 3D keyboard preview, sharing the same geometry pipeline as KeyboardLayout
// (placeLayout / rotatePoint from layoutGeometry.ts) so both renderers agree
// on where every key and encoder sits. Coordinates: KLE x -> world X,
// KLE y -> world Z, extrusion height -> world Y (up). Rotation is applied
// around a vertical (Y) axis at the key's rotated center; the sign is
// flipped relative to three.js's default Y-rotation because KLE's clockwise
// screen rotation (X-axis toward Y-axis) maps to X-axis toward +Z here,
// which is the opposite of three.js's right-hand rule for +Y rotation.
//
// Keycaps are deliberately uniform-height (DSA/XDA-style) rather than
// sculpted R1-R4: KLE's y coordinate carries no "row" semantics on custom
// layouts (ortholinear has no rows, columnar-stagger and split boards put
// wildly different fingers at the same y, Alice-likes are rotated outright),
// so any row heuristic would render a visibly wrong board. Uniform profiles
// are also what ortho/split/small boards actually ship with, so this is
// faithful rather than a shortcut. It buys three simplifications: cap shape
// depends only on (width, height), no per-key tilt, and a constant legend
// height for every key.
//
// Every geometry, material and legend texture is cached and shared across
// keys (see Resources) — a 100-key board ends up with roughly a dozen
// geometries. The rebuild effect therefore only allocates Mesh wrappers, and
// disposal happens once on unmount instead of per mesh.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useKeyboardRevision } from "../../hooks/useKeyboardRevision.ts";
import type { Keyboard, PhysicalEncoder, PhysicalKey } from "../../protocol/keyboard.ts";
import { label as kcLabel } from "../../protocol/keycodes.ts";
import { clusterHulls, offsetOutline, type Pt } from "../keymap/layout/caseOutline.ts";
import { footprintsOf, hasSecondRect, placeLayout, rotatePoint } from "../keymap/layout/layoutGeometry.ts";
import { knobLayout } from "../keymap/layout/knobGrouping.ts";
import { DEFAULT_PREVIEW_3D_PARAMS, type Preview3DParams } from "./preview3dParams.ts";

const UNIT = 1;
const CAP_SEGMENTS = 3;
/** How far the legend plane floats above the cap's top face (z-fighting guard). */
const LEGEND_LIFT = 0.004;

const CAP_HOVER_COLOR = 0xdadada;
const ENCODER_COLOR = 0xe6e6e6;

interface Props {
  keyboard: Keyboard;
  layer: number;
  onKeySelect: (row: number, col: number) => void;
  onEncoderSelect: (index: number, direction: 0 | 1) => void;
  /** Live-tunable geometry/material constants; see preview3dParams.ts. */
  params?: Preview3DParams;
}

interface Pickable extends THREE.Object3D {
  userData: { onActivate: () => void };
}

/** A cap/encoder mesh remembers which shared material to fall back to when unhovered. */
interface HoverableMesh extends THREE.Mesh {
  userData: { baseMat: THREE.Material; hoverMat: THREE.Material };
}

/**
 * Geometry/material/texture caches shared by every key on the board, owned by
 * the scene and disposed once on unmount. Keys are content-addressed strings
 * (`cap:1x1`, `legend:0.77`, the label text itself), so the rebuild effect can
 * look everything up instead of allocating.
 */
interface Resources {
  geo: Map<string, THREE.BufferGeometry>;
  tex: Map<string, THREE.CanvasTexture>;
  legendMat: Map<string, THREE.MeshBasicMaterial>;
  capMat: THREE.MeshStandardMaterial;
  capHoverMat: THREE.MeshStandardMaterial;
  encoderMat: THREE.MeshStandardMaterial;
  encoderHoverMat: THREE.MeshStandardMaterial;
  plateMat: THREE.MeshStandardMaterial;
  shellMat: THREE.MeshStandardMaterial;
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  ambientLight: THREE.HemisphereLight;
  group: THREE.Group;
  /**
   * The case lives in its own group because it depends only on the layout, not
   * on the keymap — it must not be rebuilt by the per-render cap pass.
   */
  caseGroup: THREE.Group;
  /** Case geometries are unique per layout rather than cached, so track them to dispose. */
  caseGeo: THREE.BufferGeometry[];
  pickables: Pickable[];
  raycaster: THREE.Raycaster;
  hovered: HoverableMesh | null;
  res: Resources;
}

/** Collapses float noise in vial.json dimensions (1.0499999999999998 vs 1.05) so cache keys hit. */
function q(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function createResources(p: Preview3DParams): Resources {
  const cap = { roughness: 0.62, metalness: 0.03 };
  return {
    geo: new Map(),
    tex: new Map(),
    legendMat: new Map(),
    capMat: new THREE.MeshStandardMaterial({ color: p.capColor, ...cap }),
    capHoverMat: new THREE.MeshStandardMaterial({ color: CAP_HOVER_COLOR, ...cap }),
    encoderMat: new THREE.MeshStandardMaterial({ color: ENCODER_COLOR, roughness: 0.5, metalness: 0.12 }),
    encoderHoverMat: new THREE.MeshStandardMaterial({ color: CAP_HOVER_COLOR, roughness: 0.5, metalness: 0.12 }),
    plateMat: new THREE.MeshStandardMaterial({ color: p.plateColor, roughness: 0.78, metalness: 0.12 }),
    shellMat: new THREE.MeshStandardMaterial({ color: p.shellColor, roughness: 0.85, metalness: 0.08 }),
  };
}

function disposeResources(res: Resources) {
  res.geo.forEach((g) => g.dispose());
  res.tex.forEach((t) => t.dispose());
  res.legendMat.forEach((m) => m.dispose());
  res.geo.clear();
  res.tex.clear();
  res.legendMat.clear();
  res.capMat.dispose();
  res.capHoverMat.dispose();
  res.encoderMat.dispose();
  res.encoderHoverMat.dispose();
  res.plateMat.dispose();
  res.shellMat.dispose();
}

/**
 * Scales vertices toward the cap's vertical axis proportionally to their
 * height, turning RoundedBoxGeometry's prism into a frustum (narrow top, wide
 * base). Normals are recomputed since the slanted sides no longer face
 * straight out.
 */
function taperCap(geo: THREE.BufferGeometry, height: number, taper: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // t: 0 at the base, 1 at the top face.
    const t = (y + height / 2) / height;
    const scale = 1 + (taper - 1) * t;
    pos.setX(i, pos.getX(i) * scale);
    pos.setZ(i, pos.getZ(i) * scale);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function cachedGeometry(res: Resources, key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = res.geo.get(key);
  if (!geo) {
    geo = make();
    res.geo.set(key, geo);
  }
  return geo;
}

/** Outer footprint of a cap in world units, before the taper. */
function capFootprint(p: Preview3DParams, w: number, h: number): { x: number; z: number } {
  return { x: Math.max(w * UNIT - p.gap, 0.1), z: Math.max(h * UNIT - p.gap, 0.1) };
}

function capGeometry(p: Preview3DParams, res: Resources, w: number, h: number): THREE.BufferGeometry {
  return cachedGeometry(res, `cap:${q(w)}x${q(h)}`, () => {
    const { x, z } = capFootprint(p, w, h);
    const geo = new RoundedBoxGeometry(x, p.capHeight, z, CAP_SEGMENTS, p.capRadius);
    taperCap(geo, p.capHeight, p.capTaper);
    return geo;
  });
}

/**
 * Legend planes are square and sized off the cap's *short* edge so the square
 * label texture is never stretched — a 6.25u spacebar gets the same undistorted
 * glyphs as a 1u alpha.
 */
function legendGeometry(p: Preview3DParams, res: Resources, w: number, h: number): THREE.BufferGeometry {
  const { x, z } = capFootprint(p, w, h);
  const size = q(Math.min(x, z) * p.capTaper * p.legendFill);
  return cachedGeometry(res, `legend:${size}`, () => new THREE.PlaneGeometry(size, size));
}

function wrapLabel(text: string): string[] {
  const lines = text.split("\n").flatMap((line) => (line.length > 10 ? [line.slice(0, 10)] : [line]));
  return lines.slice(0, 2);
}

/**
 * Glyphs only, on a fully transparent canvas — the cap's own material shows
 * through. (An opaque background here would bake the cap colour into the
 * texture and make CAP_COLOR only affect the sides.)
 */
function makeLabelTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapLabel(text);
  const fontSize = lines.length > 1 ? 52 : 60;
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const lineHeight = fontSize * 1.15;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, startY + i * lineHeight));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function legendMaterial(p: Preview3DParams, res: Resources, label: string): THREE.MeshBasicMaterial {
  let mat = res.legendMat.get(label);
  if (!mat) {
    let tex = res.tex.get(label);
    if (!tex) {
      tex = makeLabelTexture(label, p.legendColor);
      res.tex.set(label, tex);
    }
    mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    res.legendMat.set(label, mat);
  }
  return mat;
}

function addLegend(
  p: Preview3DParams,
  parent: THREE.Object3D,
  res: Resources,
  w: number,
  h: number,
  label: string,
) {
  if (!label) {
    return;
  }
  const legend = new THREE.Mesh(legendGeometry(p, res, w, h), legendMaterial(p, res, label));
  legend.rotation.x = -Math.PI / 2;
  legend.position.y = p.capHeight / 2 + LEGEND_LIFT;
  parent.add(legend);
}

/** Rotated world-space center of a key/encoder's own rectangle (or its secondary rectangle). */
function rotatedCenter(
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  rx: number,
  ry: number,
  shiftX: number,
  shiftY: number,
): { x: number; z: number } {
  const [px, py] = rotatePoint(x + w / 2, y + h / 2, angle, rx, ry);
  return { x: px + shiftX, z: py + shiftY };
}

function buildKeyMesh(
  p: Preview3DParams,
  res: Resources,
  key: PhysicalKey,
  shiftX: number,
  shiftY: number,
  boardOffsetX: number,
  boardOffsetZ: number,
  label: string,
): THREE.Group {
  const group = new THREE.Group();
  const yaw = -(key.rotationAngle * Math.PI) / 180;

  // On a two-rectangle cap (ISO Enter, big-ass Enter) only the primary
  // rectangle carries the legend — printing it twice reads as two keys.
  const addRect = (x: number, y: number, w: number, h: number, withLegend: boolean) => {
    const mesh = new THREE.Mesh(capGeometry(p, res, w, h), res.capMat) as unknown as HoverableMesh;
    mesh.userData = { baseMat: res.capMat, hoverMat: res.capHoverMat };
    const center = rotatedCenter(x, y, w, h, key.rotationAngle, key.rotationX, key.rotationY, shiftX, shiftY);
    mesh.position.set(center.x - boardOffsetX, p.capHeight / 2, center.z - boardOffsetZ);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (withLegend) {
      addLegend(p, mesh, res, w, h, label);
    }
    group.add(mesh);
  };

  addRect(key.x, key.y, key.width, key.height, true);
  if (hasSecondRect(key)) {
    addRect(key.x + key.x2, key.y + key.y2, key.width2, key.height2, false);
  }
  return group;
}

function buildEncoderMesh(
  p: Preview3DParams,
  res: Resources,
  encoder: PhysicalEncoder,
  shiftX: number,
  shiftY: number,
  boardOffsetX: number,
  boardOffsetZ: number,
  label: string,
): THREE.Group {
  const group = new THREE.Group();
  const radius = (Math.min(encoder.width, encoder.height) * UNIT - p.gap) / 2;
  const geo = cachedGeometry(
    res,
    `knob:${q(radius)}`,
    () => new THREE.CylinderGeometry(radius * p.capTaper, radius, p.capHeight, 32),
  );
  const mesh = new THREE.Mesh(geo, res.encoderMat) as unknown as HoverableMesh;
  mesh.userData = { baseMat: res.encoderMat, hoverMat: res.encoderHoverMat };
  const center = rotatedCenter(
    encoder.x,
    encoder.y,
    encoder.width,
    encoder.height,
    encoder.rotationAngle,
    encoder.rotationX,
    encoder.rotationY,
    shiftX,
    shiftY,
  );
  mesh.position.set(center.x - boardOffsetX, p.capHeight / 2, center.z - boardOffsetZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addLegend(p, mesh, res, encoder.width, encoder.height, label);
  group.add(mesh);
  return group;
}

/** Shapes are authored in XY and rotated flat, which maps shape-y to world -Z. */
function toShapePoints(points: Pt[]): THREE.Vector2[] {
  return points.map(([x, z]) => new THREE.Vector2(x, -z));
}

/**
 * Extrudes a closed outline upward from `bottomY` by `height`. Passing `hole`
 * makes it a ring (used for the bezel); the hole is reversed because a Shape's
 * holes must wind opposite to its outer contour.
 */
function extrudeProfile(
  p: Preview3DParams,
  outer: Pt[],
  hole: Pt[] | null,
  material: THREE.Material,
  bottomY: number,
  height: number,
  sink: THREE.BufferGeometry[],
): THREE.Mesh {
  const shape = new THREE.Shape(toShapePoints(outer));
  if (hole && hole.length >= 3) {
    shape.holes.push(new THREE.Path(toShapePoints(hole).reverse()));
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: p.plateBevel,
    bevelSize: p.plateBevel,
    bevelSegments: 2,
    curveSegments: 1,
  });
  sink.push(geo);
  const mesh = new THREE.Mesh(geo, material);
  // Local +Z becomes world +Y after this rotation, so the slab grows upward
  // from position.y.
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = bottomY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds one case per spatially connected cluster of keys, so a split board
 * gets two separate cases instead of one slab spanning the empty middle, and a
 * rotated layout (Alice) gets a case that follows the rotation rather than its
 * much larger bounding box.
 *
 * Each cluster is a body plus a bezel rather than stacked flat slabs: the body
 * is a solid tub whose top face is the recessed plate, and the bezel is a wall
 * ringing the key area that rises past the cap bottoms. Both contours come from
 * the same hull at different offsets, so no extra geometry work is needed.
 *
 * Deliberately restrained — vial.json carries no case height, tilt or feet, so
 * the proportions here are a plausible default rather than the real device's.
 */
function buildCase(
  p: Preview3DParams,
  footprints: Pt[][],
  res: Resources,
  sink: THREE.BufferGeometry[],
): THREE.Group {
  const group = new THREE.Group();
  const plateTop = -p.capInset;
  for (const hull of clusterHulls(footprints, p.clusterGap)) {
    const outer = offsetOutline(hull, p.plateMargin);
    const inner = offsetOutline(hull, p.bezelInner);
    group.add(extrudeProfile(p, outer, null, res.shellMat, plateTop - p.caseHeight, p.caseHeight, sink));
    group.add(extrudeProfile(p, outer, inner, res.plateMat, plateTop, p.bezelTop - plateTop, sink));
  }
  return group;
}

export function KeyboardLayout3D({
  keyboard,
  layer,
  onKeySelect,
  onEncoderSelect,
  params = DEFAULT_PREVIEW_3D_PARAMS,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  // Subscribes to keyboard.set*/save*/restore* writes so the mesh-rebuild effect
  // below knows precisely when a remap actually changed something, instead of the
  // old "rerun on every render, whatever the reason" hack.
  const revision = useKeyboardRevision(keyboard);

  const boardSize = useMemo(() => {
    const placed = placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices);
    return { width: placed.width, height: placed.height };
  }, [keyboard, keyboard.layoutOptions]);

  // One-time scene/renderer/controls setup, torn down on unmount.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 2;
    controls.maxDistance = 60;

    // Key light casts the shadows; the hemisphere ambient and a dim fill from
    // the opposite side keep the shaded flanks of the caps from going flat.
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x4a4a4a, params.ambientIntensity);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, params.keyLightIntensity);
    keyLight.position.set(4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0015;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, params.fillLightIntensity);
    fillLight.position.set(-5, 4, -4);
    scene.add(fillLight);

    const group = new THREE.Group();
    scene.add(group);
    const caseGroup = new THREE.Group();
    scene.add(caseGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const state: SceneState = {
      renderer,
      scene,
      camera,
      controls,
      keyLight,
      fillLight,
      ambientLight,
      group,
      caseGroup,
      caseGeo: [],
      pickables: [],
      raycaster,
      hovered: null,
      res: createResources(params),
    };
    stateRef.current = state;

    const setPointerFromEvent = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickableAt = (ev: PointerEvent): { pickable: Pickable; mesh: HoverableMesh } | null => {
      setPointerFromEvent(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(state.pickables, true);
      if (hits.length === 0) {
        return null;
      }
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !state.pickables.includes(obj as Pickable)) {
        obj = obj.parent;
      }
      // Legend planes are children of the cap; resolve a hit on one back to the
      // cap itself so hovering the glyphs doesn't count as a miss.
      let mesh: THREE.Object3D | null = hits[0].object;
      while (mesh && !(mesh as HoverableMesh).userData?.hoverMat) {
        mesh = mesh.parent;
      }
      return obj && mesh ? { pickable: obj as Pickable, mesh: mesh as HoverableMesh } : null;
    };

    // Materials are shared board-wide, so hover swaps the mesh's material
    // reference rather than mutating one — mutating would light up every key.
    const setHover = (mesh: HoverableMesh | null) => {
      if (state.hovered === mesh) {
        return;
      }
      if (state.hovered) {
        state.hovered.material = state.hovered.userData.baseMat;
      }
      state.hovered = mesh;
      if (mesh) {
        mesh.material = mesh.userData.hoverMat;
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      const hit = pickableAt(ev);
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      setHover(hit?.mesh ?? null);
    };

    const onClick = (ev: PointerEvent) => {
      const hit = pickableAt(ev);
      hit?.pickable.userData.onActivate();
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("pointerleave", () => setHover(null));

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      group.clear();
      caseGroup.clear();
      state.caseGeo.forEach((g) => g.dispose());
      state.caseGeo = [];
      disposeResources(state.res);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
    // Params are only seeded here; the effect below applies later changes in
    // place so tweaking a slider never rebuilds the renderer or resets the
    // camera the user has orbited to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geometry is cached by size alone, so any param change invalidates the whole
  // cache. Declared before the rebuild effects so that within one commit the
  // cache is dropped first and immediately repopulated — nothing renders in
  // between, so the meshes never reference a disposed geometry. Textures go too
  // because the legend colour is baked into them.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }
    const { res } = state;
    res.geo.forEach((g) => g.dispose());
    res.geo.clear();
    res.tex.forEach((t) => t.dispose());
    res.tex.clear();
    res.legendMat.forEach((m) => m.dispose());
    res.legendMat.clear();

    res.capMat.color.set(params.capColor);
    res.plateMat.color.set(params.plateColor);
    res.shellMat.color.set(params.shellColor);
    state.ambientLight.intensity = params.ambientIntensity;
    state.keyLight.intensity = params.keyLightIntensity;
    state.fillLight.intensity = params.fillLightIntensity;
  }, [params]);

  // Reframe the camera whenever the physical board size changes (layout
  // options), but not on every keymap edit — that would jerk the view out
  // from under a user mid-remap.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }
    const maxDim = Math.max(boardSize.width, boardSize.height, 4);
    state.camera.position.set(0, maxDim * 0.85, maxDim * 0.95);
    state.camera.near = 0.1;
    state.camera.far = maxDim * 12;
    state.camera.updateProjectionMatrix();
    state.controls.target.set(0, 0, 0);
    state.controls.update();

    // The shadow camera is orthographic and defaults to a ±5 box, which clips
    // shadows on anything wider than a 40%; size it to the board instead.
    const half = maxDim * 0.75;
    const shadowCam = state.keyLight.shadow.camera;
    shadowCam.left = -half;
    shadowCam.right = half;
    shadowCam.top = half;
    shadowCam.bottom = -half;
    shadowCam.near = 0.5;
    shadowCam.far = maxDim * 4;
    shadowCam.updateProjectionMatrix();
  }, [boardSize.width, boardSize.height]);

  // Rebuild key/encoder meshes whenever the keymap actually changes (`revision`,
  // bumped by Keyboard.notify — see useKeyboardRevision), or layer/params change.
  // Keyboard.getKey/getEncoder are re-read fresh each pass since the Keyboard
  // instance mutates its fields in place. Only Mesh wrappers are allocated here —
  // geometries, materials and textures all come from the shared cache.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }
    const { res } = state;
    state.group.clear();
    state.pickables = [];
    // The previously hovered mesh is no longer in the scene.
    state.hovered = null;

    // Same knob grouping the 2D boards use, so this view agrees with them about
    // what is one knob: stacked rotation directions become a single cylinder
    // (two coincident ones would z-fight), and the push switch is drawn as that
    // knob's face rather than as a cap of its own.
    const { placed, knobs, loose: looseEncoders, pressKeys } = knobLayout(keyboard);
    const offsetX = placed.width / 2;
    const offsetZ = placed.height / 2;

    for (const placedKey of placed.keys) {
      const { key, shiftX, shiftY } = placedKey;
      if (key.decal || pressKeys.has(placedKey)) {
        continue;
      }
      const qmkId = keyboard.getKey(layer, key.row, key.col);
      const mesh = buildKeyMesh(params, res, key, shiftX, shiftY, offsetX, offsetZ, kcLabel(qmkId));
      const pickable = mesh as unknown as Pickable;
      pickable.userData = { onActivate: () => onKeySelect(key.row, key.col) };
      state.group.add(mesh);
      state.pickables.push(pickable);
    }
    for (const { index, ccw, press } of knobs) {
      // A cylinder carries one legend, so it shows what the knob's face does:
      // its press binding where there is one, otherwise 左旋. The other bindings
      // live in the 2D board's knob panel — this page is display-only.
      const faceId = press
        ? keyboard.getKey(layer, press.key.row, press.key.col)
        : keyboard.getEncoder(layer, index, 0);
      const mesh = buildEncoderMesh(
        params,
        res,
        ccw.encoder,
        ccw.shiftX,
        ccw.shiftY,
        offsetX,
        offsetZ,
        kcLabel(faceId),
      );
      const pickable = mesh as unknown as Pickable;
      pickable.userData = { onActivate: () => onEncoderSelect(index, 0) };
      state.group.add(mesh);
      state.pickables.push(pickable);
    }
    for (const { encoder, shiftX, shiftY } of looseEncoders) {
      const qmkId = keyboard.getEncoder(layer, encoder.index, encoder.direction);
      const mesh = buildEncoderMesh(params, res, encoder, shiftX, shiftY, offsetX, offsetZ, kcLabel(qmkId));
      const pickable = mesh as unknown as Pickable;
      pickable.userData = { onActivate: () => onEncoderSelect(encoder.index, encoder.direction) };
      state.group.add(mesh);
      state.pickables.push(pickable);
    }
  }, [keyboard, layer, params, revision, onKeySelect, onEncoderSelect]);

  // The case depends only on the physical layout, so it is rebuilt on layout
  // changes rather than in the per-render cap pass above — hull + extrusion is
  // far too expensive to redo on every keymap edit.
  const layoutKey = keyboard.layoutChoices.join(",");
  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }
    state.caseGroup.clear();
    state.caseGeo.forEach((g) => g.dispose());
    state.caseGeo = [];

    const placed = placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices);
    const offsetX = placed.width / 2;
    const offsetZ = placed.height / 2;
    const footprints: Pt[][] = [];
    for (const { key, shiftX, shiftY } of placed.keys) {
      if (key.decal) {
        continue;
      }
      footprints.push(...footprintsOf(key, shiftX, shiftY, offsetX, offsetZ));
    }
    for (const { encoder, shiftX, shiftY } of placed.encoders) {
      footprints.push(...footprintsOf(encoder, shiftX, shiftY, offsetX, offsetZ));
    }

    state.caseGroup.add(buildCase(params, footprints, state.res, state.caseGeo));
  }, [keyboard, layoutKey, params]);

  return <div ref={mountRef} className="keyboard-layout-3d" />;
}
