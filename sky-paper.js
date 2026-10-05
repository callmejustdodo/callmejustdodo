import { getShaderNoiseTexture } from './vendor/paper-shaders/get-shader-noise-texture.js';
import { ShaderMount } from './vendor/paper-shaders/shader-mount.js';
import {
  WarpPatterns,
  warpFragmentShader,
  warpMeta,
} from './vendor/paper-shaders/shaders/warp.js';

const MOTION_SPEED = 0.08;
const STATIC_FRAME = 28000;
const MAX_PIXEL_COUNT = 650000;

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function mixColor(from, to, amount) {
  const t = clamp01(amount);
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

function opaque(color) {
  return [color[0], color[1], color[2], 1];
}

function warpColors(palette) {
  const night = clamp01(palette.night);
  const warmth = clamp01(palette.warmth);
  const auroraStrength = night * 0.62;

  const colors = [
    mixColor(palette.top, palette.horizon, 0.08),
    mixColor(palette.top, palette.cloud, 0.20),
    mixColor(palette.top, palette.horizon, 0.36),
    mixColor(palette.horizon, palette.paper, 0.12 + warmth * 0.16),
    mixColor(palette.horizon, palette.aurora, auroraStrength * 0.48),
    mixColor(palette.top, palette.aurora, auroraStrength),
    mixColor(palette.horizon, palette.cloud, 0.34),
    mixColor(palette.top, palette.horizon, 0.06),
  ].map(opaque);

  while (colors.length < warpMeta.maxColorCount) {
    colors.push([...colors[colors.length - 1]]);
  }

  return colors;
}

function paletteUniforms(palette) {
  const night = clamp01(palette.night);

  return {
    u_colors: warpColors(palette),
    u_colorsCount: 8,
    u_proportion: 0.5,
    u_softness: 0.94,
    u_shape: WarpPatterns.stripes,
    u_shapeScale: 0.14 + night * 0.025,
    u_distortion: 0.025 + night * 0.055,
    u_swirl: 0.012 + night * 0.038,
    u_swirlIterations: 6,
  };
}

function sizingUniforms() {
  return {
    u_fit: 0,
    u_scale: 1,
    u_rotation: -3,
    u_offsetX: 0,
    u_offsetY: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0,
  };
}

async function loadNoiseTexture() {
  const image = getShaderNoiseTexture();
  if (!image) throw new Error('Paper Shaders: noise texture is unavailable');
  if (image.complete && image.naturalWidth > 0) return image;

  if (typeof image.decode === 'function') {
    try {
      await image.decode();
      if (image.naturalWidth > 0) return image;
    } catch {
      // Some browsers reject decode() for data URLs but still emit a load event.
    }
  }

  await new Promise((resolve, reject) => {
    if (image.complete) {
      if (image.naturalWidth > 0) resolve();
      else reject(new Error('Paper Shaders: noise texture failed to load'));
      return;
    }
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', () => reject(new Error('Paper Shaders: noise texture failed to load')), { once: true });
  });

  return image;
}

export async function createPaperSky(container, initialPalette) {
  const existingChildren = new Set(container.children);
  let mount;

  try {
    const noiseTexture = await loadNoiseTexture();
    mount = new ShaderMount(
      container,
      warpFragmentShader,
      {
        ...sizingUniforms(),
        ...paletteUniforms(initialPalette),
        u_noiseTexture: noiseTexture,
      },
      { alpha: false, antialias: false, depth: false, stencil: false },
      MOTION_SPEED,
      STATIC_FRAME,
      1,
      MAX_PIXEL_COUNT,
    );
  } catch (error) {
    for (const child of container.children) {
      if (!existingChildren.has(child) && child.tagName === 'CANVAS') {
        child.remove();
      }
    }
    throw error;
  }

  return {
    canvas: mount.canvasElement,
    setPalette(palette) {
      mount.setUniforms(paletteUniforms(palette));
    },
    setMotion(enabled) {
      mount.setSpeed(enabled ? MOTION_SPEED : 0);
      if (!enabled) mount.setFrame(STATIC_FRAME);
    },
    dispose() {
      mount.dispose();
    },
  };
}
