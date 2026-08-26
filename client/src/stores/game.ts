import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { PublicState } from '@shared/types'
import { socket } from '@/services/socket'

export const useGameStore = defineStore('game', () => {
  const state = ref<PublicState | null>(null)

  socket.on('state', (s) => {
    state.value = s
  })

  const phase = computed(() => state.value?.phase ?? 'lobby')
  const players = computed(() => state.value?.players ?? [])
  const connectedPlayers = computed(() => players.value.filter((p) => p.connected))
  // Players expected to answer this round: not spectating, and either still
  // connected or already locked in (a locked guess counts even if they drop).
  const activePlayers = computed(() =>
    players.value.filter((p) => !p.spectator && (p.connected || p.lockedIn)),
  )
  const avatars = computed(() => state.value?.avatars ?? [])
  const imageUrl = computed(() => state.value?.imageUrl ?? null)
  const description = computed(() => state.value?.description ?? null)
  const publicUrl = computed(() => state.value?.publicUrl ?? '')
  const reveal = computed(() => state.value?.reveal ?? null)
  const lockedPlayers = computed(() => activePlayers.value.filter((p) => p.lockedIn))
  // Full standings from the server: includes disconnected and past players
  // (everyone who has ever scored), not just those in the current room.
  const scoreboard = computed(() => state.value?.scoreboard ?? [])
  // Standings just before the last game's point landed — drives the reorder animation.
  const previousScoreboard = computed(() => state.value?.previousScoreboard ?? null)
  const winnerAvatar = computed(() => state.value?.winnerAvatar ?? null)
  // Everyone who earned the full point: the winner, or the whole winning team.
  const winnerAvatars = computed(() => state.value?.winnerAvatars ?? [])
  // Team games: empty = solo play.
  const teams = computed(() => state.value?.teams ?? [])
  const teamMode = computed(() => teams.value.length > 0)
  const teamById = (id: string | null | undefined) => (id ? teams.value.find((t) => t.id === id) : undefined)
  const membersOf = (teamId: string) => players.value.filter((p) => p.teamId === teamId)
  // Avatars that picked up half a point inside the last round's radius.
  const halfPointAvatars = computed(() => state.value?.halfPointAvatars ?? [])

  // History-derived titles by avatar (computed server-side, shared with Slack).
  const badges = computed(() => state.value?.badges ?? {})
  const badgesFor = (avatar: string) => badges.value[avatar] ?? []

  const playerById = (id: string) => players.value.find((p) => p.id === id)
  const playerByAvatar = (avatar: string) => players.value.find((p) => p.avatar === avatar)

  // Settled call-outs of the game that just ended (empty until the winner is crowned).
  const duels = computed(() => state.value?.duels ?? [])
  // Live call-outs: derived from who each player called out, dropping targets
  // no longer in the room so a kicked rival's chip simply disappears.
  const callouts = computed(() =>
    players.value.flatMap((challenger) => {
      const target = challenger.rivalAvatar ? playerByAvatar(challenger.rivalAvatar) : undefined
      return target ? [{ challenger, target }] : []
    }),
  )

  return {
    state,
    phase,
    players,
    connectedPlayers,
    activePlayers,
    avatars,
    imageUrl,
    description,
    publicUrl,
    reveal,
    lockedPlayers,
    scoreboard,
    previousScoreboard,
    winnerAvatar,
    winnerAvatars,
    teams,
    teamMode,
    teamById,
    membersOf,
    halfPointAvatars,
    badges,
    badgesFor,
    duels,
    callouts,
    playerById,
    playerByAvatar,
  }
})
