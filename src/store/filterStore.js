import { showLocationSyncModal } from '@/utils/locationSyncUtils'; // eslint-disable-line no-unused-vars
import { defineStore } from 'pinia';
import { apiStore } from './store';
import apiService from '@/services/apiService';

export const useFilterStore = defineStore('filterStore', {
  state: () => ({
    wsIsConnected: false,
    filterChange: false,
    message: '',
    filterName: '',
    filterwheelSettings: {},
  }),
  actions: {
    //Read Camera settings (only PINS)
    async readSettings() {
      const store = apiStore();
      if (!store.isPINS) return;
      if (!store.filterInfo.Connected) return;
      try {
        const response = await apiService.filterAction('get-settings');
        this.filterwheelSettings = response.Response;
        console.log('[Filterstore] filterwheel Settings: ', response.Response);
      } catch (error) {
        console.error(' [Filterstore]Error fetching filterwheel Settings:', error.message);
      }
    },
  },
});
