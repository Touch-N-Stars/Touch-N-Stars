<template>
  <div class="flex flex-col gap-4">
    <SegmentTabs v-model="activeTab" :tabs="tabs" />

    <!-- Each sub-tab mounts only while active, so the inspector's status polling stops elsewhere -->
    <HfInspectorView v-if="activeTab === 'aberration'" />
    <AberrationInspectorOptions v-else-if="activeTab === 'aberrationOptions'" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SegmentTabs from '@/components/helpers/SegmentTabs.vue';
import HfInspectorView from './HfInspectorView.vue';
import AberrationInspectorOptions from './AberrationInspectorOptions.vue';

const { t } = useI18n();
const activeTab = ref('aberration');

const tabs = computed(() =>
  ['aberration', 'aberrationOptions'].map((value) => ({
    value,
    label: t(`components.focuser.hocus.tabs.${value}`),
  }))
);
</script>
