import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.querySelector(".about-object__stage");
const canvas = document.querySelector(".about-object__canvas");

function initializeLighterPreview() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    let renderer;

    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: "low-power"
        });
    } catch (error) {
        console.error("WebGL could not initialize the lighter preview.", error);
        return;
    }

    const pivot = new THREE.Group();
    let isVisible = true;
    let modelReady = false;
    let animationFrame = 0;
    let previousFrame = 0;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    const environmentGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = environmentGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 1.1;
    environmentGenerator.dispose();
    camera.position.set(0, 0, 3.8);
    scene.add(new THREE.HemisphereLight(0xfff4e8, 0x333844, 2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9debd9, 1.2);
    rimLight.position.set(4, 1, -2);
    scene.add(rimLight);
    scene.add(pivot);

    function render() {
        renderer.render(scene, camera);
    }

    function resizeRenderer() {
        const { width, height } = stage.getBoundingClientRect();
        if (width === 0 || height === 0) {
            return;
        }

        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
    }

    function stopAnimation() {
        if (animationFrame !== 0) {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        }
        previousFrame = 0;
    }

    function updateAnimation() {
        if (reducedMotion.matches || !isVisible || document.visibilityState === "hidden" || !modelReady) {
            stopAnimation();
            render();
        } else if (animationFrame === 0) {
            animationFrame = window.requestAnimationFrame(animate);
        }
    }

    function animate(timestamp) {
        animationFrame = 0;
        if (!isVisible || document.visibilityState === "hidden" || !modelReady) {
            return;
        }

        if (previousFrame !== 0) {
            const delta = Math.min((timestamp - previousFrame) / 1000, 0.05);
            pivot.rotation.y += delta * 0.3;
        }
        previousFrame = timestamp;
        render();
        animationFrame = window.requestAnimationFrame(animate);
    }

    const loader = new GLTFLoader();
    loader.load(
        new URL("./assets/vintage-lighter.glb", import.meta.url).href,
        ({ scene: model }) => {
            model.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(model);
            const size = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());
            const scale = 1.65 / Math.max(size.x, size.y, size.z);

            model.scale.setScalar(scale);
            model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
            pivot.add(model);
            modelReady = true;
            stage.classList.add("has-renderer");
            resizeRenderer();
            updateAnimation();
        },
        undefined,
        (error) => console.error("The vintage lighter model could not be loaded.", error)
    );

    if ("ResizeObserver" in window) {
        new ResizeObserver(resizeRenderer).observe(stage);
    } else {
        window.addEventListener("resize", resizeRenderer, { passive: true });
    }

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(([entry]) => {
            isVisible = entry.isIntersecting;
            updateAnimation();
        }).observe(stage);
    }

    document.addEventListener("visibilitychange", updateAnimation);
    reducedMotion.addEventListener("change", updateAnimation);
    resizeRenderer();
}

if (stage instanceof HTMLElement && canvas instanceof HTMLCanvasElement) {
    initializeLighterPreview();
}
