import * as THREE from "three";
import { Kind, type FluidSim } from "./sim";
import { opticsChunk } from "./optics";

/**
 * Spray and the drops thrown at the lens, drawn one by one as tiny ball
 * lenses. Photographed against a backlight, a falling drop is a thick dark
 * ring around a bright, inverted, miniature image of the light behind it,
 * with one hard specular point — and at speed it smears into a streak
 * along its path, because a camera shutter is open for a moment.
 *
 * Each drop is an instanced quad stretched in screen space from where the
 * drop was a shutter-interval ago to where it is now; the fragment shader
 * treats that as a capsule and shades a sphere across it.
 */

const vertex = /* glsl */ `
  in vec3 iPos;
  in vec3 iVel;
  in float iRadius;
  in float iKind;
  uniform vec2 uRes;
  uniform float uShutter;
  uniform float uFocus; // view depth in focus (the pour)
  uniform float uCoc;   // blur, px per unit of |1 − focus/depth|
  out vec2 vLocal;   // x across, y along (px, from the tail)
  out float vLen;
  out float vRad;
  out vec2 vHeadUv;
  out vec2 vDir;
  out float vBlur;
  flat out float vSeed;
  void main() {
    vSeed = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453);
    bool drop = (abs(iKind - ${Kind.Spray}.0) < 0.5 || abs(iKind - ${Kind.Lens}.0) < 0.5 || abs(iKind - ${Kind.Sheet}.0) < 0.5) && iRadius > 0.0;
    vec4 c0 = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
    if (!drop || c0.w < 0.05) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec4 c1 = projectionMatrix * viewMatrix * vec4(iPos - iVel * uShutter, 1.0);
    vec2 half_ = 0.5 * uRes;
    vec2 s0 = c0.xy / c0.w * half_;
    vec2 s1 = c1.xy / max(c1.w, 0.05) * half_;
    float rpx = max(iRadius * projectionMatrix[1][1] * half_.y / c0.w, 0.7);
    // Thin-lens depth of field: the camera is focused on the pour, so a drop
    // flung close to the lens is a large soft disc, not a crisp bead.
    float coc = uCoc * abs(1.0 - uFocus / c0.w);
    float sharpR = rpx;
    rpx = sqrt(rpx * rpx + coc * coc);
    vBlur = 1.0 - sharpR / rpx;
    vec2 d = s0 - s1;
    float len = length(d);
    // Streaks are capped so a drop racing at the lens stays a drop.
    if (len > sharpR * 14.0) { s1 = s0 - d / len * sharpR * 14.0; len = sharpR * 14.0; }
    vec2 dir = len > 1e-3 ? d / len : vec2(0.0, 1.0);
    // (perp, dir) must keep the quad's winding, or it is culled.
    vec2 perp = vec2(dir.y, -dir.x);
    float R = rpx + 1.5;
    float along = mix(-R, len + R, position.y * 0.5 + 0.5);
    vec2 p = s1 + dir * along + perp * position.x * R;
    vLocal = vec2(position.x * R, along);
    vLen = len;
    vRad = rpx;
    vHeadUv = s0 / uRes + 0.5;
    vDir = dir;
    gl_Position = vec4(p / half_ * c0.w, c0.z, c0.w);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform mat4 uViewInv;
  uniform vec3 uKey; // key softbox direction, view space
  in vec2 vLocal;
  in float vLen;
  in float vRad;
  in vec2 vHeadUv;
  in vec2 vDir;
  in float vBlur;
  flat in float vSeed;
  out vec4 outColor;

  ${opticsChunk}

  void main() {
    // Nearest point on the streak's spine, then a sphere across the capsule.
    vec2 q = vec2(vLocal.x, vLocal.y - clamp(vLocal.y, 0.0, vLen));
    float dist = length(q);
    float cov = clamp((vRad + 0.5 - dist) / (1.0 + vBlur * vRad * 0.3), 0.0, 1.0);
    if (cov <= 0.0) discard;
    vec2 perp = vec2(vDir.y, -vDir.x);
    vec2 n2 = (q.x * perp + q.y * vDir) / max(vRad, 1e-3);
    float rr = min(dot(n2, n2), 0.999);
    float h = sqrt(rr);
    vec3 nView = vec3(n2, sqrt(1.0 - rr));
    float F = fresnelWater(nView.z);

    // Through a ball lens: a ray entering at impact parameter h leaves
    // deviated by 2(θi − θt), bent across the centre — so a drop shows an
    // inverted, wide-angle view of the room. Hung below the backlight, its
    // lower half glows with the panel above it.
    float ti = asin(h);
    float tt = asin(h / 1.333);
    float dev = 2.0 * (ti - tt);
    vec2 away = h > 1e-4 ? -n2 / h : vec2(0.0);
    vec3 dOut = vec3(away * sin(dev), -cos(dev));
    vec2 uv = vHeadUv + (vLocal.y - vLen) * vDir / uRes;
    vec2 look = uv + away * tan(min(dev, 1.2)) * 0.22 * vec2(uRes.y / uRes.x, 1.0);
    vec3 near = texture(tScene, clamp(look, vec2(0.001), vec2(0.999))).rgb;
    vec3 far = studio((uViewInv * vec4(dOut, 0.0)).xyz);
    vec3 trans = mix(near, far * 0.7, smoothstep(0.35, 0.9, dev));

    vec3 nW = normalize((uViewInv * vec4(nView, 0.0)).xyz);
    vec3 vW = normalize((uViewInv * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
    // The mirror ring at the very silhouette is a fraction of a pixel wide
    // on a real drop; drawn at full strength it reads as an outline. Edges
    // go dark instead, where rays bend out to the unlit room.
    float edge = smoothstep(0.62, 0.98, h);
    vec3 refl = studio(reflect(vW, nW)) * (1.0 - edge * 0.85);
    trans *= 1.0 - smoothstep(0.5, 0.9, h) * 0.9;

    // The key softbox as one hard point. On a drop a few pixels across it
    // is sub-pixel, so it is kept at least a pixel wide and its energy
    // spread to match — which is why small drops twinkle.
    vec3 H = normalize(uKey + vec3(0.0, 0.0, 1.0));
    float sigma = max(0.16, 0.9 / max(vRad, 1.0));
    float glint = exp(-dot(n2 - H.xy, n2 - H.xy) / (sigma * sigma)) * 3.2 * min(0.16 / sigma, 1.0) * (0.3 + 0.7 * min(0.16 / sigma, 1.0));

    // Drops sit at different places in the light: some flare, most don't.
    float lit = 0.35 + 0.9 * vSeed * vSeed;
    vec3 col = (trans * (1.0 - F) + refl * F) * (0.55 + 0.45 * lit) + vec3(glint * lit);
    // Out of focus, the drop's structure averages into an even disc: what
    // it lets through, plus its glint's light spread thin.
    vec3 soft = texture(tScene, clamp(uv, vec2(0.001), vec2(0.999))).rgb * 0.95 + vec3(0.05) * lit;
    col = mix(col, soft, smoothstep(0.1, 0.7, vBlur));

    // A streak spreads the same light over more pixels, and so does blur.
    float energy = (2.0 * vRad + 1.0) / (vLen + 2.0 * vRad + 1.0);
    float sharp = 1.0 - vBlur;
    float spread = max(sharp * sharp, 0.14);
    outColor = vec4(max(col, vec3(0.0)), cov * mix(1.0, energy, 0.6) * spread);
  }
`;

