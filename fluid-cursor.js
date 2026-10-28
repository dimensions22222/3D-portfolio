import * as THREE from "three";

const page = document.querySelector("main");
const canvas = document.querySelector(".fluid-cursor-canvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// A compact GPU fluid simulation, kept independent from the React component
// this effect originated from. All simulation work stays in WebGL render
// targets; moving the pointer never triggers DOM work or layout changes.
const settings = {
    simulationResolution: 144,
    dyeResolution: 512,
    curl: 28,
    pressureIterations: 18,
    velocityDissipation: 0.975,
    dyeDissipation: 0.992,
    splatRadius: 0.004,
    force: 0.55,
    threshold: 0.09
};

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const shaders = {
    splat: `
        uniform sampler2D uTarget;
        uniform vec2 point;
        uniform vec3 color;
        uniform float aspect;
        uniform float radius;
        varying vec2 vUv;
        void main() {
            vec2 distanceToPoint = vUv - point;
            distanceToPoint.x *= aspect;
            vec3 base = texture2D(uTarget, vUv).rgb;
            float stamp = exp(-dot(distanceToPoint, distanceToPoint) / radius);
            gl_FragColor = vec4(base + stamp * color, 1.0);
        }
    `,
    advection: `
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texel;
        uniform float dt;
        uniform float dissipation;
        varying vec2 vUv;
        void main() {
            vec2 coordinate = vUv - dt * texture2D(uVelocity, vUv).xy * texel;
            gl_FragColor = vec4(dissipation * texture2D(uSource, coordinate).rgb, 1.0);
        }
    `,
    curl: `
        uniform sampler2D uVelocity;
        uniform vec2 texel;
        varying vec2 vUv;
        void main() {
            vec2 l = vUv - vec2(texel.x, 0.0);
            vec2 r = vUv + vec2(texel.x, 0.0);
            vec2 t = vUv + vec2(0.0, texel.y);
            vec2 b = vUv - vec2(0.0, texel.y);
            float value = texture2D(uVelocity, r).y - texture2D(uVelocity, l).y
                - texture2D(uVelocity, t).x + texture2D(uVelocity, b).x;
            gl_FragColor = vec4(value, 0.0, 0.0, 1.0);
        }
    `,
    vorticity: `
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform vec2 texel;
        uniform float strength;
        uniform float dt;
        varying vec2 vUv;
        void main() {
            float l = abs(texture2D(uCurl, vUv - vec2(texel.x, 0.0)).x);
            float r = abs(texture2D(uCurl, vUv + vec2(texel.x, 0.0)).x);
            float t = abs(texture2D(uCurl, vUv + vec2(0.0, texel.y)).x);
            float b = abs(texture2D(uCurl, vUv - vec2(0.0, texel.y)).x);
            vec2 force = normalize(vec2(t - b, r - l) + 0.0001)
                * strength * texture2D(uCurl, vUv).x;
            gl_FragColor = vec4(texture2D(uVelocity, vUv).xy + force * dt, 0.0, 1.0);
        }
    `,
    divergence: `
        uniform sampler2D uVelocity;
        uniform vec2 texel;
        varying vec2 vUv;
        vec2 velocity(vec2 coordinate) {
            vec2 signValue = vec2(1.0);
            if (coordinate.x < 0.0) { coordinate.x = 0.0; signValue.x = -1.0; }
            if (coordinate.x > 1.0) { coordinate.x = 1.0; signValue.x = -1.0; }
            if (coordinate.y < 0.0) { coordinate.y = 0.0; signValue.y = -1.0; }
            if (coordinate.y > 1.0) { coordinate.y = 1.0; signValue.y = -1.0; }
            return signValue * texture2D(uVelocity, coordinate).xy;
        }
        void main() {
            vec2 l = vUv - vec2(texel.x, 0.0);
            vec2 r = vUv + vec2(texel.x, 0.0);
            vec2 t = vUv + vec2(0.0, texel.y);
            vec2 b = vUv - vec2(0.0, texel.y);
            float value = 0.5 * (velocity(r).x - velocity(l).x + velocity(t).y - velocity(b).y);
            gl_FragColor = vec4(value, 0.0, 0.0, 1.0);
        }
    `,
    clear: `
        uniform sampler2D uTexture;
        uniform float value;
        varying vec2 vUv;
        void main() { gl_FragColor = value * texture2D(uTexture, vUv); }
    `,
    pressure: `
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        uniform vec2 texel;
        varying vec2 vUv;
        void main() {
            vec2 l = clamp(vUv - vec2(texel.x, 0.0), 0.0, 1.0);
            vec2 r = clamp(vUv + vec2(texel.x, 0.0), 0.0, 1.0);
            vec2 t = clamp(vUv + vec2(0.0, texel.y), 0.0, 1.0);
            vec2 b = clamp(vUv - vec2(0.0, texel.y), 0.0, 1.0);
            float value = (texture2D(uPressure, l).x + texture2D(uPressure, r).x
                + texture2D(uPressure, t).x + texture2D(uPressure, b).x
                - texture2D(uDivergence, vUv).x) * 0.25;
            gl_FragColor = vec4(value, 0.0, 0.0, 1.0);
        }
    `,
    gradientSubtract: `
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        uniform vec2 texel;
        varying vec2 vUv;
        void main() {
            float l = texture2D(uPressure, clamp(vUv - vec2(texel.x, 0.0), 0.0, 1.0)).x;
            float r = texture2D(uPressure, clamp(vUv + vec2(texel.x, 0.0), 0.0, 1.0)).x;
            float t = texture2D(uPressure, clamp(vUv + vec2(0.0, texel.y), 0.0, 1.0)).x;
            float b = texture2D(uPressure, clamp(vUv - vec2(0.0, texel.y), 0.0, 1.0)).x;
            vec2 value = texture2D(uVelocity, vUv).xy - vec2(r - l, t - b);
            gl_FragColor = vec4(value, 0.0, 1.0);
        }
    `,
    display: `
        uniform sampler2D uTexture;
        uniform float threshold;
        varying vec2 vUv;
        void main() {
            float dye = clamp(length(texture2D(uTexture, vUv).rgb), 0.0, 1.0);
            float alpha = smoothstep(threshold, threshold + 0.16, dye);
            gl_FragColor = vec4(vec3(alpha), alpha);
        }
    `
};

function createMaterial(fragmentShader, uniforms) {
    return new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false
    });
}

