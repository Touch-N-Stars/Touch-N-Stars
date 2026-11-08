<template>
  <Modal :show="show" @close="$emit('close')" max-width="max-w-2xl">
    <template #header>
      <h2 class="text-xl font-bold text-accent">
        {{ $t('components.guider.phd2.profileManagement.title') }}
      </h2>
    </template>

    <template #body>
      <div class="w-full flex flex-col gap-4">
        <!-- Create New Profile Section -->
        <div class="p-4 bg-surface-2 rounded-control border border-line">
          <h3 class="text-sm font-semibold text-content mb-3">
            {{ $t('components.guider.phd2.profileManagement.createNew') }}
          </h3>
          <div class="flex gap-2">
            <input
              v-model="newProfileName"
              type="text"
              :placeholder="$t('components.guider.phd2.profileManagement.profileNamePlaceholder')"
              class="tns-input flex-1"
              :disabled="operationInProgress"
              @keyup.enter="handleCreate"
            />
            <button
              @click="handleCreate"
              class="tns-btn-primary px-4 max-w-28"
              :disabled="!canCreate || operationInProgress"
            >
              {{ $t('components.guider.phd2.profileManagement.create') }}
            </button>
          </div>
          <p v-if="newProfileNameError" class="text-xs text-status-danger mt-2">
            {{ newProfileNameError }}
          </p>
        </div>

        <!-- Profiles List -->
        <div class="p-4 bg-surface-2 rounded-control border border-line">
          <h3 class="text-sm font-semibold text-content mb-3">
            {{ $t('components.guider.phd2.profileManagement.profilesList') }}
          </h3>

          <!-- Loading Spinner -->
          <div v-if="operationInProgress" class="flex justify-center py-8 text-accent">
            <Spinner />
          </div>

          <!-- Profiles -->
          <div v-else class="space-y-2">
            <div
              v-for="(profile, index) in profiles"
              :key="profile"
              class="flex items-center gap-2 p-3 bg-surface-1 rounded-control border border-line"
            >
              <!-- Profile Name (editable if editing) -->
              <input
                v-if="editingProfileName === profile"
                v-model="renameValue"
                type="text"
                class="tns-input flex-1"
                @keyup.enter="handleRename(profile)"
                @keyup.escape="cancelEdit"
                ref="renameInput"
              />
              <span v-else class="flex-1 text-content">
                {{ profile }}
              </span>

              <!-- Action Buttons -->
              <div class="flex gap-1">
                <!-- Rename Button / Confirm -->
                <button
                  v-if="editingProfileName === profile"
                  @click="handleRename(profile, index)"
                  class="tns-btn-secondary w-12"
                  :disabled="!canRename"
                  :title="$t('common.confirm')"
                >
                  <CheckIcon class="w-5 h-5" />
                </button>
                <button
                  v-else
                  @click="startEdit(profile)"
                  class="tns-btn-secondary w-12"
                  :title="$t('components.guider.phd2.profileManagement.rename')"
                >
                  <PencilIcon class="w-5 h-5" />
                </button>

                <!-- Cancel Edit Button -->
                <button
                  v-if="editingProfileName === profile"
                  @click="cancelEdit"
                  class="tns-btn-secondary w-12"
                  :title="$t('components.guider.phd2.profileManagement.cancel')"
                >
                  <XMarkIcon class="w-5 h-5" />
                </button>

                <!-- Delete Button -->
                <button
                  v-if="editingProfileName !== profile"
                  @click="handleDeleteClick(profile)"
                  :disabled="profiles.length <= 1"
                  :class="[
                    'w-12',
                    deleteConfirmFor === profile
                      ? 'tns-btn-danger bg-status-danger/25!'
                      : profiles.length <= 1
                        ? 'tns-btn-secondary'
                        : 'tns-btn-danger',
                  ]"
                >
                  <TrashIcon v-if="deleteConfirmFor !== profile" class="w-5 h-5" />
                  <CheckIcon v-else class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- No profiles message -->
            <div v-if="profiles.length === 0" class="text-center text-content-muted py-4">
              No profiles available
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useGuiderStore } from '@/store/guiderStore';
import Modal from '@/components/helpers/Modal.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import { PencilIcon, TrashIcon, XMarkIcon, CheckIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
});

