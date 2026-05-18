<template>
  <Teleport to="body">
    <div
      v-if="store.pendingOrbitalPick"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="cancel"
    >
      <div class="w-full max-w-md rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-5 space-y-4 mx-4">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-white">Orbital Object Target</h3>
          <button @click="cancel" class="text-gray-400 hover:text-white transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p class="text-xs text-gray-400">
          Search for a comet or asteroid. Its current sky position will be computed and added as a
          Slew to RA/Dec instruction.
        </p>

        <OrbitalTargetSearch @target-selected="onTargetSelected" />

        <!-- Footer buttons -->
        <div class="flex gap-2 justify-end pt-1">
          <button
            @click="cancel"
            class="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-600 rounded-md transition"
          >
            Cancel
          </button>
          <button
            @click="confirm"
            :disabled="!selected || loading"
            class="px-3 py-1.5 text-xs bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition flex items-center gap-1.5"
          >
            <svg v-if="loading" class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Add to Sequence
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import OrbitalTargetSearch from '@/plugins/sequence-creator/components/OrbitalTargetSearch.vue';

const store = useSequenceV2Store();
const selected = ref(null);
const loading = ref(false);

watch(
  () => store.pendingOrbitalPick,
  (val) => {
    if (!val) {
      selected.value = null;
      loading.value = false;
    }
  }
);

function onTargetSelected(data) {
  selected.value = data;
}

async function confirm() {
  if (!selected.value || loading.value || !store.pendingOrbitalPick) return;
  const { targetId, insertAfter } = store.pendingOrbitalPick;
  loading.value = true;
  await store.addOrbitalItem(
    targetId,
    insertAfter,
    selected.value.name,
    selected.value.raDeg,
    selected.value.decDeg,
    selected.value.orbType ?? 1,
    selected.value.orbObj
  );
  loading.value = false;
}

function cancel() {
  store.cancelOrbitalPick();
}
</script>
