import { onBeforeUnmount, watch } from 'vue';

const TEXT_ENTRY =
  'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable]';

// Overlay element -> dismiss callback of every Modal currently on screen.
const openModals = new Map();

function onKeydown(event) {
  if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) return;
  // Inline rename fields and native dropdowns use Escape for their own cancel.
  if (event.target.closest?.(TEXT_ENTRY)) return;

  // Ask the browser what is on top instead of keeping a stack: the number picker, the setup
  // wizard and the screen lock are overlays too, and teleported Modals of equal z-index paint
  // in mount order, not in the order they were opened. If anything else covers the screen,
  // no Modal is dismissed.
  const top = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  for (const [overlay, dismiss] of openModals) {
    if (overlay.contains(top)) {
      // Deferred past this event: closing can unmount moveAxis, whose own Escape listener on
      // window has to send the mount stop first. Do not stop propagation here for the same
      // reason.
      setTimeout(dismiss);
      return;
    }
  }
}

function release(overlay) {
  openModals.delete(overlay);
  if (openModals.size === 0) document.removeEventListener('keydown', onKeydown);
}

// Calls dismiss on Escape while the overlay ref holds an element and that overlay is on top.
export function useModalEscape(overlay, dismiss) {
  watch(overlay, (element, previous) => {
    if (previous) release(previous);
    if (element) {
      openModals.set(element, dismiss);
      document.addEventListener('keydown', onKeydown);
    }
  });

  onBeforeUnmount(() => {
    if (overlay.value) release(overlay.value);
  });
}
