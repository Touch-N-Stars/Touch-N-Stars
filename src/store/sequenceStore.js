import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { apiStore } from './store';
import { createPoller } from '@/utils/poller';

export const useSequenceStore = defineStore('sequenceStore', {
  state: () => ({
    firstLoad: true,
    sequenceInfo: [],
    collapsedStates: {},
    sequenceIsLoaded: false,
    sequenceLoading: false,
    sequenceRunning: false,
    sequenceControlsLocked: false,
    autoLockControlsOnStart: false,
    sequenceRunningInitialized: false,
    sequenceEdit: false,
    sequenceIsEditable: true,
    targetName: '',
    lastTargetName: '',
    imageTargetNames: {},
    runningItems: [],
    runningConditions: [],
    showTnsModal: false,
    tnsModalMessage: '',
    selectedImageIndex: null,
    lastSequenceFilePath: '',
  }),
  actions: {
    setSelectedImageIndex(index) {
      if (index === null || (Number.isInteger(index) && index >= 0)) {
        this.selectedImageIndex = index;
      }
    },
    // Drives the full-screen loading overlay while a sequence is being loaded into NINA.
    setSequenceLoading(isLoading) {
      this.sequenceLoading = !!isLoading;
    },
    setSequenceRunning(isRunning) {
      // The very first status sync after startup only learns the state that was
      // already there - it is not a start we should react to.
      const isInitialSync = !this.sequenceRunningInitialized;
      this.sequenceRunningInitialized = true;

      // Check if the sequence state has changed
      if (this.sequenceRunning !== isRunning) {
        // If the sequence is now running and it wasn't before, it has started
        if (isRunning && !this.sequenceRunning) {
          // ensure image names are retained for new run
          this.imageTargetNames = { ...this.imageTargetNames };

          // Auto-lock the sequence controls so an accidental touch cannot modify a
          // running sequence. This never unlocks - that stays a manual action.
          // Skipped on the initial sync, otherwise reloading the app during a run
          // would restore a lock the user had deliberately released.
          if (this.autoLockControlsOnStart && !this.sequenceControlsLocked && !isInitialSync) {
            this.setSequenceControlsLocked(true);
          }
        }
        // If the sequence is no longer running and it was before, it has completed
        else if (!isRunning && this.sequenceRunning) {
          // do not wipe imageTargetNames here to preserve recorded names
        }
      }

      this.sequenceRunning = isRunning;
    },
    setSequenceControlsLocked(isLocked) {
      this.sequenceControlsLocked = !!isLocked;

      if (this.sequenceControlsLocked && this.sequenceEdit) {
        this.sequenceEdit = false;
        this.startFetching();
      }

      this.saveSequenceControlsLocked();
    },

    async loadSequenceControlsLocked() {
      const response = await apiService.getSetting('sequence_controls_locked');
      if (response?.Response?.Value !== undefined) {
        this.sequenceControlsLocked = response.Response.Value === 'true';
      }
    },

    async saveSequenceControlsLocked() {
      const res = await apiService.createSetting({
        Key: 'sequence_controls_locked',
        Value: String(this.sequenceControlsLocked),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting(
          'sequence_controls_locked',
          String(this.sequenceControlsLocked)
        );
      }
    },

    setAutoLockControlsOnStart(enabled) {
      this.autoLockControlsOnStart = !!enabled;
      this.saveAutoLockControlsOnStart();
    },

    async loadAutoLockControlsOnStart() {
      const response = await apiService.getSetting('sequence_auto_lock_on_start');
      if (response?.Response?.Value !== undefined) {
        this.autoLockControlsOnStart = response.Response.Value === 'true';
      }
    },

    async saveAutoLockControlsOnStart() {
      const res = await apiService.createSetting({
        Key: 'sequence_auto_lock_on_start',
        Value: String(this.autoLockControlsOnStart),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting(
          'sequence_auto_lock_on_start',
          String(this.autoLockControlsOnStart)
        );
      }
    },
    setImageTargetName(index, name) {
      if (!Number.isInteger(index) || index < 0) return;

      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName) return;

      const existingName = this.imageTargetNames[index];
      if (existingName && existingName.trim().length > 0) {
        if (existingName === trimmedName) {
          this.lastTargetName = trimmedName;
        }
        return;
      }

      this.imageTargetNames = {
        ...this.imageTargetNames,
        [index]: trimmedName,
      };

      this.lastTargetName = trimmedName;
    },
    getImageTargetName(index) {
      if (!Number.isInteger(index) || index < 0) return '';

      return this.imageTargetNames[index] || '';
    },
    clearImageTargetNames() {
      this.imageTargetNames = {};
    },
    toggleCollapsedState(containerName) {
      this.collapsedStates = {
        ...this.collapsedStates,
        [containerName]: !this.collapsedStates[containerName],
      };
    },

    isCollapsed(containerName) {
      return !!this.collapsedStates[containerName];
    },

    setCollapsedState(path, isCollapsed) {
      this.collapsedStates = {
        ...this.collapsedStates,
        [path]: isCollapsed,
      };
    },
    toggleCollapsedState(path) {
      this.collapsedStates[path] = !this.collapsedStates[path];
    },
    isCollapsed(path) {
      return !!this.collapsedStates[path];
    },
    initializeCollapsedStates(items) {
      if (!items) return;
      items.forEach((item) => {
        if (item && item._path && this.collapsedStates[item._path] === undefined) {
          this.collapsedStates[item._path] = false;
        }
        if (item.Items) {
          this.initializeCollapsedStates(item.Items);
        }
      });
    },

    async getSequenceInfoState() {
      try {
        return await apiService.sequenceAction('state');
      } catch (error) {
        this.sequenceIsEditable = false;
        console.error('Error fetching sequence info state:', error);
      }
    },

    async getSequenceInfoJson() {
      try {
        return await apiService.sequenceAction('json');
      } catch (error) {
        console.error('Error fetching sequence info json:', error);
      }
    },

    countKeysDeep(obj) {
      let count = 0;
      function recurse(current) {
        if (typeof current === 'object' && current !== null) {
          for (const key in current) {
            if (Object.prototype.hasOwnProperty.call(current, key)) {
              count++;
              recurse(current[key]);
            }
          }
        }
      }
      recurse(obj);
      return count;
    },

    checkForSpecialNamesRecursive(items) {
      if (!items || !Array.isArray(items)) return false;

      for (const item of items) {
        const name = typeof item?.Name === 'string' ? item.Name : '';

        if (name.includes('Target Scheduler') || name.includes('+_Container')) {
          return true;
        }

        // rekursiv in verschachtelten Items weitersuchen
        if (item.Items && this.checkForSpecialNamesRecursive(item.Items)) {
          return true;
        }
      }
      return false;
    },

    async getSequenceInfo() {
      let response = null;
      let foundUnsupportedPlugins = false;
      const store = apiStore();

      if (!store.isBackendReachable) return;

      if (this.firstLoad) {
        response = await this.getSequenceInfoJson();
        if (Array.isArray(response?.Response)) {
          foundUnsupportedPlugins = response.Response?.some((response) =>
            this.checkForSpecialNamesRecursive(response.Items)
          );
        }

        if (foundUnsupportedPlugins) {
          this.sequenceIsEditable = false;
          console.log('Found unsupported plugins');
        }
        this.firstLoad = false;
      }

      if (
        this.sequenceIsEditable &&
        !store.isPINS &&
        !store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.2.8.0')
      ) {
        //console.log('Abfrage state');
        response = await this.getSequenceInfoState();
        const keysCount = this.countKeysDeep(response);

        //console.log(response);
        if (response?.StatusCode === 500 || !response?.StatusCode || keysCount > 4000) {
          // begrenzen auf 4000 keys damit es nicht zu lange dauert
          console.log('not editable');
          this.sequenceIsEditable = false;
          response = await this.getSequenceInfoJson();
        }
      } else {
        //console.log('Abfrage json');
        response = await this.getSequenceInfoJson();
      }

      if (response?.Success) {
        const isEmptySequence = this.isSequenceResponseEmpty(response.Response);
        if (isEmptySequence) {
          this.sequenceInfo = [];
          this.sequenceIsLoaded = false;
          this.setSequenceRunning(false);
          this.targetName = '';
          this.runningItems = [];
          this.runningConditions = [];
          this.collapsedStates = {};
          return;
        }

        // Check for errors in sequence items
        let hasErrors = false;
        let errorMessage = '';

        if (Array.isArray(response.Response)) {
          for (const container of response.Response) {
            if (container.Items) {
              for (const item of container.Items) {
                if (item.Status === 'ERROR') {
                  hasErrors = true;
                  errorMessage = item.ErrorMessage || 'Unknown error in sequence';
                  break;
                }
              }
              if (hasErrors) break;
            }
          }
        }

        if (hasErrors) {
          console.warn('Sequence error detected:', errorMessage);
        }

        this.sequenceInfo = response.Response;

        // TargetName auslesen, wenn vorhanden
        for (const container of this.sequenceInfo) {
          if (container?.Items) {
            this.findAndSetTargetName(container.Items);
            if (this.targetName) break; // Bei erstem Treffer abbrechen
          }
        }

        if (this.sequenceIsEditable) {
          this.generatePaths(this.sequenceInfo);
        }
        this.sequenceIsLoaded = true;

        // Check if any sequence is running by searching for RUNNING status
        const isRunning = response.Response?.some((sequence) =>
          sequence.Items?.some((item) => item.Status === 'RUNNING')
        );

        // Collect all running items with their names from already-fetched response
        const oldRunningItems = this.runningItems;
        const oldRunningConditions = this.runningConditions;

        this.runningItems = [];
        this.runningConditions = [];

        this.collectRunningItems(response.Response);
        this.collectRunningConditions(response.Response);

        // Only update if arrays actually changed
        if (JSON.stringify(oldRunningItems) === JSON.stringify(this.runningItems)) {
          this.runningItems = oldRunningItems;
        }
        if (JSON.stringify(oldRunningConditions) === JSON.stringify(this.runningConditions)) {
          this.runningConditions = oldRunningConditions;
        }

        // Update sequence running state (this will trigger notification if state changed)
        this.setSequenceRunning(isRunning || false);
      } else {
        this.sequenceIsLoaded = false;
        this.setSequenceRunning(false);
      }
    },

    isSequenceResponseEmpty(containers) {
      if (!Array.isArray(containers) || containers.length === 0) {
        return true;
      }

      const hasContent = containers.some((container) => {
        if (!container || typeof container !== 'object') return false;

        const hasItems = Array.isArray(container.Items) && container.Items.length > 0;
        const hasContainerTriggers =
          Array.isArray(container.Triggers) && container.Triggers.length > 0;
        const hasContainerConditions =
          Array.isArray(container.Conditions) && container.Conditions.length > 0;
        const hasGlobalTriggers =
          Array.isArray(container.GlobalTriggers) && container.GlobalTriggers.length > 0;

        return hasItems || hasContainerTriggers || hasContainerConditions || hasGlobalTriggers;
      });

      return !hasContent;
    },

    generatePaths(sequenceData) {
      sequenceData.forEach((container, index) => {
        let pathPart = '';

        // Setze pathPart je nach Index
        if (index === 0) {
          pathPart = 'Global';
        } else if (index === 1) {
          pathPart = 'Start';
        } else if (index === 2) {
          pathPart = 'Imaging';
        } else if (index === 3) {
          pathPart = 'End';
        } else {
          pathPart = `Custom-${index}`;
        }

        // Setze den _path für das Container-Objekt
        container._path = pathPart;

        // Falls der Container GlobalTriggers hat, ebenfalls Pfade generieren
        if (container.GlobalTriggers) {
          container.GlobalTriggers.forEach((trigger, tIndex) => {
            // GlobalTriggers sind auf oberster Ebene, brauchen kein Container-Präfix
            const triggerPath = `GlobalTriggers-${tIndex}`;
            trigger._path = triggerPath;
          });
        }

        // Falls der Container Items hat, rekursiv bearbeiten
        if (container.Items) {
          this.generateItemPaths(container.Items, pathPart);
        }

        // Falls der Container Triggers hat, rekursiv bearbeiten
        if (container.Triggers) {
          this.generateTriggerPaths(container.Triggers, pathPart);
        }

        // Falls der Container Conditions hat, rekursiv bearbeiten
        if (container.Conditions) {
          this.generateConditionsPaths(container.Conditions, pathPart);
        }
      });
    },

    generateItemPaths(items, parentPath) {
      items.forEach((item, idx) => {
        const itemPath = `${parentPath}-Items-${idx}`;
        item._path = itemPath;
        if (item.Items) {
          this.generateItemPaths(item.Items, itemPath);
        }
        if (item.Triggers) {
          this.generateTriggerPaths(item.Triggers, itemPath);
        }
        if (item.Conditions) {
          this.generateConditionsPaths(item.Conditions, itemPath);
        }
      });
    },

    generateTriggerPaths(triggers, parentPath) {
      triggers.forEach((trigger, idx) => {
        const triggerPath = `${parentPath}-Triggers-${idx}`;
        trigger._path = triggerPath;
      });
    },

    generateConditionsPaths(conditions, parentPath) {
      conditions.forEach((condition, idx) => {
        const conditionPath = `${parentPath}-Conditions-${idx}`;
        condition._path = conditionPath;
      });
    },

    collectRunningItems(containers) {
      if (!containers || !Array.isArray(containers)) return;

      containers.forEach((container) => {
        if (container.Items) {
          this.findRunningItemsRecursive(container.Items, [container]);
        }
      });
    },

    collectRunningConditions(containers) {
      if (!containers || !Array.isArray(containers)) return;

      containers.forEach((container) => {
        this.findRunningConditionsRecursive(container);
      });
    },

    findRunningConditionsRecursive(container) {
      if (!container) return;

      // Nur Conditions sammeln wenn der Container RUNNING ist
      if (
        container.Status === 'RUNNING' &&
        container.Conditions &&
        container.Conditions.length > 0
      ) {
        // Nur nicht-disabled Conditions hinzufügen
        const enabledConditions = container.Conditions.filter(
          (condition) => condition.Status !== 'DISABLED'
        );
        this.runningConditions.push(...enabledConditions);
      }

      // Für Items mit Iterations/CompletedIterations eine virtuelle Condition erstellen (nur wenn RUNNING)
      if (
        container.Status === 'RUNNING' &&
        container.Iterations !== undefined &&
        container.CompletedIterations !== undefined &&
        container.Name
      ) {
        this.runningConditions.push({
          Name: `${container.Name}_Iterations`,
          Status: container.Status,
          Iterations: container.Iterations,
          CompletedIterations: container.CompletedIterations,
          Type: 'iterations',
        });
      }

      // Rekursiv durch alle Items gehen
      if (container.Items) {
        container.Items.forEach((item) => {
          this.findRunningConditionsRecursive(item);
        });
      }
    },

    findRunningItemsRecursive(items, containerHierarchy = []) {
      if (!items || !Array.isArray(items)) return;

      items.forEach((item) => {
        // Check for running triggers
        if (item.Triggers && Array.isArray(item.Triggers)) {
          item.Triggers.forEach((trigger) => {
            if (trigger.Name && trigger.Status === 'RUNNING') {
              this.runningItems.push(trigger.Name);
            }
          });
        }

        // Wenn Item RUNNING ist und verschachtelte Items hat, nur tiefer suchen
        if (item.Status === 'RUNNING' && item.Items && item.Items.length > 0) {
          // Aktuelles Item zur Hierarchie hinzufügen, falls es ein Container ist
          const newHierarchy = item.Name ? [...containerHierarchy, item] : containerHierarchy;
          this.findRunningItemsRecursive(item.Items, newHierarchy);
        }
        // Wenn Item RUNNING ist aber keine verschachtelten Items hat, hinzufügen
        else if (
          item.Status === 'RUNNING' &&
          item.Name &&
          (!item.Items || item.Items.length === 0)
        ) {
          let itemName = item.Name;

          this.runningItems.push(itemName);
        }
        // Wenn Item nicht RUNNING ist, trotzdem tiefer suchen
        else if (item.Items && item.Items.length > 0) {
          // Aktuelles Item zur Hierarchie hinzufügen, falls es ein Container ist
          const newHierarchy = item.Name ? [...containerHierarchy, item] : containerHierarchy;
          this.findRunningItemsRecursive(item.Items, newHierarchy);
        }
      });
    },

    findIterationInfoInHierarchy(containerHierarchy) {
      // Von der äußersten zur innersten Ebene suchen
      for (let i = containerHierarchy.length - 1; i >= 0; i--) {
        const container = containerHierarchy[i];
        const iterationInfo = this.findIterationInfoInConditions(container.Conditions);
        if (iterationInfo) {
          return iterationInfo;
        }
      }
      return null;
    },

    findIterationInfoInConditions(conditions) {
      if (!conditions || !Array.isArray(conditions)) return null;

      for (const condition of conditions) {
        if (condition.Iterations !== undefined && condition.CompletedIterations !== undefined) {
          return {
            completed: condition.CompletedIterations,
            total: condition.Iterations,
          };
        }
      }
      return null;
    },

    findAndSetTargetName(items) {
      if (!items || !Array.isArray(items)) return;
      this.targetName = '';

      for (const item of items) {
        // Wenn das Item läuft und ein Target hat, speichern
        if (item?.Status === 'RUNNING') {
          const resolvedName = this.extractTargetName(item.Target);
          if (resolvedName) {
            this.targetName = resolvedName;
            this.lastTargetName = resolvedName;
            //console.log('Aktives Target (RUNNING):', this.targetName);
            return; // ersten aktiven Treffer nehmen
          }
        }
      }
    },

    extractTargetName(target) {
      if (!target) return '';

      if (typeof target === 'string') {
        return target.trim();
      }

      if (typeof target.TargetName === 'string') {
        return target.TargetName.trim();
      }

      return '';
    },

    startFetching() {
      this.stopFetching(); // Stop any existing interval before starting a new one
      if (!this._sequencePoller) {
        this._sequencePoller = createPoller(() => this.getSequenceInfo(), 5000, {
          immediate: true,
        });
      }
      this._sequencePoller.start();
    },

    stopFetching() {
      this._sequencePoller?.stop();
    },
    // Reset the active sequence on the backend
    async resetSequence() {
      try {
        await apiService.sequenceAction('reset');
        return true;
      } catch (error) {
        console.error('Error resetting sequence:', error);
        return false;
      }
    },

    async fetchAvailableSequences() {
      try {
        const response = await apiService.sequenceAction('list-available');
        console.log('Available sequences:', response.Response);
        return response;
      } catch (error) {
        console.error('Error fetching available sequences:', error);
        throw error;
      }
    },

    setLastSequenceFilePath(filePath) {
      this.lastSequenceFilePath = filePath;
    },
  },
});