function startFluidCursor() {
    if (!(page instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement) || reducedMotion.matches) {
        return;
    }

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    } catch (error) {
        console.warn("Fluid cursor effect is unavailable.", error);
        return;
    }

    if (!renderer.extensions.has("EXT_color_buffer_float")) {
        renderer.dispose();
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    scene.add(quad);

    const makeTarget = (width, height) => new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter
    });
    const makeDoubleTarget = (width, height) => ({
        read: makeTarget(width, height),
        write: makeTarget(width, height),
        swap() { [this.read, this.write] = [this.write, this.read]; },
        dispose() { this.read.dispose(); this.write.dispose(); }
    });
    const textureUniform = () => ({ value: null });
    const numberUniform = (value = 0) => ({ value });
    const vectorUniform = () => ({ value: new THREE.Vector2() });

    const materials = {
        splat: createMaterial(shaders.splat, {
            uTarget: textureUniform(), point: vectorUniform(), color: { value: new THREE.Vector3() },
            aspect: numberUniform(), radius: numberUniform()
        }),
        advection: createMaterial(shaders.advection, {
            uVelocity: textureUniform(), uSource: textureUniform(), texel: vectorUniform(),
            dt: numberUniform(), dissipation: numberUniform()
        }),
        curl: createMaterial(shaders.curl, { uVelocity: textureUniform(), texel: vectorUniform() }),
        vorticity: createMaterial(shaders.vorticity, {
            uVelocity: textureUniform(), uCurl: textureUniform(), texel: vectorUniform(),
            strength: numberUniform(), dt: numberUniform()
        }),
        divergence: createMaterial(shaders.divergence, { uVelocity: textureUniform(), texel: vectorUniform() }),
        clear: createMaterial(shaders.clear, { uTexture: textureUniform(), value: numberUniform() }),
        pressure: createMaterial(shaders.pressure, {
            uPressure: textureUniform(), uDivergence: textureUniform(), texel: vectorUniform()
        }),
        gradientSubtract: createMaterial(shaders.gradientSubtract, {
            uPressure: textureUniform(), uVelocity: textureUniform(), texel: vectorUniform()
        }),
        display: createMaterial(shaders.display, { uTexture: textureUniform(), threshold: numberUniform() })
    };

    let width = 1;
    let height = 1;
    let velocity;
    let dye;
    let pressure;
    let divergence;
    let curl;
    let simTexel;
    let dyeTexel;
    let raf = 0;
    let lastTime = performance.now();
    const pointer = { x: 0, y: 0, dx: 0, dy: 0, active: false };

    const pass = (material, target) => {
        quad.material = material;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
    };
    const set = (material, values) => {
        Object.entries(values).forEach(([name, value]) => { material.uniforms[name].value = value; });
        return material;
    };
    const disposeTargets = () => {
        velocity?.dispose();
        dye?.dispose();
        pressure?.dispose();
        divergence?.dispose();
        curl?.dispose();
    };
    const resize = () => {
        const pixelRatio = renderer.getPixelRatio();
        width = Math.max(1, Math.round(window.innerWidth * pixelRatio));
        height = Math.max(1, Math.round(window.innerHeight * pixelRatio));
        renderer.setSize(window.innerWidth, window.innerHeight, false);

        const aspect = width / height;
        const simWidth = settings.simulationResolution;
        const simHeight = Math.max(1, Math.round(simWidth / aspect));
        const dyeWidth = settings.dyeResolution;
        const dyeHeight = Math.max(1, Math.round(dyeWidth / aspect));
        disposeTargets();
        velocity = makeDoubleTarget(simWidth, simHeight);
        dye = makeDoubleTarget(dyeWidth, dyeHeight);
        pressure = makeDoubleTarget(simWidth, simHeight);
        divergence = makeTarget(simWidth, simHeight);
        curl = makeTarget(simWidth, simHeight);
        simTexel = new THREE.Vector2(1 / simWidth, 1 / simHeight);
        dyeTexel = new THREE.Vector2(1 / dyeWidth, 1 / dyeHeight);
    };
    const splat = () => {
        const point = new THREE.Vector2(pointer.x / width, 1 - pointer.y / height);
        const aspect = width / height;
        set(materials.splat, { point, aspect, radius: settings.splatRadius });
        set(materials.splat, {
            uTarget: velocity.read.texture,
            color: new THREE.Vector3(pointer.dx * settings.force, -pointer.dy * settings.force, 0)
        });
        pass(materials.splat, velocity.write);
        velocity.swap();
        set(materials.splat, { uTarget: dye.read.texture, color: new THREE.Vector3(1.15, 1.15, 1.15) });
        pass(materials.splat, dye.write);
        dye.swap();
    };
    const simulate = (dt) => {
        pass(set(materials.curl, { uVelocity: velocity.read.texture, texel: simTexel }), curl);
        pass(set(materials.vorticity, {
            uVelocity: velocity.read.texture, uCurl: curl.texture, texel: simTexel,
            strength: settings.curl, dt
        }), velocity.write);
        velocity.swap();
        pass(set(materials.divergence, { uVelocity: velocity.read.texture, texel: simTexel }), divergence);
        pass(set(materials.clear, { uTexture: pressure.read.texture, value: 0.8 }), pressure.write);
        pressure.swap();
        set(materials.pressure, { uDivergence: divergence.texture, texel: simTexel });
        for (let index = 0; index < settings.pressureIterations; index += 1) {
            materials.pressure.uniforms.uPressure.value = pressure.read.texture;
            pass(materials.pressure, pressure.write);
            pressure.swap();
        }
        pass(set(materials.gradientSubtract, {
            uPressure: pressure.read.texture, uVelocity: velocity.read.texture, texel: simTexel
        }), velocity.write);
        velocity.swap();
        set(materials.advection, {
            uVelocity: velocity.read.texture, uSource: velocity.read.texture, texel: simTexel,
            dt, dissipation: settings.velocityDissipation
        });
        pass(materials.advection, velocity.write);
        velocity.swap();
        set(materials.advection, {
            uVelocity: velocity.read.texture, uSource: dye.read.texture, texel: dyeTexel,
            dt, dissipation: settings.dyeDissipation
        });
        pass(materials.advection, dye.write);
        dye.swap();
    };
    const render = () => pass(set(materials.display, {
        uTexture: dye.read.texture, threshold: settings.threshold
    }), null);
    const loop = (time) => {
        raf = 0;
        if (document.visibilityState === "hidden" || reducedMotion.matches) return;
        const dt = Math.min((time - lastTime) / 1000, 1 / 60);
        lastTime = time;
        if (pointer.active) {
            splat();
            pointer.active = false;
        }
        simulate(dt);
        render();
        raf = requestAnimationFrame(loop);
    };
    const ensureAnimation = () => {
        if (document.visibilityState === "visible" && !reducedMotion.matches && raf === 0) {
            lastTime = performance.now();
            raf = requestAnimationFrame(loop);
        }
    };
    const onPointerMove = (event) => {
        const pixelRatio = renderer.getPixelRatio();
        const nextX = event.clientX * pixelRatio;
        const nextY = event.clientY * pixelRatio;
        pointer.dx = nextX - pointer.x;
        pointer.dy = nextY - pointer.y;
        pointer.x = nextX;
        pointer.y = nextY;
        pointer.active = Math.abs(pointer.dx) + Math.abs(pointer.dy) > 0;
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", ensureAnimation);
    reducedMotion.addEventListener("change", ensureAnimation);
    ensureAnimation();

    window.addEventListener("pagehide", () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointerMove);
        disposeTargets();
        Object.values(materials).forEach((material) => material.dispose());
        quad.geometry.dispose();
        renderer.dispose();
    }, { once: true });
}

startFluidCursor();
