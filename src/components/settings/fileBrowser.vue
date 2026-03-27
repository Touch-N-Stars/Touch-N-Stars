<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      @click.self="cancel"
    >
      <div
        class="bg-[#1a1f2e] border border-[#2e3650] rounded-[10px] w-full max-w-[480px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-3.5 border-b border-[#2e3650] shrink-0"
        >
          <span class="text-sm font-semibold text-slate-200 tracking-wide">Speicherort wählen</span>
          <button
            class="text-slate-500 text-sm px-2 py-1 rounded hover:text-slate-200 hover:bg-[#2e3650] transition-colors cursor-pointer bg-transparent border-none"
            @click="cancel"
          >
            ✕
          </button>
        </div>

        <!-- Device Tabs -->
        <div class="flex gap-2 px-4 py-3 border-b border-[#2e3650] shrink-0 overflow-x-auto">
          <button
            v-for="device in devices"
            :key="device.path"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs cursor-pointer whitespace-nowrap transition-all"
            :class="
              currentRoot === device.path
                ? 'bg-cyan-700 border-cyan-700 text-white'
                : 'bg-transparent border-[#2e3650] text-slate-400 hover:bg-[#2e3650] hover:text-slate-200'
            "
            @click="selectDevice(device)"
          >
            <span class="text-sm">{{ device.path === '/' ? '💾' : '🔌' }}</span>
            {{ device.name }}
          </button>
          <div v-if="devicesLoading" class="text-slate-500 text-xs self-center">Lade…</div>
        </div>

        <!-- Breadcrumb -->
        <div
          v-if="currentPath"
          class="flex items-center flex-wrap px-4 py-2 border-b border-[#2e3650] bg-[#151a27] shrink-0 min-h-8"
        >
          <button
            v-for="(crumb, i) in breadcrumbs"
            :key="crumb.path"
            class="flex items-center bg-transparent border-none text-[0.78rem] cursor-pointer px-1 py-0.5 rounded transition-colors"
            :class="
              i === breadcrumbs.length - 1
                ? 'text-slate-200 cursor-default pointer-events-none'
                : 'text-slate-500 hover:text-slate-400'
            "
            @click="navigateTo(crumb.path)"
          >
            <span v-if="i > 0" class="text-[#2e3650] mx-0.5 pointer-events-none">/</span>
            {{ crumb.label }}
          </button>
        </div>

        <!-- Directory List -->
        <div class="flex-1 overflow-y-auto min-h-[160px]">
          <div
            v-if="listLoading"
            class="flex items-center justify-center gap-2 min-h-[140px] text-slate-500 text-sm"
          >
            <span
              class="w-4 h-4 border-2 border-[#2e3650] border-t-cyan-700 rounded-full animate-spin shrink-0"
            ></span>
            <span>Lade Verzeichnisse…</span>
          </div>
          <div
            v-else-if="listError"
            class="flex items-center justify-center min-h-[140px] text-red-400 text-sm"
          >
            {{ listError }}
          </div>
          <div
            v-else-if="entries.length === 0"
            class="flex items-center justify-center min-h-[140px] text-slate-600 text-sm italic"
          >
            Keine Unterordner vorhanden
          </div>
          <ul v-else class="list-none m-0 py-1.5">
            <li
              v-for="entry in entries"
              :key="entry.path"
              class="flex items-center gap-2 px-4 py-2 cursor-pointer border-l-2 transition-all"
              :class="
                selectedPath === entry.path
                  ? 'bg-cyan-900/10 border-l-cyan-700'
                  : 'border-l-transparent hover:bg-[#1e2639]'
              "
              @click="selectEntry(entry)"
              @dblclick="navigateTo(entry.path)"
            >
              <span class="text-sm shrink-0">📁</span>
              <span class="flex-1 text-[0.85rem] text-slate-200 truncate">{{ entry.name }}</span>
              <span class="text-[0.7rem] text-slate-600 shrink-0">Doppelklick zum Öffnen</span>
            </li>
          </ul>
        </div>

        <!-- New Folder -->
        <div class="flex items-center gap-2 px-4 py-2 border-t border-[#2e3650] shrink-0">
          <input
            v-if="creatingFolder"
            ref="folderInput"
            v-model="newFolderName"
            class="flex-1 bg-[#0f1420] border border-[#2e3650] focus:border-cyan-700 rounded-md text-slate-200 text-xs px-2.5 py-1.5 outline-none transition-colors"
            placeholder="Ordnername…"
            @keydown.enter="confirmNewFolder"
            @keydown.escape="cancelNewFolder"
          />
          <button
            v-if="!creatingFolder"
            class="px-3 py-1.5 rounded-md border border-[#2e3650] bg-transparent text-slate-400 text-xs cursor-pointer hover:bg-[#2e3650] hover:text-slate-200 transition-all"
            @click="startNewFolder"
          >
            + Neuer Ordner
          </button>
          <template v-else>
            <button
              class="px-3 py-1.5 rounded-md border border-[#2e3650] bg-transparent text-slate-400 text-xs cursor-pointer hover:bg-[#2e3650] hover:text-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!newFolderName.trim()"
              @click="confirmNewFolder"
            >
              Erstellen
            </button>
            <button
              class="px-3 py-1.5 rounded-md border border-[#2e3650] bg-transparent text-slate-400 text-xs cursor-pointer hover:bg-[#2e3650] hover:text-slate-200 transition-all"
              @click="cancelNewFolder"
            >
              Abbrechen
            </button>
          </template>
        </div>

        <!-- Selected Path Preview -->
        <div
          class="flex items-center gap-2 px-4 py-2 bg-[#0f1420] border-t border-[#2e3650] shrink-0 min-h-9"
        >
          <span class="text-xs text-slate-600 whitespace-nowrap shrink-0">Gewählter Pfad:</span>
          <span class="text-[0.78rem] text-slate-400 font-mono truncate">{{
            selectedPath || '—'
          }}</span>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-[#2e3650] shrink-0">
          <button
            class="px-3.5 py-1.5 rounded-md border border-[#2e3650] bg-transparent text-slate-400 text-xs cursor-pointer hover:bg-[#2e3650] hover:text-slate-200 transition-all"
            @click="cancel"
          >
            Abbrechen
          </button>
          <button
            class="px-3.5 py-1.5 rounded-md border border-transparent bg-cyan-700 text-white font-medium text-xs cursor-pointer hover:bg-cyan-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!selectedPath"
            @click="confirm"
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import apiService from '@/services/apiService';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  initialPath: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue', 'select']);

// ─── State ───────────────────────────────────────────────────────────────────

const isOpen = computed(() => props.modelValue);

const devices = ref([]);
const devicesLoading = ref(false);

const currentRoot = ref('');
const currentPath = ref('');
const selectedPath = ref('');

const entries = ref([]);
const listLoading = ref(false);
const listError = ref('');

const creatingFolder = ref(false);
const newFolderName = ref('');
const folderInput = ref(null);

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

const breadcrumbs = computed(() => {
  if (!currentPath.value || !currentRoot.value) return [];

  const root = currentRoot.value;
  const path = currentPath.value;

  const crumbs = [{ label: root === '/' ? '/' : root.split('/').pop(), path: root }];

  const relative = path.slice(root.length).replace(/^\//, '');
  if (relative) {
    const parts = relative.split('/').filter(Boolean);
    let accumulated = root;
    for (const part of parts) {
      accumulated = accumulated.replace(/\/$/, '') + '/' + part;
      crumbs.push({ label: part, path: accumulated });
    }
  }

  return crumbs;
});

// ─── Watchers ────────────────────────────────────────────────────────────────

watch(isOpen, async (val) => {
  if (val) {
    await loadDevices();
    if (props.initialPath) {
      selectedPath.value = props.initialPath;
    }
  }
});

// ─── API Calls ───────────────────────────────────────────────────────────────

async function loadDevices() {
  devicesLoading.value = true;
  try {
    const result = await apiService.getFileDevices();
    devices.value = result || [];
    if (devices.value.length > 0) {
      await selectDevice(devices.value[0]);
    }
  } catch (e) {
    console.error('FileBrowser: could not load devices', e);
  } finally {
    devicesLoading.value = false;
  }
}

async function selectDevice(device) {
  currentRoot.value = device.path;
  await navigateTo(device.path);
}

async function navigateTo(path) {
  currentPath.value = path;
  selectedPath.value = path;
  listError.value = '';
  listLoading.value = true;
  entries.value = [];
  try {
    const result = await apiService.listFileDirectories(path);
    entries.value = result || [];
  } catch (e) {
    listError.value = 'Fehler beim Laden des Verzeichnisses.';
  } finally {
    listLoading.value = false;
  }
}

function selectEntry(entry) {
  selectedPath.value = entry.path;
}

// ─── New Folder ───────────────────────────────────────────────────────────────

function startNewFolder() {
  creatingFolder.value = true;
  newFolderName.value = '';
  nextTick(() => folderInput.value?.focus());
}

async function confirmNewFolder() {
  const name = newFolderName.value.trim();
  if (!name || !currentPath.value) return;
  try {
    const created = await apiService.createFileDirectory(currentPath.value, name);
    await navigateTo(currentPath.value);
    selectedPath.value = created.path;
  } catch (e) {
    console.error('FileBrowser: could not create folder', e);
  } finally {
    creatingFolder.value = false;
    newFolderName.value = '';
  }
}

function cancelNewFolder() {
  creatingFolder.value = false;
  newFolderName.value = '';
}

// ─── Dialog Actions ──────────────────────────────────────────────────────────

function confirm() {
  emit('select', selectedPath.value);
  emit('update:modelValue', false);
}

function cancel() {
  emit('update:modelValue', false);
}
</script>
