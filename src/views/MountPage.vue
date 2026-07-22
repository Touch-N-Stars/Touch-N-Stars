<template>
  <div
    class="mount-page min-h-screen"
    :style="
      imageStore.imageData && store.mount.currentTab === 'showTppa' && tppaStore.isRunning
        ? `background-image: url(${imageStore.imageData}); background-size: cover; background-position: center; background-repeat: no-repeat;`
        : ''
    "
  >
    <SubNav
      :items="[
        { name: t('components.mount.title'), value: 'showMount' },
        { name: t('components.mount.slew'), value: 'showSlew' },
        { name: t('components.tppa.tppa'), value: 'showTppa' },
        { name: t('components.mount.settings.meridian_flip_settings'), value: 'showSettings' },
      ]"
      v-model:activeItem="store.mount.currentTab"
    />
    <div class="container py-4 flex items-center justify-center">
      <div class="container max-w-md landscape:max-w-xl">
        <!-- No page heading: the SubNav already names the page. -->
        <infoMount
          v-if="store.mount.currentTab !== 'showTppa' && store.mount.currentTab !== 'showSettings'"
          v-model="store.mountInfo.Connected"
          compact
          class="p-3 bg-surface-1 rounded-card border border-line"
        />
        <Transition name="slide-in" mode="out-in">
          <div
            v-if="store.mount.currentTab === 'showMount' && store.mountInfo.Connected"
            key="mount-tab"
          >
            <div class="mt-4 border border-line rounded-card shadow-lg bg-surface-1">
              <div class="container pl-5 pb-5 pr-5">
                <div class="mt-5">
                  <controlMount />
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <Transition name="slide-in" mode="out-in">
          <div
            v-if="store.mount.currentTab === 'showSlew' && store.mountInfo.Connected"
            key="slew-tab"
          >
            <div class="mt-4 border border-line rounded-card shadow-lg bg-surface-1">
              <div class="container pl-5 pb-5 pr-5">
                <div class="mt-5">
                  <TargetSearch class="w-full mt-2" />
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <Transition name="slide-in" mode="out-in">
          <div v-if="store.mount.currentTab === 'showTppa'" key="tppa-tab">
            <div
              :class="[
                'mt-4 border border-line rounded-card shadow-lg',
                // Semi-transparent while TPPA runs so the live image stays readable
                tppaStore.isRunning && imageStore.imageData ? 'bg-surface-1/30' : 'bg-surface-1',
              ]"
            >
              <div class="container pl-5 pb-5 pr-5">
                <div class="mt-5">
                  <TppaPage />
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <Transition name="slide-in" mode="out-in">
          <div v-if="store.mount.currentTab === 'showSettings'" key="settings-tab">
            <div class="mt-4 border border-line rounded-card shadow-lg bg-surface-1">
              <div class="container pl-5 pb-5 pr-5">
                <div class="mt-5">
                  <MeridianFlipSettings />
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import TppaPage from '@/components/tppa/TppaPage.vue';
import TargetSearch from '@/components/framing/TargetSearch.vue';
import infoMount from '@/components/mount/infoMount.vue';
import controlMount from '@/components/mount/controlMount.vue';
import MeridianFlipSettings from '@/components/mount/settings/MeridianFlipSettings.vue';
import { apiStore } from '@/store/store';
import { useTppaStore } from '@/store/tppaStore';
import { useImagetStore } from '@/store/imageStore';
import SubNav from '@/components/SubNav.vue';
import { useI18n } from 'vue-i18n';
const showTppa = ref(false); // eslint-disable-line no-unused-vars
const { t } = useI18n();

const store = apiStore();
const tppaStore = useTppaStore();
const imageStore = useImagetStore();
</script>

<style scoped>
.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-in-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.slide-in-enter-to,
.slide-in-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style>
