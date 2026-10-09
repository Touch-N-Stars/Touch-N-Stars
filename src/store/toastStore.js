import { markRaw } from 'vue';
import { defineStore } from 'pinia';

export const useToastStore = defineStore('toastStore', {
  state: () => ({
    newMessage: false,
    title: '',
    message: '',
    link: '',
    linkText: '',
    type: 'info',
    autoClose: true,
    autoCloseDelay: 8000,
    // Optional action button of a non-blocking toast (e.g. "Replay"): label and handler.
    actionText: '',
    onAction: null,
    // Neue Confirmation-Properties
    isConfirmation: false,
    confirmationResolver: null,
    confirmText: 'Bestätigen',
    cancelText: 'Abbrechen',
    // A toast that arrived while a confirmation was open; shown once the user has answered.
    queuedToast: null,
  }),
  actions: {
    showToast(options) {
      // Never replace an open confirmation: its promise would never settle and the action the
      // user was asked about would silently not happen. Background toasts (e.g. guider alerts)
      // wait until the user has answered; only the newest one is kept.
      if (this.isConfirmation && this.confirmationResolver) {
        this.queuedToast = markRaw({ ...options });
        return;
      }
      const {
        type = 'info',
        title = '',
        message = '',
        link = '',
        linkText = '',
        autoClose = true,
        autoCloseDelay = 8000,
        actionText = '',
        onAction = null,
      } = options || {};
      this.newMessage = true;
      this.type = type;
      this.title = title;
      this.message = message;
      this.link = link;
      this.linkText = linkText;
      this.autoClose = autoClose;
      this.autoCloseDelay = autoCloseDelay;
      this.actionText = typeof onAction === 'function' ? actionText : '';
      this.onAction = typeof onAction === 'function' ? markRaw(onAction) : null;
      this.isConfirmation = false;
    },

    /** Runs the toast's action button and closes the toast. */
    runToastAction() {
      const action = this.onAction;
      this.newMessage = false;
      this.onAction = null;
      this.actionText = '';
      if (typeof action === 'function') action();
    },

    // Neue Confirmation-Methode
    showConfirmation(
      confirmationTitle,
      confirmationMessage,
      confirmButtonText = 'Bestätigen',
      cancelButtonText = 'Abbrechen'
    ) {
      // A second confirmation replaces the first: settle the first one as "no" so its caller
      // does not wait forever.
      if (this.confirmationResolver) {
        const previous = this.confirmationResolver;
        this.confirmationResolver = null;
        previous(false);
      }
      return new Promise((resolve) => {
        this.actionText = '';
        this.onAction = null;
        this.title = confirmationTitle;
        this.message = confirmationMessage;
        this.type = 'warning';
        this.confirmText = confirmButtonText;
        this.cancelText = cancelButtonText;
        this.isConfirmation = true;
        this.confirmationResolver = resolve;
        this.newMessage = true;
      });
    },

    confirmAction() {
      this.settleConfirmation(true);
    },

    cancelAction() {
      this.settleConfirmation(false);
    },

    settleConfirmation(answer) {
      this.newMessage = false;
      this.isConfirmation = false;
      const resolver = this.confirmationResolver;
      this.confirmationResolver = null;
      if (resolver) resolver(answer);
      const queued = this.queuedToast;
      this.queuedToast = null;
      // Next tick: the modal must see newMessage go false before the queued toast opens it
      // again, otherwise its auto-close timer is never armed.
      if (queued) setTimeout(() => this.showToast(queued), 0);
    },

    closeToast() {
      if (this.isConfirmation) {
        this.cancelAction();
      } else {
        this.newMessage = false;
      }
    },
  },
});
