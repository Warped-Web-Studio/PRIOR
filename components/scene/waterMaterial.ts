import * as THREE from "three";

/**
 * All moving water (stream, crown, droplets) shares one idea: a physical
 * material for real environment reflections, with the vertex stage replaced
 * by an analytic motion function. Geometry never touches the CPU per frame.
 *
 * `normalCode` must assign `objectNormal`; `positionCode` must assign
 * `transformed`. Both run in the vertex shader with the given uniforms.
 */
export function createWaterSurfaceMaterial(opts: {
  uniforms: Record<string, THREE.IUniform>;
  declarations: string;
  normalCode: string;
  positionCode: string;
  opacity?: number;
  rim?: number;
  side?: THREE.Side;
}) {
  const material = new THREE.MeshPhysicalMaterial({
    // Near-black body: on a dark set, water is seen almost entirely by what
    // it reflects. A bright diffuse colour reads as grey plastic.
    color: new THREE.Color("#0c1315"),
    roughness: 0.03,
    metalness: 0,
    ior: 1.333,
    specularIntensity: 1,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    envMapIntensity: 3.4,
    transparent: true,
    opacity: opts.opacity ?? 0.8,
    depthWrite: false,
    side: opts.side ?? THREE.FrontSide,
  });
  const rimUniform = { value: opts.rim ?? 1 };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, opts.uniforms, { uRim: rimUniform });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${opts.declarations}`)
      .replace("#include <beginnormal_vertex>", `vec3 objectNormal; vec3 transformed;\n${opts.normalCode}`)
      .replace("#include <begin_vertex>", opts.positionCode);
    // Water on black reads by its edges: a Fresnel rim, cooler than the key.
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uRim;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += vec3(0.42, 0.55, 0.58) * fres * uRim;`,
      );
  };
  // Distinct cache keys, otherwise three may reuse one variant's program.
  material.customProgramCacheKey = () => opts.positionCode;
  return { material, rimUniform };
}
