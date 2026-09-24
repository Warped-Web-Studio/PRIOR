import * as THREE from "three";
import { brand } from "@/lib/brand";

/**
 * Every texture is generated on a canvas at runtime: no image downloads, no
 * decode stalls, and the type is set in the same fonts as the DOM.
 * Callers must wait for `document.fonts` before drawing.
 */

function fontFamily(varName: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

export function fonts() {
  return {
    display: fontFamily("--font-display", "Helvetica Neue, Arial, sans-serif"),
    mono: fontFamily("--font-mono-face", "Menlo, monospace"),
  };
}

function canvasTexture(canvas: HTMLCanvasElement, srgb = true) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacingPx: number) {
  // Canvas letterSpacing is widely supported now, but centre alignment with
  // tracking needs the trailing space compensated manually.
  ctx.letterSpacing = `${spacingPx}px`;
  ctx.fillText(text, x + spacingPx / 2, y);
  ctx.letterSpacing = "0px";
}

/**
 * Front label: white ceramic ink printed straight onto the glass. Drawn as an
 * alpha mask — colour comes from the material so it reacts to light.
 */
export function createFrontLabel(scale: number) {
  const W = Math.round(1024 * scale);
  const H = Math.round(1384 * scale);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const f = fonts();
  const u = W / 1024;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Coordinates — top.
  ctx.font = `400 ${22 * u}px ${f.mono}`;
  spaced(ctx, "ANSEL SHELF", W / 2, 150 * u, 7 * u);
  ctx.font = `300 ${20 * u}px ${f.mono}`;
  spaced(ctx, brand.coordinates, W / 2, 186 * u, 3 * u);

  // The core mark: a sample rule with a single stratum break.
  ctx.fillRect(W / 2 - 1.6 * u, 250 * u, 3.2 * u, 170 * u);
  ctx.fillRect(W / 2 - 1.6 * u, 446 * u, 3.2 * u, 54 * u);
  ctx.fillRect(W / 2 - 18 * u, 432 * u, 36 * u, 2.4 * u);

  // Wordmark.
  ctx.font = `250 ${188 * u}px ${f.display}`;
  spaced(ctx, "PRIOR", W / 2, 700 * u, 14 * u);

  ctx.font = `400 ${21 * u}px ${f.mono}`;
  spaced(ctx, "GLACIAL AQUIFER WATER", W / 2, 776 * u, 6 * u);
  ctx.font = `300 ${21 * u}px ${f.mono}`;
  spaced(ctx, `SEALED ${brand.age} YEARS`, W / 2, 814 * u, 6 * u);

  // Hairline.
  ctx.fillRect(W / 2 - 140 * u, 900 * u, 280 * u, 1.6 * u);

  ctx.font = `400 ${24 * u}px ${f.mono}`;
  spaced(ctx, brand.edition, W / 2, 1150 * u, 4 * u);
  ctx.font = `300 ${19 * u}px ${f.mono}`;
  spaced(ctx, "750 ML  ·  STILL", W / 2, 1196 * u, 5 * u);

  return canvasTexture(c, false);
}

/** Back print — the hand-numbered edition, seen reversed through the water. */
export function createBackLabel(scale: number) {
  const W = Math.round(768 * scale);
  const H = Math.round(1384 * scale);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const f = fonts();
  const u = W / 768;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";

  ctx.font = `300 ${19 * u}px ${f.mono}`;
  const lines = [
    "DRAWN AT THE WELLHEAD",
    "DURING THE 2026 THAW",
    "",
    "FILLED, STOPPERED AND",
    "NUMBERED BY HAND",
  ];
  lines.forEach((l, i) => spaced(ctx, l, W / 2, (560 + i * 34) * u, 5 * u));

  ctx.font = `200 ${120 * u}px ${f.display}`;
  spaced(ctx, "0417", W / 2, 900 * u, 6 * u);
  ctx.fillRect(W / 2 - 60 * u, 950 * u, 120 * u, 1.6 * u);
  ctx.font = `300 ${19 * u}px ${f.mono}`;
  spaced(ctx, "OF 2400", W / 2, 994 * u, 6 * u);

  return canvasTexture(c, false);
}

