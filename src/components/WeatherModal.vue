<template>
  <Modal
    show
    zIndex="z-top"
    maxWidth="max-w-md"
    :title="$t('components.weatherModal.weatherInformation')"
    @close="$emit('close')"
  >
    <template #header>
      <div>
        <h2 class="text-xl font-bold">{{ $t('components.weatherModal.weatherInformation') }}</h2>
        <p class="text-sm text-content-muted mt-1">{{ weatherInfo.DisplayName }}</p>
      </div>
      <button
        @click="toggleUnits"
        class="text-sm font-medium text-content-muted hover:text-content transition-colors"
      >
        {{
          settingsStore.useImperialUnits
            ? $t('components.weatherModal.imperial')
            : $t('components.weatherModal.metric')
        }}
      </button>
    </template>
    <template #body>
      <div class="w-full space-y-6 pr-3">
        <!-- Temperature -->
        <div
          v-if="Number.isFinite(weatherInfo.Temperature)"
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              fill="currentColor"
              class="size-6"
              viewBox="0 0 64 64"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M40.9,27.2l-7.6,12.9C32.9,40.1,32.5,40,32,40c-2.8,0-5,2.2-5,5s2.2,5,5,5s5-2.2,5-5c0-1.6-0.8-3-1.9-3.9l7.3-12.4
          c2,2.3,3.3,5.2,3.5,8.4c0,0.5,0.5,0.9,1,0.9h3.4c0.5,0,0.8-0.3,1-0.7c0.5-1.7,0.7-3.5,0.7-5.3c0-11-9-20-20-20s-20,9-20,20
          c0,1.8,0.2,3.6,0.7,5.3c0.1,0.4,0.5,0.7,1,0.7H17c0.5,0,1-0.4,1-0.9C18.5,29.7,24.6,24,32,24C35.4,24,38.5,25.2,40.9,27.2z M32,48
          c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S33.7,48,32,48z M25.8,23.3l-2.9-6.7c0,0,0-0.1-0.1-0.1c2.4-1.4,5.2-2.3,8.1-2.5v8
          C29.2,22.2,27.4,22.6,25.8,23.3z M33,22v-8c3,0.2,5.7,1,8.1,2.5c0,0,0,0.1-0.1,0.1l-2.9,6.7C36.6,22.6,34.8,22.2,33,22z M49.6,36
          h-1.7c-0.3-2.3-1.1-4.4-2.2-6.3l3.6-2.7c0.5,1.6,0.7,3.2,0.7,5C50,33.4,49.8,34.7,49.6,36z"
              />
            </svg>
            <span>{{ $t('components.weatherModal.temperature') }}</span>
          </h3>
          <p class="text-content pl-7">{{ temperature }} {{ temperatureUnit }}</p>
        </div>
        <!-- Cloud Cover -->
        <div
          v-if="Number.isFinite(weatherInfo.CloudCover)"
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"
              />
            </svg>
            <span>{{ $t('components.weatherModal.cloudCover') }}</span>
          </h3>
          <p class="text-content pl-7">{{ cloudCover }}</p>
        </div>

        <!-- Wind -->
        <div
          v-if="
            Number.isFinite(weatherInfo.WindSpeed) || Number.isFinite(weatherInfo.WindDirection)
          "
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 32 32"
              fill="white"
            >
              <path
                d="M13 11.261c0.038 0 0.070-0.018 0.107-0.021 2.849-0.061 5.136-2.386 5.136-5.244 0-2.897-2.348-5.245-5.245-5.245-2.404 0-4.43 1.617-5.050 3.823l-0.009 0.037-0.012 0.025c-0.115 0.411-0.181 0.883-0.182 1.371v0c0 0.69 0.56 1.25 1.25 1.25s1.25-0.56 1.25-1.25v0c0-0.254 0.035-0.499 0.099-0.732l-0.005 0.019 0.006-0.012c0.327-1.18 1.391-2.032 2.655-2.032 1.519 0 2.75 1.231 2.75 2.75s-1.231 2.75-2.75 2.75h-0c-0.019 0-0.034 0.010-0.053 0.011l-10.932-0.011c-0 0-0 0-0 0-0.69 0-1.25 0.56-1.25 1.25s0.559 1.25 1.249 1.25l10.985 0.011zM24.469 4.869c-3.106 0.004-5.723 2.093-6.527 4.942l-0.012 0.048-0.013 0.026c-0.149 0.53-0.235 1.139-0.235 1.768 0 0.002 0 0.003 0 0.005v-0c0 0.69 0.56 1.25 1.25 1.25s1.25-0.56 1.25-1.25v0c0-0.002 0-0.005 0-0.007 0-0.393 0.054-0.774 0.155-1.135l-0.007 0.030 0.007-0.013c0.509-1.837 2.166-3.163 4.133-3.163 2.364 0 4.281 1.917 4.281 4.281s-1.917 4.281-4.281 4.281v0c-0.026 0-0.047 0.013-0.072 0.015l-20.34-0.020c-0.689 0.003-1.246 0.561-1.246 1.25s0.557 1.247 1.245 1.25l20.413 0.020c0.053-0.008 0.099-0.017 0.144-0.029l-0.008 0.002c3.685-0.073 6.644-3.078 6.644-6.774 0-3.742-3.033-6.775-6.775-6.775-0.002 0-0.004 0-0.006 0h0zM22.718 19.309c-0.031-0.008-0.070-0.017-0.11-0.023l-0.006-0.001-18.546 0.018c-0.69 0-1.25 0.56-1.25 1.25s0.56 1.25 1.25 1.25c0 0 0 0 0.001 0l18.487-0.018c0.020 0.001 0.037 0.012 0.058 0.012 1.902 0 3.443 1.542 3.443 3.443s-1.542 3.443-3.443 3.443c-1.582 0-2.915-1.067-3.318-2.521l-0.006-0.024-0.007-0.015c-0.074-0.267-0.117-0.573-0.118-0.89v-0c0-0.002 0-0.003 0-0.005 0-0.69-0.559-1.25-1.25-1.25s-1.25 0.559-1.25 1.25c0 0.002 0 0.003 0 0.005v-0c0 0.002 0 0.005 0 0.007 0 0.55 0.075 1.082 0.214 1.587l-0.010-0.042c0.005 0.017 0.016 0.029 0.021 0.045 0.717 2.533 3.009 4.357 5.726 4.357 3.281 0 5.941-2.66 5.941-5.941 0-3.241-2.595-5.876-5.821-5.94l-0.006-0z"
              ></path>
            </svg>
            <span>{{ $t('components.weatherModal.wind') }}</span>
          </h3>
          <p class="text-content pl-7">
            {{ windSpeed }} {{ windSpeedUnit }}
            {{ Number.isFinite(weatherInfo.WindDirection) ? `(${windDirection})` : '' }}
          </p>
        </div>

        <!-- Humidity -->
        <div
          v-if="Number.isFinite(weatherInfo.Humidity)"
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 328.611 328.611"
              fill="currentColor"
            >
              <path
                d="M209.306,50.798c-2.452-3.337-7.147-4.055-10.485-1.602c-3.338,2.453-4.055,7.147-1.603,10.485
        c54.576,74.266,66.032,123.541,66.032,151.8c0,27.691-8.272,52.794-23.293,70.685c-17.519,20.866-42.972,31.446-75.651,31.446
        c-73.031,0-98.944-55.018-98.944-102.131c0-52.227,28.103-103.234,51.679-136.829c25.858-36.847,52.11-61.415,52.37-61.657
        c3.035-2.819,3.209-7.565,0.39-10.6c-2.819-3.034-7.565-3.209-10.599-0.39c-1.11,1.031-27.497,25.698-54.254,63.765
        c-24.901,35.428-54.586,89.465-54.586,145.71c0,31.062,9.673,59.599,27.236,80.353c20.361,24.061,50.345,36.779,86.708,36.779
        c36.794,0,66.926-12.726,87.139-36.801c17.286-20.588,26.806-49.117,26.806-80.33C278.25,156.216,240.758,93.597,209.306,50.798z"
              />
              <path
                d="M198.43,148.146l-95.162,95.162c-2.929,2.929-2.929,7.678,0,10.606c1.465,1.464,3.385,2.197,5.304,2.197
        s3.839-0.732,5.304-2.197l95.162-95.162c2.929-2.929,2.929-7.678,0-10.606C206.107,145.217,201.359,145.217,198.43,148.146z"
              />
              <path
                d="M191.965,207.899c-13.292,0-24.106,10.814-24.106,24.106s10.814,24.106,24.106,24.106s24.106-10.814,24.106-24.106
        S205.257,207.899,191.965,207.899z M191.965,241.111c-5.021,0-9.106-4.085-9.106-9.106s4.085-9.106,9.106-9.106
        s9.106,4.085,9.106,9.106S196.986,241.111,191.965,241.111z"
              />
              <path
                d="M125.178,194.162c13.292,0,24.106-10.814,24.106-24.106s-10.814-24.106-24.106-24.106s-24.106,10.814-24.106,24.106
        S111.886,194.162,125.178,194.162z M125.178,160.949c5.021,0,9.106,4.085,9.106,9.106s-4.085,9.106-9.106,9.106
        c-5.021,0-9.106-4.085-9.106-9.106S120.156,160.949,125.178,160.949z"
              />
            </svg>
            <span>{{ $t('components.weatherModal.humidity') }}</span>
          </h3>
          <p class="text-content pl-7">{{ humidity }}</p>
        </div>

        <!-- Pressure -->
        <div
          v-if="Number.isFinite(weatherInfo.Pressure)"
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="white"
            >
              <path
                d="M12 9C11.4477 9 11 9.44771 11 10V15.2676C10.4022 15.6134 10 16.2597 10 17C10 18.1046 10.8954 19 12 19C13.1046 19 14 18.1046 14 17C14 16.2597 13.5978 15.6134 13 15.2676V10C13 9.44771 12.5523 9 12 9Z"
              />
              <path
                d="M11 6C11 5.44772 11.4477 5 12 5C12.5523 5 13 5.44772 13 6C13 6.55228 12.5523 7 12 7C11.4477 7 11 6.55228 11 6Z"
              />
              <path
                d="M16 7C15.4477 7 15 7.44772 15 8C15 8.55229 15.4477 9 16 9C16.5523 9 17 8.55229 17 8C17 7.44772 16.5523 7 16 7Z"
              />
              <path
                d="M6 13C5.44772 13 5 12.5523 5 12C5 11.4477 5.44772 11 6 11C6.55228 11 7 11.44772 7 12C7 12.5523 6.55228 13 6 13Z"
              />
              <path
                d="M7 8C7 8.55229 7.44772 9 8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8Z"
              />
              <path
                d="M18 13C17.4477 13 17 12.5523 17 12C17 11.4477 17.4477 11 18 11C18.5523 11 19 11.4477 19 12C19 12.5523 18.5523 13 18 13Z"
              />
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23ZM12 20.9932C7.03321 20.9932 3.00683 16.9668 3.00683 12C3.00683 7.03321 7.03321 3.00683 12 3.00683C16.9668 3.00683 20.9932 7.03321 20.9932 12C20.9932 16.9668 16.9668 20.9932 12 20.9932Z"
              />
            </svg>
            <span>{{ $t('components.weatherModal.pressure') }}</span>
          </h3>
          <p class="text-content pl-7">{{ pressure }}</p>
        </div>

        <!-- Dew Point -->
        <div
          v-if="Number.isFinite(weatherInfo.DewPoint)"
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              fill="currentColor"
              class="size-6"
              viewBox="0 0 64 64"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M40.9,27.2l-7.6,12.9C32.9,40.1,32.5,40,32,40c-2.8,0-5,2.2-5,5s2.2,5,5,5s5-2.2,5-5c0-1.6-0.8-3-1.9-3.9l7.3-12.4
          c2,2.3,3.3,5.2,3.5,8.4c0,0.5,0.5,0.9,1,0.9h3.4c0.5,0,0.8-0.3,1-0.7c0.5-1.7,0.7-3.5,0.7-5.3c0-11-9-20-20-20s-20,9-20,20
          c0,1.8,0.2,3.6,0.7,5.3c0.1,0.4,0.5,0.7,1,0.7H17c0.5,0,1-0.4,1-0.9C18.5,29.7,24.6,24,32,24C35.4,24,38.5,25.2,40.9,27.2z M32,48
          c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S33.7,48,32,48z M25.8,23.3l-2.9-6.7c0,0,0-0.1-0.1-0.1c2.4-1.4,5.2-2.3,8.1-2.5v8
          C29.2,22.2,27.4,22.6,25.8,23.3z M33,22v-8c3,0.2,5.7,1,8.1,2.5c0,0,0,0.1-0.1,0.1l-2.9,6.7C36.6,22.6,34.8,22.2,33,22z M49.6,36
          h-1.7c-0.3-2.3-1.1-4.4-2.2-6.3l3.6-2.7c0.5,1.6,0.7,3.2,0.7,5C50,33.4,49.8,34.7,49.6,36z"
              />
            </svg>
            <span>{{ $t('components.weatherModal.dewPoint') }}</span>
          </h3>
          <p class="text-content pl-7">{{ dewPoint }} {{ dewPointUnit }}</p>
        </div>

        <!-- Rain Rate -->
        <div
          v-if="Number.isFinite(Number(weatherInfo.RainRate))"
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <span>{{ $t('components.weatherModal.rainRate') }}</span>
          </h3>
          <p class="text-content pl-7">{{ rainRate }}</p>
        </div>

        <!-- Sky Quality -->
        <div
          v-if="Number.isFinite(Number(weatherInfo.SkyQuality))"
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            <span>{{ $t('components.weatherModal.skyQuality') }}</span>
          </h3>
          <p class="text-content pl-7">{{ skyQuality }}</p>
        </div>

        <!-- Sky Temperature -->
        <div
          v-if="Number.isFinite(Number(weatherInfo.SkyTemperature))"
          class="bg-surface-2 p-5 rounded-xl hover:bg-surface-3 transition-colors duration-200"
        >
          <h3 class="font-semibold text-content mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
              />
            </svg>
            <span>{{ $t('components.weatherModal.skyTemperature') }}</span>
          </h3>
          <p class="text-content pl-7">{{ skyTemperature }} {{ skyTemperatureUnit }}</p>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { useSettingsStore } from '@/store/settingsStore';

