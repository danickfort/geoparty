import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  AdminState,
  GameDraft,
  GameRecord,
  GeocodeHit,
  ImageSearchResult,
  LatLng,
  PanoLookup,
  PreparedGame,
  TeamSetup,
} from '@shared/types'
import { DEFAULT_TIMER_SECONDS } from '@shared/types'
import type { Ack } from '@shared/events'
import { socket } from '@/services/socket'

const PASSWORD_KEY = 'gp:adminPassword'

export const useAdminStore = defineStore('admin', () => {
  const password = ref(localStorage.getItem(PASSWORD_KEY) ?? '')
  const authed = ref(false)
  const loginError = ref<string | null>(null)
  const state = ref<AdminState | null>(null)

  socket.on('admin:state', (s) => {
    state.value = s
  })

  function login(pw: string) {
    loginError.value = null
    socket.emit('admin:login', { password: pw }, (r) => {
      if (r.ok) {
        password.value = pw
        localStorage.setItem(PASSWORD_KEY, pw)
        authed.value = true
      } else {
        loginError.value = r.error ?? 'unknown'
      }
    })
  }

  /** Silent re-auth after connect/reconnect/reload. */
  function reregister() {
    if (!password.value) return
    socket.emit('admin:register', { password: password.value }, (r) => {
      authed.value = r.ok
    })
  }

  function logout() {
    localStorage.removeItem(PASSWORD_KEY)
    password.value = ''
    authed.value = false
  }

  const setRound = (
    imageUrl: string,
    answer: LatLng,
    description: string,
    halfPointRadiusKm: number | null,
    rivalCallouts: boolean,
    timerSeconds: number | null,
  ) =>
    socket.emit('admin:setRound', {
      imageUrl,
      answer,
      description,
      halfPointRadiusKm,
      rivalCallouts,
      timerSeconds,
    })
  const startGuessing = () => socket.emit('admin:startGuessing')
  const startReveal = () => socket.emit('admin:startReveal')
  const revealNext = () => socket.emit('admin:revealNext')
  const showWinner = () => socket.emit('admin:showWinner')
  const showRoundResults = () => socket.emit('admin:showRoundResults')
  const showScoreboard = () => socket.emit('admin:showScoreboard')
  const newGame = () => socket.emit('admin:newGame')
  const kickPlayer = (playerId: string) => socket.emit('admin:kickPlayer', { playerId })
  const resetScores = () => socket.emit('admin:resetScores')
  const setScores = (scores: Record<string, number>) => socket.emit('admin:setScores', { scores })
  const setTeams = (teams: TeamSetup[]) =>
    new Promise<boolean>((resolve) => socket.emit('admin:setTeams', { teams }, (r) => resolve(r.ok)))

  // ── prepared games ───────────────────────────────────────────────────

  /**
   * When set, RoundSetup copies it into its form fields (overwriting them) and
   * clears it — how "load prepared" and search results reach the setup form.
   */
  const roundDraft = ref<{
    imageUrl: string
    answer: LatLng
    description: string
    halfPointRadiusKm: number | null
    rivalCallouts: boolean
    /** Seconds; null = no timer. */
    timerSeconds: number | null
  } | null>(null)

  const savePrepared = (payload: GameDraft) =>
    new Promise<boolean>((resolve) => socket.emit('admin:savePrepared', payload, (r) => resolve(r.ok)))

  const updatePrepared = (game: PreparedGame) =>
    new Promise<boolean>((resolve) => socket.emit('admin:updatePrepared', game, (r) => resolve(r.ok)))

  const deletePrepared = (id: string) => socket.emit('admin:deletePrepared', { id })

  /** Reflect a freshly loaded game into the RoundSetup form. */
  const draftFrom = (game: GameDraft) => {
    roundDraft.value = {
      imageUrl: game.imageUrl,
      answer: { ...game.answer },
      description: game.description,
      halfPointRadiusKm: game.halfPointRadiusKm ?? null,
      rivalCallouts: game.rivalCallouts ?? true,
      timerSeconds: game.timerSeconds === undefined ? DEFAULT_TIMER_SECONDS : game.timerSeconds,
    }
  }

  function loadPrepared(game: PreparedGame): Promise<boolean> {
    return new Promise((resolve) =>
      socket.emit('admin:loadPrepared', { id: game.id }, (r) => {
        if (r.ok) draftFrom(game)
        resolve(r.ok)
      }),
    )
  }

  // ── collections ──────────────────────────────────────────────────────

  const createCollection = (name: string) =>
    new Promise<boolean>((resolve) =>
      socket.emit('admin:createCollection', { name }, (r) => resolve(r.ok)),
    )

  const renameCollection = (id: string, name: string) =>
    new Promise<boolean>((resolve) =>
      socket.emit('admin:renameCollection', { id, name }, (r) => resolve(r.ok)),
    )

  const deleteCollection = (id: string) => socket.emit('admin:deleteCollection', { id })

  const addToCollection = (collectionId: string, game: GameDraft) =>
    new Promise<boolean>((resolve) =>
      socket.emit('admin:addToCollection', { collectionId, game }, (r) => resolve(r.ok)),
    )

  const updateCollectionGame = (collectionId: string, game: PreparedGame) =>
    new Promise<boolean>((resolve) =>
      socket.emit('admin:updateCollectionGame', { collectionId, game }, (r) => resolve(r.ok)),
    )

  const deleteCollectionGame = (collectionId: string, gameId: string) =>
    socket.emit('admin:deleteCollectionGame', { collectionId, gameId })

  function loadCollectionGame(collectionId: string, game: PreparedGame): Promise<boolean> {
    return new Promise((resolve) =>
      socket.emit('admin:loadCollectionGame', { collectionId, gameId: game.id }, (r) => {
        if (r.ok) draftFrom(game)
        resolve(r.ok)
      }),
    )
  }

  /**
   * Save a game draft to a destination: 'prepared' for the standalone list,
   * or a collection id. Used by round setup and the image search.
   */
  const saveGameTo = (target: string, game: GameDraft): Promise<boolean> =>
    target === 'prepared' ? savePrepared(game) : addToCollection(target, game)

  // ── Slack results ────────────────────────────────────────────────────

  const unpostedGames = computed<GameRecord[]>(() => state.value?.unpostedGames ?? [])
  const history = computed<GameRecord[]>(() => state.value?.history ?? [])
  const slackConfigured = computed(() => state.value?.slackConfigured ?? false)

  const postToSlack = () =>
    new Promise<Ack>((resolve) => socket.emit('admin:postToSlack', (r) => resolve(r)))

  const postGameToSlack = (id: string) =>
    new Promise<Ack>((resolve) => socket.emit('admin:postGameToSlack', { id }, (r) => resolve(r)))

  async function searchImages(query: string): Promise<ImageSearchResult[]> {
    const res = await fetch(`/api/search-images?q=${encodeURIComponent(query)}`, {
      headers: { 'x-admin-password': password.value },
    })
    if (!res.ok) throw new Error(`search failed (${res.status})`)
    const { results } = (await res.json()) as { results: ImageSearchResult[] }
    return results
  }

  /** Nearest Street View panorama to a point, or null when there's none close by. */
  async function lookupPano(p: LatLng): Promise<PanoLookup | null> {
    const res = await fetch(`/api/pano-lookup?lat=${p.lat}&lng=${p.lng}`, {
      headers: { 'x-admin-password': password.value },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`lookup failed (${res.status})`)
    return (await res.json()) as PanoLookup
  }

  /** Places matching free text (Nominatim, proxied by the server). */
  async function searchPlaces(query: string): Promise<GeocodeHit[]> {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
      headers: { 'x-admin-password': password.value },
    })
    if (!res.ok) throw new Error(`place search failed (${res.status})`)
    const { results } = (await res.json()) as { results: GeocodeHit[] }
    return results
  }

  /**
   * Expand a Google maps short link (`maps.app.goo.gl/…`) into the full URL
   * that carries the coordinates and heading. The shortener sends no CORS
   * headers, so the server follows the redirect on our behalf.
   */
  async function resolveLink(url: string): Promise<string> {
    const res = await fetch(`/api/resolve-link?url=${encodeURIComponent(url)}`, {
      headers: { 'x-admin-password': password.value },
    })
    if (!res.ok) throw new Error(`resolve failed (${res.status})`)
    const { url: expanded } = (await res.json()) as { url: string }
    return expanded
  }

  async function uploadImage(file: File): Promise<string> {
    const body = new FormData()
    body.append('image', file)
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-password': password.value },
      body,
    })
    if (!res.ok) throw new Error(`upload failed (${res.status})`)
    const { url } = (await res.json()) as { url: string }
    return url
  }

  return {
    password,
    authed,
    loginError,
    state,
    login,
    reregister,
    logout,
    setRound,
    startGuessing,
    startReveal,
    revealNext,
    showWinner,
    showRoundResults,
    showScoreboard,
    newGame,
    kickPlayer,
    resetScores,
    setScores,
    setTeams,
    roundDraft,
    savePrepared,
    updatePrepared,
    deletePrepared,
    loadPrepared,
    createCollection,
    renameCollection,
    deleteCollection,
    addToCollection,
    updateCollectionGame,
    deleteCollectionGame,
    loadCollectionGame,
    saveGameTo,
    unpostedGames,
    history,
    slackConfigured,
    postToSlack,
    postGameToSlack,
    searchImages,
    lookupPano,
    searchPlaces,
    resolveLink,
    uploadImage,
  }
})
