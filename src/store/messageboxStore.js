import { defineStore } from 'pinia';
import { apiStore } from '@/store/store';
import signalRMessageboxesService from '@/services/signalRMessageboxesService';

export const useMessageboxStore = defineStore('messageboxStore', {
  state: () => ({
    messageboxes: [],
    messageboxCount: 0,
    isConnectedToSignalR: false,
  }),
  actions: {
    async respondToMessageBox(messageBoxId, result) {
      try {
        if (signalRMessageboxesService.isSignalRConnected()) {
          console.log(
            '[messageboxStore] Responding to MessageBox via SignalR:',
            messageBoxId,
            result
          );

          await signalRMessageboxesService.invoke('RespondToMessageBox', messageBoxId, result);

          console.log('[messageboxStore] MessageBox response sent successfully');
          return { Success: true };
        } else {
          console.error('[messageboxStore] SignalR not connected');
          throw new Error('SignalR not connected');
        }
      } catch (error) {
        console.error(`[messageboxStore] Error responding to MessageBox:`, error);
        throw error;
      }
    },

    /**
     * Initialize SignalR connection for messagebox updates
     * This allows receiving real-time updates without polling
     */
    async initializeMessageboxSignalR() {
      const store = apiStore();

      if (!store.isBackendReachable) {
        console.warn(
          '[messageboxStore] Backend is not reachable, cannot establish SignalR connection'
        );
        return;
      }

      // Check if already connected
      if (signalRMessageboxesService.isSignalRConnected()) {
        console.log('[messageboxStore] SignalR already connected, skipping initialization');
        return;
      }

      try {
        console.log('[messageboxStore] Initializing SignalR connection via service');

        // Set up callback for ReceiveMessageBox event
        signalRMessageboxesService.setDialogCallback((messageboxData) => {
          console.log('[messageboxStore] MessageBox received:', messageboxData);
          this.handleMessageboxUpdate(messageboxData);
        });

        // Also arrives for a box this client already closed itself; the clear is idempotent.
        signalRMessageboxesService.setClearDialogCallback((messageboxId) => {
          this.handleClearMessagebox(messageboxId);
        });

        signalRMessageboxesService.setStatusCallback((status) => {
          console.log('[messageboxStore] SignalR connection status:', status);
          this.isConnectedToSignalR = status === 'Connected' || status === 'Reconnected';
        });

        // Connect. isConnectedToSignalR is driven exclusively by the status
        // callback above: connect() can resolve without a live connection when
        // the first attempt fails (the factory arms a background restart
        // instead of rejecting), so it must not set the flag itself here.
        await signalRMessageboxesService.connect();
        console.log('[messageboxStore] Messagebox SignalR connect() attempt finished');
      } catch (error) {
        console.error('[messageboxStore] Failed to establish SignalR connection:', error);
        this.isConnectedToSignalR = false;
      }
    },

    /**
     * Handle messagebox update from SignalR
     */
    handleMessageboxUpdate(messageboxData) {
      console.log('[messageboxStore] handleMessageboxUpdate received:', messageboxData);

      // Map SignalR messagebox structure to internal format
      const normalizedMessagebox = {
        id: messageboxData.id,
        title: messageboxData.title,
        text: messageboxData.text,
        button: messageboxData.button,
        defaultResult: messageboxData.defaultResult,
        timestamp: messageboxData.timestamp,
        result: messageboxData.result,
      };

      console.log('[messageboxStore] Normalized messagebox:', normalizedMessagebox);

      // Update or add the messagebox to the messageboxes array using id
      const existingIndex = this.messageboxes.findIndex((m) => m.id === normalizedMessagebox.id);

      if (existingIndex >= 0) {
        // Update existing messagebox
        console.log('[messageboxStore] Updating existing messagebox at index', existingIndex);
        this.messageboxes[existingIndex] = {
          ...this.messageboxes[existingIndex],
          ...normalizedMessagebox,
        };
      } else {
        // Add new messagebox
        console.log('[messageboxStore] Adding new messagebox');
        this.messageboxes.push(normalizedMessagebox);
      }

      console.log('[messageboxStore] Current messageboxes array:', this.messageboxes);
    },

    /**
     * Handle status update from SignalR
     */
    handleStatusUpdate(status) {
      console.log('[messageboxStore] Status update:', status);
      // Handle general status updates if needed
    },

    /**
     * Handle clear messagebox from SignalR
     */
    handleClearMessagebox(messageboxId) {
      console.log('[messageboxStore] handleClearMessagebox called with id:', messageboxId);
      console.log('[messageboxStore] Current messageboxes before clear:', this.messageboxes);

      // Remove messagebox from the messageboxes array
      const beforeCount = this.messageboxes.length;
      this.messageboxes = this.messageboxes.filter((m) => m.id !== messageboxId);
      const afterCount = this.messageboxes.length;

      console.log('[messageboxStore] Messageboxes removed:', beforeCount - afterCount);
      console.log('[messageboxStore] Current messageboxes after clear:', this.messageboxes);
    },

    /**
     * Generic close messagebox function
     */
    async closeMessagebox(messageboxId) {
      try {
        const messagebox = this.messageboxes.find((m) => m.id === messageboxId);

        if (!messagebox) {
          console.warn(`[messageboxStore] No messagebox found with id: ${messageboxId}`);
          return;
        }

        console.log(`[messageboxStore] Closing messagebox: ${messageboxId}`);

        // Remove messagebox from array (in case server doesn't send ClearDialog event)
        this.messageboxes = this.messageboxes.filter((m) => m.id !== messageboxId);
        console.log(`[messageboxStore] Messagebox closed and removed: ${messageboxId}`);
      } catch (error) {
        console.error(`[messageboxStore] Error closing messagebox (${messageboxId}):`, error);
      }
    },

    /**
     * Disconnect from SignalR
     */
    async disconnectMessageboxSignalR() {
      try {
        await signalRMessageboxesService.disconnect();
        console.log('[messageboxStore] Disconnected from messagebox SignalR');
        this.isConnectedToSignalR = false;
      } catch (error) {
        console.error('[messageboxStore] Error disconnecting from SignalR:', error);
      }
    },
  },
});
