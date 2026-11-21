<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.starDatabase.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.starDatabase.description') }}
      </p>
    </div>

    <!-- Another solver than ASTAP brings its own catalog; nothing to install here. -->
    <p v-if="!usesAstap" class="text-sm text-content-muted">
      {{ t('components.setupWizard.starDatabase.otherSolver') }}
    </p>
    <template v-else>
      <SetPlateSolverAstapDatabasePins />
      <p class="text-xs text-content-faint">
        {{ t('components.setupWizard.starDatabase.hint') }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import SetPlateSolverAstapDatabasePins from '@/components/settings/plateSolver/SetPlateSolverAstapDatabasePins.vue';
import { useAstapDatabases } from '@/composables/useAstapDatabases';

// Plate solving (polar alignment, centering) needs a star database, and a fresh PINS image has
// none: ASTAP then fails within milliseconds and the app only showed "running". The step comes
// after the camera so the recommendation can use focal length, pixel size and sensor size.
const { t } = useI18n();
const { usesAstap } = useAstapDatabases();
</script>
