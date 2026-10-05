import { ShaderMount } from './vendor/paper-shaders/shader-mount.js';

const MOTION_SPEED = 0.08;

const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_top;
uniform vec3 u_horizon;
uniform vec3 u_cloud;
uniform vec3 u_aurora;
uniform vec3 u_paper;
uniform float u_night;
uniform float u_warmth;
uniform vec2 u_sun;

out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);

  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float cloudField(vec2 p) {
  float field = 0.0;
  field += valueNoise(p) * 0.56;
  field += valueNoise(p * 2.03 + vec2(7.1, 1.7)) * 0.28;
  field += valueNoise(p * 4.11 + vec2(2.4, 8.9)) * 0.11;
  field += valueNoise(p * 8.17 + vec2(6.2, 3.8)) * 0.05;
  return field;
}

float starField(vec2 uv) {
  vec2 grid = vec2(128.0, 72.0);
  vec2 id = floor(uv * grid);
  vec2 point = fract(uv * grid) - 0.5;
  float seed = hash21(id);
  vec2 offset = vec2(hash21(id + 17.3), hash21(id + 41.9)) - 0.5;
  float radius = mix(0.035, 0.105, hash21(id + 9.4));
  float dotShape = 1.0 - smoothstep(radius, radius + 0.045, length(point - offset * 0.58));
  return dotShape * step(0.982, seed);
}

float curtain(vec2 uv, float phase, float lane) {
  float time = u_time * 0.075;
  float wave = sin(uv.x * 5.7 + time + phase) * 0.070;
  wave += sin(uv.x * 11.3 - time * 0.63 + phase * 1.9) * 0.023;
  wave += (valueNoise(vec2(uv.x * 3.1 + time * 0.08, phase)) - 0.5) * 0.045;

  float center = lane + wave;
  float width = mix(0.018, 0.095, smoothstep(-0.01, 0.08, uv.y - center));
  float ribbon = exp(-pow(abs(uv.y - center) / width, 1.55));
  float striation = mix(0.40, 1.0, valueNoise(vec2(uv.x * 70.0 - time * 0.45, uv.y * 2.0 + phase)));
  float taper = smoothstep(0.30, 0.52, uv.x) * (1.0 - smoothstep(0.99, 1.08, uv.x));
  return ribbon * striation * taper;
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(u_resolution.xy, vec2(1.0));
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 scene = vec2((uv.x - 0.5) * aspect + 0.5, uv.y);

  float vertical = smoothstep(0.02, 0.96, uv.y);
  vertical = pow(vertical, 0.86);
  vec3 color = mix(u_horizon, u_top, vertical);

  vec2 sunDelta = scene - vec2((u_sun.x - 0.5) * aspect + 0.5, u_sun.y);
  sunDelta.x *= 0.72;
  float horizonBand = exp(-pow((uv.y - u_sun.y) * 3.25, 2.0));
  float sunHaze = exp(-dot(sunDelta, sunDelta) * 3.1) * horizonBand * u_warmth;
  color = mix(color, mix(u_horizon, u_paper, 0.46), sunHaze * 0.38);

  float rightBias = smoothstep(0.28, 0.82, uv.x);
  vec2 cloudUv = vec2(scene.x * 1.12 - u_time * 0.0042, uv.y * 8.4);
  float cloudTexture = cloudField(cloudUv);
  float highWisp = exp(-pow((uv.y - 0.69) * 8.8, 2.0));
  float lowWisp = exp(-pow((uv.y - 0.43) * 11.5, 2.0));
  float cloudShape = smoothstep(0.49, 0.72, cloudTexture) * (highWisp * 0.72 + lowWisp * 0.34);
  float dayCloud = cloudShape * rightBias * (1.0 - u_night * 0.78) * 0.48;
  // Fuller daytime layers, with open sky between them. Keep the original
  // nocturnal wisps so the added clouds never compete with the aurora.
  float daylight = 1.0 - smoothstep(0.05, 0.70, u_night);
  float broadTexture = cloudField(vec2(scene.x * 1.75 - u_time * 0.003, uv.y * 5.8) + vec2(3.2, 6.4));
  float upperLayer = exp(-pow((uv.y - 0.84) * 10.0, 2.0));
  float middleLayer = exp(-pow((uv.y - 0.64) * 7.4, 2.0));
  float distantLayer = exp(-pow((uv.y - 0.43) * 12.0, 2.0));
  float layeredCloud = smoothstep(0.38, 0.68, broadTexture)
    * (upperLayer * 0.80 + middleLayer * 0.85 + distantLayer * 0.38);
  float daytimeCoverage = mix(0.28, 1.0, rightBias);
  float fullerCloud = clamp((layeredCloud + cloudShape * 0.48) * daytimeCoverage * 0.78, 0.0, 0.72);
  dayCloud = mix(dayCloud, fullerCloud, daylight);
  color = mix(color, u_cloud, dayCloud);

  float stars = starField(uv) * smoothstep(0.22, 0.92, uv.y);
  stars *= mix(0.12, 1.0, rightBias) * smoothstep(0.38, 0.92, u_night) * 0.42;
  vec3 starColor = mix(u_cloud, u_aurora, 0.22);
  color = mix(color, starColor, stars);

  float upperCurtain = curtain(uv, 1.7, 0.69);
  float lowerCurtain = curtain(uv, 4.9, 0.56) * 0.63;
  float auroraMask = clamp(upperCurtain + lowerCurtain, 0.0, 1.0);
  auroraMask *= smoothstep(0.43, 0.98, u_night) * 0.78;
  vec3 auroraColor = mix(u_horizon, u_aurora, 0.94);
  color = mix(color, auroraColor, auroraMask);

  float atmosphericVeil = valueNoise(vec2(scene.x * 2.2 + u_time * 0.0015, uv.y * 2.7));
  atmosphericVeil = (atmosphericVeil - 0.5) * rightBias * 0.035;
  color = mix(color, mix(u_top, u_horizon, uv.y), abs(atmosphericVeil));

  fragColor = vec4(color, 1.0);
}
`;

function paletteUniforms(palette) {
  return {
    u_top: palette.top,
    u_horizon: palette.horizon,
    u_cloud: palette.cloud,
    u_aurora: palette.aurora,
    u_paper: palette.paper,
    u_night: palette.night,
    u_warmth: palette.warmth,
    u_sun: [palette.sunX, palette.sunY],
  };
}

export function createNaturalSky(container, initialPalette) {
  const existingChildren = new Set(container.children);
  let mount;

  try {
    mount = new ShaderMount(
      container,
      fragmentShader,
      paletteUniforms(initialPalette),
      { alpha: false, antialias: false, depth: false, stencil: false },
      MOTION_SPEED,
      20000,
      1,
      650000,
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
    },
    dispose() {
      mount.dispose();
    },
  };
}
