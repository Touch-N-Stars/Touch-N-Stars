<template>
  <!-- What blocks a night before it starts. Both used to surface only as a polar alignment
       that silently never finished. -->
  <section
    v-if="locationMissing || databaseMissing"
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
  </section>
</template>

<script setup>
import { useSimpleSetupChecks } from '@/composables/useSimpleSetupChecks';

const { locationMissing, databaseMissing } = useSimpleSetupChecks();
</script>
