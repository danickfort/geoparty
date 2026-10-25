import L from 'leaflet'
import { MaplibreGL } from '@maplibre/maplibre-gl-leaflet'

// The bridge's transition frame and moveend callback outlive onRemove upstream.
export class MapLibreLayer extends MaplibreGL {
  declare protected _resizeContainer: () => void
  declare protected _zoomEnd: () => void
  declare protected _zooming: boolean

  private transitionFrame: number | undefined
  private finishTransition: (() => void) | undefined

  _transitionEnd(): void {
    if (this.transitionFrame !== undefined) L.Util.cancelAnimFrame(this.transitionFrame)
    this.transitionFrame = L.Util.requestAnimFrame(() => {
      this.transitionFrame = undefined
      const map = this._map
      const gl = this.getMaplibreMap()
      const offset = map.latLngToContainerPoint(map.getBounds().getNorthWest())
      this._resizeContainer()
      L.DomUtil.setTransform(gl.getCanvas(), offset, 1)

      if (this.finishTransition) gl.off('moveend', this.finishTransition)
      const finish = () => {
        if (this.finishTransition !== finish) return
        this.finishTransition = undefined
        this._zoomEnd()
      }
      this.finishTransition = finish
      gl.once('moveend', finish)
      const center = map.getCenter()
      gl.jumpTo({ center: [center.lng, center.lat], zoom: map.getZoom() - 1 })
    })
  }

  override onRemove(map: L.Map): this {
    if (this.transitionFrame !== undefined) {
      L.Util.cancelAnimFrame(this.transitionFrame)
      this.transitionFrame = undefined
    }
    if (this.finishTransition) {
      this.getMaplibreMap().off('moveend', this.finishTransition)
      this.finishTransition = undefined
    }
    this._zooming = false
    super.onRemove(map)
    return this
  }
}
