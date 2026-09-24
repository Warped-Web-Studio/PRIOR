import * as THREE from "three";
import type { FluidSim } from "./sim";

/**
 * Screen-space fluid rendering (after van der Laan et al., used widely in
 * games). Particles are drawn as spheres into a depth buffer, the depth is
 * smoothed with a bilateral filter so neighbouring spheres merge into one
 * continuous surface, and a shading pass reconstructs normals and renders
 * the result as water: the scene behind is refracted and absorbed through
 * the fluid's thickness, the studio is reflected by Fresnel.
 *
 * All passes are skipped while no water is in flight.
 */

const pointVertex = /* glsl */ `
  in float aRadius;
  uniform float uScale;
  out float vRadius;
  out vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    vRadius = aRadius;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aRadius > 0.0 ? min(aRadius * uScale / max(-mv.z, 0.05) * 2.0, 480.0) : 0.0;
  }
`;

const depthFragment = /* glsl */ `
  uniform mat4 uProjection;
  in float vRadius;
  in vec3 vView;
  out vec4 outColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    c.y = -c.y;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    vec3 p = vView + vec3(c * vRadius, sqrt(1.0 - r2) * vRadius);
    vec4 clip = uProjection * vec4(p, 1.0);
    gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
    outColor = vec4(-p.z, 1.0, 0.0, 1.0); // (depth, coverage) — blur keeps it premultiplied
  }
`;

const thicknessFragment = /* glsl */ `
  in float vRadius;
  in vec3 vView;
  out vec4 outColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    outColor = vec4(sqrt(1.0 - r2) * vRadius * 2.0, 0.0, 0.0, 1.0);
  }
`;

const quadVertex = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Separable bilateral filter: smooths the sphere bumps away without
// bleeding depth across silhouettes (range weight on depth difference).
const blurFragment = /* glsl */ `
  uniform sampler2D tDepth;
  uniform vec2 uDir;
  uniform float uScale;
  uniform float uWorldRadius;
  in vec2 vUv;
  out vec4 outColor;
  void main() {
    vec4 c = texture(tDepth, vUv);
    if (c.g < 0.5) { outColor = vec4(0.0); return; }
    float d = c.r / c.g;
    float radiusPx = clamp(uWorldRadius * uScale / d * 2.2, 1.0, 14.0);
    float sigma = radiusPx * 0.5;
    float sigmaZ = uWorldRadius * 3.0;
    vec2 texel = uDir / vec2(textureSize(tDepth, 0));
    float sum = 0.0, wsum = 0.0;
    for (int i = -14; i <= 14; i++) {
      float fi = float(i);
      if (abs(fi) > radiusPx) continue;
      vec4 s = texture(tDepth, vUv + texel * fi);
      if (s.g < 0.5) continue;
      float sd = s.r / s.g;
      float w = exp(-fi * fi / (2.0 * sigma * sigma)) * exp(-pow((sd - d) / sigmaZ, 2.0));
      sum += sd * w;
      wsum += w;
    }
    outColor = vec4(sum / max(wsum, 1e-5), 1.0, 0.0, 1.0);
  }
`;

const shadeFragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tDepth;
  uniform sampler2D tThick;
  uniform mat4 uProj;
  uniform mat4 uViewInv;
  uniform float uBacklight;
  in vec2 vUv;
  out vec4 outColor;

  uniform vec2 uRes;
  vec3 viewPos(vec2 uv, float d) {
    vec2 ndc = uv * 2.0 - 1.0;
    return vec3(ndc.x * d / uProj[0][0], ndc.y * d / uProj[1][1], -d);
  }
  vec3 depthAt(vec2 uv, vec3 p, bool forward) {
    vec4 s = texture(tDepth, uv);
    if (s.g < 0.3) return vec3(1e3);
    vec3 q = viewPos(uv, s.r / s.g);
    return forward ? q - p : p - q;
  }

  // The studio as the water sees it: the same softbox, rim strips and top
  // light as the environment map, plus the backlight raised for the pour.
  vec3 studio(vec3 r) {
    if (dot(r, r) < 1e-6) return vec3(0.0);
    r = normalize(r);
    float az = atan(r.x, r.z + 1e-6);
    float el = asin(clamp(r.y, -1.0, 1.0));
    float band = smoothstep(1.2, 0.0, abs(el - 0.1));
    vec3 c = vec3(0.0);
    c += vec3(2.6) * exp(-pow((az + 0.92) / 0.2, 2.0)) * band;
    c += vec3(5.0) * exp(-pow((az - 2.05) / 0.035, 2.0)) * band;
    c += vec3(2.2, 2.35, 2.4) * exp(-pow((az + 2.1) / 0.03, 2.0)) * band;
    c += vec3(0.8) * smoothstep(1.05, 1.35, el);
    float back = exp(-pow((abs(az) - 3.14159) / 0.32, 2.0)) * smoothstep(1.1, 0.0, abs(el));
    c += vec3(2.4, 2.6, 2.6) * back * uBacklight;
    return c;
  }

  void main() {
    vec4 scene = texture(tScene, vUv);
    vec4 dc = texture(tDepth, vUv);
    // Thickness is additive per sphere; smooth it so seams between
    // overlapping spheres don't read as outlines.
    vec2 tt = 2.0 / vec2(textureSize(tThick, 0));
    float thick = texture(tThick, vUv).r * 0.28
      + (texture(tThick, vUv + vec2(tt.x, 0.0)).r + texture(tThick, vUv - vec2(tt.x, 0.0)).r
      + texture(tThick, vUv + vec2(0.0, tt.y)).r + texture(tThick, vUv - vec2(0.0, tt.y)).r) * 0.13
      + (texture(tThick, vUv + tt).r + texture(tThick, vUv - tt).r
      + texture(tThick, vUv + vec2(tt.x, -tt.y)).r + texture(tThick, vUv + vec2(-tt.x, tt.y)).r) * 0.05;
    if (dc.g < 0.02 || thick < 1e-4) { outColor = scene; return; }

    float d = dc.r / dc.g;
    vec2 texel = 1.0 / uRes;
    vec3 p = viewPos(vUv, d);
    // Normals from the smoothed depth, sampled with filtering at full
    // resolution; take the smaller difference per axis so silhouettes stay clean.
    vec3 ddx = depthAt(vUv + vec2(texel.x, 0.0), p, true);
    vec3 ddx2 = depthAt(vUv - vec2(texel.x, 0.0), p, false);
    if (abs(ddx2.z) < abs(ddx.z)) ddx = ddx2;
    vec3 ddy = depthAt(vUv + vec2(0.0, texel.y), p, true);
    vec3 ddy2 = depthAt(vUv - vec2(0.0, texel.y), p, false);
    if (abs(ddy2.z) < abs(ddy.z)) ddy = ddy2;
    vec3 cn = cross(ddx * 2.0, ddy * 2.0);
    vec3 n = dot(cn, cn) > 1e-14 ? normalize(cn) : vec3(0.0, 0.0, 1.0);
    if (n.z < 0.0) n = -n;

    vec3 V = normalize(-p);
    float NdV = clamp(dot(n, V), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);

    // Refraction: offset the lookup by the surface normal, scaled by how
    // much water the ray passes through, then absorb (water eats red).
    float th = min(thick, 0.35);
    vec2 off = n.xy * (0.012 + th * 0.09);
    vec3 behind = vec3(
      texture(tScene, vUv + off * 1.0).r,
      texture(tScene, vUv + off * 1.03).g,
      texture(tScene, vUv + off * 1.06).b
    );
    vec3 absorb = exp(-th * vec3(0.55, 0.16, 0.13));
    vec3 refr = behind * absorb;

    vec3 nW = normalize((uViewInv * vec4(n, 0.0)).xyz);
    vec3 vW = normalize((uViewInv * vec4(-V, 0.0)).xyz);
    vec3 refl = studio(reflect(vW, nW));
    // On a black set water shows only what it refracts (the backlight panel,
    // bent and inverted) and what it reflects at grazing angles. A sharp
    // key glint rides the surface.
    vec3 L = normalize((uViewInv * vec4(0.0, 0.0, 1.0, 0.0)).xyz * 0.2 + vec3(-0.62, 0.35, 0.7));
    float glint = pow(max(dot(reflect(vW, nW), L), 0.0), 140.0) * 2.5;
    // A trace of milky scatter: poured water carries air.
    vec3 scatter = vec3(0.045, 0.055, 0.056) * smoothstep(0.0, 0.25, thick) * (0.4 + uBacklight);
    vec3 col = refr * (1.0 - fres) + refl * fres + vec3(glint) + scatter;
    float alpha = smoothstep(0.0, 0.03, thick) * smoothstep(0.05, 0.6, dc.g);
    col = max(col, vec3(0.0));
    outColor = vec4(mix(scene.rgb, col, alpha), 1.0);
  }