/**
 * Large type placed behind the bottle in 3D so the glass genuinely refracts
 * it. Returned with its aspect so the plane can be sized without distortion.
 */
export function createWordTexture(text: string, weight = 200, maxWidth = 2048) {
  const f = fonts();
  const measure = document.createElement("canvas").getContext("2d")!;
  const size = 400;
  measure.font = `${weight} ${size}px ${f.display}`;
  const tracking = size * -0.02;
  measure.letterSpacing = `${tracking}px`;
  const w = measure.measureText(text).width + size * 0.3;
  const scale = Math.min(1, maxWidth / w);
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(size * 1.25 * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.font = `${weight} ${size}px ${f.display}`;
  ctx.letterSpacing = `${tracking}px`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, size * 0.66);
  const tex = canvasTexture(c);
  tex.generateMipmaps = true;
  return { texture: tex, aspect: c.width / c.height };
}

/** Tiny deterministic PRNG so the condensation pattern is identical per load. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Condensation: a heightfield of beads converted to a tangent-space normal
 * map. Beads are densest low on the body (the coldest glass) and thin out
 * toward the shoulder, with a few larger drops that have begun to run.
 */
export function createCondensationNormalMap(bodyV: [number, number], size = 1024) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  const rand = mulberry32(71);

  // UV v runs bottom→top of the profile; canvas y runs top→bottom.
  const vToY = (v: number) => (1 - v) * size;
  const yTop = vToY(bodyV[1]);
  const yBottom = vToY(bodyV[0]);

  const bead = (x: number, y: number, r: number, stretch = 1) => {
    for (const ox of [-size, 0, size]) {
      const g = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.55, "rgba(255,255,255,0.72)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + ox, y, r, r * stretch, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const count = Math.round(size * 2.2);
  for (let i = 0; i < count; i++) {
    const t = Math.pow(rand(), 0.6); // bias toward the bottom
    const y = yTop + (yBottom - yTop) * t;
    const x = rand() * size;
    const r = (0.8 + rand() * rand() * 3.4) * (size / 1024) * (0.6 + t * 0.7);
    bead(x, y, r);
  }
  // A handful of heavier drops with short trails.
  for (let i = 0; i < 26; i++) {
    const y = yTop + (yBottom - yTop) * (0.25 + rand() * 0.7);
    const x = rand() * size;
    const r = (3.5 + rand() * 3) * (size / 1024);
    const trail = 12 + rand() * 50;
    for (let k = 0; k < trail; k += 2) bead(x, y - k * (size / 1024), r * (0.35 + 0.25 * (k / trail)));
    bead(x, y, r, 1.25);
  }

  const src = ctx.getImageData(0, 0, size, size).data;
  const out = new Uint8ClampedArray(size * size * 4);
  const h = (x: number, y: number) => {
    const xx = (x + size) % size;
    const yy = Math.min(size - 1, Math.max(0, y));
    return src[(yy * size + xx) * 4] / 255;
  };
  const strength = 2.6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      out[i] = (-dx * inv * 0.5 + 0.5) * 255;
      out[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      out[i + 2] = (inv * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  // Beads also scatter light slightly — a roughness map from the same field.
  const rough = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = src[i * 4];
    const r = 14 + v * 0.35;
    rough[i * 4] = r;
    rough[i * 4 + 1] = r;
    rough[i * 4 + 2] = r;
    rough[i * 4 + 3] = 255;
  }
  const roughTex = new THREE.DataTexture(rough, size, size, THREE.RGBAFormat);
  roughTex.wrapS = THREE.RepeatWrapping;
  roughTex.generateMipmaps = true;
  roughTex.minFilter = THREE.LinearMipmapLinearFilter;
  roughTex.magFilter = THREE.LinearFilter;
  roughTex.needsUpdate = true;

  return { normal: tex, roughness: roughTex };
}
