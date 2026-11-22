<template>
  <!-- What blocks a night before it starts. Location and star map used to surface only as a
       polar alignment that silently never finished; a flip timing that does not fit the mount
       shows only when the telescope hits the tripod. Each item is done once, not every night. -->
  <section
    v-if="locationMissing || databaseMissing || flipMissing"
    class="tns-card border-status-warn/50! flex flex-col gap-3"
  >
    <h2 class="tns-section-title">{{ $t('components.simpleMode.setupChecks.title') }}</h2>

    <div v-if="locationMissing" class="flex flex-col gap-2">
      <p class="text-sm font-semibold text-content">
        {{ $t('components.simpleMode.setupChecks.locationTitle') }}
      </p>
      <p class="text-xs text-content-muted">
        {{ $t('components.simpleMode.setupChecks.locationText') }}
      </p>
      <router-link
        :to="{ path: '/settings', query: { tab: 'connection' } }"
        class="tns-btn-primary"
      >
        {{ $t('components.simpleMode.setupChecks.locationAction') }}
      </router-link>
    </div>

    <div v-if="databaseMissing" class="flex flex-col gap-2">
      <p class="text-sm font-semibold text-content">
        {{ $t('components.simpleMode.setupChecks.databaseTitle') }}
      </p>
      <p class="text-xs text-content-muted">
        {{ $t('components.simpleMode.setupChecks.databaseText') }}
      </p>
      <router-link
        :to="{ path: '/settings', query: { tab: 'plateSolver' } }"
        class="tns-btn-primary"
      >
        {{ $t('components.simpleMode.setupChecks.databaseAction') }}
      </router-link>
    </div>

    <SimpleFlipSetup v-if="flipMissing" @chosen="markFlipSetUp" />
  </section>
</template>

<script setup>
import { useSimpleSetupChecks } from '@/composables/useSimpleSetupChecks';
import SimpleFlipSetup from '@/components/simpleMode/SimpleFlipSetup.vue';

const { locationMissing, databaseMissing, flipMissing, markFlipSetUp } = useSimpleSetupChecks();
</script>
