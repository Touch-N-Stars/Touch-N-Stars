<template>
  <div class="flex flex-col gap-3">
    <!-- Collapsed: Pattern string + Preview -->
    <template v-if="!localShowTokens">
      <div class="flex flex-col gap-1">
        <label class="text-xs text-content-muted">{{
          $t('components.settings.imageFile.preview')
        }}</label>
        <div
          class="bg-ground/50 border border-line rounded-lg px-3 py-2 font-mono text-xs text-accent break-all"
        >
          {{ previewResult || '—' }}
        </div>
      </div>
    </template>

    <!-- Expanded: Chips + Token buttons -->
    <template v-else>
      <!-- Pattern Chips -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-1">
          <label class="text-xs text-content-muted">{{
            $t('components.settings.imageFile.pattern')
          }}</label>
          <button @click="showHelp = true" class="text-accent hover:text-content p-1">
            <InformationCircleIcon class="w-5 h-5" />
          </button>
        </div>
        <div
          class="flex flex-wrap items-center bg-ground/50 border border-line rounded-lg px-1 py-2 min-h-[40px]"
        >
          <template v-if="patternSegments.length === 0">
            <button
              @click="setInsertPos(0)"
              class="cursor-insert"
              :class="{ 'cursor-active': insertPos === 0 }"
            />
          </template>
          <template v-else>
            <template v-for="(segment, index) in patternSegments" :key="index">
              <button
                @click="setInsertPos(index)"
                class="cursor-insert"
                :class="{ 'cursor-active': insertPos === index }"
              />
              <div
                class="flex items-center rounded text-xs font-mono"
                :class="segmentClass(segment)"
              >
                <span class="px-1.5 py-0.5">{{ segmentLabel(segment) }}</span>
                <button
                  @click="removeSegment(index)"
                  class="px-1 py-0.5 hover:text-status-danger transition-colors opacity-60 hover:opacity-100"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3 w-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </template>
            <button
              @click="setInsertPos(patternSegments.length)"
              class="cursor-insert"
              :class="{ 'cursor-active': insertPos === patternSegments.length }"
            />
          </template>
        </div>
      </div>

      <!-- Preview -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-content-muted">{{
          $t('components.settings.imageFile.preview')
        }}</label>
        <div
          class="bg-ground/50 border border-line rounded-lg px-3 py-2 font-mono text-xs text-accent break-all"
        >
          {{ previewResult || '—' }}
        </div>
      </div>
    </template>

    <!-- Toggle edit -->
    <button
      @click="toggleShowTokens"
      class="flex items-center justify-between w-full text-xs text-content-muted hover:text-content transition-colors"
    >
      <span>{{ $t('components.settings.imageFile.editTokens') }}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 transition-transform"
        :class="{ 'rotate-180': localShowTokens }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="localShowTokens" class="flex flex-col gap-2">
      <div v-for="group in tokenGroups" :key="group.label" class="flex flex-col gap-1">
        <label class="text-xs text-content-faint">{{ $t(group.label) }}</label>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="token in group.tokens"
            :key="token.key"
            @click="addSegment(token.key)"
            class="px-2 py-1 text-xs rounded bg-surface-3 hover:bg-surface-2 text-content border border-line transition-colors"
          >
            {{ token.display }}
          </button>
        </div>
      </div>

      <!-- Separator buttons -->
      <div class="flex flex-wrap gap-1 mt-1">
        <button
          @click="addSegment('/')"
          class="px-3 py-1 text-xs rounded bg-status-warn/15 hover:bg-status-warn/15 text-status-warn border border-amber-700/50 transition-colors font-mono"
        >
          \ {{ $t('components.settings.imageFile.folder') }}
        </button>
        <button
          @click="addSegment('_')"
          class="px-3 py-1 text-xs rounded bg-status-warn/15 hover:bg-status-warn/15 text-status-warn border border-amber-700/50 transition-colors font-mono"
        >
          _ {{ $t('components.settings.imageFile.separator') }}
        </button>
        <button
          @click="addSegment('-')"
          class="px-3 py-1 text-xs rounded bg-status-warn/15 hover:bg-status-warn/15 text-status-warn border border-amber-700/50 transition-colors font-mono"
        >
          - {{ $t('components.settings.imageFile.separator') }}
        </button>
      </div>

      <!-- Free Text Input -->
      <div class="flex flex-col gap-1 mt-2">
        <label class="text-xs text-content-faint">{{
          $t('components.settings.imageFile.freeText') || 'Free Text'
        }}</label>
        <div class="flex gap-1">
          <input
            v-model="freeTextInput"
            type="text"
            @keyup.enter="addFreeText"
            placeholder="Enter text..."
            class="flex-1 px-2 py-1 text-xs rounded bg-surface-2 border border-line text-content placeholder:text-content-faint focus:outline-none focus:border-line-strong"
          />
          <button
            @click="addFreeText"
            :disabled="!freeTextInput.trim()"
            class="px-3 py-1 text-xs rounded bg-accent/15 hover:bg-accent/25 disabled:bg-surface-2 disabled:text-content-faint text-accent border border-accent/40 disabled:border-line transition-colors"
          >
            {{ $t('components.settings.imageFile.addText') || 'Add' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Help Modal -->
    <Modal :show="showHelp" zIndex="z-top" maxWidth="max-w-xl" @close="showHelp = false">
      <template #header>
        <h2 class="text-xl font-bold">
          {{ $t('components.settings.imageFile.help.title') }}
        </h2>
      </template>
      <template #body>
        <div class="space-y-3 text-sm text-content">
          <p>{{ $t('components.settings.imageFile.help.intro') }}</p>

          <div>
            <h3 class="text-accent font-semibold mb-1">
              {{ $t('components.settings.imageFile.help.tokensTitle') }}
            </h3>
            <p>{{ $t('components.settings.imageFile.help.tokensDesc') }}</p>
          </div>

          <div>
            <h3 class="text-status-warn font-semibold mb-1">
              {{ $t('components.settings.imageFile.help.separatorsTitle') }}
            </h3>
            <p>{{ $t('components.settings.imageFile.help.separatorsDesc') }}</p>
          </div>

          <div>
            <h3 class="text-accent font-semibold mb-1">
              {{ $t('components.settings.imageFile.help.cursorTitle') }}
            </h3>
            <p>{{ $t('components.settings.imageFile.help.cursorDesc') }}</p>
          </div>

          <div>
            <h3 class="text-accent font-semibold mb-1">
              {{ $t('components.settings.imageFile.help.exampleTitle') }}
            </h3>
            <code class="block bg-ground rounded px-3 py-2 text-xs text-accent break-all">
              $$DATEMINUS12$$\$$IMAGETYPE$$\$$DATETIME$$_$$FILTER$$_$$EXPOSURETIME$$s
            </code>
            <p class="mt-1 text-xs text-content-muted">
              {{ $t('components.settings.imageFile.help.exampleResult') }}
            </p>
            <code class="block bg-ground rounded px-3 py-1 text-xs text-content break-all">
              2024-01-15\LIGHT\2024-01-15_21-30-00_Ha_300s
            </code>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { InformationCircleIcon } from '@heroicons/vue/24/outline';
import {
  defaultPattern,
  allTokenKeys,
  tokenDisplayNames,
  tokenGroups,
  exampleValues,
} from './patternConstants.js';
import Modal from '@/components/helpers/Modal.vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  showTokens: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'update:showTokens']);

const localShowTokens = ref(props.showTokens);
const showHelp = ref(false);
const insertPos = ref(null);
const freeTextInput = ref('');
const patternSegments = ref([]);

function toggleShowTokens() {
  localShowTokens.value = !localShowTokens.value;
  emit('update:showTokens', localShowTokens.value);
}

/**
 * Parse a pattern string into segments.
 */
function parsePattern(patternString) {
  const segments = [];
  if (!patternString) return segments;

  const tokenPattern = /(\$\$[A-Z]+\$\$)/;
  const parts = patternString.split(tokenPattern).filter((p) => p !== '');

  for (const part of parts) {
    if (allTokenKeys.includes(part)) {
      segments.push(part);
    } else {
      let buffer = '';
      for (const char of part) {
        if (char === '\\' || char === '/' || char === '_' || char === '-') {
          if (buffer) {
            segments.push(buffer);
            buffer = '';
          }
          segments.push(char);
        } else {
          buffer += char;
        }
      }
      if (buffer) {
        segments.push(buffer);
      }
    }
  }

  return segments;
}

function buildPattern() {
  return patternSegments.value.join('');
}

function isToken(segment) {
  return allTokenKeys.includes(segment);
}

function isSeparator(segment) {
  return segment === '\\' || segment === '/' || segment === '_' || segment === '-';
}

function segmentLabel(segment) {
  if (isToken(segment)) return tokenDisplayNames[segment] || segment;
  if (segment === '/' || segment === '\\') return '\\';
  return segment;
}

function segmentClass(segment) {
  if (isToken(segment)) {
    return 'bg-accent/15 text-accent border border-accent/40';
  }
  if (isSeparator(segment)) {
    return 'bg-status-warn/15 text-status-warn border border-amber-700/50';
  }
  return 'bg-surface-2 text-content border border-line';
}

function setInsertPos(index) {
  insertPos.value = index;
}

function addSegment(segment) {
  if (insertPos.value !== null && insertPos.value <= patternSegments.value.length) {
    patternSegments.value.splice(insertPos.value, 0, segment);
    insertPos.value = insertPos.value + 1;
  } else {
    patternSegments.value.push(segment);
    insertPos.value = patternSegments.value.length;
  }
}

function removeSegment(index) {
  patternSegments.value.splice(index, 1);
  if (insertPos.value !== null && insertPos.value > index) {
    insertPos.value = insertPos.value - 1;
  }
}

function addFreeText() {
  const text = freeTextInput.value.trim();
  if (!text) return;
  addSegment(text);
  freeTextInput.value = '';
}

const patternString = computed(() => buildPattern());

const previewResult = computed(() => {
  const raw = patternString.value;
  if (!raw) return '';
  let result = raw;
  for (const [token, value] of Object.entries(exampleValues)) {
    result = result.replaceAll(token, value);
  }
  return result;
});

watch(patternString, (val) => {
  emit('update:modelValue', val);
});

watch(
  () => props.modelValue,
  (val) => {
    if (val && val !== patternString.value) {
      patternSegments.value = parsePattern(val);
      insertPos.value = patternSegments.value.length;
    }
  }
);

onMounted(() => {
  const source = props.modelValue || defaultPattern;
  patternSegments.value = parsePattern(source);
  insertPos.value = patternSegments.value.length;
});
</script>

<style scoped>
.cursor-insert {
  width: 12px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  position: relative;
  padding: 0;
  flex-shrink: 0;
}

.cursor-insert::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 2px;
  bottom: 2px;
  width: 2px;
  border-radius: 1px;
  background: transparent;
  transform: translateX(-50%);
  transition: background 0.15s;
}

.cursor-insert:hover::after {
  background: rgba(107, 114, 128, 0.5);
}

.cursor-active::after {
  background: #06b6d4 !important;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
