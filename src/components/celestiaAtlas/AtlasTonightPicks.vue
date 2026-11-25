<template>
  <div ref="root" class="atlas-tonight">
    <button
      class="atlas-tonight-toggle"
      :class="{ 'is-active': open }"
      type="button"
      :aria-expanded="open"
      data-testid="atlas-tonight-toggle"
      @click="toggle"
    >
      <MoonIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{{ t('components.celestiaAtlas.tonight.title') }}</span>
    </button>
    <div v-if="open" class="atlas-tonight-panel" data-testid="atlas-tonight-panel">
      <p class="atlas-tonight-intro">{{ t('components.celestiaAtlas.tonight.intro') }}</p>
      <p v-if="!hasSite" class="atlas-tonight-hint">
        {{ t('components.celestiaAtlas.tonight.noSite') }}
      </p>
      <p v-else-if="!nightWindow" class="atlas-tonight-hint">
        {{ t('components.celestiaAtlas.tonight.noDarkNight') }}
      </p>
      <p v-else-if="!picks.length" class="atlas-tonight-hint">
        {{ t('components.celestiaAtlas.tonight.nothing') }}
      </p>
      <ul v-else>
        <li v-for="pick in picks" :key="pick.id">
          <button class="atlas-tonight-row" type="button" @click="choose(pick)">
            <span class="atlas-tonight-name">{{ pick.name }}</span>
            <span class="atlas-tonight-meta">
              {{ [pick.catalog, typeLabel(pick.type)].filter(Boolean).join(' · ') }}
              ·
              {{
                t('components.celestiaAtlas.tonight.maxAlt', { alt: Math.round(pick.maxAltDeg) })
              }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { MoonIcon } from '@heroicons/vue/24/outline';
import { useTonightPicks } from '@/composables/useTonightPicks';

const emit = defineEmits(['select']);
const { t, te } = useI18n();
const { picks, nightWindow, hasSite, refresh } = useTonightPicks();

const open = ref(false);
const root = ref(null);

function toggle() {
  open.value = !open.value;
}

function choose(pick) {
  open.value = false;
  emit('select', pick);
}

function typeLabel(type) {
  const key = `components.celestiaAtlas.tonight.types.${type}`;
  return te(key) ? t(key) : '';
}

function onPointerDown(event) {
  if (root.value && !root.value.contains(event.target)) open.value = false;
}

// The window depends on the time of day, so the list is recomputed every time it is opened.
watch(open, (value) => {
  if (value) {
    refresh();
    window.addEventListener('pointerdown', onPointerDown, true);
  } else {
    window.removeEventListener('pointerdown', onPointerDown, true);
  }
});

onBeforeUnmount(() => window.removeEventListener('pointerdown', onPointerDown, true));
</script>

<style scoped>
.atlas-tonight {
  position: relative;
  margin-top: 0.5rem;
}
.atlas-tonight-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--spacing-touch);
  padding: 0 0.875rem;
  font-size: 0.875rem;
  color: var(--color-content);
  background: rgb(17 24 39 / 92%);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-control);
}
.atlas-tonight-toggle.is-active {
  color: var(--color-accent);
}
.atlas-tonight-panel {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  width: min(22rem, calc(100vw - 1.5rem));
  max-height: 24rem;
  overflow-y: auto;
  background: rgb(17 24 39 / 96%);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-control);
}
.atlas-tonight-intro {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-content-muted);
}
.atlas-tonight-hint {
  padding: 0.25rem 0.75rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-content);
}
.atlas-tonight-row {
  display: grid;
  width: 100%;
  min-height: var(--spacing-touch);
  padding: 0.5rem 0.75rem;
  text-align: left;
  color: var(--color-content);
}
.atlas-tonight-row:hover {
  background: var(--color-surface-2);
}
.atlas-tonight-name {
  font-weight: 600;
}
.atlas-tonight-meta {
  font-size: 0.75rem;
  color: var(--color-content-muted);
}
</style>