const props = defineProps({
  weatherInfo: {
    type: Object,
    required: true,
  },
});

const settingsStore = useSettingsStore();

const temperature = computed(() => {
  if (!Number.isFinite(props.weatherInfo.Temperature)) {
    return 'N/A';
  }
  return settingsStore.useImperialUnits
    ? ((props.weatherInfo.Temperature * 9) / 5 + 32).toFixed(2)
    : props.weatherInfo.Temperature.toFixed(2);
});

const temperatureUnit = computed(() => {
  return settingsStore.useImperialUnits ? '°F' : '°C';
});

const windSpeed = computed(() => {
  if (!Number.isFinite(props.weatherInfo.WindSpeed)) {
    return 'N/A';
  }
  return settingsStore.useImperialUnits
    ? (props.weatherInfo.WindSpeed * 2.23694).toFixed(2)
    : props.weatherInfo.WindSpeed.toFixed(2);
});

const windDirection = computed(() => {
  if (!Number.isFinite(props.weatherInfo.WindDirection)) {
    return 'N/A';
  }
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round((props.weatherInfo.WindDirection % 360) / 22.5);
  return directions[index % 16];
});

const windSpeedUnit = computed(() => {
  return settingsStore.useImperialUnits ? 'mph' : 'm/s';
});

const cloudCover = computed(() => {
  return !Number.isFinite(props.weatherInfo.CloudCover)
    ? 'N/A'
    : `${Number(props.weatherInfo.CloudCover).toFixed(2)}%`;
});

