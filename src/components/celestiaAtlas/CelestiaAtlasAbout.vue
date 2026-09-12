<template>
  <button
    class="celestia-atlas-icon-button bg-gray-700 border border-cyan-600 rounded-full shadow-md"
    type="button"
    title="About Celestia Atlas"
    aria-label="About Celestia Atlas"
    @click="aboutVisible = true"
  >
    <InformationCircleIcon class="h-7 w-7" />
  </button>

  <Modal :show="aboutVisible" max-width="max-w-xl" zIndex="z-40" @close="aboutVisible = false">
    <template #header>
      <h3>About Celestia Atlas</h3>
    </template>
    <template #body>
      <div class="w-full space-y-4 text-sm leading-6 text-gray-300">
        <section>
          <h4 class="mb-1 text-base font-semibold text-gray-100">Celestia Atlas</h4>
          <p>
            Touch-N-Stars uses the offline-first Celestia Atlas renderer and its packaged star and
            deep-sky catalogues.
          </p>
          <a
            class="break-all text-cyan-400 hover:underline"
            href="https://github.com/acocalypso/celestia_atlas"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/acocalypso/celestia_atlas
          </a>
        </section>

        <section>
          <h4 class="mb-1 text-base font-semibold text-gray-100">Photographic sky survey</h4>
          <p>
            Digitized Sky Survey — STScI/NASA; colored and HiPS-processed by CDS (CNRS/Unistra).
            Touch-N-Stars loads the packaged survey from the selected NINA plugin and does not fetch
            public survey tiles.
          </p>
          <a
            class="break-all text-cyan-400 hover:underline"
            href="https://outerspace.stsci.edu/spaces/MASTDATA/pages/176435492/Photographic+Sky+Surveys"
            target="_blank"
            rel="noopener noreferrer"
          >
            Photographic Sky Surveys attribution
          </a>
        </section>

        <section>
          <h4 class="mb-1 text-base font-semibold text-gray-100">Catalogue credits</h4>
          <p>
            Catalogue layers include HYG with HD identifiers (CC BY-SA 4.0), SIMBAD SAO
            cross-identifiers and Wolf-Rayet stars (ODbL 1.0), OpenNGC and the supplementary
            catalogue sources documented with Celestia Atlas. Full source and redistribution notices
            are included in the project documentation.
          </p>
        </section>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref } from 'vue';
import { InformationCircleIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';

const aboutVisible = ref(false);
</script>
