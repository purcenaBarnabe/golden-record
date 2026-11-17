import { MeshPhysicalMaterial, type MeshPhysicalMaterialParameters } from 'three'

// Metre-scale visual estimates, not microscopy of a flight article. Shader
// derivatives fade unresolved detail rather than letting it turn into moiré.
export const METAL_FINISH = {
  grainPitch: 0.000018,
  grainHeight: 0.00000024,
  finePitch: 0.000006,
  fineHeight: 0.000000055,
  brushPitch: 0.000016,
  brushHeight: 0.00000011,
  groovePitch: 0.000082,
} as const

const noise = /* glsl */ `
  varying vec2 vVoyagerMetal;
  float voyagerHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  vec2 voyagerGradient(vec2 p) {
    vec2 g = vec2(voyagerHash(p), voyagerHash(p + vec2(71.23, 43.11))) * 2.0 - 1.0;
    return g * inversesqrt(max(dot(g, g), 0.000001));
  }
  // Gradient noise avoids the visible square-cell boundaries of value noise.
  vec3 voyagerGrain(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    vec2 ga = voyagerGradient(i), gb = voyagerGradient(i + vec2(1.0, 0.0));
    vec2 gc = voyagerGradient(i + vec2(0.0, 1.0)), gd = voyagerGradient(i + vec2(1.0));
    float a = dot(ga, f), b = dot(gb, f - vec2(1.0, 0.0));
    float c = dot(gc, f - vec2(0.0, 1.0)), d = dot(gd, f - vec2(1.0));
    vec2 gradient = mix(mix(ga, gb, u.x), mix(gc, gd, u.x), u.y)
      + vec2(mix(b - a, d - c, u.y) * du.x, mix(c - a, d - b, u.x) * du.y);
    return vec3(mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 0.7 + 0.5, gradient * 0.7);
  }
  float voyagerResolved(vec2 p) {
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    return 1.0 - smoothstep(0.25, 0.95, footprint);
  }
`

export function createMetalMaterial(
  parameters: MeshPhysicalMaterialParameters,
  finish: 'cover' | 'record' = 'cover',
) {
  const material = new MeshPhysicalMaterial({
    ...parameters,
    anisotropy: parameters.anisotropy ?? 0.2,
  })
  const record = finish === 'record'
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vVoyagerMetal;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvVoyagerMetal = position.xy;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${noise}`)
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        vec2 voyagerP = vVoyagerMetal;
        float voyagerCoarseWeight = voyagerResolved(voyagerP / ${METAL_FINISH.grainPitch});
        float voyagerFineWeight = voyagerResolved(voyagerP / ${METAL_FINISH.finePitch});
        vec3 voyagerCoarse = vec3(0.5, 0.0, 0.0), voyagerFine = vec3(0.5, 0.0, 0.0);
        if (voyagerCoarseWeight > 0.001) voyagerCoarse = voyagerGrain(voyagerP / ${METAL_FINISH.grainPitch});
        if (voyagerFineWeight > 0.001) voyagerFine = voyagerGrain(voyagerP / ${METAL_FINISH.finePitch});
        vec2 voyagerSlope = voyagerCoarse.yz * ${METAL_FINISH.grainHeight / METAL_FINISH.grainPitch} * voyagerCoarseWeight
          + voyagerFine.yz * ${METAL_FINISH.fineHeight / METAL_FINISH.finePitch} * voyagerFineWeight;
        roughnessFactor = clamp(roughnessFactor + (voyagerCoarse.x - 0.5) * 0.045 * voyagerCoarseWeight
          + (voyagerFine.x - 0.5) * 0.015 * voyagerFineWeight, 0.075, 0.9);
        float voyagerCavity = 1.0;
      `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        ${
          record
            ? `
          float voyagerRadius = length(voyagerP);
          vec2 voyagerRadial = normalize(voyagerP + vec2(0.0000001));
          float voyagerPhase = (voyagerRadius - 0.074) / ${METAL_FINISH.groovePitch} + atan(voyagerP.y, voyagerP.x) / 6.28318530718;
          float voyagerGrooveWeight = 1.0 - smoothstep(0.25, 1.6, fwidth(voyagerPhase));
          float voyagerArea = smoothstep(0.073, 0.075, voyagerRadius) * (1.0 - smoothstep(0.150, 0.1514, voyagerRadius));
          float voyagerCycle = fract(voyagerPhase) - 0.5;
          // Narrow V-cut walls, rounded shoulders and a flat land between turns.
          float voyagerWall = sign(voyagerCycle) * smoothstep(0.015, 0.055, abs(voyagerCycle))
            * (1.0 - smoothstep(0.15, 0.20, abs(voyagerCycle))) * 0.72;
          voyagerSlope += voyagerRadial * voyagerWall * voyagerGrooveWeight * voyagerArea;
          voyagerCavity = 1.0 - (1.0 - smoothstep(0.08, 0.19, abs(voyagerCycle))) * 0.18 * voyagerGrooveWeight * voyagerArea;
        `
            : `
          vec2 voyagerAxis = vec2(0.743294, 0.668965);
          float voyagerBrush = dot(voyagerP, voyagerAxis) / ${METAL_FINISH.brushPitch};
          float voyagerBrushWeight = voyagerResolved(voyagerP / ${METAL_FINISH.brushPitch});
          voyagerSlope += voyagerAxis * cos(voyagerBrush * 6.28318530718 + voyagerCoarse.x * 0.8)
            * ${(2 * Math.PI * METAL_FINISH.brushHeight) / METAL_FINISH.brushPitch} * voyagerBrushWeight;
        `
        }
        normal = normalize(normal - tbn[0] * voyagerSlope.x - tbn[1] * voyagerSlope.y);
      `,
      )
      .replace(
        '#include <aomap_fragment>',
        '#include <aomap_fragment>\nreflectedLight.indirectSpecular *= voyagerCavity;',
      )
  }
  material.customProgramCacheKey = () => `voyager-physical-microfinish-v2-${finish}`
  return material
}
