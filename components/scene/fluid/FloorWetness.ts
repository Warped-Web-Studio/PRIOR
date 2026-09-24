import * as THREE from "three";
import type { FluidSim } from "./sim";

/**
 * Water that has landed is a film, not a heap of spheres. Each frame the
 * film particles are splatted, seen from directly above, into a small
 * density map; the floor shader turns that into a puddle — darker wet
 * stone, a mirror for the backlight, a bright meniscus at its edge. The
 * puddle spreads exactly where the simulated water spreads.
 */

export const floorWet = {
  texture: null as THREE.Texture | null,
  center: new THREE.Vector2(0, 0.4),
  extent: 7,
  on: 0,
};

const vertex = /* glsl */ `
  in float aWet;
  uniform float uPx;
  out float vWet;
  void main() {
    vWet = aWet;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    gl_PointSize = aWet > 0.0 ? aWet * uPx * 2.0 : 0.0;
  }
`;
const fragment = /* glsl */ `
  in float vWet;
  out vec4 outColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    outColor = vec4(exp(-r2 * 3.0) * 0.4, 0.0, 0.0, 1.0);
  }
`;

export class FloorWetness {
  private rt: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam: THREE.OrthographicCamera;
  private mat: THREE.ShaderMaterial;
  private points: THREE.Points;
  private wetAttr: THREE.BufferAttribute;
  private black = new THREE.Color(0, 0, 0);
  private prevClear = new THREE.Color();

  constructor(sim: FluidSim, size: number) {
    this.rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, depthBuffer: false });
    const e = floorWet.extent / 2;
    this.cam = new THREE.OrthographicCamera(-e, e, e, -e, 0.1, 20);
    this.cam.position.set(floorWet.center.x, 6, floorWet.center.y);
    // Looking straight down with +z toward the bottom of the map.
    this.cam.up.set(0, 0, -1);
    this.cam.lookAt(floorWet.center.x, 0, floorWet.center.y);
    this.cam.updateMatrixWorld();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(sim.pos, 3));
    this.wetAttr = new THREE.BufferAttribute(sim.wet, 1);
    this.wetAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aWet", this.wetAttr);
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uPx: { value: size / floorWet.extent } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    floorWet.texture = this.rt.texture;
  }

  render(gl: THREE.WebGLRenderer) {
    this.wetAttr.needsUpdate = true;
    // Positions are uploaded by the fluid renderer's geometry already; this
    // geometry shares the same array, so flag it too.
    (this.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    const prev = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    gl.getClearColor(this.prevClear);
    const alpha = gl.getClearAlpha();
    gl.setClearColor(this.black, 0);
    gl.autoClear = true;
    gl.setRenderTarget(this.rt);
    gl.render(this.scene, this.cam);
    gl.setRenderTarget(prev);
    gl.autoClear = autoClear;
    gl.setClearColor(this.prevClear, alpha);
  }

  dispose() {
    this.rt.dispose();
    this.mat.dispose();
    this.points.geometry.dispose();
    if (floorWet.texture === this.rt.texture) floorWet.texture = null;
  }
}
