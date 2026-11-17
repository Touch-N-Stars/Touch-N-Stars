import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { useToastStore } = await import('@/store/toastStore');

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('a toast arriving during a confirmation waits until the user has answered', async () => {
  freshPinia();
  const toast = useToastStore();

  const answer = toast.showConfirmation('Stop guiding?', 'Really?', 'Stop', 'Cancel');
  toast.showToast({ type: 'error', title: 'Star lost', message: 'Lock lost' });

  assert.equal(toast.isConfirmation, true, 'the confirmation stays open');
  assert.equal(toast.title, 'Stop guiding?');

  toast.confirmAction();
  assert.equal(await answer, true, 'the answer reaches the caller');

  await tick();
  assert.equal(toast.newMessage, true);
  assert.equal(toast.isConfirmation, false);
  assert.equal(toast.title, 'Star lost');
});

test('a second confirmation settles the first one as cancelled', async () => {
  freshPinia();
  const toast = useToastStore();

  const first = toast.showConfirmation('First?', '');
  const second = toast.showConfirmation('Second?', '');
  assert.equal(await first, false);

  toast.confirmAction();
  assert.equal(await second, true);
});

test('the action button of a toast runs its handler once and closes the toast', () => {
  freshPinia();
  const toast = useToastStore();
  let runs = 0;

  toast.showToast({ title: 'Saved', actionText: 'Replay', onAction: () => runs++ });
  assert.equal(toast.actionText, 'Replay');
  toast.runToastAction();
  toast.runToastAction();

  assert.equal(runs, 1);
  assert.equal(toast.newMessage, false);
  assert.equal(toast.actionText, '');
});

test('a confirmation drops the action button of the toast before it', () => {
  freshPinia();
  const toast = useToastStore();
  toast.showToast({ title: 'Saved', actionText: 'Replay', onAction: () => {} });
  toast.showConfirmation('Delete?', '');
  assert.equal(toast.actionText, '');
  assert.equal(toast.onAction, null);
  toast.cancelAction();
});

test('a persistent toast pushed aside by a newer one comes back once that one closes', async () => {
  freshPinia();
  const toast = useToastStore();

  toast.showToast({ type: 'error', title: 'Parking failed', autoClose: false });
  toast.showToast({ type: 'info', title: 'Sequence loaded' });
  assert.equal(toast.title, 'Sequence loaded');

  toast.closeToast();
  await tick();
  assert.equal(toast.newMessage, true);
  assert.equal(toast.title, 'Parking failed');
  assert.equal(toast.autoClose, false);
});

test('a persistent toast queued during a confirmation survives a later queued toast', async () => {
  freshPinia();
  const toast = useToastStore();

  toast.showConfirmation('Stop guiding?', '');
  toast.showToast({ type: 'error', title: 'Parking failed', autoClose: false });
  toast.showToast({ type: 'error', title: 'Filter change failed' });
  toast.cancelAction();

  await tick();
  assert.equal(toast.title, 'Filter change failed');
  toast.closeToast();
  await tick();
  assert.equal(toast.title, 'Parking failed');
});

test('every shown toast bumps the sequence, also one replacing an open toast', () => {
  freshPinia();
  const toast = useToastStore();
  toast.showToast({ title: 'First' });
  const first = toast.toastSeq;
  toast.showToast({ title: 'Second' });
  assert.equal(toast.toastSeq, first + 1);
});
