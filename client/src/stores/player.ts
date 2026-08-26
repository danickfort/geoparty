import { computed, ref, watch } from 'vue'
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

  // Team games: my team, whether I hold the pin, and my teammates' live pins
  // (delivered only to our team's phones).
  const myTeam = computed(() => game.teamById(me.value?.teamId))
  const isCaptain = computed(() => !!myTeam.value && myTeam.value.captainId === playerId.value)
  const livePins = ref<Record<string, LatLng>>({})
  socket.on('team:live', ({ pins }) => (livePins.value = pins))
  watch(
    () => game.phase,
    (phase) => {
      if (phase !== 'guessing') livePins.value = {}
    },
  )
  // Trailing-edge throttle (~4/s): dragging a pin shouldn't flood the room.
  let suggestTimer: ReturnType<typeof setTimeout> | undefined
  let pendingSuggestion: LatLng | null = null
  function suggest(p: LatLng) {
    pendingSuggestion = p
    if (suggestTimer) return
    suggestTimer = setTimeout(() => {
      suggestTimer = undefined
      if (pendingSuggestion) socket.emit('player:suggest', pendingSuggestion)
      pendingSuggestion = null
    }, 250)
  }

  // Rival call-outs: the server decides who is within reach; we only resolve avatars to players.
  const rivalAvatar = computed(() => me.value?.rivalAvatar ?? null)
  const rival = computed(() => (rivalAvatar.value ? game.playerByAvatar(rivalAvatar.value) : undefined))
  const eligibleRivals = computed(() =>
    (me.value?.eligibleRivalAvatars ?? []).flatMap((a) => {
      const p = game.playerByAvatar(a)
      return p ? [p] : []
    }),
  )
  const callOutRival = (targetAvatar: string) =>
    new Promise<boolean>((resolve) =>
      socket.emit('player:callOutRival', { targetAvatar }, (r) => resolve(r.ok)),
    )

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
    livePins.value = {}
    sessionStorage.removeItem(AVATAR_KEY)
  }

  socket.on('player:kicked', reset)

  return {
    playerId,
    avatar,
    joined,
    joinError,
    pin,
    me,
    lockedIn,
    rivalAvatar,
    rival,
    eligibleRivals,
    callOutRival,
    myTeam,
    isCaptain,
    livePins,
    suggest,
    join,
    rejoin,
    lockIn,
    reset,
  }
})
