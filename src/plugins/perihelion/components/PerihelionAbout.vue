<template>
  <button
    class="w-8 h-8 rounded-full border border-accent/40 bg-surface-2 flex items-center justify-center shrink-0"
    type="button"
    title="About Perihelion"
    aria-label="About Perihelion"
    @click="aboutVisible = true"
  >
    <InformationCircleIcon class="w-5 h-5 text-accent" />
  </button>

  <Modal :show="aboutVisible" max-width="max-w-xl" zIndex="z-40" @close="aboutVisible = false">
    <template #header>
      <h3>About Perihelion</h3>
    </template>
    <template #body>
      <div class="w-full space-y-4 text-sm leading-6 text-content-muted">
        <section>
          <h4 class="mb-1 text-base font-semibold text-content">Perihelion</h4>
          <p>
            Non-sidereal tracking for comets and asteroids -- sets a mount's custom RA/Dec rate live
            from current orbital elements, computed in-process with no external service.
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
          <h4 class="mb-1 text-base font-semibold text-content">Data sources</h4>
          <p>
            Comet orbital elements come from the IAU Minor Planet Center, cached on-disk and synced
            on demand. Observed brightness cross-checks come from COBS (Comet OBServation database)
            where available. The orbital mechanics itself is built on CosineKitty.AstronomyEngine,
            the same engine (kept in version lockstep) OryxAstro's own website uses for its
            sky-events planner.
          </p>
        </section>

        <section>
          <h4 class="mb-1 text-base font-semibold text-content">OryxAstro</h4>
          <p>
            Perihelion is built by OryxAstro, whose website's own Deep Sky / Solar System Planner
            can send a tracking sequence for a comet or asteroid directly to PINS.
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
          <h4 class="mb-1 text-base font-semibold text-content">License</h4>
          <p>GPL-3.0-or-later -- see the repository for the full text.</p>
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
