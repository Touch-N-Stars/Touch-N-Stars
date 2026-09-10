<template>
  <div class="flex flex-col gap-4">
    <!-- Scan and Device Selection Section -->
    <div
      class="flex flex-col sm:flex-row border border-gray-700 p-4 rounded-lg gap-2 sm:items-center transition-all duration-300 bg-gradient-to-br from-gray-800 to-gray-900"
    >
      <label class="text-sm sm:w-36 shrink-0">{{ $t('plugins.hocusfocus.tilter.device') }}:</label>
      <div class="flex gap-2 items-center w-full">
        <select
          class="w-full border border-gray-600 rounded px-3 py-2 text-white min-w-0 transition-colors"
          :class="{
            'bg-gray-700 cursor-pointer': !isConnected,
            'bg-gray-600 cursor-not-allowed opacity-70': isConnected,
          }"
          v-model="selectedDeviceId"
          :disabled="isScanning || isConnecting || isDisconnecting || isConnected"
        >
          <option disabled value="">
            {{ $t('plugins.hocusfocus.tilter.selectDevice') }}
          </option>
          <option v-for="device in devices" :key="device.DeviceId" :value="String(device.DeviceId)">
            {{ device.Name }} - {{ device.SerialInfo }}
          </option>
        </select>
        <div class="flex shrink-0 gap-1">
          <button
            @click="scanDevices"
            :disabled="isConnecting || isDisconnecting"
            class="flex justify-center items-center w-10 h-10 border border-cyan-500/20 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-70 transition-colors"
            :title="$t('plugins.hocusfocus.tilter.scanTooltip')"
          >
            <svg
              class="w-6 h-6"
              :class="{ 'animate-spin text-green-500': isScanning, 'text-white': !isScanning }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            @click="toggleConnection"
            :disabled="!selectedDeviceId || isConnecting || isDisconnecting"
            class="flex justify-center items-center w-10 h-10 border border-cyan-500/20 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-70 transition-colors relative"
            :title="
              isConnected
                ? $t('plugins.hocusfocus.tilter.disconnect')
                : $t('plugins.hocusfocus.tilter.connect')
            "
          >
            <svg
              v-if="!isConnected"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <svg
              v-else
              class="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <svg
              v-if="isConnecting || isDisconnecting"
              class="animate-spin h-6 w-6 text-white absolute"
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
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Device Info and Controls (Wanderer ETA) - only show if not using manual tilter -->
    <div
      v-if="isConnected && selectedDeviceId"
      class="border border-gray-700 rounded-lg p-4 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg"
    >
      <h3 class="font-bold text-base text-cyan-400 mb-4">
        {{ $t('plugins.hocusfocus.tilter.deviceInfo') }}
      </h3>
      <div class="flex flex-col gap-3">
        <!-- Device Status -->
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span class="text-gray-400">{{ $t('plugins.hocusfocus.tilter.status') }}:</span>
            <span
              class="ml-2 font-semibold"
              :class="deviceStatus?.IsMoving ? 'text-yellow-400' : 'text-green-400'"
            >
              {{
                deviceStatus?.IsMoving
                  ? $t('plugins.hocusfocus.tilter.moving')
                  : $t('plugins.hocusfocus.tilter.idle')
              }}
            </span>
          </div>
          <div>
            <span class="text-gray-400">{{ $t('plugins.hocusfocus.tilter.connected') }}:</span>
            <span class="ml-2 font-semibold text-green-400">{{ $t('general.yes') }}</span>
          </div>
        </div>

        <!-- Position Display -->
        <div class="border border-gray-600/30 rounded p-3 bg-gray-700/20">
          <div class="flex justify-between items-center mb-4">
            <p class="text-sm text-cyan-400 font-semibold">
              {{ $t('plugins.hocusfocus.tilter.currentPositions') }}
            </p>
          </div>

          <div class="grid grid-cols-4 gap-4">
            <!-- Position buttons -->
            <div class="col-span-1 flex flex-col gap-2">
              <button
                @click="openPositionPicker(1)"
                :disabled="deviceStatus?.IsMoving"
                :class="{
                  'bg-blue-500/20 border-blue-500 text-blue-300 text-blue-400 hover:bg-blue-500/30 cursor-pointer':
                    !deviceStatus?.IsMoving,
                  'bg-blue-500/10 border-blue-500/50 text-blue-300/50 text-blue-400/50 cursor-not-allowed opacity-60':
                    deviceStatus?.IsMoving,
                }"
                class="border rounded p-2 text-center transition-colors w-full"
              >
                <p class="text-xs font-semibold mb-0.5">Position 1</p>
                <p class="text-xs font-mono font-bold">
                  {{ deviceStatus?.CurrentPosition1?.toFixed(3) ?? 'N/A' }}
                </p>
              </button>

              <button
                @click="openPositionPicker(2)"
                :disabled="deviceStatus?.IsMoving"
                :class="{
                  'bg-green-500/20 border-green-500 text-green-300 text-green-400 hover:bg-green-500/30 cursor-pointer':
                    !deviceStatus?.IsMoving,
                  'bg-green-500/10 border-green-500/50 text-green-300/50 text-green-400/50 cursor-not-allowed opacity-60':
                    deviceStatus?.IsMoving,
                }"
                class="border rounded p-2 text-center transition-colors w-full"
              >
                <p class="text-xs font-semibold mb-0.5">Position 2</p>
                <p class="text-xs font-mono font-bold">
                  {{ deviceStatus?.CurrentPosition2?.toFixed(3) ?? 'N/A' }}
                </p>
              </button>

              <button
                @click="openPositionPicker(3)"
                :disabled="deviceStatus?.IsMoving"
                :class="{
                  'bg-amber-500/20 border-amber-500 text-amber-300 text-amber-400 hover:bg-amber-500/30 cursor-pointer':
                    !deviceStatus?.IsMoving,
                  'bg-amber-500/10 border-amber-500/50 text-amber-300/50 text-amber-400/50 cursor-not-allowed opacity-60':
                    deviceStatus?.IsMoving,
                }"
                class="border rounded p-2 text-center transition-colors w-full"
              >
                <p class="text-xs font-semibold mb-0.5">Position 3</p>
                <p class="text-xs font-mono font-bold">
                  {{ deviceStatus?.CurrentPosition3?.toFixed(3) ?? 'N/A' }}
                </p>
              </button>
            </div>

            <!-- Sensor plane visualization -->
            <div class="col-span-3 flex justify-center items-center" style="min-height: 320px">
              <div
                class="relative flex items-center justify-center"
                style="width: 320px; height: 320px"
              >
                <div
                  class="relative w-64 h-48 border border-gray-600 rounded bg-gray-800/30 flex items-center justify-center"
                  :style="{ transform: `rotate(${sensorConfig.SensorRotation}deg)` }"
                >
                  <!-- Rotating sensor frame -->
                  <svg
                    class="absolute inset-0 w-full h-full"
                    viewBox="0 0 256 192"
                    preserve-aspect-ratio="xMidYMid meet"
                  >
                    <!-- Center crosshair -->
                    <line
                      x1="128"
                      y1="80"
                      x2="128"
                      y2="104"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-dasharray="4"
                    />
                    <line
                      x1="104"
                      y1="96"
                      x2="152"
                      y2="96"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-dasharray="4"
                    />
                    <!-- Small center dot -->
                    <circle cx="128" cy="96" r="2" fill="#6B7280" />
                  </svg>

                  <!-- Fixed corner boxes (always at same position, values update based on rotation) -->
                  <div
                    class="absolute top-3 right-3 bg-amber-500/20 border border-amber-500 rounded px-2 py-1 text-center text-xs"
                  >
                    <p class="text-amber-300 font-semibold">TL</p>
                    <p class="text-amber-400 whitespace-nowrap">
                      {{ (deviceStatus?.ImagePlaneTopLeftOffset * 1000)?.toFixed(0) ?? 'N/A' }} µm
                    </p>
                  </div>

                  <div
                    class="absolute top-3 left-3 bg-blue-500/20 border border-blue-500 rounded px-2 py-1 text-center text-xs"
                  >
                    <p class="text-blue-300 font-semibold">TR</p>
                    <p class="text-blue-400 whitespace-nowrap">
                      {{ (deviceStatus?.ImagePlaneTopRightOffset * 1000)?.toFixed(0) ?? 'N/A' }} µm
                    </p>
                  </div>

                  <div
                    class="absolute bottom-3 right-3 bg-green-500/20 border border-green-500 rounded px-2 py-1 text-center text-xs"
                  >
                    <p class="text-green-300 font-semibold">BL</p>
                    <p class="text-green-400 whitespace-nowrap">
                      {{ (deviceStatus?.ImagePlaneBottomLeftOffset * 1000)?.toFixed(0) ?? 'N/A' }}
                      µm
                    </p>
                  </div>

                  <div
                    class="absolute bottom-3 left-3 bg-cyan-500/20 border border-cyan-500 rounded px-2 py-1 text-center text-xs"
                  >
                    <p class="text-cyan-300 font-semibold">BR</p>
                    <p class="text-cyan-400 whitespace-nowrap">
                      {{ (deviceStatus?.ImagePlaneBottomRightOffset * 1000)?.toFixed(0) ?? 'N/A' }}
                      µm
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p class="text-red-400 text-sm">{{ errorMessage }}</p>
        </div>
      </div>
    </div>

    <!-- Manual Tilter Configuration - only show if manual tilter is selected OR if real device is not connected -->
    <div
      v-if="shouldShowManualTilterUI()"
      class="border border-gray-700 rounded-lg p-4 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg"
    >
      <h3 class="font-bold text-base text-cyan-400 mb-4">
        {{ $t('plugins.hocusfocus.tilter.manualTilterConfiguration') }}
      </h3>

      <div class="flex flex-col gap-4">
        <!-- Tilter Geometry Visualization -->
        <div
          class="border border-gray-600/30 rounded p-4 bg-gray-700/20 flex justify-center items-center"
        >
          <div class="relative" style="width: 340px; height: 340px">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 340 340"
              xmlns="http://www.w3.org/2000/svg"
              class="mx-auto"
              preserveAspectRatio="xMidYMid meet"
              style="overflow: visible"
            >
              <!-- Outer ring (tilter housing) -->
              <circle
                cx="170"
                cy="170"
                r="160"
                fill="none"
                stroke="#4b5563"
                stroke-width="20"
                opacity="0.6"
              />
              <circle
                cx="170"
                cy="170"
                r="160"
                fill="none"
                stroke="#6b7280"
                stroke-width="2"
                stroke-dasharray="2"
                opacity="0.3"
              />

              <!-- Inner circle (sensor plane boundary) -->
              <circle
                cx="170"
                cy="170"
                r="50"
                fill="none"
                stroke="#1f2937"
                stroke-width="2"
                opacity="0.5"
              />

              <!-- Sensor plane in center (rotated) -->
              <g :transform="`rotate(${Number(sensorConfig.SensorRotation) || 0} 170 170)`">
                <!-- Sensor rectangle -->
                <rect
                  x="100"
                  y="123"
                  width="140"
                  height="94"
                  fill="#f97316"
                  opacity="0.15"
                  stroke="#f97316"
                  stroke-width="1.5"
                />
                <!-- Sensor corners -->
                <circle cx="100" cy="123" r="2" fill="#f97316" />
                <circle cx="240" cy="123" r="2" fill="#f97316" />
                <circle cx="100" cy="217" r="2" fill="#f97316" />
                <circle cx="240" cy="217" r="2" fill="#f97316" />

                <!-- Corner text -->
                <text
                  :x="115"
                  :y="138"
                  text-anchor="middle"
                  fill="#9ca3af"
                  font-weight="bold"
                  font-size="13"
                >
                  TR
                </text>
                <text
                  :x="225"
                  :y="138"
                  text-anchor="middle"
                  fill="#9ca3af"
                  font-weight="bold"
                  font-size="13"
                >
                  TL
                </text>
                <text
                  :x="115"
                  :y="210"
                  text-anchor="middle"
                  fill="#9ca3af"
                  font-weight="bold"
                  font-size="13"
                >
                  BR
                </text>
                <text
                  :x="225"
                  :y="210"
                  text-anchor="middle"
                  fill="#9ca3af"
                  font-weight="bold"
                  font-size="13"
                >
                  BL
                </text>

                <!-- Center crosshair -->
                <line
                  x1="170"
                  y1="140"
                  x2="170"
                  y2="200"
                  stroke="#9ca3af"
                  stroke-width="1"
                  stroke-dasharray="2"
                />
                <line
                  x1="140"
                  y1="170"
                  x2="200"
                  y2="170"
                  stroke="#9ca3af"
                  stroke-width="1"
                  stroke-dasharray="2"
                />
                <circle cx="170" cy="170" r="2" fill="#9ca3af" />
              </g>

              <!-- Actuators (screws) positioned on the outer ring -->
              <template v-for="screw in actuators" :key="screw.label">
                <g>
                  <circle
                    :cx="screw.cx"
                    :cy="screw.cy"
                    r="12"
                    :fill="screw.fill"
                    opacity="0.2"
                    :stroke="screw.fill"
                    stroke-width="2"
                  />
                  <circle
                    :cx="screw.cx"
                    :cy="screw.cy"
                    r="7"
                    fill="none"
                    :stroke="screw.fill"
                    stroke-width="2"
                  />
                  <circle :cx="screw.cx" :cy="screw.cy" r="2" :fill="screw.fill" />
                  <line
                    :x1="screw.cx"
                    :y1="screw.cy - 7"
                    :x2="screw.cx"
                    :y2="screw.cy + 7"
                    :stroke="screw.fill"
                    stroke-width="1.5"
                  />
                  <line
                    :x1="screw.cx - 7"
                    :y1="screw.cy"
                    :x2="screw.cx + 7"
                    :y2="screw.cy"
                    :stroke="screw.fill"
                    stroke-width="1.5"
                  />
                </g>
                <text
                  :x="screw.labelX"
                  :y="screw.labelY"
                  text-anchor="middle"
                  :fill="screw.textFill"
                  font-weight="bold"
                  font-size="13"
                >
                  {{ screw.label }}
                </text>
              </template>
            </svg>
          </div>
        </div>

        <p class="text-xs text-gray-400 text-center mt-2">
          {{
            $t('plugins.hocusfocus.tilter.actuatorVisualizationLabel', {
              radius: sensorConfig.value?.TilterOuterRadius?.toFixed(1),
              rotation: (Number(sensorConfig.SensorRotation) || 0).toFixed(1),
            })
          }}
        </p>

        <p v-if="screwCount === 4" class="text-xs text-amber-300/80 text-center">
          {{ $t('plugins.hocusfocus.tilter.fourScrewHint') }}
        </p>
      </div>
    </div>

    <!-- Sensor Configuration Section -->
    <div
      class="border border-gray-700 rounded-lg p-4 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg"
    >
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-base text-cyan-400">
          {{ $t('plugins.hocusfocus.tilter.configuration') }}
        </h3>
        <button
          @click="toggleSensorConfigEdit"
          class="px-3 py-1 text-xs rounded border border-cyan-500/20 bg-gray-700 text-white hover:bg-gray-600 transition-colors"
        >
          {{ isSensorConfigEditing ? $t('general.cancel') : $t('general.edit') }}
        </button>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <!-- Sensor Width -->
        <div class="flex flex-col gap-2">
          <label class="text-xs text-gray-400"
            >{{ $t('plugins.hocusfocus.tilter.sensorWidth') }} (mm)</label
          >
          <div
            v-if="!isSensorConfigEditing"
            class="px-3 py-2 bg-gray-700/30 border border-gray-600 rounded text-white text-sm"
          >
            {{ sensorConfig.SensorWidth?.toFixed(1) ?? 'N/A' }}
          </div>
          <input
            v-else
            v-model.number="sensorConfig.SensorWidth"
            type="number"
            step="0.1"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <!-- Sensor Height -->
        <div class="flex flex-col gap-2">
          <label class="text-xs text-gray-400"
            >{{ $t('plugins.hocusfocus.tilter.sensorHeight') }} (mm)</label
          >
          <div
            v-if="!isSensorConfigEditing"
            class="px-3 py-2 bg-gray-700/30 border border-gray-600 rounded text-white text-sm"
          >
            {{ sensorConfig.SensorHeight?.toFixed(1) ?? 'N/A' }}
          </div>
          <input
            v-else
            v-model.number="sensorConfig.SensorHeight"
            type="number"
            step="0.1"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <!-- Sensor Rotation -->
        <div class="flex flex-col gap-2">
          <label class="text-xs text-gray-400"
            >{{ $t('plugins.hocusfocus.tilter.sensorRotation') }} (°)</label
          >
          <div
            v-if="!isSensorConfigEditing"
            class="px-3 py-2 bg-gray-700/30 border border-gray-600 rounded text-white text-sm"
          >
            {{ sensorConfig.SensorRotation?.toFixed(1) ?? 'N/A' }}
          </div>
          <input
            v-else
            v-model.number="sensorConfig.SensorRotation"
            type="number"
            step="0.1"
            min="0"
            max="359.9"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          />
          <p class="text-xs text-gray-500">
            {{ $t('plugins.hocusfocus.tilter.sensorRotationDescription') }}
          </p>
        </div>

        <!-- Tilter Outer Radius (only for manual tilter) -->
        <div v-if="shouldShowManualTilterUI()" class="flex flex-col gap-2">
          <label class="text-xs text-gray-400"
            >{{ $t('plugins.hocusfocus.tilter.tilterOuterRadius') }} (mm)</label
          >
          <div
            v-if="!isSensorConfigEditing"
            class="px-3 py-2 bg-gray-700/30 border border-gray-600 rounded text-white text-sm"
          >
            {{ sensorConfig.TilterOuterRadius?.toFixed(1) ?? 'N/A' }}
          </div>
          <input
            v-else
            v-model.number="sensorConfig.TilterOuterRadius"
            type="number"
            step="0.1"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
            placeholder="e.g., 60"
          />
        </div>

        <!-- Tilter Thread Pitch (only for manual tilter) -->
        <div v-if="shouldShowManualTilterUI()" class="flex flex-col gap-2">
          <label class="text-xs text-gray-400"
            >{{ $t('plugins.hocusfocus.tilter.tilterThreadPitch') }} (mm)</label
          >
          <div
            v-if="!isSensorConfigEditing"
            class="px-3 py-2 bg-gray-700/30 border border-gray-600 rounded text-white text-sm"
          >
            {{ sensorConfig.TilterThreadPitch?.toFixed(2) ?? 'N/A' }}
          </div>
          <input
            v-else
            v-model.number="sensorConfig.TilterThreadPitch"
            type="number"
            step="0.01"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
            placeholder="e.g., 0.35"
          />
        </div>

        <!-- Tilter Screw Count (only for manual tilter) -->
        <div v-if="shouldShowManualTilterUI()" class="flex flex-col gap-2">
          <label class="text-xs text-gray-400">{{
            $t('plugins.hocusfocus.tilter.tilterScrewCount')
          }}</label>
          <div
            v-if="!isSensorConfigEditing"
            class="px-3 py-2 bg-gray-700/30 border border-gray-600 rounded text-white text-sm"
          >
            {{ screwCountLabel }}
          </div>
          <select
            v-else
            v-model.number="sensorConfig.TilterScrewCount"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option :value="3">{{ $t('plugins.hocusfocus.tilter.screwCountThree') }}</option>
            <option :value="4">{{ $t('plugins.hocusfocus.tilter.screwCountFour') }}</option>
          </select>
          <p class="text-xs text-gray-500">
            {{ $t('plugins.hocusfocus.tilter.tilterScrewCountDescription') }}
          </p>
        </div>
      </div>

      <!-- Save Button (only show when editing) -->
      <div v-if="isSensorConfigEditing" class="flex justify-end gap-2 mt-4">
        <button
          @click="saveSensorConfiguration"
          :disabled="isSavingSensorConfig"
          class="px-4 py-2 text-sm rounded border border-green-500/50 bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 transition-colors"
        >
          {{ isSavingSensorConfig ? $t('general.saving') : $t('general.save') }}
        </button>
      </div>

      <!-- Error Message -->
      <div v-if="sensorConfigError" class="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded">
        <p class="text-red-400 text-xs">{{ sensorConfigError }}</p>
      </div>
    </div>

    <!-- Apply Tilt Plane Section -->
    <div
      v-if="selectedDeviceId || shouldShowManualTilterUI()"
      class="border border-gray-700 rounded-lg p-4 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg"
    >
      <h3 class="font-bold text-base text-cyan-400 mb-4">
        {{ $t('plugins.hocusfocus.tilter.applyTiltPlane') }}
      </h3>

      <div class="grid grid-cols-2 gap-4">
        <!-- Top-Left Z -->
        <div class="flex flex-col gap-2">
          <label class="text-xs text-gray-400">Top-Left Z (mm)</label>
          <input
            v-model.number="applyTiltPlane.topLeftZ"
            type="number"
            step="0.001"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <!-- Top-Right Z -->
        <div class="flex flex-col gap-2">
          <label class="text-xs text-gray-400">Top-Right Z (mm)</label>
          <input
            v-model.number="applyTiltPlane.topRightZ"
            type="number"
            step="0.001"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <!-- Bottom-Left Z -->
        <div class="flex flex-col gap-2">
          <label class="text-xs text-gray-400">Bottom-Left Z (mm)</label>
          <input
            v-model.number="applyTiltPlane.bottomLeftZ"
            type="number"
            step="0.001"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <!-- Bottom-Right Z -->
        <div class="flex flex-col gap-2">
          <label class="text-xs text-gray-400">Bottom-Right Z (mm)</label>
          <input
            v-model.number="applyTiltPlane.bottomRightZ"
            type="number"
            step="0.001"
            class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      <!-- Screw travel reference (manual tilters only) -->
      <div v-if="shouldShowManualTilterUI()" class="mt-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="shiftToNonNegative"
            type="checkbox"
            class="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
          />
          <span class="text-gray-300 text-sm">{{
            $t('plugins.hocusfocus.tilter.shiftToNonNegative')
          }}</span>
        </label>
        <p class="text-xs text-gray-500 mt-1">
          {{ $t('plugins.hocusfocus.tilter.shiftToNonNegativeDescription') }}
        </p>
      </div>

      <!-- Calculate Button -->
      <div class="flex justify-start gap-2 mt-4">
        <button
          @click="fetchFromAberrationInspector"
          :disabled="!aberrationInspectorAvailable || isFetchingAberration"
          class="px-4 py-2 text-sm rounded border border-purple-500/50 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :title="
            aberrationInspectorAvailable
              ? 'Fill corner Z values from last Aberration Inspector run'
              : 'No Aberration Inspector data available'
          "
        >
          {{
            isFetchingAberration
              ? $t('general.loading')
              : $t('plugins.hocusfocus.tilter.fetchFromAberrationInspector')
          }}
        </button>
        <button
          @click="calculateTiltPlane"
          :disabled="isCalculatingTiltPlane"
          class="px-4 py-2 text-sm rounded border border-cyan-500/50 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 transition-colors"
        >
          {{
            isCalculatingTiltPlane
              ? $t('general.calculating')
              : $t('plugins.hocusfocus.tilter.calculateActuatorPositions')
          }}
        </button>
      </div>

      <!-- Calculated Positions -->
      <div
        v-if="calculatedPositions"
        class="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded"
      >
        <p class="text-green-400 text-sm font-semibold mb-2">
          {{ $t('plugins.hocusfocus.tilter.calculatedPositions') }}:
        </p>
        <div
          class="grid gap-2 text-xs text-green-300"
          :class="calculatedScrews.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'"
        >
          <div v-for="screw in calculatedScrews" :key="screw.label">
            <div>
              {{ screw.label }}: {{ screw.position?.toFixed(3) }} mm<span
                v-if="shouldShowManualTilterUI() && screw.raw !== null && screw.showRaw"
                class="text-gray-400 text-xs"
              >
                [calc: {{ screw.raw?.toFixed(3) }} mm]</span
              >
            </div>
            <div
              v-if="
                shouldShowManualTilterUI() &&
                typeof sensorConfig.TilterThreadPitch === 'number' &&
                sensorConfig.TilterThreadPitch > 0
              "
              class="text-green-400 mt-1 font-semibold"
            >
              {{ (screw.position / sensorConfig.TilterThreadPitch).toFixed(2) }}
              turns
            </div>
          </div>
        </div>

        <!-- Apply Button (hidden for manual tilter) -->
        <button
          v-if="!shouldShowManualTilterUI()"
          @click="applyCalculatedPositions"
          :disabled="isApplyingPositions"
          class="mt-3 px-4 py-2 text-sm rounded border border-green-500/50 bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 transition-colors w-full"
        >
          {{
            isApplyingPositions
              ? $t('general.applying')
              : $t('plugins.hocusfocus.tilter.applyThesePositionsToDevice')
          }}
        </button>
      </div>

      <!-- Error Message -->
      <div
        v-if="applyTiltPlaneError"
        class="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded"
      >
        <p class="text-red-400 text-xs">{{ applyTiltPlaneError }}</p>
      </div>
    </div>

    <!-- No Device Selected Message -->
    <div v-if="!selectedDeviceId" class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
      <p class="text-blue-400 font-medium text-center text-sm">
        {{ $t('plugins.hocusfocus.tilter.noDeviceSelected') }}
      </p>
    </div>

    <!-- Position Picker Modal -->
    <div
      v-if="showPositionPicker"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="closePositionPicker"
    >
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 w-96 shadow-xl">
        <h3 class="text-lg font-bold text-cyan-400 mb-4">
          Set Position {{ selectedPositionIndex }}
        </h3>

        <div class="mb-4">
          <label class="block text-sm text-gray-300 mb-2"> New Position (0 - 1.200 mm) </label>
          <input
            v-model="positionInputValue"
            type="number"
            min="0"
            max="1.2"
            step="0.001"
            placeholder="Enter position value"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div v-if="positionError" class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p class="text-red-400 text-sm">{{ positionError }}</p>
        </div>

        <div class="flex gap-2 justify-end">
          <button
            @click="closePositionPicker"
            :disabled="isSettingPosition"
            class="px-4 py-2 text-sm rounded border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="savePosition"
            :disabled="isSettingPosition"
            class="px-4 py-2 text-sm rounded border border-green-500/50 bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 transition-colors"
          >
            {{ isSettingPosition ? 'Setting...' : 'Set Position' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { usePolling } from '@/composables/usePolling';
import apiService from '@/services/apiService';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const devices = ref([]);
const selectedDeviceId = ref('');
const isScanning = ref(false);
const isConnecting = ref(false);
const isDisconnecting = ref(false);
const isConnected = ref(false);
const deviceStatus = ref(null);
const errorMessage = ref('');
// Refresh status every 1 second while connected; started on connect,
// stopped on disconnect and automatically on unmount
const statusPoller = usePolling(
  () => {
    if (isConnected.value && selectedDeviceId.value) {
      return refreshStatus();
    }
  },
  1000,
  { autoStart: false, immediate: false }
);

// Sensor configuration state
const sensorConfig = ref({
  SensorWidth: 36,
  SensorHeight: 24,
  SensorRotation: 0,
  TilterOuterRadius: 60,
  TilterThreadPitch: 0,
  TilterScrewCount: 3,
});

// Screw ring radius in SVG units (the visualization is drawn at a fixed scale)
const RING_RADIUS = 160;

// Screw layouts, mirroring TilterService.GetScrewPositions on the backend.
// Angles are in SVG screen space (y grows downward), so screen_y = -math_y.
// 3 screws: equilateral plate (P1 upper left, P2 bottom, P3 upper right).
// 4 screws: one screw on each diagonal, under a sensor corner.
const SCREW_LAYOUTS = {
  3: [
    { label: 'P1', angle: 210, fill: '#60a5fa', textFill: '#93c5fd' },
    { label: 'P2', angle: 90, fill: '#4ade80', textFill: '#86efac' },
    { label: 'P3', angle: 330, fill: '#fb923c', textFill: '#fed7aa' },
  ],
  4: [
    { label: 'TL', angle: 315, fill: '#60a5fa', textFill: '#93c5fd' },
    { label: 'TR', angle: 225, fill: '#4ade80', textFill: '#86efac' },
    { label: 'BL', angle: 45, fill: '#fb923c', textFill: '#fed7aa' },
    { label: 'BR', angle: 135, fill: '#c084fc', textFill: '#e9d5ff' },
  ],
};

const screwCount = computed(() => (Number(sensorConfig.value.TilterScrewCount) === 4 ? 4 : 3));

const screwCountLabel = computed(() =>
  screwCount.value === 4
    ? t('plugins.hocusfocus.tilter.screwCountFour')
    : t('plugins.hocusfocus.tilter.screwCountThree')
);

// Screw markers for the geometry visualization, laid out on the outer ring.
// Labels are pulled back towards the centre so they stay inside the viewBox.
const actuators = computed(() =>
  SCREW_LAYOUTS[screwCount.value].map((screw) => {
    const radians = (screw.angle * Math.PI) / 180;
    const cx = 170 + RING_RADIUS * Math.cos(radians);
    const cy = 170 + RING_RADIUS * Math.sin(radians);
    return {
      ...screw,
      cx,
      cy,
      labelX: cx - 28 * Math.cos(radians),
      labelY: cy - 28 * Math.sin(radians) + 5,
    };
  })
);

const isSensorConfigEditing = ref(false);
const isSavingSensorConfig = ref(false);
const sensorConfigError = ref('');

// Position picker modal state
const showPositionPicker = ref(false);
const selectedPositionIndex = ref(null); // 1, 2, or 3
const positionInputValue = ref('');
const isSettingPosition = ref(false);
const positionError = ref('');

// Apply Tilt Plane
const applyTiltPlane = ref({
  topLeftZ: 0,
  topRightZ: 0,
  bottomLeftZ: 0,
  bottomRightZ: 0,
});
const calculatedPositions = ref(null);
const isCalculatingTiltPlane = ref(false);
const isApplyingPositions = ref(false);
const applyTiltPlaneError = ref('');
const aberrationInspectorAvailable = ref(false);
// Manual tilters are adjusted from fully seated screws, so travel is reported as
// non-negative by default; unchecking reports signed adjustments instead.
const shiftToNonNegative = ref(true);
const isFetchingAberration = ref(false);

// Calculated positions flattened into per-screw rows for display
const calculatedScrews = computed(() => {
  const result = calculatedPositions.value;
  if (!result) return [];
  const layout = SCREW_LAYOUTS[result.ScrewCount === 4 ? 4 : 3];
  return layout.map((screw, index) => {
    const position = result[`Position${index + 1}`];
    const raw = result[`RawPosition${index + 1}`];
    return {
      label: screw.label,
      position,
      raw,
      // With the shift disabled the reported value is the raw one, so don't print it twice
      showRaw: raw !== undefined && raw !== null && Math.abs(raw - position) > 1e-9,
    };
  });
});

// Computed property to detect if selected device is manual tilter
const isSelectedManualTilter = () => selectedDeviceId.value === '-1';

// Computed property: show manual tilter UI whenever not connected to a device
const shouldShowManualTilterUI = () => !isConnected.value;

// Load devices on mount
onMounted(async () => {
  // Restore devices list and selected device from localStorage
  const savedDevicesList = localStorage.getItem('tilterDevicesList');
  const savedDeviceId = localStorage.getItem('tilterSelectedDeviceId');
  const savedIsConnected = localStorage.getItem('tilterIsConnected');

  if (savedDevicesList) {
    // Use cached devices list
    try {
      devices.value = JSON.parse(savedDevicesList);
    } catch (e) {
      console.error('Error parsing saved devices list:', e);
      await loadDevices(); // Reload if parsing fails
    }
  } else {
    // First run - load devices from API
    await loadDevices();
  }

  if (savedDeviceId) {
    selectedDeviceId.value = savedDeviceId;
    // Restore connection state immediately from cache
    // Skip auto-connect for manual tilter (device -1) - always require explicit connection
    if (savedIsConnected === 'true' && selectedDeviceId.value !== '-1') {
      // Only auto-connect real devices (not manual tilter)
      isConnected.value = true;
      checkConnectionStatus();
      statusPoller.start();
    }

    // Restore corner Z values for Apply Tilt Plane
    const savedTiltPlane = localStorage.getItem('applyTiltPlane');
    if (savedTiltPlane) {
      try {
        const tiltPlane = JSON.parse(savedTiltPlane);
        applyTiltPlane.value = tiltPlane;
      } catch (e) {
        console.error('Error parsing saved tilt plane values:', e);
      }
    }
  }

  // Restore the screw travel reference choice
  const savedShift = localStorage.getItem('tilterShiftToNonNegative');
  if (savedShift !== null) {
    try {
      shiftToNonNegative.value = JSON.parse(savedShift) !== false;
    } catch (e) {
      console.error('Error parsing saved screw travel reference:', e);
    }
  }

  // Load sensor configuration
  await loadSensorConfiguration();

  // Check if Aberration Inspector data is available
  try {
    const d = await apiService.hocusfocus.getTiltCornerMeasurements();
    aberrationInspectorAvailable.value = !!d?.tiltCornerMeasurements?.length;
  } catch (_) {
    aberrationInspectorAvailable.value = false;
  }
});

// Watch for changes to selectedDeviceId and persist to localStorage
watch(selectedDeviceId, (newValue) => {
  if (newValue) {
    localStorage.setItem('tilterSelectedDeviceId', newValue);
  } else {
    localStorage.removeItem('tilterSelectedDeviceId');
  }
});

// Watch for changes to SensorRotation and clamp to 0-359°
watch(
  () => sensorConfig.value.SensorRotation,
  (newValue) => {
    // Default to 0 if empty, null, or undefined
    if (newValue == null || newValue === '') {
      sensorConfig.value.SensorRotation = 0;
    } else if (newValue < 0) {
      sensorConfig.value.SensorRotation = 0;
    } else if (newValue > 359.9) {
      sensorConfig.value.SensorRotation = 359.9;
    }
  }
);

// Watch for changes to corner Z values and persist to localStorage
watch(
  () => applyTiltPlane.value,
  (newValue) => {
    localStorage.setItem('applyTiltPlane', JSON.stringify(newValue));
  },
  { deep: true }
);

// Persist the screw travel reference choice
watch(shiftToNonNegative, (newValue) => {
  localStorage.setItem('tilterShiftToNonNegative', JSON.stringify(newValue));
});

async function loadDevices() {
  try {
    isScanning.value = true;
    errorMessage.value = '';
    const response = await apiService.hocusfocus.getTilterDevices();

    if (response.Error) {
      console.error('Error loading devices:', response.Error);
      errorMessage.value = response.Error;
      devices.value = [];
    } else if (Array.isArray(response.Response)) {
      devices.value = response.Response;
      // Save devices list to localStorage
      localStorage.setItem('tilterDevicesList', JSON.stringify(devices.value));
    } else {
      devices.value = [];
    }
  } catch (error) {
    console.error('Error loading tilter devices:', error);
    errorMessage.value = error.message || 'Failed to load devices';
    devices.value = [];
  } finally {
    isScanning.value = false;
  }
}

async function scanDevices() {
  try {
    isScanning.value = true;
    errorMessage.value = '';
    const response = await apiService.hocusfocus.scanTilterDevices();

    if (response.Error) {
      console.error('Scan error:', response.Error);
      errorMessage.value = response.Error;
      devices.value = [];
    } else if (Array.isArray(response.Response)) {
      devices.value = response.Response;
      // Save devices list to localStorage
      localStorage.setItem('tilterDevicesList', JSON.stringify(devices.value));
      selectedDeviceId.value = ''; // Reset selection after scan
    } else {
      devices.value = [];
    }
  } catch (error) {
    console.error('Error scanning tilter devices:', error);
    errorMessage.value = error.message || 'Failed to scan devices';
    devices.value = [];
  } finally {
    isScanning.value = false;
  }
}

async function toggleConnection() {
  if (!selectedDeviceId.value) return;

  try {
    if (isConnected.value) {
      await disconnect();
    } else {
      await connect();
    }
  } catch (error) {
    console.error('Connection error:', error);
    errorMessage.value = error.message || 'Connection failed';
  }
}

async function connect() {
  try {
    isConnecting.value = true;
    errorMessage.value = '';

    // Handle manual tilter - no actual connection needed.
    // Radius, thread pitch and screw count come from the server-side sensor
    // configuration, which is loaded on mount.
    if (isSelectedManualTilter()) {
      isConnected.value = true;
      localStorage.setItem('tilterIsConnected', 'true');
      return;
    }

    const response = await apiService.hocusfocus.connectTilterDevice(selectedDeviceId.value);

    if (response.Error) {
      errorMessage.value = response.Error;
      isConnected.value = false;
      localStorage.setItem('tilterIsConnected', 'false');
    } else {
      isConnected.value = true;
      localStorage.setItem('tilterIsConnected', 'true');
      await refreshStatus();
      statusPoller.start();
    }
  } catch (error) {
    console.error('Connect error:', error);
    errorMessage.value = error.message || 'Failed to connect';
    isConnected.value = false;
    localStorage.setItem('tilterIsConnected', 'false');
  } finally {
    isConnecting.value = false;
  }
}

async function disconnect() {
  try {
    isDisconnecting.value = true;
    errorMessage.value = '';
    statusPoller.stop();

    // Handle manual tilter - no actual disconnection needed
    if (isSelectedManualTilter()) {
      isConnected.value = false;
      deviceStatus.value = null;
      localStorage.setItem('tilterIsConnected', 'false');
      return;
    }

    const response = await apiService.hocusfocus.disconnectTilterDevice(selectedDeviceId.value);

    if (response.Error) {
      errorMessage.value = response.Error;
    } else {
      isConnected.value = false;
      deviceStatus.value = null;
      localStorage.setItem('tilterIsConnected', 'false');
    }
  } catch (error) {
    console.error('Disconnect error:', error);
    errorMessage.value = error.message || 'Failed to disconnect';
  } finally {
    isDisconnecting.value = false;
  }
}

async function refreshStatus() {
  // Skip status refresh for manual tilter (device -1)
  if (selectedDeviceId.value === '-1') {
    return;
  }

  try {
    const response = await apiService.hocusfocus.getTilterStatus(selectedDeviceId.value);

    if (response.Error) {
      errorMessage.value = response.Error;
    } else if (response.Response) {
      deviceStatus.value = response.Response;
    }
  } catch (error) {
    console.error('Status refresh error:', error);
    errorMessage.value = error.message || 'Failed to get status';
  }
}

async function checkConnectionStatus() {
  if (!selectedDeviceId.value) return;

  try {
    const response = await apiService.hocusfocus.isTilterDeviceConnected(selectedDeviceId.value);

    if (!response.Error && response.IsConnected) {
      isConnected.value = true;
      localStorage.setItem('tilterIsConnected', 'true');
      await refreshStatus();
      statusPoller.start();
    } else {
      isConnected.value = false;
      localStorage.setItem('tilterIsConnected', 'false');
    }
  } catch (error) {
    console.error('Error checking connection status:', error);
    isConnected.value = false;
    localStorage.setItem('tilterIsConnected', 'false');
  }
}

async function loadSensorConfiguration() {
  try {
    sensorConfigError.value = '';
    const response = await apiService.hocusfocus.getSensorConfiguration();

    if (!response) {
      console.warn('Sensor configuration API returned no response');
      return;
    }

    if (response.Error) {
      console.error('Error loading sensor configuration:', response.Error);
      sensorConfigError.value = response.Error;
    } else if (
      response.Success &&
      response.SensorWidth !== undefined &&
      response.SensorWidth !== null
    ) {
      sensorConfig.value = {
        SensorWidth: response.SensorWidth,
        SensorHeight: response.SensorHeight,
        SensorRotation: response.SensorRotation,
        TilterOuterRadius: response.TilterOuterRadius ?? 60,
        TilterThreadPitch: response.TilterThreadPitch ?? 0,
        TilterScrewCount: response.TilterScrewCount === 4 ? 4 : 3,
      };
      console.log('Sensor configuration loaded:', sensorConfig.value);
    }
  } catch (error) {
    console.error('Error loading sensor configuration:', error);
    sensorConfigError.value = error.message || 'Failed to load sensor configuration';
  }
}

function toggleSensorConfigEdit() {
  if (isSensorConfigEditing.value) {
    // Cancel editing - reload original configuration
    isSensorConfigEditing.value = false;
    sensorConfigError.value = '';
    loadSensorConfiguration();
  } else {
    // Start editing
    isSensorConfigEditing.value = true;
    sensorConfigError.value = '';
  }
}

async function saveSensorConfiguration() {
  try {
    isSavingSensorConfig.value = true;
    sensorConfigError.value = '';

    // Ensure SensorRotation is a number, default to 0 if empty
    const rotation = Number(sensorConfig.value.SensorRotation) || 0;
    if (rotation < 0 || rotation > 359.9) {
      sensorConfigError.value = 'Sensor rotation must be between 0 and 359.9 degrees';
      isSavingSensorConfig.value = false;
      return;
    }

    const response = await apiService.hocusfocus.setSensorConfiguration({
      sensorWidth: sensorConfig.value.SensorWidth,
      sensorHeight: sensorConfig.value.SensorHeight,
      sensorRotation: rotation,
      tilterOuterRadius: sensorConfig.value.TilterOuterRadius,
      tilterThreadPitch: sensorConfig.value.TilterThreadPitch,
      tilterScrewCount: screwCount.value,
    });

    if (response.Error) {
      sensorConfigError.value = response.Error;
    } else if (response.Success) {
      isSensorConfigEditing.value = false;
      // Configuration saved successfully, will be used in next status refresh
    }
  } catch (error) {
    console.error('Error saving sensor configuration:', error);
    sensorConfigError.value = error.message || 'Failed to save sensor configuration';
  } finally {
    isSavingSensorConfig.value = false;
  }
}

function openPositionPicker(positionIndex) {
  selectedPositionIndex.value = positionIndex;
  const currentValue =
    positionIndex === 1
      ? deviceStatus.value?.CurrentPosition1
      : positionIndex === 2
        ? deviceStatus.value?.CurrentPosition2
        : deviceStatus.value?.CurrentPosition3;
  positionInputValue.value = currentValue ? currentValue.toString() : '0';
  positionError.value = '';
  showPositionPicker.value = true;
}

function closePositionPicker() {
  showPositionPicker.value = false;
  selectedPositionIndex.value = null;
  positionInputValue.value = '';
  positionError.value = '';
}

function validatePositionInput(value) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'Please enter a valid number';
  }
  if (num < 0 || num > 1.2) {
    return 'Position must be between 0 and 1.200';
  }
  return '';
}

