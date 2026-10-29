<script setup lang="ts">
/**
 * An embedded Google Street View panorama, used wherever a round's image would
 * normally be an `<img>` (the big screen and the admin previews).
 *
 * Two renderers, tried in order:
 *
 * 1. `StreetViewPano.vue` — our own WebGL viewer fed by Google's raw imagery
 *    tiles (keyless). Since we draw the panorama ourselves, none of Google's
 *    UI exists at all: no street names, no place-name chip, no navigation
 *    chevrons, no controls. Needs a pano id with Google-car coverage, or a
 *    user photosphere's image URL.
 *
 * 2. The keyless `output=svembed` iframe, when there's neither or the tile
 *    viewer fails (e.g. a photosphere link without its image URL). Its UI
 *    can't be turned off with a URL parameter, so the iframe is laid out larger
 *    than this box on every side and the overflow is clipped: each edge-anchored control
 *    (place-name chip, compass, zoom, attribution) lands outside the visible
 *    area. In-scene street names remain — they're drawn by Google's renderer
 *    inside the iframe, out of our reach — which is why the tile viewer comes
 *    first.
 */
import { computed, ref, watch } from 'vue'
import type { StreetViewSpec } from '@shared/streetview'
import { streetViewEmbedUrl } from '@shared/streetview'
import StreetViewPano from '@/components/StreetViewPano.vue'

const props = defineProps<{ spec: StreetViewSpec }>()
// Only our own viewer reports where it looks; the iframe is cross-origin.
const emit = defineEmits<{ view: [view: { heading: number; pitch: number }] }>()

const iframeFallback = ref(false)
const panoKey = computed(() => props.spec.panoId ?? props.spec.photosphere?.imageUrl ?? '')
watch(panoKey, () => {
  iframeFallback.value = false
})

const usePano = computed(() => !!panoKey.value && !iframeFallback.value)
const src = computed(() => streetViewEmbedUrl(props.spec))
</script>

<template>
  <div class="street-view">
    <StreetViewPano
      v-if="usePano"
      :key="panoKey"
      :spec="spec"
      @fallback="iframeFallback = true"
      @view="emit('view', $event)"
    />
    <iframe
      v-else
      :src="src"
      title="Street View of the mystery location"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
  </div>
</template>

<style scoped>
.street-view {
  /* How much of each iframe edge to hide. Top clears the place-name chip,
     right the compass / fullscreen / zoom stack, bottom the attribution row. */
  --crop-top: 64px;
  --crop-right: 56px;
  --crop-bottom: 52px;
  --crop-left: 4px;

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--photo-bg);
}

iframe {
  /* Grown past all four edges; the parent's overflow does the cropping. The
     size is spelled out because an <iframe> is a replaced element: with
     `width: auto` it would fall back to its intrinsic 300x150 rather than
     stretching between `left` and `right`. */
  position: absolute;
  top: calc(-1 * var(--crop-top));
  left: calc(-1 * var(--crop-left));
  width: calc(100% + var(--crop-left) + var(--crop-right));
  height: calc(100% + var(--crop-top) + var(--crop-bottom));
  border: 0;
}
</style>
