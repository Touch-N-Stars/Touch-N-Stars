<template>
  <button
    class="w-8 h-8 rounded-full border border-accent/40 bg-surface-2 flex items-center justify-center shrink-0"
    type="button"
    :title="t('perihelion.about.buttonTitle')"
    :aria-label="t('perihelion.about.buttonTitle')"
    @click="aboutVisible = true"
  >
    <InformationCircleIcon class="w-5 h-5 text-accent" />
  </button>

  <Modal :show="aboutVisible" max-width="max-w-xl" zIndex="z-40" @close="aboutVisible = false">
    <template #header>
      <h3>{{ t('perihelion.about.heading') }}</h3>
    </template>
    <template #body>
      <div class="w-full space-y-4 text-sm leading-6 text-content-muted">
        <section>
          <h4 class="mb-1 text-base font-semibold text-content">
            {{ t('perihelion.about.sectionTitle') }}
          </h4>
          <p>
            {{ t('perihelion.about.description') }}
          </p>
          <a
            class="break-all text-accent hover:underline"
            href="https://github.com/OryxAstro/perihelion"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/OryxAstro/perihelion
          </a>
        </section>

        <section>
          <h4 class="mb-1 text-base font-semibold text-content">
            {{ t('perihelion.about.dataSourcesTitle') }}
          </h4>
          <p>
            {{ t('perihelion.about.dataSourcesDescription') }}
          </p>
        </section>

        <section>
          <h4 class="mb-1 text-base font-semibold text-content">
            {{ t('perihelion.about.oryxAstroTitle') }}
          </h4>
          <p>
            {{ t('perihelion.about.oryxAstroDescription') }}
          </p>
          <a
            class="break-all text-accent hover:underline"
            href="https://oryxastro.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            oryxastro.com
          </a>
        </section>

        <section>
          <h4 class="mb-1 text-base font-semibold text-content">
            {{ t('perihelion.about.licenseTitle') }}
          </h4>
          <p>{{ t('perihelion.about.licenseText') }}</p>
        </section>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { InformationCircleIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';

const { t } = useI18n();
const aboutVisible = ref(false);
</script>
