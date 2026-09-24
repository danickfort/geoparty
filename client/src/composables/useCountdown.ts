import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { formatClock } from '@shared/format'

/**
 * Whole seconds until `endsAt` (a server timestamp), corrected by the
 * server-clock offset. Ticks a few times a second so the display never
 * visibly skips a number.
 */
export function useCountdown(endsAt: Ref<number | null>, offset: Ref<number>) {
  const secondsLeft = ref(0)
  let ticker: ReturnType<typeof setInterval> | null = null

  const update = () => {
    const end = endsAt.value
    secondsLeft.value =
      end === null ? 0 : Math.max(0, Math.ceil((end - (Date.now() + offset.value)) / 1000))
  }

  const stop = () => {
    if (ticker) clearInterval(ticker)
    ticker = null
  }

  watch(
    endsAt,
    (end) => {
      stop()
      update()
      if (end !== null) ticker = setInterval(update, 250)
    },
    { immediate: true },
  )
  onBeforeUnmount(stop)

  return { secondsLeft, label: computed(() => formatClock(secondsLeft.value)) }
}
