import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTick, ref } from 'vue';
import { useModalEscape } from '@/composables/useModalEscape';
import { mountComposable } from '../../test-helpers/pollingTestEnv.js';

function fakeOverlay() {
  const overlay = { contains: (node) => node === overlay || node?.parent === overlay };
  return overlay;
}

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const listeners = new Set();
  const screen = { top: null };
  globalThis.window = { innerWidth: 400, innerHeight: 800 };
  globalThis.document = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    elementFromPoint: () => screen.top,
  };
  const unmounts = [];
  t.after(() => {
    unmounts.forEach((unmount) => unmount());
    delete globalThis.window;
    delete globalThis.document;
  });

  async function openModal() {
    const overlay = fakeOverlay();
    const element = ref(null);
    const modal = { dismissed: 0, overlay, element };
    const { unmount } = mountComposable(() => useModalEscape(element, () => modal.dismissed++));
    modal.unmount = unmount;
    unmounts.push(unmount);
    element.value = overlay;
    await nextTick();
    return modal;
  }

  function pressEscape(overrides = {}) {
    const event = { key: 'Escape', target: { closest: () => null }, ...overrides };
    listeners.forEach((listener) => listener(event));
    t.mock.timers.tick(0);
  }

  return { listeners, screen, openModal, pressEscape };
}

test('Escape dismisses only the Modal that is on top', async (t) => {
  const { screen, openModal, pressEscape } = setup(t);
  const lower = await openModal();
  const upper = await openModal();

  screen.top = { parent: upper.overlay };
  pressEscape();

  assert.equal(upper.dismissed, 1);
  assert.equal(lower.dismissed, 0);
});

test('the on-screen order wins over the order the Modals were opened in', async (t) => {
  const { screen, openModal, pressEscape } = setup(t);
  const openedFirst = await openModal();
  const openedLast = await openModal();

  screen.top = openedFirst.overlay;
  pressEscape();

  assert.equal(openedFirst.dismissed, 1);
  assert.equal(openedLast.dismissed, 0);
});

test('nothing is dismissed while another overlay covers the Modal', async (t) => {
  const { screen, openModal, pressEscape } = setup(t);
  const modal = await openModal();

  screen.top = { id: 'number-picker' };
  pressEscape();

  assert.equal(modal.dismissed, 0);
});

test('Escape stays with text entry and with handlers that already took it', async (t) => {
  const { screen, openModal, pressEscape } = setup(t);
  const modal = await openModal();
  screen.top = modal.overlay;

  pressEscape({ target: { closest: () => ({ tagName: 'INPUT' }) } });
  pressEscape({ defaultPrevented: true });
  pressEscape({ repeat: true });
  pressEscape({ key: 'Enter' });

  assert.equal(modal.dismissed, 0);
});

test('dismissal waits until the event has reached every other listener', async (t) => {
  const { listeners, screen, openModal } = setup(t);
  const modal = await openModal();
  screen.top = modal.overlay;

  listeners.forEach((listener) => listener({ key: 'Escape', target: { closest: () => null } }));
  assert.equal(modal.dismissed, 0);

  t.mock.timers.tick(0);
  assert.equal(modal.dismissed, 1);
});

test('the key listener lives only while a Modal is on screen', async (t) => {
  const { listeners, screen, openModal, pressEscape } = setup(t);
  const hidden = await openModal();
  const unmounted = await openModal();
  assert.equal(listeners.size, 1);

  // A minimized Modal has no overlay element.
  hidden.element.value = null;
  await nextTick();
  screen.top = hidden.overlay;
  pressEscape();
  assert.equal(hidden.dismissed, 0);
  assert.equal(listeners.size, 1);

  unmounted.unmount();
  assert.equal(listeners.size, 0);
});