async function savePosition() {
  try {
    const error = validatePositionInput(positionInputValue.value);
    if (error) {
      positionError.value = error;
      return;
    }

    if (!selectedDeviceId.value || selectedPositionIndex.value === null) {
      positionError.value = 'Invalid device or position';
      return;
    }

    isSettingPosition.value = true;
    positionError.value = '';

    const newValue = parseFloat(positionInputValue.value);
    // Only send the position being changed - others will be undefined/null
    const positions = {};
    if (selectedPositionIndex.value === 1) {
      positions.position1 = newValue;
    } else if (selectedPositionIndex.value === 2) {
      positions.position2 = newValue;
    } else if (selectedPositionIndex.value === 3) {
      positions.position3 = newValue;
    }

    const response = await apiService.hocusfocus.setTilterPositions(
      selectedDeviceId.value,
      positions
    );

    if (response.Error) {
      positionError.value = response.Error;
    } else if (!response.Success) {
      positionError.value = response.Message || 'Failed to set position';
    } else {
      closePositionPicker();
      // Status will update on next refresh
    }
  } catch (error) {
    console.error('Error saving position:', error);
    positionError.value = error.message || 'Failed to save position';
  } finally {
    isSettingPosition.value = false;
  }
}

async function fetchFromAberrationInspector() {
  try {
    isFetchingAberration.value = true;
    applyTiltPlaneError.value = '';
    const data = await apiService.hocusfocus.getTiltCornerMeasurements();
    if (!data || !data.tiltCornerMeasurements || data.tiltCornerMeasurements.length === 0) {
      aberrationInspectorAvailable.value = false;
      applyTiltPlaneError.value = 'No Aberration Inspector data available';
      return;
    }
    const corners = data.tiltCornerMeasurements;
    const find = (side) => corners.find((c) => c.sensorSide === side);
    const tl = find('TopLeft');
    const tr = find('TopRight');
    const bl = find('BottomLeft');
    const br = find('BottomRight');
    // adjustmentRequiredMicrons is in µm, inputs expect mm
    applyTiltPlane.value.topLeftZ = tl ? +(tl.adjustmentRequiredMicrons / 1000).toFixed(6) : 0;
    applyTiltPlane.value.topRightZ = tr ? +(tr.adjustmentRequiredMicrons / 1000).toFixed(6) : 0;
    applyTiltPlane.value.bottomLeftZ = bl ? +(bl.adjustmentRequiredMicrons / 1000).toFixed(6) : 0;
    applyTiltPlane.value.bottomRightZ = br ? +(br.adjustmentRequiredMicrons / 1000).toFixed(6) : 0;
  } catch (error) {
    console.error('Error fetching Aberration Inspector data:', error);
    applyTiltPlaneError.value = error.message || 'Failed to fetch Aberration Inspector data';
  } finally {
    isFetchingAberration.value = false;
  }
}

