// Decorative 3D keyboard model shown on the waiting-for-connection screen,
// distinct from KeyboardLayout3D.tsx (which renders the *connected* device's
// actual matrix/keymap). This just spins the static /Keyboard.glb asset —
// no picking, no keymap data, nothing to keep in sync with a live Keyboard.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MAX_YAW = 0.5; // radians, rotation.y at the far left/right edge of the window
const MAX_PITCH = 0.2; // radians, rotation.x at the top/bottom edge of the window
const FOLLOW_SMOOTHING = 4; // higher = snappier tracking, lower = more lag

interface Props {
  // WebGL can be unavailable (disabled by the user, no GPU, a lost context)
  // independently of whether three.js itself loaded, so success/failure is
  // reported via callback rather than assumed once this component mounts —
  // the caller keeps its static fallback icon visible until onReady fires.
  onReady: () => void;
  onError: () => void;
}

export function KeyboardModelPreview({ onReady, onError }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 2.6, 3.2);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.error("Failed to create WebGL context:", err);
      onError();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x78555e, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const pivot = new THREE.Group();
    scene.add(pivot);

    let disposed = false;
    const loader = new GLTFLoader();
    loader.load(
      "/Keyboard.glb",
      (gltf) => {
        if (disposed) {
          return;
        }
        const model = gltf.scene;

        // Normalize the imported model to a consistent on-screen size
        // regardless of the units/scale it was authored at.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 2.4 / maxDim;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

        pivot.add(model);
        setLoaded(true);
        onReady();
      },
      undefined,
      (err) => {
        if (disposed) {
          return;
        }
        console.error("Failed to load keyboard model:", err);
        onError();
      },
    );

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    // Target orientation follows the mouse's position anywhere in the
    // window (not just over the model), normalized to -1..1 per axis.
    const target = { yaw: 0, pitch: 0 };
    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      target.yaw = nx * MAX_YAW;
      target.pitch = ny * MAX_PITCH;
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
        const t = 1 - Math.exp(-FOLLOW_SMOOTHING * dt);
        pivot.rotation.y += (target.yaw - pivot.rotation.y) * t;
        pivot.rotation.x += (target.pitch - pivot.rotation.x) * t;
      }
      try {
        renderer.render(scene, camera);
      } catch (err) {
        console.error("Failed to render keyboard model:", err);
        cancelAnimationFrame(raf);
        onError();
      }
    };
    raf = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver.disconnect();
      pivot.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            const withMap = material as THREE.Material & { map?: THREE.Texture | null };
            withMap.map?.dispose();
            material.dispose();
          }
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="keyboard-model-preview"
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.4s ease" }}
    />
  );
}
