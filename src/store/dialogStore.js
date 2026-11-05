import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import signalRDialogService from '@/services/signalRDialogService';
import { useFramingStore } from '@/store/framingStore';
import { createPoller } from '@/utils/poller';

export const useDialogStore = defineStore('dialogStore', {
  state: () => ({
    dialogs: [],
    dialogCount: 0,
    meridianFlipData: null,
    slewAndCenterData: null,
    isPolling: false,
    isConnectedToSignalR: false,
    minimizedDialogs: {}, // Track minimized state per dialog ID
  }),
  actions: {
    async fetchDialogs() {
      const store = apiStore();
      try {
        if (!store.isBackendReachable) {
          console.warn('Backend is not reachable');
          return;
        }

        const response = await apiService.getDialogList();
        if (response.Success) {
          this.dialogs = response.Response.Dialogs || [];
          //console.log('Fetched dialogs:',response.Response);
          //console.log('[DialogStore] dialogs.length' , this.dialogs.length)
          this.dialogCount = response.Response.Count;
          // Store MeridianFlip data if available
          if (response.Response.MeridianFlip) {
            this.meridianFlipData = response.Response.MeridianFlip;
          }
          // Store SlewAndCenter data if available
          if (response.Response.SlewAndCenter) {
            this.slewAndCenterData = response.Response.SlewAndCenter;
          }
          //console.log('Dialog count:', this.dialogCount);
        }
      } catch (error) {
        console.error('Error fetching dialogs:', error);
      }
    },

    async fetchDialogCount() {
      const store = apiStore();
      try {
        if (!store.isBackendReachable) {
          console.warn('Backend is not reachable');
          return;
        }

        const response = await apiService.getDialogCount();
        if (response.Success) {
          this.dialogCount = response.Response;
        }
      } catch (error) {
        console.error('Error fetching dialog count:', error);
      }
    },

    async clickButton(buttonName, windowHashCode = null) {
      try {
        const store = apiStore();

        // In PINS mode, use SignalR to click the button directly
        if (store.isPINS && signalRDialogService.isSignalRConnected()) {
          console.log('[dialogStore] Clicking button via SignalR:', buttonName);

          // Find the current dialog's ContentType
          const currentDialog =
            this.dialogs.length > 0 ? this.dialogs[this.dialogs.length - 1] : null;
          if (currentDialog && currentDialog.ContentType) {
            console.log(
              '[dialogStore] Sending ClickDialogButton:',
              currentDialog.ContentType,
              buttonName
            );
            await signalRDialogService.invoke(
              'ClickDialogButton',
              currentDialog.ContentType,
              buttonName
            );
            return { Success: true };
          } else {
            console.warn('[dialogStore] No dialog found to click button on');
            return { Success: false, Error: 'No active dialog' };
          }
        } else {
          // WPF mode - use HTTP API
          const response = await apiService.clickDialogButton(buttonName, windowHashCode);
          if (response.Success) {
            await this.fetchDialogs();
          }
          return response;
        }
      } catch (error) {
        console.error(`Error clicking button ${buttonName}:`, error);
        throw error;
      }
    },

    async closeAllDialogs(confirm = true) {
      try {
        const response = await apiService.closeAllDialogs(confirm);
        if (response.Success) {
          await this.fetchDialogs();
        }
        return response;
      } catch (error) {
        console.error('Error closing all dialogs:', error);
        throw error;
      }
    },

    async closeDialogsByType(type, confirm = true) {
      try {
        const response = await apiService.closeDialogsByType(type, confirm);
        if (response.Success) {
          await this.fetchDialogs();
        }
        return response;
      } catch (error) {
        console.error(`Error closing dialogs by type ${type}:`, error);
        throw error;
      }
    },

    startPolling(interval = 2000) {
      if (!this.isPolling) {
        console.log('Start polling dialogs...');
        this.isPolling = true;
        if (!this._dialogPoller) {
          this._dialogPoller = createPoller(() => this.fetchDialogs(), interval, {
            immediate: true,
          });
        }
        this._dialogPoller.start();
      }
    },

    stopPolling() {
      if (this.isPolling) {
        console.log('Stop polling dialogs...');
        this.isPolling = false;
        this._dialogPoller?.stop();
        // Reset so a later startPolling(interval) with a different interval takes effect.
        this._dialogPoller = null;
      }
    },

    /**
     * Initialize SignalR connection for dialog updates
     * This allows receiving real-time updates without polling
     */
    async initializeDialogSignalR() {
      const store = apiStore();

      if (!store.isBackendReachable) {
        console.warn('[dialogStore] Backend is not reachable, cannot establish SignalR connection');
        return;
      }

      // Check if already connected
      if (signalRDialogService.isSignalRConnected()) {
        console.log('[dialogStore] SignalR already connected, skipping initialization');
        return;
      }

      try {
        console.log('[dialogStore] Initializing SignalR connection via service');

        // Set up callbacks
        signalRDialogService.setDialogCallback((dialogData) => {
          console.log('[dialogStore] Dialog callback triggered:', dialogData);
          this.handleDialogUpdate(dialogData);
        });

        signalRDialogService.setMeasurementCallback((measurement) => {
          console.log('[dialogStore] Measurement callback triggered:', measurement);
          this.handleMeasurementUpdate(measurement);
        });

        signalRDialogService.setDialogStatusCallback((status) => {
          console.log('[dialogStore] Status callback triggered:', status);
          this.handleStatusUpdate(status);
        });

        signalRDialogService.setClearDialogCallback((contentType) => {
          console.log('[dialogStore] Clear dialog callback triggered:', contentType);
          this.handleClearDialog(contentType);
        });

        signalRDialogService.setStatusCallback((status) => {
          console.log('[dialogStore] SignalR connection status:', status);
          this.isConnectedToSignalR = status === 'Connected' || status === 'Reconnected';
          if (status === 'Reconnecting') this.dropDialogsBeforeReplay();
        });

        this.dropDialogsBeforeReplay();

        // Connect. isConnectedToSignalR is driven exclusively by the status
        // callback above: connect() can resolve without a live connection when
        // the first attempt fails (the factory arms a background restart
        // instead of rejecting), so it must not set the flag itself here.
        await signalRDialogService.connect();
        console.log('[dialogStore] Dialog SignalR connect() attempt finished');
      } catch (error) {
        console.error('[dialogStore] Failed to establish SignalR connection:', error);
        this.isConnectedToSignalR = false;
      }
    },

    /**
     * The dialog hub sends every active dialog on each connect, but a ClearDialog sent while
     * the app was away is lost. Dropping the list before connecting leaves only live dialogs.
     * Must run before the connection is up: the replay can arrive ahead of the Connected status.
     */
    dropDialogsBeforeReplay() {
      this.dialogs = [];
      this.slewAndCenterData = null;
      this.meridianFlipData = null;
    } /**
     * Handle dialog update from SignalR
     */,
    handleDialogUpdate(dialogData) {
      console.log('[dialogStore] handleDialogUpdate received:', dialogData);

      // Keep dialog data as-is, only normalize essential properties for dialog management
      const normalizedDialog = {
        ...dialogData,
        // Normalize only ContentType and Title for dialog identification and display
        Title: dialogData.Title || dialogData.title,
        ContentType: dialogData.ContentType || dialogData.contentType,
        AvailableCommands: dialogData.AvailableCommands || dialogData.availableCommands || [],
      };

      console.log('[dialogStore] Normalized dialog:', normalizedDialog);
      console.log('[dialogStore] ContentType:', normalizedDialog.ContentType);

      // Update or add the dialog to the dialogs array
      const existingIndex = this.dialogs.findIndex(
        (d) => d.ContentType === normalizedDialog.ContentType
      );

      if (existingIndex >= 0) {
        // Update existing dialog
        console.log('[dialogStore] Updating existing dialog at index', existingIndex);
        this.dialogs[existingIndex] = {
          ...this.dialogs[existingIndex],
          ...normalizedDialog,
        };
      } else {
        // Add new dialog
        console.log('[dialogStore] Adding new dialog');
        this.dialogs.push(normalizedDialog);
      }

      console.log('[dialogStore] Current dialogs array:', this.dialogs);
    },

    /**
     * Handle measurement update from SignalR
     */
    handleMeasurementUpdate(measurement) {
      if (!this.slewAndCenterData) {
        this.slewAndCenterData = {
          Active: true,
          Status: '',
          CurrentMeasurement: null,
          Measurements: [],
        };
      }

      // Update current measurement
      this.slewAndCenterData.CurrentMeasurement = measurement;

      // Add to measurements history
      if (!this.slewAndCenterData.Measurements) {
        this.slewAndCenterData.Measurements = [];
      }
      this.slewAndCenterData.Measurements.push(measurement);
    },

    /**
     * Handle status update from SignalR
     */
    handleStatusUpdate(status) {
      if (!this.slewAndCenterData) {
        this.slewAndCenterData = {
          Active: true,
          Status: status,
          CurrentMeasurement: null,
          Measurements: [],
        };
      } else {
        this.slewAndCenterData.Status = status;
      }
    },

    /**
     * Handle clear dialog from SignalR
     */
    handleClearDialog(contentType) {
      console.log('[dialogStore] handleClearDialog called with contentType:', contentType);
      console.log('[dialogStore] Current dialogs before clear:', this.dialogs);

      // Remove dialog from the dialogs array
      const beforeCount = this.dialogs.length;
      this.dialogs = this.dialogs.filter((d) => d.ContentType !== contentType);
      const afterCount = this.dialogs.length;

      console.log('[dialogStore] Dialogs removed:', beforeCount - afterCount);
      console.log('[dialogStore] Current dialogs after clear:', this.dialogs);

      // Clear related data based on dialog type
      if (contentType === 'NINA.WPF.Base.ViewModel.PlateSolvingStatusVM') {
        this.slewAndCenterData = null;
        // Cancel the in-flight API request and reset state
        const framingStore = useFramingStore();
        framingStore.cancelSlewAndCenter();
        console.log('[dialogStore] Cancelled slew and center operation');
      } else if (contentType === 'NINA.WPF.Base.ViewModel.MeridianFlipVM') {
        this.meridianFlipData = null;
      }
    },

    /**
     * Close Plate Solving Dialog with cleanup
     */
    async closePlateSolvingDialog() {
      try {
        const contentType = 'NINA.WPF.Base.ViewModel.PlateSolvingStatusVM';
        const dialog = this.dialogs.find((d) => d.ContentType === contentType);

        if (!dialog) {
          console.warn('[dialogStore] No Plate Solving dialog found to close');
          return;
        }

        console.log('[dialogStore] Closing Plate Solving dialog...');

        // 2. Cleanup state
        this.slewAndCenterData = null;
        console.log('[dialogStore] Slew and center cancelled');

        // 3. Close dialog via button click
        const store = apiStore();
        const buttonToClick = store.isPINS ? 'Cancel' : 'PART_CloseButton';
        await this.clickButton(buttonToClick, dialog.Title);

        // 4. Remove dialog from array (in case server doesn't send ClearDialog event)
        this.dialogs = this.dialogs.filter((d) => d.ContentType !== contentType);
        console.log('[dialogStore] Plate Solving dialog closed and removed');

        // 1. Send stop commands. Only while slewing: an INDI abort also ends tracking, so
        // closing the dialog during a solve or a sequence would stop the mount for good.
        if (!store.mountIsSlewing) return;
        try {
          await apiService.slewStop();
          console.log('[dialogStore] Stop commands sent successfully');
        } catch (error) {
          console.error('[dialogStore] Error sending stop commands:', error);
        }
      } catch (error) {
        console.error('[dialogStore] Error closing Plate Solving dialog:', error);
      }
    },

    /**
     * Close AutoFocus Dialog with cleanup
     */
    async closeAutoFocusDialog() {
      try {
        const contentTypes = [
          'NINA.Joko.Plugins.HocusFocus.AutoFocus.HocusFocusVM',
          'NINA.WPF.Base.ViewModel.AutoFocus.AutoFocusVM',
        ];
        const dialog = this.dialogs.find((d) => contentTypes.includes(d.ContentType));

        if (!dialog) {
          console.warn('[dialogStore] No AutoFocus dialog found to close');
          return;
        }

        console.log('[dialogStore] Closing AutoFocus dialog...');

        // 1. Send stop command
        try {
          await apiService.focuserAfAction('stopp');
          console.log('[dialogStore] AutoFocus stopped successfully');
        } catch (error) {
          console.error('[dialogStore] Error stopping AutoFocus:', error);
        }

        // 2. Close dialog via button click
        const store = apiStore();
        const buttonToClick = store.isPINS ? 'Cancel' : 'PART_CloseButton';
        await this.clickButton(buttonToClick, dialog.Title);

        // 3. Remove dialog from array (in case server doesn't send ClearDialog event)
        this.dialogs = this.dialogs.filter((d) => !contentTypes.includes(d.ContentType));
        console.log('[dialogStore] AutoFocus dialog closed and removed');
      } catch (error) {
        console.error('[dialogStore] Error closing AutoFocus dialog:', error);
      }
    },

    /**
     * Close Manual Rotator Dialog with cleanup
     */
    async closeManualRotatorDialog() {
      try {
        const dialog = this.dialogs.find(
          (d) => d.ContentType === 'NINA.Equipment.Equipment.MyRotator.ManualRotator'
        );

        if (!dialog) {
          console.warn('[dialogStore] No Manual Rotator dialog found to close');
          return;
        }

        console.log('[dialogStore] Closing Manual Rotator dialog...');

        // Close dialog via button click
        const store = apiStore();
        const buttonToClick = store.isPINS ? 'Cancel' : 'PART_CloseButton';
        await this.clickButton(buttonToClick, dialog.Title);

        // Remove dialog from array (in case server doesn't send ClearDialog event)
        this.dialogs = this.dialogs.filter(
          (d) => d.ContentType !== 'NINA.Equipment.Equipment.MyRotator.ManualRotator'
        );
        console.log('[dialogStore] Manual Rotator dialog closed and removed');
      } catch (error) {
        console.error('[dialogStore] Error closing Manual Rotator dialog:', error);
      }
    },

    /**
     * Close Meridian Flip Dialog with cleanup
     */
    async closeMeridianFlipDialog() {
      try {
        const dialog = this.dialogs.find(
          (d) => d.ContentType === 'NINA.WPF.Base.ViewModel.MeridianFlipVM'
        );

        if (!dialog) {
          console.warn('[dialogStore] No Meridian Flip dialog found to close');
          return;
        }

        console.log('[dialogStore] Closing Meridian Flip dialog...');

        // Cleanup data
        this.meridianFlipData = null;

        // Close dialog via button click
        const store = apiStore();
        const buttonToClick = store.isPINS ? 'Cancel' : 'PART_CloseButton';
        await this.clickButton(buttonToClick, dialog.Title);

        // Remove dialog from array (in case server doesn't send ClearDialog event)
        this.dialogs = this.dialogs.filter(
          (d) => d.ContentType !== 'NINA.WPF.Base.ViewModel.MeridianFlipVM'
        );
        console.log('[dialogStore] Meridian Flip dialog closed and removed');
      } catch (error) {
        console.error('[dialogStore] Error closing Meridian Flip dialog:', error);
      }
    },

    /**
     * Generic close dialog function for dialogs without special cleanup
     */
    async closeDialog(contentType) {
      try {
        const dialog = this.dialogs.find((d) => d.ContentType === contentType);

        if (!dialog) {
          console.warn(`[dialogStore] No dialog found with ContentType: ${contentType}`);
          return;
        }

        console.log(`[dialogStore] Closing dialog: ${contentType}`);

        // Close dialog via button click
        const store = apiStore();
        const buttonToClick = store.isPINS ? 'Cancel' : 'PART_CloseButton';
        await this.clickButton(buttonToClick, dialog.Title);

        // Remove dialog from array (in case server doesn't send ClearDialog event)
        this.dialogs = this.dialogs.filter((d) => d.ContentType !== contentType);
        console.log(`[dialogStore] Dialog closed and removed: ${contentType}`);
      } catch (error) {
        console.error(`[dialogStore] Error closing dialog (${contentType}):`, error);
      }
    },

    /**
     * Disconnect from SignalR
     */
    async disconnectDialogSignalR() {
      try {
        await signalRDialogService.disconnect();
        console.log('[dialogStore] Disconnected from dialog SignalR');
        this.isConnectedToSignalR = false;
      } catch (error) {
        console.error('[dialogStore] Error disconnecting from SignalR:', error);
      }
    },

    /**
     * Toggle minimize state for a dialog
     */
    toggleMinimizedDialog(dialogId) {
      this.minimizedDialogs[dialogId] = !this.minimizedDialogs[dialogId];
    },

    /**
     * Check if a dialog is minimized
     */
    isDialogMinimized(dialogId) {
      return !!this.minimizedDialogs[dialogId];
    },

    /**
     * Minimize a dialog
     */
    minimizeDialog(dialogId) {
      this.minimizedDialogs[dialogId] = true;
    },

    /**
     * Restore a minimized dialog
     */
    restoreDialog(dialogId) {
      this.minimizedDialogs[dialogId] = false;
    },
  },
});