async function calculateTiltPlane() {
  try {
    isCalculatingTiltPlane.value = true;
    applyTiltPlaneError.value = '';

    // Validate outer radius for manual tilter (or fallback)
    if (shouldShowManualTilterUI()) {
      if (!sensorConfig.value?.TilterOuterRadius || sensorConfig.value.TilterOuterRadius <= 0) {
        applyTiltPlaneError.value =
          'Please configure the Tilter Screw Outer Radius before calculating positions';
        isCalculatingTiltPlane.value = false;
        return;
      }
    }

    // Only send outerRadius for manual tilter; ETA devices will fetch from hardware
    const outerRadius = shouldShowManualTilterUI()
      ? parseFloat(sensorConfig.value.TilterOuterRadius)
      : undefined;

    // Use device ID -1 for manual tilter (virtual device), or the selected device ID for real hardware
    const deviceId = shouldShowManualTilterUI() ? -1 : parseInt(selectedDeviceId.value);

    console.log('[calculateTiltPlane]', {
      deviceId: deviceId,
      usingManualTilterMode: shouldShowManualTilterUI(),
      outerRadius: outerRadius,
      screwCount: shouldShowManualTilterUI() ? screwCount.value : 3,
      shiftToNonNegative: shouldShowManualTilterUI() ? shiftToNonNegative.value : true,
      cornerValues: {
        topLeftZ: applyTiltPlane.value.topLeftZ,
        topRightZ: applyTiltPlane.value.topRightZ,
        bottomLeftZ: applyTiltPlane.value.bottomLeftZ,
        bottomRightZ: applyTiltPlane.value.bottomRightZ,
      },
    });

    const response = await apiService.hocusfocus.applyTiltPlane(
      deviceId,
      applyTiltPlane.value.topLeftZ,
      applyTiltPlane.value.topRightZ,
      applyTiltPlane.value.bottomLeftZ,
      applyTiltPlane.value.bottomRightZ,
      outerRadius,
      shouldShowManualTilterUI() ? true : undefined, // Skip offset to 0 for manual tilters
      // ETA hardware is always a 3-screw plate; only manual tilters may be 4-screw
      shouldShowManualTilterUI() ? screwCount.value : 3,
      // Real hardware always needs non-negative positions
      shouldShowManualTilterUI() ? shiftToNonNegative.value : true
    );

    if (response.Error) {
      applyTiltPlaneError.value = response.Error;
      calculatedPositions.value = null;
    } else if (!response.Success) {
      applyTiltPlaneError.value = response.Message || 'Failed to calculate positions';
      calculatedPositions.value = null;
    } else {
      calculatedPositions.value = response;
    }
  } catch (error) {
    console.error('Error calculating tilt plane:', error);
    applyTiltPlaneError.value = error.message || 'Failed to calculate positions';
    calculatedPositions.value = null;
  } finally {
    isCalculatingTiltPlane.value = false;
  }
}

async function applyCalculatedPositions() {
  try {
    if (!calculatedPositions.value) {
      applyTiltPlaneError.value = 'No calculated positions available';
      return;
    }

    isApplyingPositions.value = true;
    applyTiltPlaneError.value = '';

    // Use device ID -1 for manual tilter (virtual device), or the selected device ID for real hardware
    const deviceId = shouldShowManualTilterUI() ? -1 : parseInt(selectedDeviceId.value);

    const response = await apiService.hocusfocus.setTilterPositions(deviceId, {
      position1: calculatedPositions.value.Position1,
      position2: calculatedPositions.value.Position2,
      position3: calculatedPositions.value.Position3,
    });

    if (response.Error) {
      applyTiltPlaneError.value = response.Error;
    } else if (!response.Success) {
      applyTiltPlaneError.value = response.Message || 'Failed to apply positions';
    } else {
      // Success!
      calculatedPositions.value = null;
      // Position will update on next status refresh
    }
  } catch (error) {
    console.error('Error applying positions:', error);
    applyTiltPlaneError.value = error.message || 'Failed to apply positions';
  } finally {
    isApplyingPositions.value = false;
  }
}
</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
