<script setup lang="ts">
import { computed } from 'vue'
import { formatKm } from '@shared/format'
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
    <h1 class="board-head">This round</h1>
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
        <span class="distance">{{ formatKm(r.distanceKm) }}</span>
      </div>
    </div>
    <p v-else class="empty">Nobody guessed this round 😅</p>

    <section v-if="game.badgeChanges.length" class="titles">
      <h2>Titles</h2>
      <div
        v-for="(c, i) in game.badgeChanges"
        :key="c.badge.id"
        class="title-row pop-in"
        :style="{ animationDelay: `${0.4 + i * 0.12}s` }"
      >
        <span class="emoji">{{ c.badge.emoji }}</span>
        <strong>{{ c.badge.label }}</strong>
        <template v-if="c.to">
          <span class="arrow">→</span>
          <img :src="`/avatars/${c.to}`" :alt="game.nameOfAvatar(c.to)" />
          <strong>{{ game.nameOfAvatar(c.to) }}</strong>
          <span v-if="c.badge.detail" class="muted">({{ c.badge.detail }})</span>
          <span class="muted">{{ c.from ? `took it from ${game.nameOfAvatar(c.from)}` : 'new title' }}</span>
        </template>
        <span v-else class="muted">— {{ game.nameOfAvatar(c.from!) }} lost it</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.round-scoreboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1vh;
  padding: 4vh 4vw;
}

/* Title over a thick ink rule, like the head of a map legend. */
.board-head {
  width: min(640px, 92vw);
  font-size: clamp(2rem, 5.5vw, 4rem);
  padding-bottom: 0.15em;
  border-bottom: clamp(3px, 0.35vw, 6px) solid var(--text);
}

.rows {
  display: flex;
  flex-direction: column;
  width: min(640px, 92vw);
  max-height: 70vh;
  overflow-y: auto;
}

/* Rows are separated by thin rules, no cards. */
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.rank {
  width: 2.4em;
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 2.6vw, 2rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.faces {
  display: flex;
}

.row img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  background: #fff;
}

.row img.other {
  width: 40px;
  height: 40px;
  margin-left: -14px;
  align-self: flex-end;
  box-shadow: 0 0 0 2px var(--bg);
}

/* Closest this round: rank, distance and a paper + red ring in the one red. */
.row.leader .rank,
.row.leader .distance {
  color: var(--hot);
}

.row.leader img:first-child {
  box-shadow:
    0 0 0 3px var(--bg),
    0 0 0 6px var(--hot);
}

.name {
  flex: 1;
  font-size: clamp(1.1rem, 2.6vw, 1.7rem);
  font-weight: 600;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.duel {
  display: inline-block;
  margin-left: 8px;
  vertical-align: middle;
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums;
  font-size: 0.7em;
  font-weight: 700;
  padding: 0 9px;
  border-radius: 999px;
  color: #fff;
  background: var(--ok);
}

.duel.lost {
  color: #fff;
  background: var(--hot);
}

.place {
  font-size: clamp(0.8rem, 1.6vw, 1.05rem);
  font-weight: 600;
  font-style: normal;
  color: var(--muted);
}

.distance {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3.4vw, 2.6rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  white-space: nowrap;
}

.empty {
  font-size: clamp(1.2rem, 3vw, 2rem);
  color: var(--muted);
}

.titles {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 3vh;
}

.titles h2 {
  font-size: clamp(1.4rem, 3vw, 2.2rem);
}

/* Outlined paper pills, one per title that changed hands. */
.title-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 18px 4px 12px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  font-size: clamp(1rem, 1.9vw, 1.4rem);
  white-space: nowrap;
}

.title-row strong {
  font-weight: 600;
}

.title-row .emoji {
  font-size: 1.3em;
}

.title-row img {
  width: 1.8em;
  height: 1.8em;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  background: #fff;
}

.arrow {
  color: var(--text);
  font-weight: 700;
}
</style>
