<template>
  <div class="space-y-6">
    <!-- Instance Detection Section -->
    <div class="tns-card">
      <h3 class="text-lg font-semibold text-white mb-4">NINA Instance Discovery</h3>
      <InstanceDetection v-model="tempInstance" :hide-manual-config="true" />
    </div>

    <!-- Add/Edit Instance Form -->
    <div class="tns-card">
      <h3 class="text-lg font-semibold text-white mb-4">
        {{ editingInstance ? 'Edit Instance' : 'Add New Instance' }}
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-content mb-2">Instance Name</label>
          <input
            v-model="tempInstance.name"
            type="text"
            class="tns-select"
            placeholder="My NINA Instance"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-content mb-2">IP Address / FQDN</label>
          <input
            v-model="tempInstance.ip"
            type="text"
            class="tns-select"
            placeholder="192.168.1.100"
          />
        </div>

        <div>
          <NumberInputPicker
            v-model="tempInstance.port"
            :label="`Port`"
            :min="1"
            :max="65535"
            :step="1"
            :decimalPlaces="0"
            placeholder="5000"
            inputId="port"
            wrapperClass="w-full"
            labelPosition="top"
          />
        </div>
      </div>

      <!-- Error Message -->
      <div
        v-if="emptyFieldsError"
        class="mb-4 p-3 bg-status-danger/10 border border-status-danger/40 rounded-md"
      >
        <div class="flex items-center text-status-danger text-sm">
          <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          {{ $t('components.settings.errors.emptyFields') }}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3">
        <button @click="saveInstance" class="tns-btn-primary">
          {{ editingInstance ? $t('components.settings.update') : $t('components.settings.add') }}
        </button>

        <button v-if="editingInstance" @click="cancelEdit" class="tns-btn-secondary">Cancel</button>
      </div>
    </div>

    <!-- Instance List -->
    <div class="tns-card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-white">
          Configured Instances
          <span class="text-sm text-content-muted font-normal ml-2">({{ instances.length }})</span>
        </h3>
      </div>

      <!-- Empty State -->
      <div v-if="instances.length === 0" class="text-center py-8">
        <svg
          class="mx-auto h-12 w-12 text-content-faint mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p class="text-content-muted text-sm">No instances configured yet</p>
        <p class="text-content-faint text-xs mt-1">Use the detection above or add manually</p>
      </div>

      <!-- Instance Cards -->
      <div v-else class="space-y-3">
        <div
          v-for="(instance, index) in instances"
          :key="instance.id"
          class="relative p-4 rounded-lg border transition-all duration-200 hover:shadow-md"
          :class="[
            settingsStore.getInstanceColorByIndex(index),
            selectedInstance === instance.id
              ? 'ring-2 ring-accent border-accent/50'
              : 'border-line-strong hover:border-line-strong',
          ]"
        >
          <!-- Selected Badge -->
          <div
            v-if="selectedInstance === instance.id"
            class="absolute -top-2 -right-2 bg-accent-action text-white text-xs px-2 py-1 rounded-full font-medium"
          >
            Active
          </div>

          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center mb-2">
                <h4 class="font-medium text-white text-lg">{{ instance.name }}</h4>
                <div
                  v-if="selectedInstance === instance.id"
                  class="ml-2 w-2 h-2 bg-status-ok rounded-full"
                  title="Currently selected"
                ></div>
              </div>
              <div class="flex items-center text-content-muted text-sm">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"
                  />
                </svg>
                {{ instance.ip }}:{{ instance.port }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1 ml-4">
              <button
                @click="selectInstance(instance)"
                :class="[
                  'p-2 rounded-md transition-colors',
                  selectedInstance === instance.id
                    ? 'text-status-ok bg-status-ok/15'
                    : 'text-content-muted hover:text-status-ok hover:bg-status-ok/10',
                ]"
                :title="selectedInstance === instance.id ? 'Currently Active' : 'Set as Active'"
              >
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <button
                @click="editInstance(instance.id)"
                class="p-2 text-content-muted hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
                title="Edit Instance"
              >
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                  />
                </svg>
              </button>

              <button
                @click="removeInstance(instance.id)"
                class="p-2 text-content-muted hover:text-status-danger hover:bg-status-danger/10 rounded-md transition-colors"
                title="Delete Instance"
              >
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';
import InstanceDetection from '../../setup/InstanceDetection.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const settingsStore = useSettingsStore();
const instances = computed(() => settingsStore.connection.instances);
const editingInstance = ref(null);
const selectedInstance = ref(settingsStore.selectedInstanceId);
const emptyFieldsError = ref(false);
const tempInstance = ref({
  name: 'My NINA',
  ip: '',
  port: 5000,
});
const instanceError = ref(null);

function saveInstance() {
  // Clear errors before validation
  emptyFieldsError.value = false;
  instanceError.value = null;

  // Validate fields
  if (!tempInstance.value.name || !tempInstance.value.ip || !tempInstance.value.port) {
    emptyFieldsError.value = true;
    return;
  }

  // Save instance
  if (editingInstance.value) {
    settingsStore.updateInstance(editingInstance.value, tempInstance.value);
  } else {
    settingsStore.addInstance({
      id: Date.now().toString(),
      ...tempInstance.value,
    });
  }

  // Clear form after successful save
  clearForm();
}

function editInstance(id) {
  const instance = instances.value.find((i) => i.id === id);
  if (instance) {
    tempInstance.value = { ...instance };
    editingInstance.value = id;
  }
}

function cancelEdit() {
  clearForm();
}

function clearForm() {
  editingInstance.value = null;
  emptyFieldsError.value = false;
  tempInstance.value = {
    name: 'My NINA',
    ip: '',
    port: 5000,
  };
}

function selectInstance(instance) {
  selectedInstance.value = instance.id;
  settingsStore.setSelectedInstanceId(instance.id);
}

function removeInstance(id) {
  settingsStore.removeInstance(id);
}
</script>
