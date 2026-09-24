/**
 * Final pass. Studio (HDR, tone-mapped here) or the inquiry environment,
 * seen through the water film on the lens, then grain and vignette.
 *
 * The lens film comes from LensWater's heightfield. Its slope refracts the
 * world behind (drops invert and magnify, as they do on glass), and thick
 * water also *blurs* it — sampled from the studio's mip chain — because a
 * sheet of moving water on glass never shows a sharp image. The world swap
 * happens while that sheet is thick enough to hide it.
 */

export const compositorVertex = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const compositorFragment = /* glsl */ `
  uniform sampler2D tStudio;
  uniform float uStudioLod;   // 0 when the studio texture has no mip chain
  uniform sampler2D tLens;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uSurface;
  uniform float uSwap;
  uniform float uQuiet;
  uniform float uWater;
  uniform float uInquiryTime;
  uniform float uCoverFloor; // guarantees no dry gaps while the world swaps
  in vec2 vUv;
  out vec4 outColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }

  vec3 studio(vec2 uv, float lod) {
    vec3 c = textureLod(tStudio, clamp(uv, vec2(0.001), vec2(0.999)), lod * uStudioLod).rgb;
    #ifdef TONE_MAPPING
      c = toneMapping(c);
    #endif
    return linearToOutputTexel(vec4(c, 1.0)).rgb;
  }

  // The far side: pale mineral light, soft and very slow — daylight through
  // a thin layer of ice rather than a swimming pool.
  vec3 inquiry(vec2 uv) {
    float aspect = uRes.x / uRes.y;
    vec2 p = uv * vec2(aspect, 1.0);
    vec3 low = vec3(0.842, 0.872, 0.867);
    vec3 high = vec3(0.938, 0.953, 0.949);
    vec3 c = mix(low, high, smoothstep(-0.1, 1.05, uv.y));
    float t = uInquiryTime * 0.03;
    float pools = fbm(p * 1.3 + vec2(t, -t * 0.6)) - 0.5;
    c += vec3(0.03, 0.035, 0.034) * pools * smoothstep(0.0, 0.8, uv.y + 0.2);
    // Soft vertical light bands, as through tall frosted windows. They give
    // the eye something to see bend when water passes over it.
    float bands = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float x0 = aspect * (0.52 + fk * 0.19);
      bands += smoothstep(0.16, 0.0, abs(p.x - x0 + (uv.y - 1.0) * 0.28)) * (0.7 - fk * 0.15);
    }
    c += vec3(0.022, 0.028, 0.028) * bands * smoothstep(-0.1, 1.0, uv.y);
    return c;
  }

  vec3 world(vec2 uv, float lod) {
    vec3 a = uSwap < 0.999 ? studio(uv, lod) : vec3(0.0);
    vec3 b = uSwap > 0.001 ? inquiry(uv) : vec3(0.0);
    return mix(a, b, uSwap);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec3 col = world(uv, 0.0);

    if (uWater > 0.5) {
      float h = max(texture(tLens, uv).r, uCoverFloor);
      if (h > 0.003) {
        vec2 tx = 1.0 / vec2(textureSize(tLens, 0));
        float hx = texture(tLens, uv + vec2(tx.x * 1.5, 0.0)).r - texture(tLens, uv - vec2(tx.x * 1.5, 0.0)).r;
        float hy = texture(tLens, uv + vec2(0.0, tx.y * 1.5)).r - texture(tLens, uv - vec2(0.0, tx.y * 1.5)).r;
        // Slope in screen units (height per screen height).
        vec2 slope = vec2(hx / (3.0 * tx.x * aspect), hy / (3.0 * tx.y)) * 0.0022;

        float thin = smoothstep(0.004, 0.05, h);
        float deep = smoothstep(0.35, 0.85, h);

        // Thick water is never still: ripples travelling down with the flow.
        vec2 fp = uv * vec2(aspect, 1.0) * 5.0 + vec2(0.0, uTime * 1.6);
        float f0 = fbm(fp);
        vec2 flow = vec2(fbm(fp + vec2(0.05, 0.0)) - f0, fbm(fp + vec2(0.0, 0.05)) - f0) / 0.05;
        // Full coverage = a wave on the lens: the image goes completely soft
        // and swims. The world changes inside that blur, then sharpens as it drains.
        float veil = smoothstep(0.02, 0.45, uCoverFloor);
        slope += flow * (0.006 * deep + 0.02 * veil);

        vec2 off = -slope * 0.9;
        float lod = deep * 2.4 + thin * 0.4 + veil * 4.2;
        vec3 refr = vec3(
          world(uv + off * 1.0, lod).r,
          world(uv + off * 1.04, lod).g,
          world(uv + off * 1.08, lod).b
        );

        // Ink water in the studio; bright, cold water as we surface.
        vec3 ink = refr * mix(vec3(0.97, 1.0, 1.0), vec3(0.8, 0.9, 0.9), deep) + vec3(0.004, 0.01, 0.012) * deep;
        vec3 ice = refr * mix(vec3(0.97, 0.985, 0.985), vec3(0.9, 0.945, 0.94), deep) + vec3(0.012, 0.02, 0.02) * deep;
        vec3 w = mix(ink, ice, uSurface);

        vec3 n = normalize(vec3(-slope * 9.0, 1.0));
        float spec = pow(max(dot(n, normalize(vec3(-0.4, 0.7, 0.6))), 0.0), 90.0);
        w += vec3(spec) * mix(0.9, 0.7, uSurface) * thin;
        // Steep edges of drops turn dark (total internal reflection), with a
        // bright focus on the side away from the light.
        float steep = clamp(length(slope) * 5.0, 0.0, 1.0);
        w *= 1.0 - steep * steep * mix(0.5, 0.3, uSurface);
        float focus = max(dot(normalize(slope + 1e-5), normalize(vec2(-0.4, 0.7))), 0.0) * steep;
        w += vec3(0.75, 0.88, 0.88) * focus * focus * 0.22 * (1.0 - deep);

        col = mix(col, w, thin);
      }
    }

    vec2 vq = (uv - 0.5) * vec2(aspect * 0.72, 1.0);
    float vig = smoothstep(1.05, 0.28, length(vq));
    float vigAmt = mix(0.38, 0.66, uQuiet) * (1.0 - 0.8 * uSwap);
    col *= mix(1.0 - vigAmt, 1.0, vig);
    float grain = hash(uv * uRes + fract(uTime * 7.3) * 100.0) - 0.5;
    col += grain * mix(0.028, 0.016, uSwap);
    outColor = vec4(col, 1.0);
  }
`;
