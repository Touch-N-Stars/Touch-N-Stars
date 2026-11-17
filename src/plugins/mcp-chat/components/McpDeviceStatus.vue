<template>
  <dl v-if="rows.length" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <div
      v-for="device in rows"
      :key="device.id"
      class="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-black/10 px-3 py-2"
    >
      <dt class="min-w-0 break-words text-sm">
        {{ device.labelKey ? t(device.labelKey) : device.name }}
      </dt>
      <dd
        class="flex shrink-0 items-center gap-1.5 text-xs"
        :class="
          device.connected === true
            ? 'text-emerald-400'
            : device.connected === false
              ? 'text-red-400'
              : 'text-slate-400'
        "
      >
        <component
          :is="
            device.connected === true
              ? CheckCircleIcon
              : device.connected === false
                ? XCircleIcon
                : QuestionMarkCircleIcon
          "
          class="h-5 w-5 shrink-0"
          aria-hidden="true"
        />
        {{
          device.connected === true
            ? t('components.rotator.connected')
            : device.connected === false
              ? t('components.rotator.disconnected')
              : t('components.guider.status.unknown')
        }}
      </dd>
    </div>
  </dl>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircleIcon, XCircleIcon, QuestionMarkCircleIcon } from '@heroicons/vue/24/outline';
import { deviceStatusRows } from '@/utils/mcpDeviceStatus';

const props = defineProps({ result: { type: Object, required: true } });
const { t } = useI18n();
const rows = computed(() => deviceStatusRows(props.result));
</script>
