<template>
  <div class="flex flex-col gap-2">
    <!-- Input Row -->
    <div class="flex items-center gap-2">
      <input
        v-model="path"
        type="text"
        readonly
        placeholder="Kein Pfad gewählt"
        class="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
      />

      <button
        @click="showBrowser = true"
        class="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-sm text-gray-200 transition-colors"
        title="Pfad auswählen"
      >
        …
      </button>

      <button
        @click="savePath"
        :disabled="!path || saving"
        class="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm text-white transition-colors"
      >
        <span v-if="saving">…</span>
        <span v-else>Speichern</span>
      </button>
    </div>

    <!-- Status feedback -->
    <p v-if="statusMsg" class="text-xs" :class="statusOk ? 'text-green-400' : 'text-red-400'">
      {{ statusMsg }}
    </p>

    <!-- FileBrowser Dialog -->
    <FileBrowser v-model="showBrowser" :initial-path="path" @select="onPathSelected" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import FileBrowser from './fileBrowser.vue';

const store = apiStore();
const toast = useToastStore();

const path = ref('');
const showBrowser = ref(false);
const saving = ref(false);
const statusMsg = ref('');
const statusOk = ref(true);

onMounted(() => {
  path.value = store.imageSavePath || '';
});

// Called when user confirms a path in the FileBrowser
function onPathSelected(selectedPath) {
  path.value = selectedPath;
  statusMsg.value = '';
}

// Save path via NINA profile API
async function savePath() {
  if (!path.value) return;

  saving.value = true;
  statusMsg.value = '';

  try {
    await store.setImageSavePath(path.value);

    statusOk.value = true;
    statusMsg.value = `✓ Pfad gespeichert: ${path.value}`;

    toast.showToast({
      type: 'success',
      title: 'Pfad gespeichert',
      message: path.value,
    });
  } catch (e) {
    statusOk.value = false;
    statusMsg.value = 'Fehler beim Speichern des Pfads.';

    toast.showToast({
      type: 'error',
      title: 'Fehler',
      message: 'Pfad konnte nicht gespeichert werden.',
      autoClose: false,
    });
  } finally {
    saving.value = false;
  }
}
</script>
