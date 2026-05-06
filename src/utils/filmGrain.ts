/**
 * Analog film grain renderer.
 *
 * Digital noise: R/G/B channels vary independently → colorful, uniform.
 * Analog grain: monochromatic (R=G=B), irregular cluster size, soft-light
 * blend so it integrates with the underlying image tonality.
 *
 * A half-resolution grain canvas is generated and scaled up, which keeps
 * cost proportional to ~1/4 of the output pixel count.
 */

export type FilmGrainLevel = 'off' | 'light' | 'medium' | 'heavy';

interface GrainConfig {
  /** base opacity 0-255 for each grain pixel */
  baseAlpha: number;
  /** grain pixel density: fraction of canvas pixels that get a grain sample */
  density: number;
  /** probability of a 2-pixel cluster (vs single pixel) */
  clusterRate: number;
}

const GRAIN_CONFIG: Record<Exclude<FilmGrainLevel, 'off'>, GrainConfig> = {
  light:  { baseAlpha: 38,  density: 0.10, clusterRate: 0.10 },
  medium: { baseAlpha: 65,  density: 0.18, clusterRate: 0.18 },
  heavy:  { baseAlpha: 110, density: 0.30, clusterRate: 0.28 },
};

/**
 * Apply a single frame of analog film grain to an existing canvas context.
 * Must be called after all clip content has been drawn.
 *
 * @param ctx  - target canvas 2d context (HTMLCanvas or OffscreenCanvas)
 * @param viewWidth  - logical width  (pixels without DPR)
 * @param viewHeight - logical height (pixels without DPR)
 * @param level - grain intensity
 */
export function applyFilmGrain(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  viewWidth: number,
  viewHeight: number,
  level: Exclude<FilmGrainLevel, 'off'>
): void {
  const cfg = GRAIN_CONFIG[level];

  // Work at half resolution → 1/4 the pixel cost, then scale up.
  // The slight blurring this introduces matches the soft quality of real grain.
  const gw = Math.max(1, Math.floor(viewWidth  / 2));
  const gh = Math.max(1, Math.floor(viewHeight / 2));

  // Reuse a module-level OffscreenCanvas to avoid per-frame allocation.
  const grain = getGrainCanvas(gw, gh);
  const gc    = grain.getContext('2d')!;
  const id    = gc.createImageData(gw, gh);
  const data  = id.data;
  const total = gw * gh;
  const samples = Math.floor(total * cfg.density);

  for (let s = 0; s < samples; s++) {
    // Random position
    const px = (Math.random() * gw) | 0;
    const py = (Math.random() * gh) | 0;
    const idx = (py * gw + px) * 4;

    // Analog grain: monochromatic luminance only.
    // Skew toward midpoint brightness for a silver-halide feel.
    const lum = (100 + Math.random() * 120) | 0; // 100-220 range

    // Alpha: vary per grain for organic feel
    const a = (cfg.baseAlpha * (0.5 + Math.random())) | 0;

    data[idx]     = lum;
    data[idx + 1] = lum;
    data[idx + 2] = lum;
    data[idx + 3] = Math.min(255, a);

    // Occasionally add a small cluster (adjacent pixel)
    if (Math.random() < cfg.clusterRate && px + 1 < gw) {
      const ci = idx + 4;
      const cl = (lum + ((Math.random() - 0.5) * 30)) | 0;
      data[ci]     = cl;
      data[ci + 1] = cl;
      data[ci + 2] = cl;
      data[ci + 3] = Math.min(255, (a * 0.7) | 0);
    }
  }

  gc.putImageData(id, 0, 0);

  // Composite onto the main canvas.
  // soft-light gives the most organic, tonality-preserving result.
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.drawImage(grain, 0, 0, viewWidth, viewHeight);
  ctx.restore();
}

// ---- module-level canvas cache ----
let _grainCanvas: OffscreenCanvas | null = null;
let _grainW = 0;
let _grainH = 0;

function getGrainCanvas(w: number, h: number): OffscreenCanvas {
  if (!_grainCanvas || _grainW !== w || _grainH !== h) {
    _grainCanvas = new OffscreenCanvas(w, h);
    _grainW = w;
    _grainH = h;
  }
  return _grainCanvas;
}
