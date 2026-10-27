import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const stage = document.querySelector(".hero-3d-stage");
const canvas = document.querySelector(".hero-3d-canvas");
const status = document.querySelector(".hero-3d-status");

function initializeHeroScene() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: "low-power"
        });
    } catch (error) {
        console.error("WebGL could not initialize the hero 3D preview.", error);
        if (status) {
            status.textContent = "3D preview unavailable. Showing a static illustration instead.";
        }
        return;
    }
    const pivot = new THREE.Group();
    let modelReady = false;
    let isVisible = true;
    let animationFrame = 0;
    let previousFrame = 0;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    camera.position.set(0, 0, 4.4);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xf4f3ee, 0x53616a, 2.1));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb7d2d0, 1.5);
    fillLight.position.set(4, 1, 3);
    scene.add(fillLight);
    scene.add(pivot);

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

    function render() {
        renderer.render(scene, camera);
    }

    function animate(timestamp) {
        animationFrame = 0;
        if (!isVisible || document.visibilityState === "hidden" || !modelReady) {
            return;
        }

        if (previousFrame !== 0) {
            const delta = Math.min((timestamp - previousFrame) / 1000, 0.05);
            pivot.rotation.y += delta * 0.12;
            pivot.position.y = Math.sin(timestamp * 0.00055) * 0.025;
        }
        previousFrame = timestamp;
        render();
        animationFrame = window.requestAnimationFrame(animate);
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

    function showFallback(error) {
        console.error("The hero 3D model could not be loaded.", error);
        if (status) {
            status.textContent = "3D preview unavailable. Showing a static illustration instead.";
        }
    }

    try {
        const loader = new OBJLoader();
        const bookMaterials = [
            new THREE.MeshStandardMaterial({ color: 0x667d88, roughness: 0.76 }),
            new THREE.MeshStandardMaterial({ color: 0xb8a88f, roughness: 0.82 }),
            new THREE.MeshStandardMaterial({ color: 0x415761, roughness: 0.72 }),
            new THREE.MeshStandardMaterial({ color: 0x879a98, roughness: 0.8 })
        ];
        const detailMaterial = new THREE.MeshStandardMaterial({ color: 0xc3b89f, roughness: 0.56 });
        let bookIndex = 0;

        loader.load(
            new URL("./3D_files_textures/books_and_mugs.obj", import.meta.url).href,
            (model) => {
                model.rotation.x = -Math.PI / 2;
                model.updateMatrixWorld(true);

                const bounds = new THREE.Box3().setFromObject(model);
                const size = bounds.getSize(new THREE.Vector3());
                const center = bounds.getCenter(new THREE.Vector3());
                const scale = 2.25 / size.y;
                model.scale.setScalar(scale);
                model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

                model.traverse((child) => {
                    if (!(child instanceof THREE.Mesh)) {
                        return;
                    }

                    child.material = child.name.startsWith("Box")
                        ? bookMaterials[bookIndex++ % bookMaterials.length]
                        : detailMaterial;
                    child.castShadow = false;
                    child.receiveShadow = false;
                });

                pivot.add(model);
                modelReady = true;
                stage.classList.add("has-renderer");
                resizeRenderer();
                updateAnimation();
            },
            undefined,
            showFallback
        );
    } catch (error) {
        showFallback(error);
    }

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
    initializeHeroScene();
}
