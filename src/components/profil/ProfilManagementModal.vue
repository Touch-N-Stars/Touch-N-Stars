<template>
  <Modal :show="show" @close="$emit('close')" max-width="max-w-2xl">
    <template #header>
      <h2 class="text-xl font-bold">
        {{ $t('components.profile.manage') }}
      </h2>
    </template>

    <template #body>
      <div class="w-full flex flex-col gap-4">
        <!-- Profiles List -->
        <div class="p-4 bg-surface-2 rounded-card border border-line">
          <!-- Loading Spinner -->
          <div v-if="operationInProgress" class="flex justify-center py-8">
            <Spinner class="text-accent" />
          </div>

          <!-- Profiles -->
          <div v-else class="space-y-2">
            <div
              v-for="profile in profiles"
              :key="profile.Id"
              class="flex items-center gap-2 p-3 bg-surface-1 rounded-control border"
              :class="profile.IsActive ? 'border-accent' : 'border-line'"
            >
              <!-- Active badge -->
              <span
                v-if="profile.IsActive"
                class="text-xs bg-accent-action text-white px-2 py-0.5 rounded-chip shrink-0"
              >
                ✓
              </span>

              <!-- Rename input or profile name -->
              <template v-if="renamingProfile && renamingProfile.Id === profile.Id">
                <input
                  v-model="renameValue"
                  type="text"
                  class="tns-input flex-1"
                  :disabled="operationInProgress"
                  @keyup.enter="handleRenameConfirm"
                  @keyup.escape="cancelRename"
                  ref="renameInput"
                />
              </template>
              <span
                v-else
                class="flex-1 text-content truncate"
                :class="
                  !profile.IsActive && !operationInProgress && !anyDeviceConnected
                    ? 'cursor-pointer hover:text-accent transition-colors'
                    : ''
                "
                @click="
                  !profile.IsActive && !operationInProgress && !anyDeviceConnected
                    ? handleSwitch(profile)
                    : undefined
                "
                :title="
                  anyDeviceConnected
                    ? $t('components.profile.cannotSwitchConnected')
                    : !profile.IsActive
                      ? $t('components.profile.switchTo')
                      : ''
                "
                >{{ profile.Name }}</span
              >

              <!-- Action buttons -->
              <div class="flex gap-1 shrink-0">
                <!-- Rename confirm / cancel -->
                <template v-if="renamingProfile && renamingProfile.Id === profile.Id">
                  <button
                    @click="handleRenameConfirm"
                    class="tns-btn-secondary w-12"
                    :disabled="!canRename"
                    :title="$t('common.confirm')"
                  >
                    <CheckIcon class="w-5 h-5" />
                  </button>
                  <button
                    @click="cancelRename"
                    class="tns-btn-secondary w-12"
                    :title="$t('common.cancel')"
                  >
                    <XMarkIcon class="w-5 h-5" />
                  </button>
                </template>

                <!-- Rename + Clone + Remove buttons (normal state) -->
                <template v-else>
                  <!-- Rename button -->
                  <button
                    @click="startRename(profile)"
                    class="tns-btn-secondary w-12"
                    :disabled="operationInProgress"
                    :title="$t('components.profile.rename')"
                  >
                    <PencilIcon class="w-5 h-5" />
                  </button>

                  <!-- Clone button -->
                  <button
                    @click="handleClone(profile)"
                    class="tns-btn-secondary w-12"
                    :disabled="operationInProgress"
                    :title="$t('components.profile.clone')"
                  >
                    <DocumentDuplicateIcon class="w-5 h-5" />
                  </button>

                  <!-- Remove button -->
                  <button
                    @click="handleRemoveClick(profile)"
                    :disabled="profile.IsActive || profiles.length <= 1 || operationInProgress"
                    :class="[
                      'w-12!',
                      removeConfirmFor === profile.Id
                        ? 'tns-btn bg-status-danger text-white hover:brightness-110'
                        : profile.IsActive || profiles.length <= 1
                          ? 'tns-btn-secondary'
                          : 'tns-btn-danger',
                    ]"
                    :title="
                      profile.IsActive
                        ? $t('components.profile.cannotRemoveActive')
                        : profiles.length <= 1
                          ? $t('components.profile.cannotRemoveLast')
                          : $t('components.profile.remove')
                    "
                  >
                    <TrashIcon v-if="removeConfirmFor !== profile.Id" class="w-5 h-5" />
                    <CheckIcon v-else class="w-5 h-5" />
                  </button>
                </template>
              </div>
            </div>

            <div v-if="profiles.length === 0" class="text-center text-content-muted py-4">
              {{ $t('components.profile.noProfiles') }}
            </div>
          </div>
        </div>

        <!-- Add new profile button -->
        <button
          @click="handleAdd"
          class="tns-btn-primary w-full py-2 flex items-center justify-center gap-2"
          :disabled="operationInProgress"
        >
          <PlusIcon class="w-5 h-5" />
          {{ $t('components.profile.add') }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import {
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close', 'profile-changed']);

const store = apiStore();

const anyDeviceConnected = computed(
  () =>
    store.mountInfo.Connected ||
    store.cameraInfo.Connected ||
    store.filterInfo.Connected ||
    store.focuserInfo.Connected ||
    store.rotatorInfo.Connected ||
    store.guiderInfo.Connected ||
    store.weatherInfo.Connected ||
    store.safetyInfo.Connected ||
    store.flatdeviceInfo.Connected ||
    store.domeInfo.Connected ||
    store.switchInfo.Connected
);

const profiles = ref([]);
const renamingProfile = ref(null);
const renameValue = ref('');
const removeConfirmFor = ref(null);
const operationInProgress = ref(false);
const renameInput = ref(null);

const canRename = computed(() => {
  if (!renameValue.value.trim()) return false;
  if (renamingProfile.value && renameValue.value.trim() === renamingProfile.value.Name)
    return false;
  return !profiles.value.some(
    (p) => p.Name.toLowerCase() === renameValue.value.trim().toLowerCase()
  );
});

async function fetchProfiles() {
  try {
    const response = await apiService.profileAction('show');
    if (response && response.Response) {
      profiles.value = response.Response;
    }
  } catch (error) {
    console.error('Error loading profiles:', error);
  }
}

async function handleSwitch(profile) {
  if (operationInProgress.value) return;
  operationInProgress.value = true;
  try {
    await apiService.profileSwitch(profile.Id);
    await fetchProfiles();
    emit('profile-changed');
  } catch (error) {
    console.error('Error switching profile:', error);
  } finally {
    operationInProgress.value = false;
  }
}

async function handleAdd() {
  if (operationInProgress.value) return;
  operationInProgress.value = true;
  try {
    await apiService.profileAdd();
    await fetchProfiles();
    emit('profile-changed');
  } catch (error) {
    console.error('Error adding profile:', error);
  } finally {
    operationInProgress.value = false;
  }
}

async function handleClone(profile) {
  if (operationInProgress.value) return;
  operationInProgress.value = true;
  try {
    await apiService.profileClone(profile.Id);
    await fetchProfiles();
    emit('profile-changed');
  } catch (error) {
    console.error('Error cloning profile:', error);
  } finally {
    operationInProgress.value = false;
  }
}

function startRename(profile) {
  renamingProfile.value = profile;
  renameValue.value = profile.Name;
  removeConfirmFor.value = null;
  nextTick(() => {
    if (renameInput.value && renameInput.value.length > 0) {
      renameInput.value[0]?.focus();
      renameInput.value[0]?.select();
    }
  });
}

function cancelRename() {
  renamingProfile.value = null;
  renameValue.value = '';
}

async function handleRenameConfirm() {
  if (!canRename.value || operationInProgress.value || !renamingProfile.value) return;
  operationInProgress.value = true;
  const profile = renamingProfile.value;
  const name = renameValue.value.trim();
  try {
    if (!profile.IsActive) {
      await apiService.profileSwitch(profile.Id);
    }
    await apiService.profileChangeValue('Name', name);
    cancelRename();
    await fetchProfiles();
    emit('profile-changed');
  } catch (error) {
    console.error('Error renaming profile:', error);
  } finally {
    operationInProgress.value = false;
  }
}

function handleRemoveClick(profile) {
  if (profile.IsActive || profiles.value.length <= 1) return;

  if (removeConfirmFor.value === profile.Id) {
    handleRemove(profile);
  } else {
    removeConfirmFor.value = profile.Id;
    setTimeout(() => {
      if (removeConfirmFor.value === profile.Id) {
        removeConfirmFor.value = null;
      }
    }, 3000);
  }
}

async function handleRemove(profile) {
  operationInProgress.value = true;
  try {
    await apiService.profileRemove(profile.Id);
    removeConfirmFor.value = null;
    await fetchProfiles();
    emit('profile-changed');
  } catch (error) {
    console.error('Error removing profile:', error);
  } finally {
    operationInProgress.value = false;
  }
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      fetchProfiles();
    } else {
      renamingProfile.value = null;
      renameValue.value = '';
      removeConfirmFor.value = null;
    }
  }
);
</script>
