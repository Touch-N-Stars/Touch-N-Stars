import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { loadAllPluginsMetadata, importPlugin } from '@/utils/pluginDiscovery';

export const usePluginStore = defineStore('pluginStore', {
  state: () => ({
    plugins: [],
    navigationItems: [],
    isInitialized: false,
  }),
  actions: {
    registerPlugin(plugin) {
      // Check if plugin already exists
      const existingPluginIndex = this.plugins.findIndex((p) => p.id === plugin.id);
      if (existingPluginIndex >= 0) {
        // Update existing plugin
        this.plugins[existingPluginIndex] = plugin;
      } else {
        // Add new plugin
        this.plugins.push(plugin);
      }
    },

    addNavigationItem(item) {
      // Remove existing navigation item for this plugin if it exists
      this.navigationItems = this.navigationItems.filter(
        (navItem) => navItem.pluginId !== item.pluginId
      );
      // Then add the new one
      this.navigationItems.push(item);
    },

    async togglePlugin(pluginId, enabled) {
      const plugin = this.plugins.find((p) => p.id === pluginId);
      if (!plugin) return;

      plugin.enabled = enabled;

      if (enabled) {
        // Ensure plugin has a pluginPath before initializing
        if (!plugin.pluginPath) {
          // Find the next available plugin number
          const existingPaths = this.plugins
            .map((p) => p.pluginPath)
            .filter((path) => path && path.match(/^\/plugin\d+$/))
            .map((path) => parseInt(path.replace('/plugin', '')))
            .sort((a, b) => a - b);

          let nextNumber = 1;
          for (const num of existingPaths) {
            if (num === nextNumber) {
              nextNumber++;
            } else {
              break;
            }
          }

          plugin.pluginPath = `/plugin${nextNumber}`;
        }

        // Load and initialize the plugin if it's enabled
        await this.initializePlugin(plugin.id);
      } else {
        // If disabled, remove navigation item
        this.navigationItems = this.navigationItems.filter((item) => item.pluginId !== pluginId);
      }
    },

    getEnabledPlugins() {
      return this.plugins.filter((plugin) => plugin.enabled);
    },

    // Initialize app and router references (called from main.js)
    initializeAppAndRouter(app, router) {
      this._app = app;
      this._router = router;
      this._pluginRouteNames = {}; // tracks registered route name per pluginId (not persisted)
    },

    async loadAndRegisterPlugins(forceReload = false) {
      if (this.isInitialized && !forceReload) return;

      try {
        // Load all plugins metadata first
        const pluginsMetadata = await loadAllPluginsMetadata();

        // Store current user settings before updating
        const userSettings = new Map();
        this.plugins.forEach((plugin) => {
          userSettings.set(plugin.id, { enabled: plugin.enabled });
        });

        // Clear plugins array and reload with fresh metadata
        this.plugins = [];

        // Register metadata for all discovered plugins
        //console.log('Loading plugins metadata:', pluginsMetadata);
        let pluginIndex = 1;
        pluginsMetadata.forEach((metadata) => {
          // Skip plugins that are disabled in metadata (unless user has enabled them)
          const userSetting = userSettings.get(metadata.id);

          // Only add plugin if it's enabled in metadata OR user has previously enabled it
          if (metadata.enabled || (userSetting !== undefined && userSetting.enabled)) {
            const newPlugin = {
              ...metadata,
              // Use user setting if available, otherwise use defaultEnabled from metadata
              enabled:
                userSetting !== undefined ? userSetting.enabled : metadata.defaultEnabled || false,
              // Generate plugin path based on actual plugins added
              pluginPath: `/plugin${pluginIndex}`,
            };

            this.plugins.push(newPlugin);
            //console.log('Added plugin:', newPlugin);
            pluginIndex++;
          } else {
            console.log('Skipped disabled plugin:', metadata.id);
          }
        });

        //console.log('Final plugins array:', this.plugins);

        this.isInitialized = true;
      } catch (error) {
        console.error('Error loading plugins:', error);
      }
    },

    // Initialize all enabled plugins
    async initializeEnabledPlugins() {
      const enabledPlugins = this.getEnabledPlugins();
      for (const plugin of enabledPlugins) {
        await this.initializePlugin(plugin.id);
      }
    },

    // Initialize a specific plugin by ID
    async initializePlugin(pluginId) {
      if (!this._app || !this._router) {
        console.error('App and router must be initialized before initializing plugins');
        return;
      }

      try {
        const plugin = this.plugins.find((p) => p.id === pluginId);
        if (!plugin) {
          console.warn(`Plugin ${pluginId} not found`);
          return;
        }

        // Skip if the plugin is not enabled
        if (!plugin.enabled) return;

        const pluginModule = await importPlugin(plugin.id);
        if (pluginModule && typeof pluginModule.install === 'function') {
          // Proxy the router to intercept addRoute calls:
          // - removes the old route for this plugin (prevents duplicate routes)
          // - assigns a stable unique name so removeRoute works later
          const routeName = `plugin-${pluginId}`;
          const self = this;
          const routerProxy = new Proxy(this._router, {
            get(target, prop) {
              if (prop === 'addRoute') {
                return (route) => {
                  if (self._pluginRouteNames?.[pluginId]) {
                    target.removeRoute(self._pluginRouteNames[pluginId]);
                  }
                  const namedRoute = { ...route, name: routeName };
                  const result = target.addRoute(namedRoute);
                  if (!self._pluginRouteNames) self._pluginRouteNames = {};
                  self._pluginRouteNames[pluginId] = routeName;
                  return result;
                };
              }
              return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
            },
          });
          pluginModule.install(this._app, { router: routerProxy });
        }
      } catch (error) {
        console.error(`Error initializing plugin ${pluginId}:`, error);
      }
    },

    addPluginNavigationItem(pluginId, navigationItem) {
      // This method is now called by each plugin to add its own navigation item
      if (!navigationItem) return;

      // Add plugin ID to the navigation item
      navigationItem.pluginId = pluginId;
      // Avoid making component constructors reactive
      if (navigationItem.icon) {
        navigationItem.icon = markRaw(navigationItem.icon);
      }

      // Add the navigation item
      this.addNavigationItem(navigationItem);
    },
  },
  persist: {
    enabled: true,
    strategies: [
      {
        key: 'plugin-store',
        storage: localStorage,
        paths: ['plugins'],
      },
    ],
  },
});
