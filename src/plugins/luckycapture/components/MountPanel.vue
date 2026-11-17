<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import MoveAxis from '@/components/mount/moveAxis.vue';

defineProps({ visible: Boolean });
const emit = defineEmits(['update:open']);
const store = apiStore();
const { t } = useI18n();
const open = ref(false);
const connected = computed(() => Boolean(store.mountInfo?.Connected));
</script>

<template>
  <details
    class="mount-panel"
    @toggle="
      open = $event.target.open;
      emit('update:open', open);
    "
  >
    <summary>{{ t('luckycapture.mountControls') }}</summary>
    <template v-if="open && visible">
      <p v-if="!connected" role="status">{{ t('luckycapture.mountDisconnected') }}</p>
      <template v-else>
        <p class="mount-name">{{ store.mountInfo.Name }}</p>
        <MoveAxis compact />
        <p>{{ t('luckycapture.mountHelp') }}</p>
      </template>
    </template>
  </details>
</template>

<style scoped>
.mount-panel {
  border: 1px solid var(--lc-border, #69758a);
  border-radius: 14px;
  padding: 10px;
  margin: 12px 0;
  min-width: 0;
}
summary {
  cursor: pointer;
  min-height: 44px;
  align-content: center;
  font-weight: 600;
}
summary:focus-visible {
  outline: 3px solid #22d3ee;
  outline-offset: 2px;
}
p {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--lc-muted, #b8c5d8);
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.mount-name {
  font-weight: 600;
}
</style>