const copyVertex = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const copyFragment = /* glsl */ `
  uniform sampler2D tScene;
  in vec2 vUv;
  out vec4 outColor;
  void main() { outColor = texture(tScene, vUv); }
`;

const KEY_WORLD = new THREE.Vector3(-4.2, 0.8, 3.2).normalize();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class DropletRenderer {
  private mesh: THREE.Mesh;
  private scene = new THREE.Scene();
  private material: THREE.ShaderMaterial;
  private attrs: THREE.InstancedBufferAttribute[];
  private copy: THREE.Mesh;
  private copyMat: THREE.ShaderMaterial;

  constructor(sim: FluidSim) {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(2, 2);
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    const mk = (arr: Float32Array | Uint8Array, size: number) => {
      const a = new THREE.InstancedBufferAttribute(arr, size);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.attrs = [mk(sim.pos, 3), mk(sim.vel, 3), mk(sim.radius, 1), mk(sim.kind, 1)];
    geo.setAttribute("iPos", this.attrs[0]);
    geo.setAttribute("iVel", this.attrs[1]);
    geo.setAttribute("iRadius", this.attrs[2]);
    geo.setAttribute("iKind", this.attrs[3]);
    geo.instanceCount = sim.cap;

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        tScene: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uShutter: { value: 1 / 60 },
        uFocus: { value: 10 },
        uCoc: { value: 3 },
        uViewInv: { value: new THREE.Matrix4() },
        uKey: { value: new THREE.Vector3() },
        uEnvRot: { value: 0 },
        uBacklight: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;

    this.copyMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: copyVertex,
      fragmentShader: copyFragment,
      uniforms: { tScene: { value: null } },
      depthTest: false,
      depthWrite: false,
    });
    this.copy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMat);
    this.copy.frustumCulled = false;
    this.copy.renderOrder = -10;
    this.scene.add(this.copy, this.mesh);
  }

  /** Writes `sceneTex` (the frame beneath) to `out` with the drops over it, refracting it. */
  render(
    gl: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    sceneTex: THREE.Texture,
    out: THREE.WebGLRenderTarget,
    envRot: number,
    backlight: number,
    focus: number,
  ) {
    for (const a of this.attrs) a.needsUpdate = true;
    const u = this.material.uniforms;
    u.tScene.value = sceneTex;
    this.copyMat.uniforms.tScene.value = sceneTex;
    u.uRes.value.set(out.width, out.height);
    u.uFocus.value = focus;
    // Blur scales with resolution so it reads the same on any screen.
    u.uCoc.value = 3.2 * (out.height / 900);
    u.uViewInv.value.copy(camera.matrixWorld);
    // The studio turns with the scene's environment rotation.
    u.uKey.value.copy(KEY_WORLD).applyAxisAngle(Y_AXIS, envRot).transformDirection(camera.matrixWorldInverse);
    u.uEnvRot.value = envRot;
    u.uBacklight.value = backlight;
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setRenderTarget(out);
    gl.render(this.scene, camera);
    gl.setRenderTarget(null);
    gl.autoClear = autoClear;
  }

  /**
   * Compile programs ahead of the first pour, against the target they'll
   * draw into (the program key depends on it), so the pour never hitches.
   */
  warm(gl: THREE.WebGLRenderer, camera: THREE.Camera, target: THREE.WebGLRenderTarget) {
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.compile(this.scene, camera);
    gl.setRenderTarget(prev);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.copy.geometry.dispose();
    this.copyMat.dispose();
  }
}
