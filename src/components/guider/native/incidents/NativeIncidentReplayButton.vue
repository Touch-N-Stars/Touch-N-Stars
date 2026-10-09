<template>
  <!-- Replay of the incident an alert started or joined: a button once saved, "recording…" before -->
  <button
    v-if="state === 'saved'"
    type="button"
    class="tns-btn-secondary w-auto! min-h-9! px-2.5! text-xs! gap-1!"
    :aria-label="k('replayButton')"
    data-testid="native-guider-alert-replay"
    @click.stop="open"
  >
    <PlayCircleIcon class="h-4 w-4 shrink-0 text-accent" />
    {{ k('replayButton') }}
  </button>
  <span
    v-else-if="state === 'recording'"
    class="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-status-danger"
    role="status"
  >
    <span class="tns-dot bg-status-danger animate-pulse"></span>
    {{ k('recording') }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { PlayCircleIcon } from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { alertIncidentState } from '@/utils/nativeGuiderIncidents';
import { useIncidentText } from './useIncidentText';

const props = defineProps({
  alert: { type: Object, required: true },
});
const emit = defineEmits(['replay']);

const store = useNativeGuiderStore();
const { k } = useIncidentText();

const state = computed(() =>
  alertIncidentState(props.alert, {
    incidents: store.incidents,
    recordingId: store.incidentRecordingId,
  })
);

function open() {
  store.openReplay(props.alert.incidentId);
  emit('replay', props.alert.incidentId);
}
</script>
