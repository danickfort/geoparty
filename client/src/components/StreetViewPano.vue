<script setup lang="ts">
/**
 * Our own Street View panorama renderer: Google's raw equirectangular imagery
 * tiles (keyless, CORS-enabled) stitched into a WebGL texture and projected by
 * a tiny fragment shader.
 *
 * The whole point over the `svembed` iframe is what *isn't* here: street-name
 * ribbons, navigation chevrons, the place-name chip, compass and zoom controls
 * are all drawn by Google's renderer, not baked into the imagery — so simply
 * rendering the imagery ourselves removes every location giveaway. It also
 * frees the camera: the view drifts in a slow pan until someone grabs it.
 *
 * Anything that fails along the way (metadata, WebGL, the imagery probe) emits
 * `fallback` so `StreetViewFrame.vue` can drop back to the cropped iframe.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { PanoMeta, StreetViewSpec } from '@shared/streetview'
import { streetViewTileUrl } from '@shared/streetview'

const props = defineProps<{ spec: StreetViewSpec }>()
const emit = defineEmits<{ fallback: [] }>()

const container = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const copyright = ref('')
const loaded = ref(false)

/** Vertical field of view bounds, degrees. Default matches the embed's look. */
const FOV_DEFAULT = 75
const FOV_MIN = 35
const FOV_MAX = 100
/** Idle drift: a full turn in about four minutes, until someone drags. */
const AUTO_PAN_DEG_PER_S = 1.5
/** Never stitch a texture wider than this, however large the screen. */
const MAX_PANO_WIDTH = 8192
const TILE_CONCURRENCY = 8

const VERTEX_SRC = `
attribute vec2 pos;
varying vec2 ndc;
void main() {
  ndc = pos;
  gl_Position = vec4(pos, 0.0, 1.0);
}`

// Per pixel: build the view ray for this screen position, take its compass
// bearing and elevation, and look those up in the equirectangular texture.
// World frame: x east, y up, z north. uvScale trims the tile-padding margin.
const FRAGMENT_SRC = `
precision highp float;
varying vec2 ndc;
uniform sampler2D pano;
uniform float yaw;
uniform float pitch;
uniform float panoYaw;
uniform float tanHalfFov;
uniform float aspect;
uniform vec2 uvScale;
const float PI = 3.141592653589793;
void main() {
  vec3 forward = vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
  vec3 right = vec3(cos(yaw), 0.0, -sin(yaw));
  vec3 up = cross(forward, right);
  vec3 dir = normalize(forward + tanHalfFov * (ndc.x * aspect * right + ndc.y * up));
  float bearing = atan(dir.x, dir.z);
  float u = fract((bearing - panoYaw) / (2.0 * PI) + 0.5);
  float v = 0.5 - asin(dir.y) / PI;
  gl_FragColor = texture2D(pano, vec2(u, v) * uvScale);
}`

let gl: WebGLRenderingContext | null = null
let uniforms: Record<string, WebGLUniformLocation | null> = {}
let rafId = 0
let lastFrameAt = 0
let dirty = true
let autoPan = true
let disposed = false
let resizeObserver: ResizeObserver | null = null

// Camera state, radians.
let yaw = 0
let pitch = 0
let fov = (FOV_DEFAULT * Math.PI) / 180

const rad = (deg: number) => (deg * Math.PI) / 180

function fail(): void {
  if (!disposed) emit('fallback')
}

function compileProgram(ctx: WebGLRenderingContext): WebGLProgram | null {
  const make = (type: number, src: string) => {
    const shader = ctx.createShader(type)
    if (!shader) return null
    ctx.shaderSource(shader, src)
    ctx.compileShader(shader)
    return ctx.getShaderParameter(shader, ctx.COMPILE_STATUS) ? shader : null
  }
  const vertex = make(ctx.VERTEX_SHADER, VERTEX_SRC)
  const fragment = make(ctx.FRAGMENT_SHADER, FRAGMENT_SRC)
  const program = ctx.createProgram()
  if (!vertex || !fragment || !program) return null
  ctx.attachShader(program, vertex)
  ctx.attachShader(program, fragment)
  ctx.linkProgram(program)
  return ctx.getProgramParameter(program, ctx.LINK_STATUS) ? program : null
}

/**
 * The sharpest level that still makes sense: enough pixels that the visible
 * slice (fov/360 of the pano) is about half the canvas resolution — visually
 * plenty, at a quarter of the tile bill of true 1:1 — capped by the GPU's
 * texture limit and a sanity ceiling.
 */
