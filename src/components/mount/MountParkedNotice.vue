<template>
  <!-- Explains why the tracking buttons are greyed out and offers the way out right here,
       so the user does not have to hunt for the Unpark button further up the page. -->
  <div
    v-if="store.mountIsParked"
    class="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3 rounded-control border border-status-warn/40 bg-status-warn/10 p-3"
  >
    <div class="flex items-start gap-2 flex-1">
      <span class="tns-dot bg-status-warn mt-1.5 shrink-0"></span>
      <p class="text-sm text-content">{{ $t('components.mount.control.parkedNotice') }}</p>
    </div>
    <!-- w-auto! is required: the tns-btn base sets w-full, which would otherwise squeeze
         the message into a narrow column next to a full-width button. -->
    <ButtonUnpark class="w-auto! shrink-0 self-end xs:self-auto px-4! py-1.5! text-xs!" />
  </div>
</template>

<script setup>
import ButtonUnpark from '@/components/mount/ButtonUnpark.vue';
import { apiStore } from '@/store/store';

const store = apiStore();
</script>
