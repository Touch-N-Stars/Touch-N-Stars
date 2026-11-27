<template>
  <div class="min-h-screen pb-10">
    <div class="container py-8 max-w-4xl mx-auto px-4">
      <!-- Header -->
      <div class="mb-6 flex flex-col gap-1">
        <h1 class="text-3xl font-bold text-content">{{ $t('plugins.tenmicron.title') }}</h1>
        <p class="text-content-muted text-sm">{{ $t('plugins.tenmicron.subtitle') }}</p>
      </div>

      <!-- Until the first status round trip lands, neither notice below can be trusted:
           pluginLoaded starts false, so the "not loaded" warning would flash on every cold open. -->
      <div
        v-if="tmStore.isLoading && !tmStore.pluginLoaded"
        class="flex items-center justify-center gap-3 py-10 text-content-muted text-sm"
      >
        <span
          class="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"
        ></span>
        {{ $t('common.loading') }}
      </div>

      <!-- Plugin not loaded notice -->
      <div
        v-else-if="!tmStore.pluginLoaded"
        class="rounded-card border border-status-warn/40 bg-status-warn/10 p-5 text-status-warn text-sm"
      >
        {{ $t('plugins.tenmicron.notLoaded') }}
      </div>

      <!-- Mount not connected notice (plugin loaded but no connection) -->
      <div
        v-else-if="!tmStore.connected"
        class="rounded-card border border-status-warn/40 bg-status-warn/10 p-4 text-status-warn text-sm mb-4"
      >
        {{ $t('plugins.tenmicron.mountNotConnected') }}
      </div>

      <!-- Mount status bar (shown when connected) -->
      <div
        v-if="tmStore.pluginLoaded && tmStore.connected"
        class="tns-card mb-4 flex flex-wrap items-center gap-x-6 gap-y-3"
      >
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <!-- shrink-0 keeps tns-stat-label's built-in truncate from eating the caption at phone
               width; the long status texts wrap onto a second line instead. -->
          <span class="tns-stat-label shrink-0">
            {{ $t('plugins.tenmicron.mountStatus') }}
          </span>
          <span class="text-sm font-semibold text-content">{{ mountStatusText }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3 ml-auto">
          <!-- Dual-Axis Tracking toggle -->
          <div class="flex items-center gap-3">
            <span class="text-sm text-content-muted">{{
              $t('plugins.tenmicron.dualAxisTracking')
            }}</span>
            <toggleButton
              :status-value="tmStore.dualAxisTrackingEnabled"
              :disabled="!tmStore.connected"
              @update:statusValue="toggleDualAxisTracking"
            />
          </div>
          <!-- Refraction Correction toggle -->
          <div class="flex items-center gap-3">
            <span class="text-sm text-content-muted">{{
              $t('plugins.tenmicron.refractionCorrection')
            }}</span>
            <toggleButton
              :status-value="tmStore.refractionCorrectionEnabled"
              :disabled="!tmStore.connected"
              @update:statusValue="toggleRefractionCorrection"
            />
          </div>
        </div>
      </div>

      <!-- Tab bar -->
      <div
        v-if="tmStore.pluginLoaded"
        class="mb-4 border border-line rounded-card bg-surface-1 overflow-hidden"
      >
        <div class="flex border-b border-line overflow-x-auto">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="tmStore.activeTab = tab.id"
            :class="[
              'px-5 min-h-touch text-sm font-semibold transition whitespace-nowrap shrink-0',
              tmStore.activeTab === tab.id
                ? 'border-b-2 border-accent text-content'
                : 'text-content-muted hover:text-content',
            ]"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- ============================================================ -->
        <!-- TAB: Model Builder                                            -->
        <!-- ============================================================ -->
        <div v-if="tmStore.activeTab === 'builder'" class="p-5 space-y-5">
          <!-- Build status badge -->
          <div
            v-if="tmStore.buildInProgress"
            class="flex flex-wrap items-center gap-3 rounded-card bg-accent/10 border border-accent/40 p-3 text-accent text-sm"
          >
            <div class="tns-dot bg-accent animate-pulse" />
            {{ $t('plugins.tenmicron.builder.buildRunning') }}
            <div class="ml-auto flex gap-2">
              <button @click="stopBuild" class="tns-btn-secondary w-auto px-3">
                {{ $t('plugins.tenmicron.builder.stop') }}
              </button>
              <button @click="cancelBuild" class="tns-btn-danger w-auto px-3">
                {{ $t('plugins.tenmicron.builder.cancel') }}
              </button>
            </div>
          </div>

          <!-- Controls row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Point generation -->
            <div class="tns-card space-y-4">
              <h3 class="text-sm font-semibold text-content">
                {{ $t('plugins.tenmicron.builder.pointGeneration') }}
              </h3>

              <!-- Generator type selector -->
              <div class="flex rounded-control overflow-hidden border border-line-strong">
                <button
                  @click="generatorType = 'goldenSpiral'"
                  :class="
                    generatorType === 'goldenSpiral'
                      ? 'bg-accent-action text-white'
                      : 'bg-surface-3 text-content-muted hover:bg-surface-2'
                  "
                  class="flex-1 px-3 min-h-touch text-sm font-semibold transition-colors"
                >
                  {{ $t('plugins.tenmicron.builder.goldenSpiral') }}
                </button>
                <button
                  @click="generatorType = 'siderealPath'"
                  :class="
                    generatorType === 'siderealPath'
                      ? 'bg-accent-action text-white'
                      : 'bg-surface-3 text-content-muted hover:bg-surface-2'
                  "
                  class="flex-1 px-3 min-h-touch text-sm font-semibold transition-colors"
                >
                  {{ $t('plugins.tenmicron.builder.siderealPath') }}
                </button>
              </div>

              <!-- Golden Spiral options -->
              <NumberInputPicker
                v-if="generatorType === 'goldenSpiral'"
                v-model="starCount"
                :label="$t('plugins.tenmicron.builder.starCount')"
                labelKey="plugins.tenmicron.builder.starCount"
                :min="3"
                :max="99"
                :step="1"
                :decimalPlaces="0"
                inputId="tm-star-count"
                @change="setOption('GoldenSpiralStarCount', starCount)"
              />

              <!-- Sidereal Path options -->
              <div v-else class="space-y-4">
                <!-- Target coordinates -->
                <div class="space-y-2">
                  <span class="tns-stat-label">{{ $t('plugins.tenmicron.builder.target') }}</span>
                  <div class="flex gap-2">
                    <button @click="fetchCoordsFromScope" class="tns-btn-secondary flex-1">
                      {{ $t('plugins.tenmicron.builder.fromScope') }}
                    </button>
                    <button @click="fetchCoordsFromSequence" class="tns-btn-secondary flex-1">
                      {{ $t('plugins.tenmicron.builder.fromSequence') }}
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-content-muted" for="tm-sidereal-ra"
                        >RA (h:m:s)</label
                      >
                      <input
                        id="tm-sidereal-ra"
                        v-model="siderealRaStr"
                        type="text"
                        placeholder="0:00:00.0"
                        class="tns-input w-full font-mono"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-content-muted" for="tm-sidereal-dec"
                        >Dec (°:′:″)</label
                      >
                      <input
                        id="tm-sidereal-dec"
                        v-model="siderealDecStr"
                        type="text"
                        placeholder="+00:00:00.0"
                        class="tns-input w-full font-mono"
                      />
                    </div>
                  </div>
                </div>
                <!-- RA Interval -->
                <NumberInputPicker
                  v-model="siderealRaDelta"
                  :label="$t('plugins.tenmicron.builder.raDelta')"
                  labelKey="plugins.tenmicron.builder.raDelta"
                  :min="0.1"
                  :max="30"
                  :step="0.1"
                  :decimalPlaces="1"
                  inputId="tm-sidereal-ra-delta"
                  @change="setOption('SiderealRaDelta', siderealRaDelta)"
                />
                <!-- Time Window -->
                <div class="space-y-2">
                  <span class="tns-stat-label">{{
                    $t('plugins.tenmicron.builder.timeWindow')
                  }}</span>
                  <!-- Start time -->
                  <div class="rounded-control bg-surface-2 border border-line p-3 space-y-3">
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-content-muted" for="tm-sidereal-start">{{
                        $t('plugins.tenmicron.builder.startTime')
                      }}</label>
                      <select
                        id="tm-sidereal-start"
                        v-model="siderealStartProvider"
                        class="tns-select"
                        @change="setOption('SiderealStartProvider', $event.target.value)"
                      >
                        <option v-for="p in SIDEREAL_START_PROVIDERS" :key="p" :value="p">
                          {{ p }}
                        </option>
                      </select>
                    </div>
                    <NumberInputPicker
                      v-model="siderealStartOffset"
                      :label="$t('plugins.tenmicron.builder.offsetMin')"
                      labelKey="plugins.tenmicron.builder.offsetMin"
                      :min="-240"
                      :max="240"
                      :step="5"
                      :decimalPlaces="0"
                      inputId="tm-sidereal-start-offset"
                      @change="setOption('SiderealStartOffset', siderealStartOffset)"
                    />
                  </div>
                  <!-- End time -->
                  <div class="rounded-control bg-surface-2 border border-line p-3 space-y-3">
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-content-muted" for="tm-sidereal-end">{{
                        $t('plugins.tenmicron.builder.endTime')
                      }}</label>
                      <select
                        id="tm-sidereal-end"
                        v-model="siderealEndProvider"
                        class="tns-select"
                        @change="setOption('SiderealEndProvider', $event.target.value)"
                      >
                        <option v-for="p in SIDEREAL_END_PROVIDERS" :key="p" :value="p">
                          {{ p }}
                        </option>
                      </select>
                    </div>
                    <NumberInputPicker
                      v-model="siderealEndOffset"
                      :label="$t('plugins.tenmicron.builder.offsetMin')"
                      labelKey="plugins.tenmicron.builder.offsetMin"
                      :min="-240"
                      :max="240"
                      :step="5"
                      :decimalPlaces="0"
                      inputId="tm-sidereal-end-offset"
                      @change="setOption('SiderealEndOffset', siderealEndOffset)"
                    />
                  </div>
                </div>
              </div>

              <div class="flex gap-2">
                <button
                  @click="generatePoints"
                  :disabled="!tmStore.connected || tmStore.buildInProgress"
                  class="tns-btn-secondary flex-1"
                >
                  {{
                    generatorType === 'siderealPath'
                      ? $t('plugins.tenmicron.builder.generateSidereal')
                      : $t('plugins.tenmicron.builder.generatePoints')
                  }}
                </button>
                <button
                  @click="clearPoints"
                  :disabled="
                    !tmStore.connected ||
                    tmStore.buildInProgress ||
                    tmStore.modelPoints.length === 0
                  "
                  class="tns-btn-secondary w-auto px-3"
                >
                  {{ $t('plugins.tenmicron.builder.clear') }}
                </button>
              </div>
            </div>

            <!-- Build actions -->
            <div class="tns-card space-y-3">
              <h3 class="text-sm font-semibold text-content">
                {{ $t('plugins.tenmicron.builder.buildControl') }}
              </h3>
              <p class="text-xs text-content-faint">
                {{
                  $t('plugins.tenmicron.builder.pointCount', {
                    valid: usableModelPoints.length,
                    total: tmStore.modelPoints.length,
                  })
                }}
              </p>
              <button
                @click="buildModel"
                :disabled="
                  !tmStore.connected ||
                  tmStore.buildInProgress ||
                  tmStore.modelPoints.length === 0 ||
                  !isCameraConnected
                "
                class="tns-btn-primary"
              >
                {{ $t('plugins.tenmicron.builder.buildModel') }}
              </button>
              <p
                v-if="tmStore.connected && !isCameraConnected"
                class="text-xs text-status-warn text-center"
              >
                {{ $t('plugins.tenmicron.builder.noCameraConnected') }}
              </p>
            </div>
          </div>

          <!-- Point Filters & Build Options (disabled while a build is running) -->
          <div
            :class="{ 'opacity-50 pointer-events-none': tmStore.buildInProgress }"
            class="space-y-5"
          >
            <!-- Point Filters -->
            <details class="rounded-card border border-line bg-surface-1">
              <summary
                class="px-4 min-h-touch flex items-center gap-2 text-sm font-semibold text-content cursor-pointer select-none"
              >
                {{ $t('plugins.tenmicron.builder.pointFilters') }}
                <ChevronRightIcon
                  class="summary-chevron ml-auto w-4 h-4 text-content-muted transition-transform duration-200"
                />
              </summary>
              <div class="px-4 pb-4 pt-2 space-y-3">
                <!-- Altitude range -->
                <NumberInputPicker
                  v-model="optMinAlt"
                  :label="$t('plugins.tenmicron.builder.altMin')"
                  labelKey="plugins.tenmicron.builder.altMin"
                  :min="0"
                  :max="89"
                  :step="1"
                  :decimalPlaces="0"
                  inputId="tm-min-alt"
                  @change="setOption('MinPointAltitude', optMinAlt)"
                />
                <NumberInputPicker
                  v-model="optMaxAlt"
                  :label="$t('plugins.tenmicron.builder.altMax')"
                  labelKey="plugins.tenmicron.builder.altMax"
                  :min="1"
                  :max="90"
                  :step="1"
                  :decimalPlaces="0"
                  inputId="tm-max-alt"
                  @change="setOption('MaxPointAltitude', optMaxAlt)"
                />
                <!-- Azimuth range -->
                <NumberInputPicker
                  v-model="optMinAz"
                  :label="$t('plugins.tenmicron.builder.azMin')"
                  labelKey="plugins.tenmicron.builder.azMin"
                  :min="0"
                  :max="359"
                  :step="0.1"
                  :decimalPlaces="1"
                  inputId="tm-min-az"
                  @change="setOption('MinPointAzimuth', optMinAz)"
                />
                <NumberInputPicker
                  v-model="optMaxAz"
                  :label="$t('plugins.tenmicron.builder.azMax')"
                  labelKey="plugins.tenmicron.builder.azMax"
                  :min="1"
                  :max="360"
                  :step="0.1"
                  :decimalPlaces="1"
                  inputId="tm-max-az"
                  @change="setOption('MaxPointAzimuth', optMaxAz)"
                />
                <!-- Max RMS -->
                <NumberInputPicker
                  v-model="optMaxRMS"
                  :label="$t('plugins.tenmicron.builder.maxRMS')"
                  labelKey="plugins.tenmicron.builder.maxRMS"
                  :min="0"
                  :max="999"
                  :step="0.1"
                  :decimalPlaces="1"
                  inputId="tm-max-rms"
                  @change="setOption('MaxPointRMS', optMaxRMS)"
                />
                <!-- Retries -->
                <NumberInputPicker
                  v-model="optNumRetries"
                  :label="$t('plugins.tenmicron.builder.numRetries')"
                  labelKey="plugins.tenmicron.builder.numRetries"
                  :min="0"
                  :max="10"
                  :step="1"
                  :decimalPlaces="0"
                  inputId="tm-num-retries"
                  @change="setOption('BuilderNumRetries', optNumRetries)"
                />
                <!-- Toggles -->
                <div class="pt-2 border-t border-line space-y-3">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.showExcluded')
                    }}</span>
                    <toggleButton
                      :status-value="optShowRemoved"
                      @update:statusValue="toggleOption('ShowRemovedPoints', optShowRemoved)"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.minimizeMeridian')
                    }}</span>
                    <toggleButton
                      :status-value="optMinimizeMeridian"
                      @update:statusValue="
                        toggleOption('MinimizeMeridianFlips', optMinimizeMeridian)
                      "
                    />
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.removeHighRMS')
                    }}</span>
                    <toggleButton
                      :status-value="optRemoveHighRMS"
                      @update:statusValue="
                        toggleOption('RemoveHighRMSAfterBuild', optRemoveHighRMS)
                      "
                    />
                  </div>
                </div>
              </div>
            </details>

            <!-- Build Options -->
            <details class="rounded-card border border-line bg-surface-1">
              <summary
                class="px-4 min-h-touch flex items-center gap-2 text-sm font-semibold text-content cursor-pointer select-none"
              >
                {{ $t('plugins.tenmicron.builder.buildOptions') }}
                <ChevronRightIcon
                  class="summary-chevron ml-auto w-4 h-4 text-content-muted transition-transform duration-200"
                />
              </summary>
              <div class="px-4 pb-4 pt-2 space-y-3">
                <!-- Max Concurrency -->
                <NumberInputPicker
                  v-model="optMaxConcurrency"
                  :label="$t('plugins.tenmicron.builder.maxConcurrency')"
                  labelKey="plugins.tenmicron.builder.maxConcurrency"
                  :min="1"
                  :max="10"
                  :step="1"
                  :decimalPlaces="0"
                  inputId="tm-max-concurrency"
                  @change="setOption('MaxConcurrency', optMaxConcurrency)"
                />
                <!-- Plate Solve Subframe -->
                <NumberInputPicker
                  v-model="optPlateSolveSubframe"
                  :label="$t('plugins.tenmicron.builder.plateSolveSubframe')"
                  labelKey="plugins.tenmicron.builder.plateSolveSubframe"
                  :min="0.01"
                  :max="1.0"
                  :step="0.01"
                  :decimalPlaces="2"
                  inputId="tm-plate-solve-subframe"
                  @change="setOption('PlateSolveSubframe', optPlateSolveSubframe)"
                />
                <!-- Dec Jitter -->
                <NumberInputPicker
                  v-model="optDecJitter"
                  :label="$t('plugins.tenmicron.builder.decJitter')"
                  labelKey="plugins.tenmicron.builder.decJitter"
                  :min="0"
                  :max="10"
                  :step="0.1"
                  :decimalPlaces="1"
                  inputId="tm-dec-jitter"
                  @change="setOption('DecJitter', optDecJitter)"
                />
                <!-- Boolean toggles -->
                <div class="pt-2 border-t border-line space-y-3">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.logCommands')
                    }}</span>
                    <toggleButton
                      :status-value="optLogCommands"
                      @update:statusValue="toggleOption('LogCommands', optLogCommands)"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.allowBlindSolves')
                    }}</span>
                    <toggleButton
                      :status-value="optAllowBlindSolves"
                      @update:statusValue="toggleOption('AllowBlindSolves', optAllowBlindSolves)"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.optimizeDome')
                    }}</span>
                    <toggleButton
                      :status-value="optOptimizeDome"
                      @update:statusValue="toggleOption('OptimizeDome', optOptimizeDome)"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.westToEast')
                    }}</span>
                    <toggleButton
                      :status-value="optWestToEast"
                      @update:statusValue="toggleOption('WestToEast', optWestToEast)"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.alternateDirection')
                    }}</span>
                    <toggleButton
                      :status-value="optAlternateDirection"
                      @update:statusValue="
                        toggleOption('AlternateDirection', optAlternateDirection)
                      "
                    />
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.disableRefractionCorrection')
                    }}</span>
                    <toggleButton
                      :status-value="optDisableRefractionCorrection"
                      @update:statusValue="
                        toggleOption('DisableRefractionCorrection', optDisableRefractionCorrection)
                      "
                    />
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-content">{{
                      $t('plugins.tenmicron.builder.disableDAT')
                    }}</span>
                    <toggleButton
                      :status-value="optDisableDAT"
                      @update:statusValue="toggleOption('DisableDAT', optDisableDAT)"
                    />
                  </div>
                </div>
              </div>
            </details>

            <!-- Reset options button -->
            <div class="flex justify-end">
              <button
                @click="resetBuilderOptions"
                :disabled="!tmStore.connected"
                class="tns-btn-secondary w-auto px-3"
              >
                {{ $t('plugins.tenmicron.builder.resetOptions') }}
              </button>
            </div>
          </div>
          <!-- end options wrapper -->

          <!-- Scatter plot of model points: X = Azimuth, Y = Altitude -->
          <div v-if="tmStore.modelPoints.length > 0" class="tns-card">
            <h3 class="text-sm font-semibold text-content mb-3">
              {{ $t('plugins.tenmicron.builder.scatterChart') }}
            </h3>
            <div ref="scatterContainerRef" class="w-full">
              <svg
                :width="scatterActualW + scatterPadL + scatterPadR"
                :height="scatterH + scatterPadT + scatterPadB"
                style="display: block"
                class="overflow-visible"
              >
                <defs>
                  <clipPath id="scatter-plot-clip">
                    <rect x="0" y="0" :width="scatterActualW" :height="scatterH" />
                  </clipPath>
                </defs>
                <g :transform="`translate(${scatterPadL}, ${scatterPadT})`">
                  <!-- Grid lines -->
                  <line
                    v-for="tick in azTicks"
                    :key="'vg' + tick"
                    :x1="scatterAzX(tick)"
                    y1="0"
                    :x2="scatterAzX(tick)"
                    :y2="scatterH"
                    stroke="var(--color-line)"
                    stroke-width="1"
                  />
                  <line
                    v-for="tick in altTicks"
                    :key="'hg' + tick"
                    x1="0"
                    :y1="scatterAltY(tick)"
                    :x2="scatterActualW"
                    :y2="scatterAltY(tick)"
                    stroke="var(--color-line)"
                    stroke-width="1"
                  />
                  <!-- Axes -->
                  <line
                    x1="0"
                    :y1="scatterH"
                    :x2="scatterActualW"
                    :y2="scatterH"
                    stroke="var(--color-line-strong)"
                    stroke-width="1"
                  />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    :y2="scatterH"
                    stroke="var(--color-line-strong)"
                    stroke-width="1"
                  />
                  <!-- X tick labels (Azimuth) -->
                  <text
                    v-for="tick in azTicks"
                    :key="'xl' + tick"
                    :x="scatterAzX(tick)"
                    :y="scatterH + 14"
                    fill="var(--color-content-faint)"
                    font-size="11"
                    text-anchor="middle"
                  >
                    {{ tick }}
                  </text>
                  <!-- Y tick labels (Altitude) -->
                  <text
                    v-for="tick in altTicks"
                    :key="'yl' + tick"
                    :x="-6"
                    :y="scatterAltY(tick) + 3"
                    fill="var(--color-content-faint)"
                    font-size="11"
                    text-anchor="end"
                  >
                    {{ tick }}
                  </text>
                  <!-- Axis labels -->
                  <text
                    :x="scatterActualW / 2"
                    :y="scatterH + 28"
                    fill="var(--color-content-muted)"
                    font-size="12"
                    text-anchor="middle"
                  >
                    {{ $t('plugins.tenmicron.builder.axisAz') }}
                  </text>
                  <text
                    :x="-scatterH / 2"
                    y="-28"
                    fill="var(--color-content-muted)"
                    font-size="12"
                    text-anchor="middle"
                    transform="rotate(-90)"
                  >
                    {{ $t('plugins.tenmicron.builder.axisAlt') }}
                  </text>
                  <!-- Model points -->
                  <g clip-path="url(#scatter-plot-clip)">
                    <g v-for="(pt, i) in tmStore.modelPoints" :key="'pt-' + i">
                      <circle
                        :cx="scatterAzX(pt.Azimuth)"
                        :cy="scatterAltY(pt.Altitude)"
                        r="4"
                        :fill="stateColor(pt.ModelPointState)"
                        fill-opacity="0.85"
                        stroke="var(--color-surface-1)"
                        stroke-width="0.5"
                      >
                        <title>
                          {{ i + 1 }}: Az {{ pt.Azimuth }}° Alt {{ pt.Altitude }}° —
                          {{ stateLabel(pt.ModelPointState) }}
                        </title>
                      </circle>
                      <text
                        :x="scatterAzX(pt.Azimuth) + 5"
                        :y="scatterAltY(pt.Altitude) - 3"
                        fill="var(--color-content-muted)"
                        font-size="9"
                        dominant-baseline="auto"
                        pointer-events="none"
                      >
                        {{ i + 1 }}
                      </text>
                    </g>
                  </g>
                  <!-- end clip-path group -->
                </g>
              </svg>
            </div>
            <!-- Legend -->
            <div class="flex flex-wrap gap-3 mt-3 justify-center text-xs text-content-muted">
              <span v-for="leg in stateLegend" :key="leg.label" class="flex items-center gap-1">
                <span class="tns-dot" :style="{ backgroundColor: leg.color }" />
                {{ leg.label }}
              </span>
            </div>
          </div>

          <!-- Points table (compact) -->
          <div
            v-if="usableModelPoints.length > 0"
            class="rounded-card border border-line bg-surface-1 overflow-x-auto"
          >
            <table class="w-full text-xs text-content">
              <thead class="bg-surface-2 text-content-faint uppercase">
                <tr>
                  <th class="px-3 py-2 text-left">#</th>
                  <th class="px-3 py-2 text-right">Az (°)</th>
                  <th class="px-3 py-2 text-right">Alt (°)</th>
                  <th class="px-3 py-2 text-left">State</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="{ point, number } in usableModelPoints"
                  :key="number"
                  class="border-t border-line hover:bg-surface-2"
                >
                  <td class="px-3 py-1">{{ number }}</td>
                  <td class="px-3 py-1 text-right tabular-nums">{{ point.Azimuth }}</td>
                  <td class="px-3 py-1 text-right tabular-nums">{{ point.Altitude }}</td>
                  <td class="px-3 py-1">
                    <span
                      class="inline-block px-2 py-0.5 rounded-chip text-xs font-medium"
                      :style="{
                        backgroundColor: stateColor(point.ModelPointState) + '33',
                        color: stateColor(point.ModelPointState),
                      }"
                      >{{ stateLabel(point.ModelPointState) }}</span
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-content-faint text-sm text-center py-4">
            {{ $t('plugins.tenmicron.builder.noPoints') }}
          </p>
        </div>

        <!-- ============================================================ -->
        <!-- TAB: Alignment Model                                          -->
        <!-- ============================================================ -->
        <div v-if="tmStore.activeTab === 'model'" class="p-5 space-y-5">
          <!-- Refresh button -->
          <div class="flex justify-end">
            <button
              @click="loadAlignmentModel"
              :disabled="!tmStore.connected || tmStore.isRefreshing"
              class="tns-btn-secondary w-auto px-3"
            >
              <span
                v-if="tmStore.isRefreshing"
                class="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin"
              ></span>
              {{ $t('plugins.tenmicron.model.refresh') }}
            </button>
          </div>

          <div v-if="!tmStore.modelLoaded" class="text-content-faint text-sm text-center py-6">
            {{ $t('plugins.tenmicron.model.noModel') }}
          </div>

          <template v-else>
            <!-- Info grid -->
            <div class="tns-card">
              <h3 class="text-sm font-semibold text-content mb-3">
                {{ $t('plugins.tenmicron.model.alignmentInfo') }}
              </h3>
              <div class="grid grid-cols-2 landscape:grid-cols-3 gap-2">
                <StatusString
                  v-for="field in modelInfoFields"
                  :key="field.label"
                  :Name="field.label"
                  :Value="field.unit ? `${field.value} ${field.unit}` : `${field.value}`"
                />
              </div>
            </div>

            <!-- Action row -->
            <div class="flex flex-wrap gap-3">
              <button
                @click="deleteWorstStar"
                :disabled="
                  !tmStore.connected ||
                  tmStore.isRefreshing ||
                  (tmStore.alignmentModel.alignmentStarCount ?? 0) === 0
                "
                class="tns-btn-secondary flex-1 min-w-32"
              >
                {{ $t('plugins.tenmicron.model.deleteWorstStar') }}
              </button>
              <button
                @click="confirmClearAlignment"
                :disabled="!tmStore.connected || tmStore.isRefreshing"
                class="tns-btn-danger flex-1 min-w-32"
              >
                {{ $t('plugins.tenmicron.model.clearAlignment') }}
              </button>
            </div>

            <!-- Polar plot of alignment stars -->
            <div v-if="tmStore.alignmentModel.alignmentStars.length > 0" class="tns-card">
              <h3 class="text-sm font-semibold text-content mb-3">
                {{ $t('plugins.tenmicron.model.starsChart') }}
              </h3>
              <div class="flex justify-center">
                <svg :width="plotSize" :height="plotSize" class="overflow-visible">
                  <g :transform="`translate(${plotSize / 2}, ${plotSize / 2})`">
                    <circle
                      v-for="ring in [30, 60, 90]"
                      :key="ring"
                      :r="altToRadius(ring)"
                      fill="none"
                      stroke="var(--color-line)"
                      stroke-width="1"
                    />
                    <line
                      v-for="az in [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]"
                      :key="az"
                      :x1="0"
                      :y1="0"
                      :x2="azToX(az, 90)"
                      :y2="azToY(az, 90)"
                      stroke="var(--color-line)"
                      stroke-width="1"
                    />
                    <text
                      :x="azToX(0, 90) * 1.08"
                      :y="azToY(0, 90) * 1.08 + 4"
                      fill="var(--color-content-muted)"
                      font-size="10"
                      text-anchor="middle"
                    >
                      N
                    </text>
                    <text
                      :x="azToX(90, 90) * 1.08"
                      :y="azToY(90, 90) * 1.08 + 4"
                      fill="var(--color-content-muted)"
                      font-size="10"
                      text-anchor="middle"
                    >
                      E
                    </text>
                    <text
                      :x="azToX(180, 90) * 1.08"
                      :y="azToY(180, 90) * 1.08 + 4"
                      fill="var(--color-content-muted)"
                      font-size="10"
                      text-anchor="middle"
                    >
                      S
                    </text>
                    <text
                      :x="azToX(270, 90) * 1.08"
                      :y="azToY(270, 90) * 1.08 + 4"
                      fill="var(--color-content-muted)"
                      font-size="10"
                      text-anchor="middle"
                    >
                      W
                    </text>
                    <!-- Stars sized by error -->
                    <circle
                      v-for="(star, i) in tmStore.alignmentModel.alignmentStars"
                      :key="'star-' + i"
                      :cx="azToX(star.Azimuth, star.Altitude)"
                      :cy="azToY(star.Azimuth, star.Altitude)"
                      :r="Math.max(4, Math.min(12, star.ErrorPointRadius ?? 5))"
                      fill="var(--color-accent)"
                      fill-opacity="0.7"
                      stroke="var(--color-surface-1)"
                      stroke-width="1"
                    >
                      <title>
                        Az {{ star.Azimuth }}° Alt {{ star.Altitude }}° Error
                        {{ star.ErrorArcsec }}"
                      </title>
                    </circle>
                  </g>
                </svg>
              </div>
            </div>

            <!-- Stars table -->
            <div class="rounded-card border border-line bg-surface-1 overflow-x-auto">
              <table class="w-full text-xs text-content">
                <thead class="bg-surface-2 text-content-faint uppercase">
                  <tr>
                    <th class="px-3 py-2 text-right">#</th>
                    <th class="px-3 py-2 text-right">Az (°)</th>
                    <th class="px-3 py-2 text-right">Alt (°)</th>
                    <th class="px-3 py-2 text-right">Error (")</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(star, i) in tmStore.alignmentModel.alignmentStars"
                    :key="i"
                    class="border-t border-line"
                  >
                    <td class="px-3 py-1 text-right tabular-nums">{{ i + 1 }}</td>
                    <td class="px-3 py-1 text-right tabular-nums">{{ star.Azimuth }}</td>
                    <td class="px-3 py-1 text-right tabular-nums">{{ star.Altitude }}</td>
                    <td
                      class="px-3 py-1 text-right tabular-nums"
                      :class="star.ErrorArcsec > 60 ? 'text-status-danger' : 'text-status-ok'"
                    >
                      {{ star.ErrorArcsec }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- ============================================================ -->
        <!-- TAB: Model Library                                            -->
        <!-- ============================================================ -->
        <div v-if="tmStore.activeTab === 'library'" class="p-5 space-y-4">
          <div class="flex justify-between items-center gap-3">
            <h3 class="text-sm font-semibold text-content">
              {{ $t('plugins.tenmicron.library.savedModels') }}
            </h3>
            <button
              @click="loadModelNames"
              :disabled="!tmStore.connected || tmStore.isRefreshing"
              class="tns-btn-secondary w-auto px-3"
            >
              <svg
                v-if="tmStore.isRefreshing"
                class="animate-spin h-3 w-3"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {{ $t('plugins.tenmicron.library.refresh') }}
            </button>
          </div>

          <!-- Save new model -->
          <div class="flex gap-2">
            <input
              v-model="newModelName"
              type="text"
              :placeholder="$t('plugins.tenmicron.library.namePlaceholder')"
              class="tns-input flex-1"
            />
            <button
              @click="saveModel"
              :disabled="!tmStore.connected || !newModelName.trim()"
              class="tns-btn-secondary w-auto px-3"
            >
              {{ $t('plugins.tenmicron.library.save') }}
            </button>
          </div>

          <div
            v-if="tmStore.modelNames.length === 0"
            class="text-content-faint text-sm text-center py-6"
          >
            {{ $t('plugins.tenmicron.library.noModels') }}
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="name in tmStore.modelNames"
              :key="name"
              class="flex items-center gap-3 rounded-control border border-line bg-surface-2 px-4 py-2"
            >
              <span class="flex-1 text-sm text-content font-mono truncate">{{ name }}</span>
              <button
                @click="loadModel(name)"
                :disabled="!tmStore.connected || tmStore.isRefreshing"
                class="tns-btn-secondary w-auto px-3"
              >
                {{ $t('plugins.tenmicron.library.load') }}
              </button>
              <button
                @click="deleteModel(name)"
                :disabled="!tmStore.connected || tmStore.isRefreshing"
                class="tns-btn-danger w-auto px-3"
              >
                {{ $t('plugins.tenmicron.library.delete') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- TAB: Mount Info                                               -->
        <!-- ============================================================ -->
        <div v-if="tmStore.activeTab === 'mount'" class="p-5 space-y-5">
          <!-- Mount Information (read-only) -->
          <div class="tns-card space-y-3">
            <h3 class="text-sm font-semibold text-content">
              {{ $t('plugins.tenmicron.mount.info') }}
            </h3>
            <div class="grid grid-cols-2 landscape:grid-cols-3 gap-2">
              <StatusString
                :Name="$t('plugins.tenmicron.mount.product')"
                :Value="tmStore.mountProductName || '—'"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.firmware')"
                :Value="tmStore.mountFirmwareVersion || '—'"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.firmwareDate')"
                :Value="tmStore.mountFirmwareTimestamp || '—'"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.ip')"
                :Value="tmStore.mountIPAddress || '—'"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.mac')"
                :Value="tmStore.mountMACAddress || '—'"
              />
            </div>
          </div>

          <!-- Mount Status (read-only tiles) -->
          <div class="tns-card space-y-3">
            <h3 class="text-sm font-semibold text-content">
              {{ $t('plugins.tenmicron.mount.statusTitle') }}
            </h3>
            <div class="grid grid-cols-2 landscape:grid-cols-3 gap-2">
              <StatusString
                :Name="$t('plugins.tenmicron.mount.statusTitle')"
                :Value="mountStatusText"
              />
              <StatusBool
                :label="$t('plugins.tenmicron.mount.gpsSync')"
                :isEnabled="tmStore.gpsSyncState !== 'Off' && tmStore.gpsSyncState !== 'Unknown'"
                :enabledText="tmStore.gpsSyncState"
                :disabledText="tmStore.gpsSyncState"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.trackingRate')"
                :Value="`${tmStore.trackingRateArcsecPerSec.toFixed(4)} ${$t('plugins.tenmicron.mount.arcsecPerSec')}`"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.refractionTemp')"
                :Value="`${tmStore.refractionTemperature} ${$t('plugins.tenmicron.mount.celsius')}`"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.refractionPressure')"
                :Value="`${tmStore.refractionPressure} ${$t('plugins.tenmicron.mount.hPa')}`"
              />
              <StatusBool
                :label="$t('plugins.tenmicron.mount.deltaTExpiration')"
                :isEnabled="tmStore.deltaTValid"
                :state="!tmStore.deltaTExpiration ? 'idle' : tmStore.deltaTValid ? 'ok' : 'danger'"
                :enabledText="tmStore.deltaTExpiration || '—'"
                :disabledText="tmStore.deltaTExpiration || '—'"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.localTime')"
                :Value="tmStore.mountLocalTime || '—'"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.localDate')"
                :Value="tmStore.mountLocalDate || '—'"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.siderealTime')"
                :Value="tmStore.mountSiderealTime || '—'"
              />
              <StatusString
                :Name="$t('plugins.tenmicron.mount.connectionType')"
                :Value="tmStore.connectionType || '—'"
              />
              <StatusBool
                :label="$t('plugins.tenmicron.mount.unattendedFlip')"
                :isEnabled="tmStore.unattendedFlipEnabled"
                :enabledText="$t('plugins.tenmicron.mount.on')"
                :disabledText="$t('plugins.tenmicron.mount.off')"
              />
            </div>
          </div>

          <!-- Mount Settings (interactive) -->
          <div class="tns-card space-y-3">
            <h3 class="text-sm font-semibold text-content">
              {{ $t('plugins.tenmicron.mount.settings') }}
            </h3>

            <!-- Slew Settle -->
            <div class="flex items-center gap-3">
              <span class="text-sm text-content flex-1">{{
                $t('plugins.tenmicron.mount.slewSettle')
              }}</span>
              <span class="text-sm text-content font-mono tabular-nums">
                {{ tmStore.slewSettleTimeSeconds }}
                <span class="text-content-faint text-xs">{{
                  $t('plugins.tenmicron.mount.seconds')
                }}</span>
              </span>
              <button
                @click="resetSlewSettle"
                :disabled="!tmStore.connected || tmStore.isRefreshing"
                class="tns-btn-secondary w-auto px-3"
              >
                {{ $t('plugins.tenmicron.mount.reset') }}
              </button>
            </div>

            <!-- Meridian Limit -->
            <div class="flex items-center gap-3">
              <span class="text-sm text-content flex-1">{{
                $t('plugins.tenmicron.mount.meridianLimit')
              }}</span>
              <span class="text-sm text-content font-mono tabular-nums">
                {{ tmStore.meridianLimitDegrees }}
                <span class="text-content-faint text-xs">{{
                  $t('plugins.tenmicron.mount.degrees')
                }}</span>
              </span>
              <button
                @click="resetMeridianLimit"
                :disabled="!tmStore.connected || tmStore.isRefreshing"
                class="tns-btn-secondary w-auto px-3"
              >
                {{ $t('plugins.tenmicron.mount.reset') }}
              </button>
            </div>

            <!-- Unattended Flip -->
            <div v-if="tmStore.unattendedFlipEnabled" class="flex items-center gap-3">
              <span class="text-sm text-content flex-1">{{
                $t('plugins.tenmicron.mount.unattendedFlip')
              }}</span>
              <button
                @click="disableUnattendedFlip"
                :disabled="!tmStore.connected || tmStore.isRefreshing"
                class="tns-btn-danger w-auto px-3"
              >
                {{ $t('plugins.tenmicron.mount.disable') }}
              </button>
            </div>

            <div
              class="space-y-3 pt-2 border-t border-line"
              :class="{
                'opacity-50 pointer-events-none': !tmStore.connected || tmStore.isRefreshing,
              }"
            >
              <!-- Slew Rate -->
              <NumberInputPicker
                v-model="slewRateInput"
                :label="$t('plugins.tenmicron.mount.slewRate')"
                labelKey="plugins.tenmicron.mount.slewRate"
                :min="tmStore.slewRateMin ?? 2"
                :max="tmStore.slewRateMax ?? 15"
                :step="1"
                :decimalPlaces="0"
                inputId="tm-slew-rate"
                @change="setSlewRate"
              />

              <!-- Horizon Limit High -->
              <NumberInputPicker
                v-model="horizonHighInput"
                :label="$t('plugins.tenmicron.mount.horizonHigh')"
                labelKey="plugins.tenmicron.mount.horizonHigh"
                :min="0"
                :max="90"
                :step="1"
                :decimalPlaces="0"
                inputId="tm-horizon-high"
                @change="setHorizonHigh"
              />

              <!-- Horizon Limit Low -->
              <NumberInputPicker
                v-model="horizonLowInput"
                :label="$t('plugins.tenmicron.mount.horizonLow')"
                labelKey="plugins.tenmicron.mount.horizonLow"
                :min="-5"
                :max="45"
                :step="1"
                :decimalPlaces="0"
                inputId="tm-horizon-low"
                @change="setHorizonLow"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- end tab container -->

      <!-- Error toast -->
      <div
        v-if="tmStore.lastError"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-1 border border-status-danger/50 text-status-danger px-5 py-3 rounded-card shadow-xl text-sm max-w-sm z-50"
        @click="tmStore.clearError()"
      >
        {{ tmStore.lastError }}
      </div>

      <!-- Clear alignment confirm modal -->
      <div
        v-if="showClearConfirm"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        @click.self="showClearConfirm = false"
      >
        <div class="tns-card bg-surface-2 max-w-sm w-full mx-4 space-y-4">
          <h3 class="text-lg font-semibold text-content">
            {{ $t('plugins.tenmicron.model.clearConfirmTitle') }}
          </h3>
          <p class="text-content-muted text-sm">
            {{ $t('plugins.tenmicron.model.clearConfirmMsg') }}
          </p>
          <div class="flex gap-3">
            <button @click="showClearConfirm = false" class="tns-btn-secondary flex-1">
              {{ $t('plugins.tenmicron.cancel') }}
            </button>
            <button @click="clearAlignment" class="tns-btn-danger flex-1">
              {{ $t('plugins.tenmicron.model.clearAlignment') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePolling } from '@/composables/usePolling';
import { hmsToDegrees, dmsToDegrees, degreesToHMS, degreesToDMS } from '@/utils/utils';
import { useI18n } from 'vue-i18n';
import { useTenMicronStore } from '../store/tenMicronStore';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { isBackendRefusal } from '@/utils/backendErrors';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import toggleButton from '@/components/helpers/toggleButton.vue';
import StatusString from '@/components/helpers/StatusString.vue';
import StatusBool from '@/components/helpers/StatusBool.vue';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';

const { t, te } = useI18n();
const tmStore = useTenMicronStore();
const mainStore = apiStore();
const isCameraConnected = computed(() => Boolean(mainStore.cameraInfo?.Connected));

const starCount = ref(tmStore.goldenSpiralStarCount);

// Sidereal Path generator state
const generatorType = ref('goldenSpiral'); // 'goldenSpiral' | 'siderealPath'
// RA as colon-separated string HH:MM:SS.s (mirrors slew/center input style)
const siderealRaStr = ref('0:00:00.0');
// Dec as colon-separated string +/-DD:MM:SS.s
const siderealDecStr = ref('+00:00:00.0');
const siderealRaDelta = ref(1.5);

// Convert display strings → decimal values for the API
function raToDecimal() {
  // hmsToDegrees returns degrees (h×15); divide back to hours
  return hmsToDegrees(siderealRaStr.value) / 15;
}
function decToDecimal() {
  return dmsToDegrees(siderealDecStr.value);
}
// Decompose decimal hours → HH:MM:SS.s string
function setRaFromDecimal(hours) {
  siderealRaStr.value = degreesToHMS(hours * 15);
}
// Decompose decimal degrees → +/-DD:MM:SS.s string
function setDecFromDecimal(deg) {
  siderealDecStr.value = degreesToDMS(deg);
}
const SIDEREAL_START_PROVIDERS = ['Now', 'Nautical Dusk', 'Sunset', 'Astronomical Dusk'];
const SIDEREAL_END_PROVIDERS = ['Now', 'Nautical Dawn', 'Sunrise', 'Astronomical Dawn'];
const siderealStartProvider = ref('Nautical Dusk');
const siderealEndProvider = ref('Nautical Dawn');
const siderealStartOffset = ref(0);
const siderealEndOffset = ref(0);
const newModelName = ref('');
const showClearConfirm = ref(false);
const slewRateInput = ref(tmStore.slewRate ?? 15);
const horizonHighInput = ref(tmStore.horizonLimitHigh ?? 90);
const horizonLowInput = ref(tmStore.horizonLimitLow ?? 0);

// keep picker refs in sync when status is refreshed from the mount
watch(
  () => tmStore.slewRate,
  (v) => {
    if (v !== null) slewRateInput.value = v;
  }
);
watch(
  () => tmStore.horizonLimitHigh,
  (v) => {
    if (v !== null) horizonHighInput.value = v;
  }
);
watch(
  () => tmStore.horizonLimitLow,
  (v) => {
    if (v !== null) horizonLowInput.value = v;
  }
);
const plotSize = 260;

// ── builder option local refs (kept in sync with store) ──────────────────────
const optMinAlt = ref(tmStore.builderOptions.minPointAltitude);
const optMaxAlt = ref(tmStore.builderOptions.maxPointAltitude);
const optMinAz = ref(tmStore.builderOptions.minPointAzimuth);
const optMaxAz = ref(tmStore.builderOptions.maxPointAzimuth);
const optMaxRMS = ref(tmStore.builderOptions.maxPointRMS);
const optShowRemoved = ref(tmStore.builderOptions.showRemovedPoints);
const optMinimizeMeridian = ref(tmStore.builderOptions.minimizeMeridianFlips);
const optNumRetries = ref(tmStore.builderOptions.builderNumRetries);
const optRemoveHighRMS = ref(tmStore.builderOptions.removeHighRMSAfterBuild);
const optLogCommands = ref(tmStore.builderOptions.logCommands);
const optMaxConcurrency = ref(tmStore.builderOptions.maxConcurrency);
const optAllowBlindSolves = ref(tmStore.builderOptions.allowBlindSolves);
const optOptimizeDome = ref(tmStore.builderOptions.optimizeDome);
const optWestToEast = ref(tmStore.builderOptions.westToEast);
const optPlateSolveSubframe = ref(tmStore.builderOptions.plateSolveSubframe);
const optAlternateDirection = ref(tmStore.builderOptions.alternateDirection);
const optDisableRefractionCorrection = ref(tmStore.builderOptions.disableRefractionCorrection);
const optDecJitter = ref(tmStore.builderOptions.decJitter);
const optDisableDAT = ref(tmStore.builderOptions.disableDAT);

// MountInfo.Status is a MountStatusEnum and the controller sends Status.ToString(), so the raw
// value is the member name ("TrackingOnOutsideLimits"), not something a user should read. The
// locale keys mirror the [Description] attributes on that enum; an unmapped value falls through
// unchanged so a firmware addition shows up as itself rather than blank.
const mountStatusText = computed(() => {
  const raw = tmStore.mountStatus;
  if (!raw) return '—';
  const key = `plugins.tenmicron.mount.status.${raw}`;
  return te(key) ? t(key) : raw;
});

// ── tabs ──────────────────────────────────────────────────────────────────────
const tabs = computed(() => [
  { id: 'builder', label: t('plugins.tenmicron.tabs.builder') },
  { id: 'model', label: t('plugins.tenmicron.tabs.model') },
  { id: 'library', label: t('plugins.tenmicron.tabs.library') },
  { id: 'mount', label: t('plugins.tenmicron.tabs.mount') },
]);

// ── scatter chart helpers (Az/Alt) ────────────────────────────────────────────
const scatterH = 180;
const scatterPadL = 40;
const scatterPadR = 16;
const scatterPadT = 16;
const scatterPadB = 36;

// Actual chart content width tracked by ResizeObserver
const scatterContainerRef = ref(null);
const scatterActualW = ref(300);
let scatterResizeObserver = null;

watch(scatterContainerRef, (el) => {
  scatterResizeObserver?.disconnect();
  if (el) {
    scatterResizeObserver = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 300;
      scatterActualW.value = Math.max(100, w - scatterPadL - scatterPadR);
    });
    scatterResizeObserver.observe(el);
  }
});

// Zoom-to-fit for sidereal path; full sky for golden spiral
const scatterDomain = computed(() => {
  const pts = tmStore.modelPoints;
  if (!pts.length || generatorType.value !== 'siderealPath') {
    return { azMin: 0, azMax: 360, altMin: 0, altMax: 90 };
  }

  const azVals = pts.map((p) => p.Azimuth);
  const altVals = pts.map((p) => p.Altitude);
  const azSpan = Math.max(Math.max(...azVals) - Math.min(...azVals), 20);
  const altSpan = Math.max(Math.max(...altVals) - Math.min(...altVals), 10);
  const azPad = azSpan * 0.1;
  const altPad = altSpan * 0.12;

  return {
    azMin: Math.max(0, Math.floor((Math.min(...azVals) - azPad) / 10) * 10),
    azMax: Math.min(360, Math.ceil((Math.max(...azVals) + azPad) / 10) * 10),
    altMin: Math.max(0, Math.floor((Math.min(...altVals) - altPad) / 5) * 5),
    altMax: Math.min(90, Math.ceil((Math.max(...altVals) + altPad) / 5) * 5),
  };
});

// Pick a "nice" step size that yields roughly targetCount ticks over a span
function niceStep(span, targetCount) {
  const rough = span / targetCount;
  for (const c of [1, 2, 5, 10, 15, 20, 30, 45, 60, 90]) {
    if (c >= rough) return c;
  }
  return 90;
}

function makeTicks(min, max) {
  const step = niceStep(max - min, 6);
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) {
    ticks.push(Math.round(t));
  }
  return ticks;
}

const azTicks = computed(() => makeTicks(scatterDomain.value.azMin, scatterDomain.value.azMax));
const altTicks = computed(() => makeTicks(scatterDomain.value.altMin, scatterDomain.value.altMax));

function scatterAzX(az) {
  const { azMin, azMax } = scatterDomain.value;
  return ((az - azMin) / (azMax - azMin)) * scatterActualW.value;
}

function scatterAltY(alt) {
  const { altMin, altMax } = scatterDomain.value;
  return scatterH - ((alt - altMin) / (altMax - altMin)) * scatterH;
}

// ── polar chart helpers (used by alignment stars chart) ──────────────────────
const maxRadius = plotSize / 2 - 20;

function altToRadius(alt) {
  return maxRadius * (1 - alt / 90);
}

function azToX(az, alt) {
  const r = altToRadius(alt);
  const rad = ((az - 90) * Math.PI) / 180;
  return r * Math.cos(rad);
}

function azToY(az, alt) {
  const r = altToRadius(alt);
  const rad = ((az - 90) * Math.PI) / 180;
  return r * Math.sin(rad);
}

// Mirrors ModelBuilder.IsPointIncludedInBuild in the C# plugin: these four states are the
// generation-time exclusions, and such points are never slewed to. Failed (97) and FailedRMS (98)
// are runtime outcomes rather than exclusions, so those points stay listed - after a build you
// want to see which ones failed, and the legend advertises both states.
const EXCLUDED_STATES = new Set([99, 100, 101, 102]);

// Each entry keeps the point's index in the full list, so the table numbers match the labels the
// scatter chart draws over tmStore.modelPoints instead of counting the filtered subset again.
const usableModelPoints = computed(() =>
  tmStore.modelPoints
    .map((point, index) => ({ point, number: index + 1 }))
    .filter(({ point }) => !EXCLUDED_STATES.has(point.ModelPointState))
);

// ── point state labels & colours (mirrors ModelPointStateEnum from C# plugin) ──
const STATE_LABELS = {
  0: 'Generated',
  1: 'Up Next',
  2: 'Exposing',
  3: 'Processing',
  4: 'Added to Model',
  97: 'Failed',
  98: 'High RMS',
  99: 'Outside Alt Bounds',
  100: 'Outside Az Bounds',
  101: 'Below Horizon',
  102: 'Near Meridian',
};

function stateLabel(state) {
  return STATE_LABELS[state] ?? 'Unknown';
}

const STATE_COLORS = {
  0: '#90EE90', // Generated      → LightGreen
  1: '#9ACD32', // UpNext         → YellowGreen
  2: '#ADD8E6', // Exposing       → LightBlue
  3: '#0000FF', // Processing     → Blue
  4: '#00FF00', // AddedToModel   → Green
  97: '#FF0000', // Failed         → Red
  98: '#FF4500', // FailedRMS      → OrangeRed
  99: '#808080', // OutsideAltBounds → Gray
  100: '#808080', // OutsideAzBounds  → Gray
  101: '#808080', // BelowHorizon     → Gray
  102: '#FFD700', // CloseToMeridian  → Gold
};

function stateColor(state) {
  return STATE_COLORS[state] ?? '#6B7280';
}

const stateLegend = [
  { label: 'Generated', color: STATE_COLORS[0] },
  { label: 'Up Next', color: STATE_COLORS[1] },
  { label: 'Exposing', color: STATE_COLORS[2] },
  { label: 'Processing', color: STATE_COLORS[3] },
  { label: 'Added', color: STATE_COLORS[4] },
  { label: 'Failed', color: STATE_COLORS[97] },
  { label: 'High RMS', color: STATE_COLORS[98] },
  { label: 'Excluded', color: STATE_COLORS[99] },
  { label: 'Near Meridian', color: STATE_COLORS[102] },
];

// ── model info fields ─────────────────────────────────────────────────────────
const DEG_TO_ARCSEC = 3600;

const modelInfoFields = computed(() => {
  const m = tmStore.alignmentModel;
  return [
    { label: t('plugins.tenmicron.model.stars'), value: m.alignmentStarCount, unit: '' },
    { label: t('plugins.tenmicron.model.rmsError'), value: m.rmsError?.toFixed(2), unit: '"' },
    { label: t('plugins.tenmicron.model.modelTerms'), value: m.modelTerms, unit: '' },
    {
      label: t('plugins.tenmicron.model.polarAlt'),
      value: m.rightAscensionAltitude?.toFixed(3),
      unit: '°',
    },
    {
      label: t('plugins.tenmicron.model.polarAz'),
      value: m.rightAscensionAzimuth?.toFixed(3),
      unit: '°',
    },
    {
      label: t('plugins.tenmicron.model.polarError'),
      value: (m.polarAlignErrorDegrees * DEG_TO_ARCSEC).toFixed(1),
      unit: '"',
    },
    {
      label: t('plugins.tenmicron.model.paAltError'),
      value: (m.paErrorAltitudeDegrees * DEG_TO_ARCSEC).toFixed(1),
      unit: '"',
    },
    {
      label: t('plugins.tenmicron.model.paAzError'),
      value: (m.paErrorAzimuthDegrees * DEG_TO_ARCSEC).toFixed(1),
      unit: '"',
    },
    {
      label: t('plugins.tenmicron.model.paAngle'),
      value: m.rightAscensionPolarPositionAngleDegrees?.toFixed(3),
      unit: '°',
    },
    {
      label: t('plugins.tenmicron.model.coneError'),
      value: (m.orthogonalityErrorDegrees * DEG_TO_ARCSEC).toFixed(1),
      unit: '"',
    },
    {
      label: t('plugins.tenmicron.model.azTurns'),
      value: m.azimuthAdjustmentTurns?.toFixed(2),
      unit: 'turns',
    },
    {
      label: t('plugins.tenmicron.model.altTurns'),
      value: m.altitudeAdjustmentTurns?.toFixed(2),
      unit: 'turns',
    },
  ];
});

// ── API calls ─────────────────────────────────────────────────────────────────
// `full` pulls the raw-LX200 values too (slew rate, horizon limits, GPS sync, connection type,
// DeltaT). The recurring poll leaves it off - those never change on their own, and asking for them
// every tick put eight serial round trips per 3s on the mount.
async function fetchStatus(full = false) {
  try {
    const data = await apiService.tenMicronGetStatus(full);
    if (data?.Success) tmStore.setStatus(data);
  } catch {
    /* ignore polling errors silently */
  }
}

async function fetchMountTime() {
  try {
    const data = await apiService.tenMicronGetMountTime();
    if (data?.Success) tmStore.setMountTime(data);
  } catch {
    /* ignore polling errors silently */
  }
}

async function loadBuilderStatus() {
  try {
    const data = await apiService.tenMicronGetBuilderStatus();
    if (data?.Success) tmStore.setBuilderStatus(data);
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

function syncOptionRefsFromStore() {
  optMinAlt.value = tmStore.builderOptions.minPointAltitude;
  optMaxAlt.value = tmStore.builderOptions.maxPointAltitude;
  optMinAz.value = tmStore.builderOptions.minPointAzimuth;
  optMaxAz.value = tmStore.builderOptions.maxPointAzimuth;
  optMaxRMS.value = tmStore.builderOptions.maxPointRMS;
  optShowRemoved.value = tmStore.builderOptions.showRemovedPoints;
  optMinimizeMeridian.value = tmStore.builderOptions.minimizeMeridianFlips;
  optNumRetries.value = tmStore.builderOptions.builderNumRetries;
  optRemoveHighRMS.value = tmStore.builderOptions.removeHighRMSAfterBuild;
  optLogCommands.value = tmStore.builderOptions.logCommands;
  optMaxConcurrency.value = tmStore.builderOptions.maxConcurrency;
  optAllowBlindSolves.value = tmStore.builderOptions.allowBlindSolves;
  optOptimizeDome.value = tmStore.builderOptions.optimizeDome;
  optWestToEast.value = tmStore.builderOptions.westToEast;
  optPlateSolveSubframe.value = tmStore.builderOptions.plateSolveSubframe;
  optAlternateDirection.value = tmStore.builderOptions.alternateDirection;
  optDisableRefractionCorrection.value = tmStore.builderOptions.disableRefractionCorrection;
  optDecJitter.value = tmStore.builderOptions.decJitter;
  optDisableDAT.value = tmStore.builderOptions.disableDAT;
  starCount.value = tmStore.builderOptions.goldenSpiralStarCount;
  siderealRaDelta.value = tmStore.builderOptions.siderealRaDelta;
  if (SIDEREAL_START_PROVIDERS.includes(tmStore.builderOptions.siderealStartProvider))
    siderealStartProvider.value = tmStore.builderOptions.siderealStartProvider;
  if (SIDEREAL_END_PROVIDERS.includes(tmStore.builderOptions.siderealEndProvider))
    siderealEndProvider.value = tmStore.builderOptions.siderealEndProvider;
  siderealStartOffset.value = tmStore.builderOptions.siderealStartOffset;
  siderealEndOffset.value = tmStore.builderOptions.siderealEndOffset;
}

async function loadBuilderOptions() {
  try {
    const data = await apiService.tenMicronGetBuilderOptions();
    if (data?.Success) {
      tmStore.setBuilderOptions(data);
      syncOptionRefsFromStore();
    }
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

// The plugin server answers a refused write with Success: false and its reason (409 while a
// model build or another job uses the mount, 400 for an invalid value, 500 when the mount did not
// take it). The global interceptor resolves that without a toast, so it is shown here.
function showRefusal(res) {
  if (!isBackendRefusal(res)) return false;
  tmStore.lastError = res.Error || t('components.backendErrors.noReason');
  return true;
}

// Returns whether the option was stored. A refused or clamped value reloads the options, so the
// field shows what the plugin actually keeps.
async function setOption(key, value) {
  try {
    const res = await apiService.tenMicronSetBuilderOption(key, value);
    if (showRefusal(res)) {
      await loadBuilderOptions();
      return false;
    }
    if (res?.Value !== undefined && res.Value !== value) await loadBuilderOptions();
    return true;
  } catch (e) {
    tmStore.lastError = e?.message;
    return false;
  }
}

async function resetBuilderOptions() {
  try {
    const data = await apiService.tenMicronResetBuilderOptions();
    if (data?.Success) {
      tmStore.setBuilderOptions(data);
      syncOptionRefsFromStore();
    }
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function toggleOption(key, currentValue) {
  const newVal = !currentValue;
  if (!(await setOption(key, newVal))) return;
  // Update the corresponding ref
  if (key === 'ShowRemovedPoints') optShowRemoved.value = newVal;
  else if (key === 'MinimizeMeridianFlips') optMinimizeMeridian.value = newVal;
  else if (key === 'RemoveHighRMSAfterBuild') optRemoveHighRMS.value = newVal;
  else if (key === 'LogCommands') optLogCommands.value = newVal;
  else if (key === 'AllowBlindSolves') optAllowBlindSolves.value = newVal;
  else if (key === 'OptimizeDome') optOptimizeDome.value = newVal;
  else if (key === 'WestToEast') optWestToEast.value = newVal;
  else if (key === 'AlternateDirection') optAlternateDirection.value = newVal;
  else if (key === 'DisableRefractionCorrection') optDisableRefractionCorrection.value = newVal;
  else if (key === 'DisableDAT') optDisableDAT.value = newVal;
}

async function loadAlignmentModel() {
  tmStore.isRefreshing = true;
  try {
    const data = await apiService.tenMicronRefreshAlignmentModel();
    if (data?.Success !== false) tmStore.setAlignmentModel(data ?? {});
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.alignmentModelFetched = true;
    tmStore.isRefreshing = false;
  }
}

async function loadModelNames() {
  tmStore.isRefreshing = true;
  try {
    const data = await apiService.tenMicronGetModelNames();
    if (data?.Success) tmStore.setModelNames(data.ModelNames);
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.modelNamesFetched = true;
    tmStore.isRefreshing = false;
  }
}

async function generatePoints() {
  try {
    tmStore.isLoading = true;
    if (generatorType.value === 'goldenSpiral') {
      showRefusal(await apiService.tenMicronGenerateGoldenSpiral(starCount.value));
    } else {
      const res = await apiService.tenMicronGenerateSiderealPath({
        ra: raToDecimal(),
        dec: decToDecimal(),
        raDelta: siderealRaDelta.value,
        startProvider: siderealStartProvider.value,
        endProvider: siderealEndProvider.value,
        startOffset: siderealStartOffset.value,
        endOffset: siderealEndOffset.value,
      });
      showRefusal(res);
    }
    await loadBuilderStatus();
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isLoading = false;
  }
}

async function fetchCoordsFromScope() {
  try {
    const res = await apiService.tenMicronSiderealCoordsFromScope();
    if (res?.Success) {
      setRaFromDecimal(res.RA);
      setDecFromDecimal(res.Dec);
    }
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function fetchCoordsFromSequence() {
  try {
    const res = await apiService.tenMicronSiderealCoordsFromSequence();
    if (res?.Success) {
      setRaFromDecimal(res.RA);
      setDecFromDecimal(res.Dec);
    }
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function clearPoints() {
  try {
    showRefusal(await apiService.tenMicronClearPoints());
    await loadBuilderStatus();
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function buildModel() {
  try {
    showRefusal(await apiService.tenMicronBuildModel());
    await fetchStatus();
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function cancelBuild() {
  try {
    showRefusal(await apiService.tenMicronCancelBuild());
    await fetchStatus();
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function stopBuild() {
  try {
    showRefusal(await apiService.tenMicronStopBuild());
    await fetchStatus();
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function loadModel(name) {
  try {
    showRefusal(await apiService.tenMicronLoadModel(name));
    await loadAlignmentModel();
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function saveModel() {
  if (!newModelName.value.trim()) return;
  tmStore.isRefreshing = true;
  try {
    const res = await apiService.tenMicronSaveModel(newModelName.value.trim());
    if (!showRefusal(res)) newModelName.value = '';
    await loadModelNames();
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

async function deleteModel(name) {
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronDeleteModel(name));
    await loadModelNames();
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

async function deleteWorstStar() {
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronDeleteWorstStar());
    await loadAlignmentModel();
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

function confirmClearAlignment() {
  showClearConfirm.value = true;
}

async function clearAlignment() {
  showClearConfirm.value = false;
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronClearAlignment());
    await loadAlignmentModel();
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

// ── mount tab actions ─────────────────────────────────────────────────────────
async function toggleDualAxisTracking() {
  try {
    const wanted = !tmStore.dualAxisTrackingEnabled;
    const res = await apiService.tenMicronSetDualAxisTracking(wanted);
    if (showRefusal(res)) return;
    // The answer carries the state the mount actually took.
    tmStore.dualAxisTrackingEnabled =
      typeof res?.DualAxisTrackingEnabled === 'boolean' ? res.DualAxisTrackingEnabled : wanted;
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function toggleRefractionCorrection() {
  try {
    const wanted = !tmStore.refractionCorrectionEnabled;
    const res = await apiService.tenMicronSetRefractionCorrection(wanted);
    if (showRefusal(res)) return;
    tmStore.refractionCorrectionEnabled =
      typeof res?.RefractionCorrectionEnabled === 'boolean'
        ? res.RefractionCorrectionEnabled
        : wanted;
  } catch (e) {
    tmStore.lastError = e?.message;
  }
}

async function disableUnattendedFlip() {
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronDisableUnattendedFlip());
    await fetchStatus(true);
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

async function resetMeridianLimit() {
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronResetMeridianLimit());
    await fetchStatus(true);
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

async function resetSlewSettle() {
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronResetSlewSettle());
    await fetchStatus(true);
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

async function setSlewRate() {
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronSetSlewRate(Math.round(slewRateInput.value)));
    await fetchStatus(true);
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

async function setHorizonHigh() {
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronSetHorizonHigh(Math.round(horizonHighInput.value)));
    await fetchStatus(true);
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

async function setHorizonLow() {
  tmStore.isRefreshing = true;
  try {
    showRefusal(await apiService.tenMicronSetHorizonLow(Math.round(horizonLowInput.value)));
    await fetchStatus(true);
  } catch (e) {
    tmStore.lastError = e?.message;
  } finally {
    tmStore.isRefreshing = false;
  }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────
// The alignment model and the model names are deliberately NOT loaded here: both walk the mount
// over LX200 (one command per alignment star), and the WPF plugin only reads them on connect or on
// an explicit refresh. They are fetched when their tab is first opened instead - see the watcher
// below. The builder points come from the plugin's VM memory and cost no mount traffic.
async function initialLoad() {
  tmStore.isLoading = true;
  try {
    await fetchStatus(true);
    await loadBuilderStatus();
    await loadBuilderOptions();
  } finally {
    tmStore.isLoading = false;
  }
}

// Load a tab's mount-backed data the first time it is opened, and refresh the raw-LX200 status
// values whenever the mount tab comes up, since that is the only tab showing them.
function loadForTab(tab) {
  if (!tmStore.connected || tmStore.isRefreshing) return;
  if (tab === 'model') {
    if (!tmStore.alignmentModelFetched) loadAlignmentModel();
  } else if (tab === 'library') {
    if (!tmStore.modelNamesFetched) loadModelNames();
  } else if (tab === 'mount') {
    fetchStatus(true);
    fetchMountTime();
  }
}

watch(() => tmStore.activeTab, loadForTab);

// The tab watcher only fires on a tab change, so a mount that connects while the page is already
// open would otherwise show an empty model tab until the user navigates away and back. A
// disconnect drops the flags again: whatever was read belongs to the old session.
watch(
  () => tmStore.connected,
  (connected) => {
    if (connected) {
      loadForTab(tmStore.activeTab);
    } else {
      tmStore.alignmentModelFetched = false;
      tmStore.modelNamesFetched = false;
    }
  }
);

// A finished build replaces the model on the mount, so let the model tab re-read it once.
watch(
  () => tmStore.buildInProgress,
  (running, wasRunning) => {
    if (wasRunning && !running) {
      tmStore.alignmentModelFetched = false;
      if (tmStore.activeTab === 'model') loadForTab('model');
    }
  }
);

// Poll builder status while build is in progress, otherwise lighter polling
usePolling(
  async () => {
    await fetchStatus();
    if (tmStore.buildInProgress) {
      await loadBuilderStatus();
    }
    if (tmStore.activeTab === 'mount' && tmStore.connected) {
      await fetchMountTime();
    }
  },
  3000,
  { immediate: false }
);

onMounted(async () => {
  await initialLoad();
  // Covers a remount onto a persisted tab: the watcher above only fires on a change.
  loadForTab(tmStore.activeTab);
});

onUnmounted(() => {
  scatterResizeObserver?.disconnect();
});
</script>

<style scoped>
/* Rotate chevron when a details element is open */
details[open] > summary .summary-chevron {
  transform: rotate(90deg);
}
</style>