function pickLevel(meta: PanoMeta, maxTexture: number): number {
  const el = container.value
  const targetWidth =
    ((el ? el.clientWidth : 1280) * Math.min(devicePixelRatio, 2) * (360 / FOV_DEFAULT)) / 2
  const cap = Math.min(MAX_PANO_WIDTH, maxTexture)
  let best = 0
  for (let i = 0; i < meta.levels.length; i++) {
    const columns = Math.ceil(meta.levels[i].width / meta.tileWidth)
    if (columns * meta.tileWidth > cap) break
    best = i
    if (meta.levels[i].width >= targetWidth) break
  }
  return best
}

function resize(): void {
  const el = container.value
  const cv = canvas.value
  if (!el || !cv || !gl) return
  const dpr = Math.min(devicePixelRatio, 2)
  const width = Math.max(1, Math.round(el.clientWidth * dpr))
  const height = Math.max(1, Math.round(el.clientHeight * dpr))
  if (cv.width !== width || cv.height !== height) {
    cv.width = width
    cv.height = height
    gl.viewport(0, 0, width, height)
    dirty = true
  }
}

function frame(now: number): void {
  if (disposed || !gl) return
  const dt = lastFrameAt ? (now - lastFrameAt) / 1000 : 0
  lastFrameAt = now
  if (autoPan) {
    yaw += rad(AUTO_PAN_DEG_PER_S) * Math.min(dt, 0.1)
    dirty = true
  }
  if (dirty) {
    dirty = false
    gl.uniform1f(uniforms.yaw, yaw)
    gl.uniform1f(uniforms.pitch, pitch)
    gl.uniform1f(uniforms.tanHalfFov, Math.tan(fov / 2))
    gl.uniform1f(uniforms.aspect, gl.drawingBufferWidth / gl.drawingBufferHeight)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  rafId = requestAnimationFrame(frame)
}

function loadTile(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`tile failed: ${url}`))
    img.src = url
  })
}

async function loadPanorama(meta: PanoMeta, ctx: WebGLRenderingContext): Promise<void> {
  const zoom = pickLevel(meta, ctx.getParameter(ctx.MAX_TEXTURE_SIZE))
  const level = meta.levels[zoom]
  const columns = Math.ceil(level.width / meta.tileWidth)
  const rows = Math.ceil(level.height / meta.tileHeight)

  // The texture is padded up to whole tiles so each upload is one clean
  // texSubImage2D; uvScale keeps sampling inside the real image.
  const textureWidth = columns * meta.tileWidth
  const textureHeight = rows * meta.tileHeight
  ctx.uniform2f(uniforms.uvScale, level.width / textureWidth, level.height / textureHeight)
  ctx.texImage2D(
    ctx.TEXTURE_2D,
    0,
    ctx.RGBA,
    textureWidth,
    textureHeight,
    0,
    ctx.RGBA,
    ctx.UNSIGNED_BYTE,
    null,
  )

  // One probe tile before committing: user-contributed photospheres share the
  // pano-id shape but have no tiles here, and should fall back to the iframe.
  try {
    const probe = await loadTile(streetViewTileUrl(meta.panoId, zoom, 0, 0))
    ctx.texSubImage2D(ctx.TEXTURE_2D, 0, 0, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, probe)
  } catch {
    fail()
    return
  }
  if (disposed) return
  loaded.value = true
  dirty = true

  // Load what the initial camera looks at first, then spiral outward.
  const centerColumn = ((yaw - rad(meta.centerHeading)) / (2 * Math.PI) + 0.5) * columns
  const pending: { x: number; y: number; distance: number }[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (x === 0 && y === 0) continue
      const across = (((x + 0.5 - centerColumn) % columns) + columns) % columns
      pending.push({ x, y, distance: Math.min(across, columns - across) + Math.abs(y - rows / 2) })
    }
  }
  pending.sort((a, b) => a.distance - b.distance)

  const workers = Array.from({ length: TILE_CONCURRENCY }, async () => {
    while (pending.length > 0 && !disposed) {
      const tile = pending.shift()
      if (!tile) return
      try {
        const img = await loadTile(streetViewTileUrl(meta.panoId, zoom, tile.x, tile.y))
        if (disposed) return
        ctx.texSubImage2D(
          ctx.TEXTURE_2D,
          0,
          tile.x * meta.tileWidth,
          tile.y * meta.tileHeight,
          ctx.RGBA,
          ctx.UNSIGNED_BYTE,
          img,
        )
        dirty = true
      } catch {
        // A missing tile leaves a black patch; not worth abandoning the pano.
      }
    }
  })
  await Promise.all(workers)
}

