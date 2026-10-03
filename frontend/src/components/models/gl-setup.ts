import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { Platform } from 'react-native';
import * as THREE from 'three';

/**
 * Create a three.js renderer on an expo-gl context (iOS, Android and web),
 * with the workarounds expo-gl needs. Shared by the small landmark models and
 * the big city map.
 */
export function createThreeRenderer(gl: ExpoWebGLRenderingContext, clearColor: string) {
  if (Platform.OS !== 'web') patchExpoGL(gl);
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (!width || !height) throw new Error(`GL surface has no size (${width}x${height})`);

  // three.js expects a canvas; on native we hand it a minimal stand-in.
  const canvas =
    (gl as unknown as { canvas?: HTMLCanvasElement }).canvas ??
    ({
      width,
      height,
      style: {},
      clientHeight: height,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as HTMLCanvasElement);

  const renderer = constructRenderer(canvas, gl);
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(new THREE.Color(clearColor), 1);
  return { renderer, width, height };
}

/**
 * expo-gl's native context is WebGL2-capable but is an instance of the global
 * `WebGLRenderingContext`, so three.js (r163+) wrongly rejects it as WebGL 1.
 * Hide that global only while the renderer is being constructed.
 */
function constructRenderer(canvas: HTMLCanvasElement, gl: ExpoWebGLRenderingContext) {
  const g = globalThis as { WebGLRenderingContext?: unknown };
  const saved = g.WebGLRenderingContext;
  let hide = Platform.OS !== 'web' && saved !== undefined;
  if (hide) {
    try {
      g.WebGLRenderingContext = undefined;
    } catch {
      hide = false;
    }
  }
  try {
    return new THREE.WebGLRenderer({
      canvas,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
  } finally {
    if (hide) g.WebGLRenderingContext = saved;
  }
}

/**
 * expo-gl doesn't implement a few WebGL calls three.js makes. Patch them so
 * three.js doesn't crash or spam warnings.
 */
function patchExpoGL(gl: ExpoWebGLRenderingContext) {
  const g = gl as unknown as Record<string, unknown> & WebGL2RenderingContext;
  if (!g.getContextAttributes?.()) {
    g.getContextAttributes = () =>
      ({
        alpha: true,
        antialias: true,
        depth: true,
        stencil: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'default',
        desynchronized: false,
        xrCompatible: false,
      }) as WebGLContextAttributes;
  }
  const origPrecision = g.getShaderPrecisionFormat?.bind(g);
  g.getShaderPrecisionFormat = (shaderType: GLenum, precisionType: GLenum) =>
    origPrecision?.(shaderType, precisionType) ??
    ({ rangeMin: 127, rangeMax: 127, precision: 23 } as WebGLShaderPrecisionFormat);
  const origPixelStorei = g.pixelStorei.bind(g);
  g.pixelStorei = (pname: GLenum, param: GLint | GLboolean) => {
    if (pname === g.UNPACK_ALIGNMENT || pname === g.PACK_ALIGNMENT) origPixelStorei(pname, param as GLint);
  };
}
