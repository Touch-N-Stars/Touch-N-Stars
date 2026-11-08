<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono truncate">
        {{ item.Script || $t('components.sequence.items.externalScript.notSet') }}
      </span>
    </template>

    <template #editor="{ save }">
      <div class="flex flex-col gap-1">
        <label class="tns-label">{{ $t('components.sequence.items.externalScript.script') }}</label>
        <!-- Full width instead of the usual seq-field-row: a script path with arguments is
             far longer than the 9-10rem the row layout leaves for an input. -->
        <div class="flex items-center gap-2">
          <TextInput
            :modelValue="item.Script ?? ''"
            :placeholder="$t('components.sequence.items.externalScript.placeholder')"
            inputClass="tns-input-compact min-w-0 font-mono"
            @change="save('Script', $event)"
          />
          <button
            class="shrink-0 p-1.5 rounded border border-line-strong bg-surface-3 text-content hover:bg-surface-2 transition-colors"
            :title="$t('components.sequence.items.externalScript.browse')"
            @click="showBrowser = true"
          >
            <FolderOpenIcon class="w-3.5 h-3.5" />
          </button>
        </div>
        <p class="text-xs text-content-faint">
          {{ $t('components.sequence.items.externalScript.hint') }}
        </p>
      </div>

      <FileBrowser
        v-model="showBrowser"
        :initial-path="splitCommand(item.Script).path"
        :title="$t('components.sequence.items.externalScript.browse')"
        mode="file"
        @select="onFileSelected($event, save)"
      />
    </template>
  </ItemShell>
</template>

<script setup>
import { ref } from 'vue';
import { FolderOpenIcon } from '@heroicons/vue/24/outline';
import ItemShell from './ItemShell.vue';
import TextInput from '@/components/helpers/TextInput.vue';
import FileBrowser from '@/components/helpers/fileBrowser.vue';

const props = defineProps({
  item: { type: Object, required: true },
});

const showBrowser = ref(false);

// NINA stores the whole command line in one string. Split off the executable (first token,
// optionally double-quoted) so the browser can open next to it and arguments survive picking
// a different script.
function splitCommand(command) {
  const match = String(command ?? '')
    .trim()
    .match(/^(?:"([^"]*)"|(\S+))\s*(.*)$/s);
  if (!match) return { path: '', args: '' };
  return { path: match[1] ?? match[2] ?? '', args: match[3] ?? '' };
}

function onFileSelected(selectedPath, save) {
  if (!selectedPath) return;
  const { args } = splitCommand(props.item.Script);
  const quoted = /\s/.test(selectedPath) ? `"${selectedPath}"` : selectedPath;
  save('Script', args ? `${quoted} ${args}` : quoted);
}
</script>
