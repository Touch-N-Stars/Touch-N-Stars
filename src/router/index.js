import { createRouter, createWebHistory } from 'vue-router';
import { useSettingsStore } from '@/store/settingsStore';

const EquipmentPage = () => import('@/views/EquipmentPage.vue');
const CameraPage = () => import('@/views/CameraPage.vue');
const MountPage = () => import('@/views/MountPage.vue');
const GuidingPage = () => import('@/views/GuidingPage.vue');
const DomePage = () => import('@/views/DomePage.vue');
const SettingsPage = () => import('@/views/SettingsPage.vue');
const FlatdevicePage = () => import('@/views/FlatdevicePage.vue');
const SequenceMonitoring = () => import('@/views/SequenceMonitoring.vue');
const SwitchPage = () => import('@/views/SwitchPage.vue');
const FilterwheelPage = () => import('@/views/FilterwheelPage.vue');
const RotatorPage = () => import('@/views/RotatorPage.vue');
const Flatassistant = () => import('@/views/FlatassistantPage.vue');
const FocusPage = () => import('@/views/FocusPage.vue');
const SequencePage = () => import('@/views/SequencePage.vue');
const FramingPage = () => import('@/views/FramingPage.vue');

const routes = [
  {
    path: '/',
    component: EquipmentPage,
  },
  { path: '/equipment', component: EquipmentPage },
  { path: '/camera', component: CameraPage },
  { path: '/mount', component: MountPage },
  { path: '/autofocus', component: FocusPage },
  { path: '/guider', component: GuidingPage },
  { path: '/dome', component: DomePage },
  { path: '/settings', component: SettingsPage },
  { path: '/flat', component: FlatdevicePage },
  { path: '/seq-mon', component: SequenceMonitoring },
  { path: '/switch', component: SwitchPage },
  { path: '/filterwheel', component: FilterwheelPage },
  { path: '/rotator', component: RotatorPage },
  { path: '/flats', component: Flatassistant },
  { path: '/sequence', component: SequencePage },
  { path: '/framing', component: FramingPage },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Without this, Vue Router leaves scroll position exactly where it was on every navigation --
  // switching pages/plugins on a long, scrolled-down page landed the next page scrolled down too,
  // not at its own top.
  scrollBehavior() {
    return { top: 0 };
  },
});

const NAV_ITEM_ROUTES = {
  equipment: '/equipment',
  camera: '/camera',
  autofocus: '/autofocus',
  mount: '/mount',
  dome: '/dome',
  flat: '/flat',
  switch: '/switch',
  filter: '/filterwheel',
  rotator: '/rotator',
  guider: '/guider',
  sequence: '/sequence',
  monitoring: '/seq-mon',
  flats: '/flats',
  framing: '/framing',
  settings: '/settings',
};

function getFirstVisibleRoute(settingsStore) {
  const order = settingsStore.navbar?.itemOrder ?? Object.keys(NAV_ITEM_ROUTES);
  const hidden = settingsStore.navbar?.hiddenItems ?? [];
  for (const id of order) {
    if (!hidden.includes(id) && NAV_ITEM_ROUTES[id]) {
      return NAV_ITEM_ROUTES[id];
    }
  }
  return '/settings';
}

// First-run setup no longer gates routing: the setup wizard is a cancellable
// overlay owned by App.vue, so every route stays reachable even before an
// instance is configured (the connection splash takes over in that case).
router.beforeEach((to, from, next) => {
  const settingsStore = useSettingsStore();

  if (
    (to.path === '/' || to.path === '/equipment') &&
    settingsStore.navbar?.hiddenItems?.includes('equipment')
  ) {
    next(getFirstVisibleRoute(settingsStore));
  } else {
    next();
  }
});

export default router;