function onPointerDown(event: PointerEvent): void {
  const cv = canvas.value
  if (!cv) return
  autoPan = false
  try {
    cv.setPointerCapture(event.pointerId)
  } catch {
    // Pointer already gone (fast tap); the drag just won't capture.
  }
  let lastX = event.clientX
  let lastY = event.clientY

  const onMove = (move: PointerEvent) => {
    const degreesPerPixel = ((fov * 180) / Math.PI) * (1 / cv.clientHeight)
    yaw -= rad((move.clientX - lastX) * degreesPerPixel)
    pitch += rad((move.clientY - lastY) * degreesPerPixel)
    pitch = Math.min(rad(85), Math.max(rad(-85), pitch))
    lastX = move.clientX
    lastY = move.clientY
    dirty = true
  }
  const onUp = () => {
    cv.removeEventListener('pointermove', onMove)
    cv.removeEventListener('pointerup', onUp)
    cv.removeEventListener('pointercancel', onUp)
  }
  cv.addEventListener('pointermove', onMove)
  cv.addEventListener('pointerup', onUp)
  cv.addEventListener('pointercancel', onUp)
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  fov = Math.min(rad(FOV_MAX), Math.max(rad(FOV_MIN), fov * Math.exp(event.deltaY * 0.001)))
  dirty = true
}

onMounted(async () => {
  const cv = canvas.value
  if (!cv || !props.spec.panoId) {
    fail()
    return
  }

  let meta: PanoMeta
  try {
    const res = await fetch(`/api/pano-meta?panoid=${encodeURIComponent(props.spec.panoId)}`)
    if (!res.ok) throw new Error(`pano-meta ${res.status}`)
    meta = (await res.json()) as PanoMeta
  } catch {
    fail()
    return
  }
  if (disposed) return

  const ctx = cv.getContext('webgl', { antialias: false, alpha: false })
  if (!ctx) {
    fail()
    return
  }
  const program = compileProgram(ctx)
  if (!program) {
    fail()
    return
  }
  gl = ctx

  ctx.useProgram(program)
  const buffer = ctx.createBuffer()
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer)
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), ctx.STATIC_DRAW)
  const pos = ctx.getAttribLocation(program, 'pos')
  ctx.enableVertexAttribArray(pos)
  ctx.vertexAttribPointer(pos, 2, ctx.FLOAT, false, 0, 0)

  for (const name of ['pano', 'yaw', 'pitch', 'panoYaw', 'tanHalfFov', 'aspect', 'uvScale']) {
    uniforms[name] = ctx.getUniformLocation(program, name)
  }

  const texture = ctx.createTexture()
  ctx.bindTexture(ctx.TEXTURE_2D, texture)
  // The stitched sizes aren't always powers of two, so no mipmaps or repeat.
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR)
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR)
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE)
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE)
  ctx.uniform1i(uniforms.pano, 0)

  yaw = rad(props.spec.heading)
  pitch = rad(Math.min(85, Math.max(-85, props.spec.pitch)))
  ctx.uniform1f(uniforms.panoYaw, rad(meta.centerHeading))
  copyright.value = meta.copyright ?? '© Google'

  resize()
  resizeObserver = new ResizeObserver(resize)
  if (container.value) resizeObserver.observe(container.value)
  rafId = requestAnimationFrame(frame)

  await loadPanorama(meta, ctx)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  gl = null
})
</script>

<template>
  <div ref="container" class="pano-viewer" :class="{ loaded }">
    <canvas ref="canvas" @pointerdown="onPointerDown" @wheel="onWheel"></canvas>
    <span v-if="loaded" class="attribution">{{ copyright }}</span>
  </div>
</template>

<style scoped>
.pano-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #05080f;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.6s ease;
  touch-action: none;
}

.loaded canvas {
  opacity: 1;
}

canvas:active {
  cursor: grabbing;
}

/* Imagery attribution — required courtesy, and it gives nothing away. */
.attribution {
  position: absolute;
  right: 8px;
  bottom: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  user-select: none;
}
</style>
