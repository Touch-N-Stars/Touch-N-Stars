<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted truncate">{{ selectedProfileName }}</span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.switchProfile.profile')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="item.SelectedProfileId"
          @change="save('SelectedProfileId', $event.target.value)"
        >
          <option v-for="p in profiles" :key="p.Id" :value="p.Id">{{ p.Name }}</option>
        </select>
      </div>

      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.switchProfile.reconnect')
        }}</label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.Reconnect"
            @update:statusValue="save('Reconnect', $event)"
          />
        </div>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import ItemShell from './ItemShell.vue';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import apiService from '@/services/apiService';

const props = defineProps({
  item: { type: Object, required: true },
});

const profiles = ref([]);

const selectedProfileName = computed(() => {
  const p = profiles.value.find((p) => p.Id === props.item.SelectedProfileId);
  return p?.Name ?? props.item.SelectedProfileId;
});

onMounted(async () => {
  try {
    const response = await apiService.profileAction('show');
    if (response?.Response) profiles.value = response.Response;
  } catch {
    // ignore
  }
});
</script>
