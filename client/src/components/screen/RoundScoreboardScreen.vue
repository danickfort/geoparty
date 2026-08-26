<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()

const medals = ['🥇', '🥈', '🥉']

// reveal.order is farthest → closest; this screen ranks closest → farthest.
interface Row {
  avatar: string
  name: string
  distanceKm: number
  place: string | null
  /** Team games: the team's colour and the other members' avatars. */
  color: string | null
  others: string[]
}

const rows = computed(() => {
  const order = game.reveal?.order ?? []
  return order
    .map((e) => {
      const player = game.playerById(e.playerId)
      if (!player) return null
      const team = game.teamById(e.teamId)
      return {
        avatar: player.avatar,
        name: team ? `Team ${team.name}` : player.name,
        distanceKm: e.distanceKm,
        place: e.place,
        color: team?.color ?? null,
        others: team ? game.membersOf(team.id).filter((m) => m.id !== player.id).map((m) => m.avatar) : [],
      }
    })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
})

// Net duel result per challenger this round (+1 per win, −0.5 per loss).
const duelNet = computed(() => {
  const net = new Map<string, number>()
  for (const d of game.duels) {
    if (d.won === null) continue
    net.set(d.challengerAvatar, (net.get(d.challengerAvatar) ?? 0) + (d.won ? 1 : -0.5))
  }
  return net
})
const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'))
</script>

<template>
  <div class="round-scoreboard">
    <h1>📍 This round</h1>
    <div v-if="rows.length > 0" class="rows">
      <div
        v-for="(r, i) in rows"
        :key="r.avatar"
        class="row pop-in"
        :class="{ leader: i === 0 }"
        :style="{ animationDelay: `${i * 0.08}s` }"
      >
        <span class="rank">{{ medals[i] ?? `${i + 1}.` }}</span>
        <span class="faces">
          <img :src="`/avatars/${r.avatar}`" :alt="r.name" :style="r.color ? { borderColor: r.color } : {}" />
          <img
            v-for="a in r.others"
            :key="a"
            class="other"
            :src="`/avatars/${a}`"
            alt=""
            :style="r.color ? { borderColor: r.color } : {}"
          />
        </span>
        <span class="name">
          <span>
            {{ r.name }}
            <span v-if="duelNet.has(r.avatar)" class="duel" :class="{ lost: duelNet.get(r.avatar)! < 0 }">
              ⚔️ {{ fmt(duelNet.get(r.avatar)!) }}
            </span>
          </span>
          <em v-if="r.place" class="place">near {{ r.place }}</em>
        </span>
        <span class="distance">{{ Math.round(r.distanceKm).toLocaleString() }} km</span>
      </div>
    </div>
    <p v-else class="empty">Nobody guessed this round 😅</p>
  </div>
</template>

<style scoped>
.round-scoreboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4vh;
  padding: 4vh 4vw;
}

h1 {
  font-size: clamp(2rem, 5.5vw, 4rem);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(640px, 92vw);
  max-height: 70vh;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 20px;
}

.row.leader {
  border-color: var(--accent);
  box-shadow: 0 0 24px rgba(251, 191, 36, 0.25);
}

.rank {
  width: 2.4em;
  font-size: 1.5rem;
  font-weight: 800;
}

.faces {
  display: flex;
}

.row img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: #fff;
}

.row img.other {
  width: 40px;
  height: 40px;
  margin-left: -14px;
  align-self: flex-end;
}

.name {
  flex: 1;
  font-size: clamp(1.1rem, 2.6vw, 1.7rem);
  font-weight: 800;
  display: flex;
  flex-direction: column;
}

.duel {
  display: inline-block;
  margin-left: 8px;
  vertical-align: middle;
  font-size: 0.6em;
  font-weight: 900;
  padding: 1px 8px;
  border-radius: 999px;
  color: #04120c;
  background: var(--ok);
}

.duel.lost {
  color: #fff;
  background: var(--hot);
}

.place {
  font-size: clamp(0.8rem, 1.6vw, 1rem);
  font-weight: 600;
  font-style: normal;
  color: var(--muted);
}

.distance {
  font-size: clamp(1.2rem, 2.6vw, 1.9rem);
  font-weight: 900;
  color: var(--accent);
}

.empty {
  font-size: clamp(1.2rem, 3vw, 2rem);
  color: var(--muted);
}
</style>
