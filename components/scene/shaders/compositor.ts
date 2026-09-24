/**
 * The compositor is where the splash becomes the page transition.
 *
 * Every frame: studio scene (HDR render target) → tone map → optionally the
 * inquiry environment (procedural, pale, caustic) → water on the lens → grain.
 *
 * Water on the lens is a signed distance field in screen space:
 *   - lens drops: metaball circles seeded from real 3D droplet hits,
 *     spreading on contact then creeping down under gravity;
 *   - the sheet: the splash wall. `uLevel` is its height; while rising its
 *     edge is fingered and chaotic, while draining it leaves rivulets.
 * The field's height profile gives a normal, which refracts whatever is
 * behind — so even at full coverage you are looking *through* water at the
 * old scene, and the environment swap happens underneath, invisibly.
 */

export const compositorVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const compositorFragment = /* glsl */ `
  #ifndef LENS_COUNT
  #define LENS_COUNT 32
  #endif
  #ifndef FBM_OCTAVES
  #define FBM_OCTAVES 4
  #endif

  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uClock;
  uniform float uLevel;
  uniform float uDraining;
  uniform float uSurface;
  uniform float uSwap;
  uniform float uQuiet;
  uniform float uLight;
  uniform float uWater;      // 0 skips all water work
  uniform vec4 uLens[LENS_COUNT];
  uniform int uLensCount;
  uniform float uLensFade;
  uniform float uInquiryTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float hash1(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < FBM_OCTAVES; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Caustic web, as light through a moving surface would throw it.
  // Expects the classic large offset domain; small inputs saturate to white.
  float caustic(vec2 q, float t) {
    vec2 p = mod(q * 6.28318, 6.28318) - 250.0;
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
  }

  vec3 studio(vec2 uv) {
    vec3 c = texture2D(tScene, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
    #ifdef TONE_MAPPING
      c = toneMapping(c);
    #endif
    return linearToOutputTexel(vec4(c, 1.0)).rgb;
  }

  // The far side of the water: pale mineral light, a slow caustic web.
  vec3 inquiry(vec2 uv) {
    float aspect = uRes.x / uRes.y;
    vec2 p = uv * vec2(aspect, 1.0);
    vec3 low = vec3(0.835, 0.868, 0.862);
    vec3 high = vec3(0.935, 0.952, 0.948);
    vec3 c = mix(low, high, smoothstep(-0.1, 1.05, uv.y + 0.08 * sin(p.x * 1.3)));
    float ca = caustic(p * 2.6 + vec2(0.0, uInquiryTime * 0.015), uInquiryTime * 0.16 + 23.0);
    float mask = smoothstep(0.1, 0.95, uv.x) * smoothstep(-0.2, 0.9, uv.y);
    c += vec3(0.86, 0.97, 0.96) * min(ca, 1.2) * 0.07 * mask;
    // A diffuse shaft falling from the upper right.
    float shaft = smoothstep(0.55, 0.0, abs((p.x - aspect * 0.78) + (uv.y - 1.0) * 0.45));
    c += vec3(0.02, 0.025, 0.025) * shaft * smoothstep(0.0, 1.0, uv.y);
    return c;
  }

  vec3 world(vec2 uv) {
    vec3 a = uSwap < 0.999 ? studio(uv) : vec3(0.0);
    vec3 b = uSwap > 0.001 ? inquiry(uv) : vec3(0.0);
    return mix(a, b, uSwap);
  }

  float lensField(vec2 uv) {
    float aspect = uRes.x / uRes.y;
    vec2 p = uv * vec2(aspect, 1.0);
    float d = 10.0;
    for (int i = 0; i < LENS_COUNT; i++) {
      if (i >= uLensCount) break;
      vec4 L = uLens[i];
      float age = uClock - L.z;
      if (age < 0.0) continue;
      // Splat: arrives at ~55% of its size, spreads fast, then keeps creeping.
      float r = L.w * (0.55 + 0.45 * (1.0 - exp(-age * 10.0))) * (1.0 + 0.3 * (1.0 - exp(-age * 1.6)));
      r *= 1.0 - uLensFade;
      if (r <= 0.0) continue;
      float slide = max(age - 0.45, 0.0);
      vec2 c = vec2(L.x * aspect, L.y - slide * slide * (0.05 + L.w * 1.2));
      vec2 q = p - c;
      float ang = atan(q.y, q.x);
      float di = length(q) - r * (1.0 + 0.028 * sin(ang * 3.0 + L.z * 13.0) + 0.014 * sin(ang * 7.0 + L.x * 20.0));
      d = smin(d, di, 0.035);
    }
    return d;
  }

  float sheetField(vec2 uv) {
    float aspect = uRes.x / uRes.y;
    float x = uv.x * aspect;
    // Rising: a torn, fingered splash front.
    float rise = 0.07 * fbm(vec2(x * 3.2, uTime * 0.9))
               + 0.1 * pow(noise(vec2(x * 7.5, uTime * 1.7)), 3.0)
               + 0.05 * pow(noise(vec2(x * 19.0, uTime * 2.3)), 4.0);
    // Draining: a heavier, smoother edge.
    float fall = 0.035 * fbm(vec2(x * 2.2, uTime * 0.4));
    float e = uLevel + mix(rise, fall, uDraining);
    float d = uv.y - e;
    // Rivulets left behind as the sheet drains.
    if (uDraining > 0.0) {
      float cells = 16.0;
      float cell = floor(uv.x * cells);
      float h = hash1(cell * 7.13 + 1.7);
      if (h > 0.45) {
        float cx = (cell + 0.3 + 0.4 * hash1(cell * 3.1)) / cells;
        float len = (h - 0.45) * 0.9 * uDraining * (1.0 - uLensFade);
        float above = uv.y - e;
        float w = (0.0025 + 0.004 * hash1(cell)) * (1.0 - clamp(above / max(len, 1e-3), 0.0, 1.0) * 0.6);
        float trail = max(abs(uv.x - cx) * aspect - w, above - len);
        d = min(d, trail);
      }
    }
    return d;
  }

  float field(vec2 uv) {
    float d = sheetField(uv);
    if (uLensCount > 0) d = smin(d, lensField(uv), 0.02);
    return d;
  }

  // Height of the water film: a smooth dome near the edge (zero slope at
  // the crown, so small drops have no central kink), flat once thick.
  float height(float d) {
    float x = clamp(-d / 0.06, 0.0, 1.0);
    return 1.0 - (1.0 - x) * (1.0 - x);
  }

  void main() {
    vec2 uv = vUv;
    vec3 col;
    vec2 px = 1.0 / uRes;

    if (uWater < 0.5) {
      col = world(uv);
    } else {
      float d = field(uv);
      float e = 1.6 * px.y;
      float dx = field(uv + vec2(e, 0.0));
      float dy = field(uv + vec2(0.0, e));
      float h = height(d);
      vec2 grad = vec2(height(dx) - h, height(dy) - h) / e;

      // Deep water: the sheet interior, where flow noise takes over.
      float deep = smoothstep(0.0, 0.18, -sheetField(uv));
      float dir = mix(1.0, -1.0, uDraining);
      vec2 fp = uv * vec2(uRes.x / uRes.y, 1.0) * 2.4 + vec2(0.0, uTime * 0.55 * dir);
      float n0 = fbm(fp);
      vec2 flow = vec2(fbm(fp + vec2(0.07, 0.0)) - n0, fbm(fp + vec2(0.0, 0.07)) - n0) / 0.07;

      vec2 normal2 = grad * 0.018 + flow * 0.028 * deep;
      float alpha = smoothstep(1.2 * px.y, -1.2 * px.y, d);

      vec3 base = world(uv);
      if (alpha > 0.001) {
        // Drops on a lens invert and magnify what is behind them.
        vec2 off = -normal2 * (0.05 + 0.03 * deep);
        vec3 refr;
        refr.r = world(uv + off).r;
        refr.g = world(uv + off * 1.035).g;
        refr.b = world(uv + off * 1.07).b;

        // Ink water in the studio: near-transparent, a touch cooler. Ice as
        // we surface: luminous, but tinted and textured enough that the
        // draining edge stays readable against the pale room behind it.
        // Deep water carries its own colour — glacial, darker as ink, luminous
        // as ice — so full coverage never collapses into a flat fade.
        vec3 ink = refr * mix(vec3(0.92, 0.98, 1.0), vec3(0.62, 0.8, 0.8), deep) + vec3(0.008, 0.02, 0.022) * (0.4 + deep);
        vec3 ice = refr * mix(vec3(0.9, 0.945, 0.94), vec3(0.76, 0.85, 0.84), deep) + vec3(0.045, 0.065, 0.064) * (0.4 + deep);
        vec3 w = mix(ink, ice, uSurface);

        // Light through a moving surface while submerged.
        vec2 cp = uv * vec2(uRes.x / uRes.y, 1.0) * 2.2 + flow * 0.08;
        float ca = caustic(cp, uTime * 0.7) + 0.6 * caustic(cp * 1.7 + 3.1, uTime * 0.9 + 4.0);
        w += vec3(0.84, 0.95, 0.93) * min(ca, 1.6) * deep * mix(0.07, 0.15, uSurface);
        // Soft shafts from above while submerged.
        float shaft = pow(max(0.0, sin(uv.x * 9.0 + uv.y * 2.5 + uTime * 0.25) * 0.5 + 0.5), 6.0);
        w += vec3(0.6, 0.78, 0.78) * shaft * deep * smoothstep(0.2, 1.0, uv.y) * mix(0.02, 0.06, uSurface);

        // Specular: a key glint on the domes and a bright Fresnel line where
        // the film is steep (its edge) — how water on glass is actually seen.
        vec3 n = normalize(vec3(-normal2 * 6.0, 1.0));
        float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.65, 0.62))), 0.0), 36.0);
        float steep = clamp(length(grad) * 0.012, 0.0, 1.0);
        w += vec3(spec) * mix(0.75, 0.5, uSurface);
        w += vec3(0.8, 0.9, 0.92) * steep * steep * mix(0.28, 0.2, uSurface);
        // Opposite the key, light focused through the drop pools as a crescent.
        float crescent = pow(max(dot(n.xy, normalize(vec2(0.45, -0.65))), 0.0), 2.0) * steep;
        w += vec3(0.7, 0.88, 0.88) * crescent * 0.35;
        // A thin meniscus line hugging the edge.
        float rim = exp(-pow(d / (1.6 * px.y), 2.0));
        w = mix(w, w * mix(0.55, 0.8, uSurface), rim * 0.6);

        col = mix(base, w, alpha);
      } else {
        col = base;
      }
    }

    // Photographic finish: vignette tightens as the room goes quiet; grain.
    float aspect = uRes.x / uRes.y;
    vec2 vq = (uv - 0.5) * vec2(aspect * 0.72, 1.0);
    float vig = smoothstep(1.05, 0.28, length(vq));
    float vigAmt = mix(0.38, 0.62, uQuiet) * (1.0 - 0.8 * uSwap);
    col *= mix(1.0 - vigAmt, 1.0, vig);
    float grain = hash(uv * uRes + fract(uTime * 7.3) * 100.0) - 0.5;
    col += grain * mix(0.028, 0.018, uSwap);

    gl_FragColor = vec4(col, 1.0);
  }
`;
