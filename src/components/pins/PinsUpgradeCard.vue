<template>
  <div class="tns-card relative overflow-hidden">
    <div class="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
      <div class="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
        <div class="flex flex-col items-center sm:items-start gap-2 w-full sm:w-auto">
          <div
            class="px-5 py-2 rounded-full font-bold text-sm border w-full sm:w-auto text-center"
            :class="{
              'bg-surface-3 border-line-strong text-content-muted': status === 'Idle',
              'bg-accent/10 border-accent/40 text-accent animate-pulse': status === 'Running',
              'bg-status-ok/10 border-status-ok/40 text-status-ok': status === 'Success',
              'bg-status-danger/10 border-status-danger/40 text-status-danger': status === 'Failed',
            }"
          >
            <span
              v-if="status === 'Running'"
              class="inline-block w-2 h-2 rounded-full bg-accent mr-2 animate-ping"
            ></span>
            {{ $t('plugins.pins.status.' + status.toLowerCase()) }}
          </div>
          <p
            v-if="status === 'Failed' && upgradeExitCode !== null"
            class="text-xs text-status-danger"
          >
            {{ $t('plugins.pins.logs.upgradeFailed', { exitCode: upgradeExitCode }) }}
          </p>
        </div>
      </div>

      <button
        @click="$emit('start-upgrade')"
        :disabled="status === 'Running'"
        class="tns-btn-primary md:w-auto! px-8"
      >
        <Spinner v-if="status === 'Running'" size="sm" />
        <span>
          {{
            status === 'Running' && activeOperation === 'upgrade'
              ? $t('plugins.pins.upgrading')
              : $t('plugins.pins.startUpgrade')
          }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import Spinner from '@/components/helpers/Spinner.vue';

defineProps({
  status: {
    type: String,
    required: true,
  },
  activeOperation: {
    type: String,
    default: null,
  },
  upgradeExitCode: {
    type: [Number, String],
    default: null,
  },
});

defineEmits(['start-upgrade']);
</script>
