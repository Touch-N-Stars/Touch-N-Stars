import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { useToastStore } from './toastStore';
import { apiStore } from '@/store/store';

export const useMountStore = defineStore('mountStore', {
  state: () => ({
    lastDirection: '',
    rate: 1,
    wsIsConnected: false,
    isSyncCoordinates: false,
    lastSyncTime: null,
  }),
  actions: {
    async syncCoordinates(raAngle, decAngle) {
      const toastStore = useToastStore();
      const store = apiStore();
      this.isSyncCoordinates = true;

      if (!store.mountInfo.Connected) {
        toastStore.showToast({
          type: 'warning',
          title: 'Mount',
          message: 'Mount not connected',
        });
        console.error('[mountSotre] Mount not connected');
        return { success: false, error: 'Mount not connected' };
      }
      try {
        const response = await apiService.mountAction(`sync?ra=${raAngle}&dec=${decAngle}`);
        console.log('[mountSotre] Sync response:', response);
        // Speichere lastSyncTime bei erfolgreichem Sync
        this.lastSyncTime = new Date().toISOString();
        console.log('[mountSotre] Coordinates synced successfully', this.lastSyncTime);

        toastStore.showToast({
          type: 'success',
          title: 'Mount',
          message: 'Coordinates synced successfully',
        });

        return { success: true, response };
      } catch (error) {
        console.log('[mountSotre] Error when syncing the coordinates');

        toastStore.showToast({
          type: 'error',
          title: 'Mount',
          message: 'Error when syncing the coordinates',
        });

        return { success: false, error };
      } finally {
        this.isSyncCoordinates = false;
      }
    },
  },
});
