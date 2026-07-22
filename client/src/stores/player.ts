import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { LatLng } from '@shared/types'
import { socket } from '@/services/socket'
import { useGameStore } from '@/stores/game'

// sessionStorage on purpose: per-tab identity survives refresh but lets you
// test several players from one browser.
const ID_KEY = 'gp:playerId'
const AVATAR_KEY = 'gp:avatar'

function storedId(): string {
  let id = sessionStorage.getItem(ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(ID_KEY, id)
  }
  return id
}

export const usePlayerStore = defineStore('player', () => {
  const game = useGameStore()

  const playerId = ref(storedId())
  const avatar = ref(sessionStorage.getItem(AVATAR_KEY))
  const joined = ref(false)
  const joinError = ref<string | null>(null)
  const pin = ref<LatLng | null>(null)

  const me = computed(() => game.players.find((p) => p.id === playerId.value))
  const lockedIn = computed(() => me.value?.lockedIn ?? false)

  function join(chosenAvatar: string) {
    joinError.value = null
    socket.emit('player:join', { playerId: playerId.value, avatar: chosenAvatar }, (r) => {
      if (r.ok && r.player) {
        avatar.value = r.player.avatar
        sessionStorage.setItem(AVATAR_KEY, r.player.avatar)
        joined.value = true
      } else {
        joinError.value = r.error ?? 'unknown'
      }
    })
  }

  /** Re-announce identity after connect/reconnect. */
  function rejoin() {
    if (avatar.value) join(avatar.value)
  }

  function lockIn() {
    if (!pin.value) return
    socket.emit('player:lockIn', pin.value, () => {})
  }

  function reset() {
    joined.value = false
    avatar.value = null
    pin.value = null
    sessionStorage.removeItem(AVATAR_KEY)
  }

  socket.on('player:kicked', reset)

  return { playerId, avatar, joined, joinError, pin, me, lockedIn, join, rejoin, lockIn, reset }
})