const humidity = computed(() => {
  return !Number.isFinite(props.weatherInfo.Humidity)
    ? 'N/A'
    : `${Number(props.weatherInfo.Humidity).toFixed(2)}%`;
});

const pressure = computed(() => {
  return !Number.isFinite(props.weatherInfo.Pressure)
    ? 'N/A'
    : `${Number(props.weatherInfo.Pressure).toFixed(2)} hPa`;
});

const dewPoint = computed(() => {
  if (!Number.isFinite(props.weatherInfo.DewPoint)) {
    return 'N/A';
  }
  return settingsStore.useImperialUnits
    ? ((props.weatherInfo.DewPoint * 9) / 5 + 32).toFixed(2)
    : props.weatherInfo.DewPoint.toFixed(2);
});

const dewPointUnit = computed(() => {
  return settingsStore.useImperialUnits ? '°F' : '°C';
});

const rainRate = computed(() => {
  const rate = Number(props.weatherInfo.RainRate);
  return !Number.isFinite(rate) ? 'N/A' : `${rate.toFixed(2)} mm/h`;
});

const skyQuality = computed(() => {
  const quality = Number(props.weatherInfo.SkyQuality);
  return !Number.isFinite(quality) ? 'N/A' : `${quality.toFixed(2)} mag/arcsec²`;
});

const skyTemperature = computed(() => {
  const temp = Number(props.weatherInfo.SkyTemperature);
  if (!Number.isFinite(temp)) {
    return 'N/A';
  }
  return settingsStore.useImperialUnits ? ((temp * 9) / 5 + 32).toFixed(2) : temp.toFixed(2);
});

const skyTemperatureUnit = computed(() => {
  return settingsStore.useImperialUnits ? '°F' : '°C';
});

function toggleUnits() {
  settingsStore.toggleUnits();
}

defineEmits(['close']);
</script>
