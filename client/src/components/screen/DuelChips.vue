<script setup lang="ts">
// "Fox ⚔️ Owl" pills for the big screen. `pending` = the call-outs of a round
// in progress; otherwise each duel carries its settled outcome.
export interface DuelChip {
  challengerAvatar: string
  challengerName: string
  targetAvatar: string
  targetName: string
  won?: boolean | null
}

defineProps<{ duels: DuelChip[]; pending?: boolean }>()

const outcome = (d: DuelChip) =>
  d.won === true ? 'won' : d.won === false ? 'lost' : d.won === null ? 'void' : ''
</script>

<template>
  <div class="chips">
    <div
      v-for="(d, i) in duels"
      :key="`${d.challengerAvatar}>${d.targetAvatar}`"
      class="chip pop-in"
      :class="pending ? '' : outcome(d)"
      :style="{ animationDelay: `${i * 0.06}s` }"
    >
      <img :src="`/avatars/${d.challengerAvatar}`" :alt="d.challengerName" />
      <span class="names">
        <strong>{{ d.challengerName }}</strong>
        <span class="swords">⚔️</span>
        <strong>{{ d.targetName }}</strong>
      </span>
      <img :src="`/avatars/${d.targetAvatar}`" :alt="d.targetName" />
      <span v-if="!pending" class="tag">
        {{ d.won === true ? '+1' : d.won === false ? '−0.5' : 'void' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

/* Paper pills with a hard ink edge — they sit over photos as well as paper. */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 999px;
  background: var(--surface);
  border: 2px solid var(--text);
  color: var(--text);
  font-size: clamp(0.85rem, 1.6vw, 1.25rem);
  white-space: nowrap;
}

.chip img {
  width: 2em;
  height: 2em;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  background: #fff;
}

.names {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.names strong {
  font-weight: 600;
}

.swords {
  font-size: 1.1em;
}

.tag {
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 0.95em;
  line-height: 1.4;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--land);
  color: var(--text);
}

.chip.won {
  border-color: var(--ok);
}

.chip.won .tag {
  background: var(--ok);
  color: #fff;
}

.chip.lost {
  border-color: var(--hot);
  opacity: 0.85;
}

.chip.lost .tag {
  background: var(--hot);
  color: #fff;
}

.chip.void {
  border-style: dashed;
  border-color: var(--border-strong);
  opacity: 0.6;
}
</style>