`;

export class FluidRenderer {
  private points: THREE.Points;
  private pointScene = new THREE.Scene();
  private depthMat: THREE.ShaderMaterial;
  private thickMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private shadeMat: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private depthA: THREE.WebGLRenderTarget;
  private depthB: THREE.WebGLRenderTarget;
  private thick: THREE.WebGLRenderTarget;
  private depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  private posAttr: THREE.BufferAttribute;
  private radAttr: THREE.BufferAttribute;
  private clear = new THREE.Color(0, 0, 0);
  private prevClear = new THREE.Color();
  backlight = 0;

  constructor(
    private sim: FluidSim,
    private resScale: number,
    private worldRadius: number,
  ) {
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(sim.pos, 3);
    this.radAttr = new THREE.BufferAttribute(sim.radius, 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.radAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this.posAttr);
    geo.setAttribute("aRadius", this.radAttr);
    const common = { glslVersion: THREE.GLSL3, uniforms: { uScale: { value: 1 }, uProjection: { value: new THREE.Matrix4() } }, vertexShader: pointVertex };
    this.depthMat = new THREE.ShaderMaterial({ ...common, fragmentShader: depthFragment });
    this.thickMat = new THREE.ShaderMaterial({
      ...common,
      uniforms: this.depthMat.uniforms,
      fragmentShader: thicknessFragment,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.points = new THREE.Points(geo, this.depthMat);
    this.points.frustumCulled = false;
    this.pointScene.add(this.points);

    this.blurMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: quadVertex,
      fragmentShader: blurFragment,
      uniforms: {
        tDepth: { value: null },
        uDir: { value: new THREE.Vector2(1, 0) },
        uScale: { value: 1 },
        uWorldRadius: { value: worldRadius },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.shadeMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: quadVertex,
      fragmentShader: shadeFragment,
      uniforms: {
        tScene: { value: null },
        tDepth: { value: null },
        tThick: { value: null },
        uProj: { value: new THREE.Matrix4() },
        uViewInv: { value: new THREE.Matrix4() },
        uBacklight: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const opts = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.depthA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.depthB = new THREE.WebGLRenderTarget(1, 1, { ...opts, depthBuffer: false });
    this.thick = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  }

  setSize(w: number, h: number) {
    const fw = Math.max(1, Math.round(w * this.resScale));
    const fh = Math.max(1, Math.round(h * this.resScale));
    this.depthA.setSize(fw, fh);
    this.depthB.setSize(fw, fh);
    this.thick.setSize(fw, fh);
  }

  /** Renders the fluid over `sceneTex` into `out`. */
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, sceneTex: THREE.Texture, out: THREE.WebGLRenderTarget) {
    this.posAttr.needsUpdate = true;
    this.radAttr.needsUpdate = true;

    const h = this.depthA.height;
    const scale = (h * 0.5) * camera.projectionMatrix.elements[5];
    this.depthMat.uniforms.uScale.value = scale;
    this.depthMat.uniforms.uProjection.value.copy(camera.projectionMatrix);
    this.blurMat.uniforms.uScale.value = scale;

    const autoClear = gl.autoClear;
    gl.getClearColor(this.prevClear);
    const prevAlpha = gl.getClearAlpha();
    gl.autoClear = false;
    gl.setClearColor(this.clear, 0);

    // 1. Scene depth only, so the bottle and floor occlude water correctly.
    gl.setRenderTarget(this.depthA);
    gl.clear(true, true, false);
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.depthOnly;
    gl.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = bg;

    // 2. Particle sphere depth.
    this.points.material = this.depthMat;
    gl.render(this.pointScene, camera);

    // 3. Thickness (additive, unoccluded — masked by depth when shading).
    gl.setRenderTarget(this.thick);
    gl.clear(true, false, false);
    this.points.material = this.thickMat;
    gl.render(this.pointScene, camera);

    // 4. Bilateral smoothing, two separable iterations.
    this.quad.material = this.blurMat;
    for (let k = 0; k < 3; k++) {
      this.blurMat.uniforms.tDepth.value = this.depthA.texture;
      this.blurMat.uniforms.uDir.value.set(1, 0);
      gl.setRenderTarget(this.depthB);
      gl.render(this.quadScene, this.quadCam);
      this.blurMat.uniforms.tDepth.value = this.depthB.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1);
      gl.setRenderTarget(this.depthA);
      gl.render(this.quadScene, this.quadCam);
    }

    // 5. Shade.
    const u = this.shadeMat.uniforms;
    u.tScene.value = sceneTex;
    u.tDepth.value = this.depthA.texture;
    u.tThick.value = this.thick.texture;
    u.uProj.value.copy(camera.projectionMatrix);
    u.uViewInv.value.copy(camera.matrixWorld);
    u.uBacklight.value = this.backlight;
    u.uRes.value.set(out.width, out.height);
    this.quad.material = this.shadeMat;
    gl.setRenderTarget(out);
    gl.clear(true, false, false);
    gl.render(this.quadScene, this.quadCam);

    gl.setRenderTarget(null);
    gl.autoClear = autoClear;
    gl.setClearColor(this.prevClear, prevAlpha);
  }

  dispose() {
    this.points.geometry.dispose();
    this.depthMat.dispose();
    this.thickMat.dispose();
    this.blurMat.dispose();
    this.shadeMat.dispose();
    this.depthOnly.dispose();
    this.quad.geometry.dispose();
    this.depthA.dispose();
    this.depthB.dispose();
    this.thick.dispose();
  }
}
