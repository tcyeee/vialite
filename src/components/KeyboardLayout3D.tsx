// 3D keyboard preview, sharing the same geometry pipeline as KeyboardLayout
// (placeLayout / rotatePoint from layoutGeometry.ts) so both renderers agree
// on where every key and encoder sits. Coordinates: KLE x -> world X,
// KLE y -> world Z, extrusion height -> world Y (up). Rotation is applied
// around a vertical (Y) axis at the key's rotated center; the sign is
// flipped relative to three.js's default Y-rotation because KLE's clockwise
// screen rotation (X-axis toward Y-axis) maps to X-axis toward +Z here,
// which is the opposite of three.js's right-hand rule for +Y rotation.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Keyboard, PhysicalEncoder, PhysicalKey } from "../protocol/keyboard.ts";
import { label as kcLabel } from "../protocol/keycodes.ts";
import { hasSecondRect, placeLayout, rotatePoint } from "./layoutGeometry.ts";

const UNIT = 1;
const GAP = 0.06;
const CAP_HEIGHT = 0.35;
const CAP_INSET = 0.08;
const PLATE_THICKNESS = 0.12;
const PLATE_MARGIN = 0.4;

const CAP_COLOR = 0xf2f2f2;
const CAP_HOVER_COLOR = 0xdadada;
const ENCODER_COLOR = 0xe6e6e6;
const PLATE_COLOR = 0x2b2b2b;

interface Props {
  keyboard: Keyboard;
  layer: number;
  onKeySelect: (row: number, col: number) => void;
  onEncoderSelect: (index: number, direction: 0 | 1) => void;
}

interface Pickable extends THREE.Object3D {
  userData: { onActivate: () => void };
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  group: THREE.Group;
  pickables: Pickable[];
  raycaster: THREE.Raycaster;
  hovered: THREE.Mesh | null;
}

function disposeMaterial(material: THREE.Material) {
  const withMap = material as THREE.Material & { map?: THREE.Texture | null };
  withMap.map?.dispose();
  material.dispose();
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(child.material);
      }
    }
  });
}

function wrapLabel(text: string): string[] {
  const lines = text.split("\n").flatMap((line) => (line.length > 10 ? [line.slice(0, 10)] : [line]));
  return lines.slice(0, 2);
}

function makeLabelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1b1c17";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapLabel(text);
  const fontSize = lines.length > 1 ? 26 : 30;
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const lineHeight = fontSize * 1.15;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, startY + i * lineHeight));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function capMaterials(label: string, color: number): THREE.Material[] {
  const side = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
  const top = new THREE.MeshStandardMaterial({
    map: makeLabelTexture(label),
    roughness: 0.5,
    metalness: 0.05,
  });
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
  return [side, side, top, side, side, side];
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
  key: PhysicalKey,
  shiftX: number,
  shiftY: number,
  boardOffsetX: number,
  boardOffsetZ: number,
  label: string,
): THREE.Group {
  const group = new THREE.Group();
  const yaw = -(key.rotationAngle * Math.PI) / 180;

  const addRect = (x: number, y: number, w: number, h: number, faceLabel: string) => {
    const geo = new THREE.BoxGeometry(
      Math.max(w * UNIT - GAP, 0.1),
      CAP_HEIGHT,
      Math.max(h * UNIT - GAP, 0.1),
    );
    const mesh = new THREE.Mesh(geo, capMaterials(faceLabel, CAP_COLOR));
    const center = rotatedCenter(x, y, w, h, key.rotationAngle, key.rotationX, key.rotationY, shiftX, shiftY);
    mesh.position.set(center.x - boardOffsetX, CAP_HEIGHT / 2, center.z - boardOffsetZ);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  addRect(key.x, key.y, key.width, key.height, label);
  if (hasSecondRect(key)) {
    addRect(key.x + key.x2, key.y + key.y2, key.width2, key.height2, label);
  }
  return group;
}

function buildEncoderMesh(
  encoder: PhysicalEncoder,
  shiftX: number,
  shiftY: number,
  boardOffsetX: number,
  boardOffsetZ: number,
  label: string,
): THREE.Group {
  const group = new THREE.Group();
  const radius = (Math.min(encoder.width, encoder.height) * UNIT - GAP) / 2;
  const geo = new THREE.CylinderGeometry(radius, radius, CAP_HEIGHT, 32);
  // CylinderGeometry material order: side, top, bottom.
  const side = new THREE.MeshStandardMaterial({ color: ENCODER_COLOR, roughness: 0.5, metalness: 0.1 });
  const top = new THREE.MeshStandardMaterial({ map: makeLabelTexture(label), roughness: 0.5, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, [side, top, side]);
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
  mesh.position.set(center.x - boardOffsetX, CAP_HEIGHT / 2, center.z - boardOffsetZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export function KeyboardLayout3D({ keyboard, layer, onKeySelect, onEncoderSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);

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
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 2;
    controls.maxDistance = 60;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(4, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const group = new THREE.Group();
    scene.add(group);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const state: SceneState = { renderer, scene, camera, controls, group, pickables: [], raycaster, hovered: null };
    stateRef.current = state;

    const setPointerFromEvent = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickableAt = (ev: PointerEvent): { pickable: Pickable; mesh: THREE.Mesh } | null => {
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
      return obj ? { pickable: obj as Pickable, mesh: hits[0].object as THREE.Mesh } : null;
    };

    const setHover = (mesh: THREE.Mesh | null) => {
      if (state.hovered === mesh) {
        return;
      }
      if (state.hovered) {
        const mats = Array.isArray(state.hovered.material) ? state.hovered.material : [state.hovered.material];
        for (const m of mats) {
          (m as THREE.MeshStandardMaterial).emissive?.setHex(0x000000);
        }
      }
      state.hovered = mesh;
      if (mesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          (m as THREE.MeshStandardMaterial).emissive?.setHex(CAP_HOVER_COLOR);
          (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
        }
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
      disposeObject(group);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

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
  }, [boardSize.width, boardSize.height]);

  // Rebuild key/encoder meshes on every render, mirroring KeyboardLayout's
  // habit of re-reading keyboard.getKey/getEncoder fresh each pass (the
  // Keyboard instance mutates in place; App bumps a forceUpdate counter to
  // trigger this).
  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }
    disposeObject(state.group);
    state.group.clear();
    state.pickables = [];

    const placed = placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices);
    const offsetX = placed.width / 2;
    const offsetZ = placed.height / 2;

    for (const { key, shiftX, shiftY } of placed.keys) {
      if (key.decal) {
        continue;
      }
      const qmkId = keyboard.getKey(layer, key.row, key.col);
      const mesh = buildKeyMesh(key, shiftX, shiftY, offsetX, offsetZ, kcLabel(qmkId));
      const pickable = mesh as unknown as Pickable;
      pickable.userData = { onActivate: () => onKeySelect(key.row, key.col) };
      state.group.add(mesh);
      state.pickables.push(pickable);
    }
    for (const { encoder, shiftX, shiftY } of placed.encoders) {
      const qmkId = keyboard.getEncoder(layer, encoder.index, encoder.direction);
      const mesh = buildEncoderMesh(encoder, shiftX, shiftY, offsetX, offsetZ, kcLabel(qmkId));
      const pickable = mesh as unknown as Pickable;
      pickable.userData = { onActivate: () => onEncoderSelect(encoder.index, encoder.direction) };
      state.group.add(mesh);
      state.pickables.push(pickable);
    }

    const plateWidth = placed.width * UNIT + PLATE_MARGIN * 2;
    const plateDepth = placed.height * UNIT + PLATE_MARGIN * 2;
    const plateGeo = new THREE.BoxGeometry(plateWidth, PLATE_THICKNESS, plateDepth);
    const plateMesh = new THREE.Mesh(
      plateGeo,
      new THREE.MeshStandardMaterial({ color: PLATE_COLOR, roughness: 0.8, metalness: 0.1 }),
    );
    plateMesh.position.set(0, -PLATE_THICKNESS / 2 - CAP_INSET, 0);
    plateMesh.receiveShadow = true;
    state.group.add(plateMesh);
  });

  return <div ref={mountRef} className="keyboard-layout-3d" />;
}
