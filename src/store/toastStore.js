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
  }),
  actions: {
    showToast({
      type = 'info',
      title = '',
      message = '',
      link = '',
      linkText = '',
      autoClose = true,
      autoCloseDelay = 8000,
      actionText = '',
      onAction = null,
    }) {
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
      this.newMessage = false;
      this.isConfirmation = false;
      if (this.confirmationResolver) {
        this.confirmationResolver(true);
        this.confirmationResolver = null;
      }
    },

    cancelAction() {
      this.newMessage = false;
      this.isConfirmation = false;
      if (this.confirmationResolver) {
        this.confirmationResolver(false);
        this.confirmationResolver = null;
      }
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
