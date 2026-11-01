import { computed } from 'vue';
import { useOrientation } from '@/composables/useOrientation';

// Viewport rect of the stage window — the area inside App.vue's rounded frame
// mask. It mirrors the stage margins, plus --status-panel-height so an open
// status-bar panel does not swallow the rounded bottom corners. Full-screen
// views (camera, livestack) position their own `fixed` container with it and
// clip with rounded-[var(--stage-radius)] overflow-hidden, so a zoomed image
// stays inside the frame instead of painting over rails and corners.
export function useStageWindow() {
  const { isLandscape } = useOrientation();

  const stageWindowStyle = computed(() =>
    isLandscape.value
      ? {
          top: 'calc(var(--stage-inset) + var(--subnav-offset))',
          left: 'calc(var(--nav-width) + var(--stage-inset))',
          right: 'var(--stage-inset)',
          bottom: 'calc(var(--statusbar-height) + var(--status-panel-height) + var(--stage-inset))',
        }
      : {
          top: 'calc(82px + var(--subnav-offset))',
          left: 'var(--stage-inset)',
          right: 'var(--stage-inset)',
          bottom:
            'calc(var(--statusbar-height) + env(safe-area-inset-bottom) + var(--status-panel-height) + var(--stage-inset))',
        }
  );

  return { stageWindowStyle };
}