defineEmits(['close']);

const guiderStore = useGuiderStore();

// Local state
const newProfileName = ref('');
const editingProfileName = ref(null);
const renameValue = ref('');
const operationInProgress = ref(false);
const statusMessage = ref(null);
const deleteConfirmFor = ref(null);
const renameInput = ref(null);

// Computed
const profiles = computed(() => guiderStore.phd2EquipmentProfiles);

const newProfileNameError = computed(() => {
  if (!newProfileName.value) return null;
  if (profiles.value.includes(newProfileName.value)) {
    return 'Profile name already exists';
  }
  return null;
});

const canCreate = computed(() => {
  return newProfileName.value.trim() !== '' && !newProfileNameError.value;
});

const canRename = computed(() => {
  if (!renameValue.value.trim()) return false;
  if (renameValue.value === editingProfileName.value) return false;
  if (profiles.value.includes(renameValue.value)) return false;
  return true;
});

// Watch for edit mode to focus input
watch(editingProfileName, async (newVal) => {
  if (newVal) {
    await nextTick();
    if (renameInput.value && renameInput.value.length > 0) {
      renameInput.value[0]?.focus();
      renameInput.value[0]?.select();
    }
  }
});

// Reset delete confirmation when switching profiles
watch(
  () => props.show,
  (newVal) => {
    if (!newVal) {
      deleteConfirmFor.value = null;
      editingProfileName.value = null;
      statusMessage.value = null;
    }
  }
);

// Methods
function showStatus(type, messageKey) {
  statusMessage.value = {
    type,
    text: messageKey,
  };

  if (type === 'success') {
    setTimeout(() => {
      statusMessage.value = null;
    }, 3000);
  }
}

async function handleCreate() {
  if (!canCreate.value || operationInProgress.value) return;

  operationInProgress.value = true;
  try {
    await guiderStore.createPHD2Profile(newProfileName.value);
    showStatus('success', 'Profile created successfully');
    newProfileName.value = '';
  } catch (error) {
    showStatus('error', error.message || 'Failed to create profile');
  } finally {
    operationInProgress.value = false;
  }
}

function startEdit(profile) {
  editingProfileName.value = profile;
  renameValue.value = profile;
  deleteConfirmFor.value = null;
}

function cancelEdit() {
  editingProfileName.value = null;
  renameValue.value = '';
}

async function handleRename(oldName, index) {
  if (!canRename.value || operationInProgress.value) return;

  operationInProgress.value = true;
  try {
    console.log('Renaming profile', index);
    await guiderStore.renamePHD2Profile(renameValue.value, index + 1);
    showStatus('success', 'Profile renamed successfully');
    editingProfileName.value = null;
    renameValue.value = '';
  } catch (error) {
    showStatus('error', error.message || 'Failed to rename profile');
  } finally {
    operationInProgress.value = false;
  }
}

function handleDeleteClick(profile) {
  console.log('Delete clicked for profile', profile);
  if (profiles.value.length <= 1) {
    showStatus('error', 'Cannot delete the last profile');
    return;
  }

  if (deleteConfirmFor.value === profile) {
    handleDelete(profile);
  } else {
    deleteConfirmFor.value = profile;
    setTimeout(() => {
      if (deleteConfirmFor.value === profile) {
        deleteConfirmFor.value = null;
      }
    }, 3000);
  }
}

async function handleDelete(profile) {
  operationInProgress.value = true;
  try {
    await guiderStore.deletePHD2Profile(profile);
    showStatus('success', 'Profile deleted successfully');
    deleteConfirmFor.value = null;
  } catch (error) {
    showStatus('error', error.message || 'Failed to delete profile');
  } finally {
    operationInProgress.value = false;
  }
}
</script>
