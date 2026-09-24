/**
 * Shared water optics (GLSL). Both the pour column and the splash reflect
 * the same studio the bottle does, so they must agree on where its lights
 * are. This is an analytic copy of StudioEnvironment's Lightformers —
 * sharper than sampling the pre-filtered cube map, which is what makes
 * highlights on thin water read as crisp lines rather than smears.
 */
export const opticsChunk = /* glsl */ `
  uniform float uEnvRot;
  uniform float uBacklight;

  vec3 rotY(vec3 v, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
  }

  // Direction in world space → studio radiance (linear HDR). The scene's
  // environmentRotation turns the lookup the same way three.js does.
  vec3 studio(vec3 r) {
    if (dot(r, r) < 1e-6) return vec3(0.0);
    r = rotY(normalize(r), -uEnvRot);
    float az = atan(r.x, r.z + 1e-6);
    float el = asin(clamp(r.y, -1.0, 1.0));
    float band = smoothstep(1.2, 0.0, abs(el - 0.1));
    vec3 c = vec3(0.0);
    // Key softbox, front-left.
    c += vec3(2.6) * exp(-pow((az + 0.92) / 0.2, 2.0)) * band;
    // Hard rim strips behind right and left.
    c += vec3(5.0) * exp(-pow((az - 2.05) / 0.035, 2.0)) * band;
    c += vec3(2.2, 2.35, 2.4) * exp(-pow((az + 2.1) / 0.03, 2.0)) * band;
    // Top light.
    c += vec3(0.8) * smoothstep(1.05, 1.35, el);
    // Glacial floor bounce.
    c += vec3(0.1, 0.16, 0.15) * smoothstep(-0.9, -1.3, el);
    // The pour's backlight panel, raised as the room goes quiet.
    float back = exp(-pow((abs(az) - 3.14159) / 0.32, 2.0)) * smoothstep(1.1, 0.0, abs(el));
    c += vec3(2.4, 2.6, 2.6) * back * uBacklight;
    return c;
  }

  float fresnelWater(float cosTheta) {
    return 0.02 + 0.98 * pow(1.0 - clamp(cosTheta, 0.0, 1.0), 5.0);
  }
`;
