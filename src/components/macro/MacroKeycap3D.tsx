// Decorative 3D keycap shown above the macro tabs. It renders a single
// mechanical-keyboard keycap whose top legend mirrors the currently selected
// macro slot (a macro icon + the slot number) — purely presentational, no
// picking or protocol data.
// Style/teardown conventions follow the other three.js views in this project
// (KeyboardModelPreview, KeyboardLayout3D): alpha renderer, reduced-motion
// aware, full geometry/material/texture disposal on unmount.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const CAP_WIDTH = 2.2;
const CAP_HEIGHT = 0.9;
const CAP_DEPTH = 2.2;
const CAP_COLOR = 0xf2f2f2;
const MAX_TILT = 0.35; // radians, tilt at the far edge of the window

// mdi:script-text-outline path (24×24 viewBox), matching the macro icon used in
// the sidebar nav and the tab labels. Drawn to the left of the slot number.
const MACRO_ICON_PATH =
  "M15 20a1 1 0 0 0 1-1V4H8a1 1 0 0 0-1 1v11H5V5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v1h-2V5a1 1 0 0 0-1-1a1 1 0 0 0-1 1v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1h11a2 2 0 0 0 2 2M9 6h5v2H9zm0 4h5v2H9zm0 4h5v2H9z";
const MACRO_ICON_VIEWBOX = 24;

function makeLegendTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1b1c17";

  const iconSize = 88;
  const iconScale = iconSize / MACRO_ICON_VIEWBOX;
  const gap = 6;
  const cy = canvas.height / 2 + 6;

  // Center the icon + number as a group.
  ctx.font = "700 96px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(text).width;
  const startX = (canvas.width - (iconSize + gap + textWidth)) / 2;

  ctx.save();
  ctx.translate(startX, cy - iconSize / 2);
  ctx.scale(iconScale, iconScale);
  ctx.fill(new Path2D(MACRO_ICON_PATH));
  ctx.restore();

  ctx.fillText(text, startX + iconSize + gap, cy);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

interface Props {
  /** Slot number printed to the right of the macro icon, e.g. "0". */
  label: string;
}

export function MacroKeycap3D({ label }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  // The legend texture/material live outside the setup effect so the label can
  // be swapped in place without rebuilding the whole scene.
  const legendRef = useRef<{ material: THREE.MeshBasicMaterial } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    // Base framing (wide panels). resize() pulls the camera further back when
    // the panel is narrow so the cap never gets clipped at the sides.
    const baseCameraPos = new THREE.Vector3(0, 3.4, 4.2);
    camera.position.copy(baseCameraPos);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      // Decorative only — if WebGL is unavailable we just leave the area blank.
      console.error("Failed to create WebGL context:", err);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x78555e, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    // Pivot the cap so it tilts around its own centre rather than the origin.
    const pivot = new THREE.Group();
    scene.add(pivot);

    const capGeo = new RoundedBoxGeometry(CAP_WIDTH, CAP_HEIGHT, CAP_DEPTH, 4, 0.18);
    const capMat = new THREE.MeshStandardMaterial({ color: CAP_COLOR, roughness: 0.55, metalness: 0.05 });
    const cap = new THREE.Mesh(capGeo, capMat);
    pivot.add(cap);

    // The legend sits on a thin plane just above the cap's top face so it can
    // be re-textured cheaply when the selected slot changes.
    const legendMat = new THREE.MeshBasicMaterial({
      map: makeLegendTexture(label),
      transparent: true,
    });
    const legend = new THREE.Mesh(new THREE.PlaneGeometry(CAP_WIDTH * 0.8, CAP_DEPTH * 0.8), legendMat);
    legend.rotation.x = -Math.PI / 2;
    legend.position.y = CAP_HEIGHT / 2 + 0.01;
    pivot.add(legend);
    legendRef.current = { material: legendMat };

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      const aspect = w / h;
      renderer.setSize(w, h);
      camera.aspect = aspect;
      // A perspective camera's horizontal FOV shrinks with the aspect ratio, so
      // a narrow panel would clip the cap's sides. Pull back proportionally
      // (never closer than the base framing) to keep the whole cap visible.
      const zoom = aspect < 1 ? 1 / aspect : 1;
      camera.position.copy(baseCameraPos).multiplyScalar(zoom);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    // Gentle tilt following the pointer anywhere in the window, kept subtle so
    // the legend stays readable.
    const target = { yaw: 0, pitch: 0 };
    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      target.yaw = nx * MAX_TILT;
      target.pitch = ny * MAX_TILT * 0.5;
    };
    if (!reduceMotion) {
      window.addEventListener("pointermove", handlePointerMove);
    }

    let raf = 0;
    let last = performance.now();
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const dt = (now - last) / 1000;
      last = now;
      if (!reduceMotion) {
        const t = 1 - Math.exp(-4 * dt);
        pivot.rotation.y += (target.yaw - pivot.rotation.y) * t;
        pivot.rotation.x += (target.pitch - pivot.rotation.x) * t;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver.disconnect();
      legendRef.current = null;
      capGeo.dispose();
      capMat.dispose();
      legend.geometry.dispose();
      legendMat.map?.dispose();
      legendMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // Swap the legend texture whenever the selected slot changes.
  useEffect(() => {
    const entry = legendRef.current;
    if (!entry) {
      return;
    }
    entry.material.map?.dispose();
    entry.material.map = makeLegendTexture(label);
    entry.material.needsUpdate = true;
  }, [label]);

  return <div ref={mountRef} className="h-40 w-full" />;
}
