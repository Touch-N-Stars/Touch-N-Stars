// Opens the simple mode home page when the app starts on the default page. Used once, in
// App.vue. PINS is detected only after the first poll, so the router guard cannot decide this
// at startup: the redirect happens when the mode becomes active, but only as long as the user
// has not navigated anywhere yet - a later tap on "All devices" must stay on /equipment.
import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSimpleMode } from '@/composables/useSimpleMode';

const LANDING_PATHS = ['/', '/equipment'];

export function useSimpleModeLanding() {
  const route = useRoute();
  const router = useRouter();
  const { active } = useSimpleMode();

  let navigations = 0;
  router.afterEach(() => {
    navigations += 1;
  });

  watch(
    active,
    (isActive) => {
      // The initial navigation counts as one; anything beyond it was the user.
      if (!isActive || navigations > 1) return;
      if (LANDING_PATHS.includes(route.path)) router.replace('/start');
    },
    { immediate: true }
  );
}
