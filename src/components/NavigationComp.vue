<template>
  <div
    class="navigation-container shadow-md overflow-hidden"
    :class="[activeInstanceColor, orientationClasses, { 'nav-labels-visible': navTouched }]"
  >
    <!-- Scroll Fade Indicators -->
    <div
      v-if="canScrollStart"
      class="scroll-fade scroll-fade-start"
      :class="isLandscape ? 'scroll-fade-top' : 'scroll-fade-left'"
    >
      <div class="scroll-arrow" :class="isLandscape ? 'arrow-up' : 'arrow-left'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            :d="isLandscape ? 'M18 15l-6-6-6 6' : 'M15 18l-6-6 6-6'"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>
    <div
      v-if="canScrollEnd"
      class="scroll-fade scroll-fade-end"
      :class="isLandscape ? 'scroll-fade-bottom' : 'scroll-fade-right'"
    >
      <div class="scroll-arrow" :class="isLandscape ? 'arrow-down' : 'arrow-right'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            :d="isLandscape ? 'M6 9l6 6 6-6' : 'M9 18l6-6-6-6'"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>

    <div
      ref="navContentRef"
      class="nav-content items-center scrollbar-hide"
      :class="contentClasses"
      @scroll="updateScrollIndicators"
    >
      <div
        class="nav-items-wrapper"
        :class="wrapperClasses"
        @touchstart.passive="handleNavTouchStart"
        @touchend.passive="handleNavTouchEnd"
        @touchcancel.passive="handleNavTouchEnd"
      >
        <div
          v-if="store.isBackendReachable && !isNavItemHidden('equipment')"
          :style="{ order: getNavOrder('equipment') }"
          :data-label="t('nav.equipment')"
        >
          <router-link to="/equipment" class="nav-button" active-class="active-nav-button">
            <LinkIcon class="icon force-visible" />
          </router-link>
        </div>

        <div
          v-if="store.cameraInfo.Connected && !isNavItemHidden('camera')"
          :style="{ order: getNavOrder('camera') }"
          :data-label="t('nav.camera')"
        >
          <router-link
            to="/camera"
            class="nav-button camera-button"
            active-class="active-nav-button"
          >
            <div class="camera-icon-wrapper">
              <!-- Progress Ring für Belichtungszeit -->
              <svg v-if="store.cameraInfo.IsExposing" class="progress-ring" viewBox="0 0 36 36">
                <!-- Background Circle -->
                <path
                  class="text-white text-opacity-30 fill-none stroke-current stroke-[2.8]"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <!-- Progress Circle -->
                <path
                  class="fill-none stroke-green-500 stroke-[2.8]"
                  :style="{
                    strokeDasharray: cameraStore.exposureProgress + ', 100',
                    transform: 'rotate(-90deg)',
                    transformOrigin: 'center',
                    transition:
                      cameraStore.exposureProgress > 0 ? 'stroke-dasharray 0.5s linear' : 'none',
                  }"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>

              <CameraIcon
                class="icon camera-icon force-visible"
                :class="store.cameraInfo.IsExposing ? 'text-green-500' : 'text-white'"
              />
            </div>
          </router-link>
        </div>

        <div
          v-if="store.focuserInfo.Connected && !isNavItemHidden('autofocus')"
          :style="{ order: getNavOrder('autofocus') }"
          :data-label="t('nav.autofocus')"
        >
          <router-link to="/autofocus" class="nav-button" active-class="active-nav-button">
            <EyeIcon class="icon force-visible" />
          </router-link>
        </div>

        <div
          v-if="!isNavItemHidden('mount')"
          :style="{ order: getNavOrder('mount') }"
          :data-label="t('nav.mount')"
        >
          <router-link to="/mount" class="nav-button" active-class="active-nav-button">
            <div class="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                :class="[
                  'icon force-visible',
                  !store.mountInfo.Connected
                    ? 'text-white'
                    : store.mountInfo.AtPark
                      ? 'text-red-500'
                      : !store.mountInfo.TrackingEnabled
                        ? 'text-yellow-500'
                        : 'text-green-500',
                ]"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M6 21l6 -5l6 5" />
                <path d="M12 13v8" />
                <path
                  d="M3.294 13.678l.166 .281c.52 .88 1.624 1.265 2.605 .91l14.242 -5.165a1.023 1.023 0 0 0 .565 -1.456l-2.62 -4.705a1.087 1.087 0 0 0 -1.447 -.42l-.056 .032l-12.694 7.618c-1.02 .613 -1.357 1.897 -.76 2.905z"
                />
                <path d="M14 5l3 5.5" />
              </svg>
              <!-- Disconnect Icon - positioned below the mount icon -->
              <LinkSlashIcon
                v-if="!store.mountInfo.Connected"
                class="absolute -bottom-2 -right-2 w-4 h-4 text-red-500 bg-gray-800 rounded-full p-0.5"
              />
            </div>
          </router-link>
        </div>

        <div
          v-if="store.domeInfo.Connected && !isNavItemHidden('dome')"
          :style="{ order: getNavOrder('dome') }"
          :data-label="t('nav.dome')"
        >
          <router-link to="/dome" class="nav-button" active-class="active-nav-button">
            <svg
              fill="#FFFFFF"
              height="24"
              width="24"
              version="1.1"
              id="Layer_1"
              xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              viewBox="0 0 512 512"
              xml:space="preserve"
              class="icon force-visible"
            >
              <path
                d="M256,114.383c-22.526,0-40.851,18.325-40.851,40.851s18.325,40.851,40.851,40.851s40.851-18.325,40.851-40.851
            S278.526,114.383,256,114.383z M256,179.745c-13.516,0-24.511-10.995-24.511-24.511c0-13.516,10.995-24.511,24.511-24.511
            s24.511,10.995,24.511,24.511C280.511,168.75,269.516,179.745,256.179.745z"
              />
              <path
                d="M495.66,283.234h-2.723v-38.128h2.723c4.512,0,8.17-3.658,8.17-8.17c0-4.512-3.658-8.17-8.17-8.17h-2.878
			c-2.027-60.223-26.424-116.55-69.243-159.369c-26.822-26.822-58.948-46.412-94.006-57.812V8.45c0-4.512-3.658-8.17-8.17-8.17
			c-3.999,0-7.322,2.876-8.026,6.671C294.802,2.366,275.583,0,256,0c-19.714,0-39.059,2.393-57.707,7.038
			c-1.154-3.113-4.141-5.337-7.655-5.337c-4.512,0-8.17,3.658-8.17,8.17v1.714c-35.06,11.399-67.184,30.989-94.008,57.812
			c-42.82,42.818-67.215,99.144-69.242,159.368H16.34c-4.512,0-8.17,3.658-8.17,8.17c0,4.512,3.658,8.17,8.17,8.17h2.723v38.128
			H16.34c-4.512,0-8.17,3.658-8.17,8.17c0,4.512,3.658,8.17,8.17,8.17h2.723V503.83c0,4.512,3.658,8.17,8.17,8.17h457.532
			c4.512,0,8.17-3.658,8.17-8.17V299.574h2.723c4.512,0,8.17-3.658,8.17-8.17C503.83,286.892,500.172,283.234,495.66,283.234z
			M198.809,23.874c18.248-4.903,37.417-7.534,57.191-7.534c19.774,0,38.944,2.631,57.191,7.534v41.487H198.809V23.874z
			M182.468,28.958v175.297c0,4.512,3.658,8.17,8.17,8.17s8.17-3.658,8.17-8.17V81.702h114.383v122.553
			c0,4.512,3.658,8.17,8.17,8.17s8.17-3.658,8.17-8.17V28.958C412.68,58.443,473.049,136.45,476.429,228.766H35.571
			C38.951,136.45,99.32,58.443,182.468,28.958z M247.83,495.66h-49.021V343.149h49.021V495.66z M313.191,495.66H264.17V343.149
			h49.021V495.66z M476.596,283.234h-367.66c-4.512,0-8.17,3.658-8.17,8.17c0,4.512,3.658,8.17,8.17,8.17h367.66V495.66H329.532
			V334.979c0-4.512-3.658-8.17-8.17-8.17H190.638c-4.512,0-8.17,3.658-8.17,8.17V495.66H35.404V299.574h40.851
			c4.512,0,8.17-3.658,8.17-8.17c0-4.512-3.658-8.17-8.17-8.17H35.404v-38.128h49.021v13.617c0,4.512,3.658,8.17,8.17,8.17
			s8.17-3.658,8.17-8.17v-13.617h49.021v13.617c0,4.512,3.658,8.17,8.17,8.17s8.17-3.658,8.17-8.17v-13.617h49.021v13.617
			c0,4.512,3.658,8.17,8.17,8.17s8.17-3.658,8.17-8.17v-13.617h49.021v13.617c0,4.512,3.658,8.17,8.17,8.17s8.17-3.658,8.17-8.17
			v-13.617h49.021v13.617c0,4.512,3.658,8.17,8.17,8.17c4.512,0,8.17-3.658,8.17-8.17v-13.617h49.021V283.234z"
              />
              <path
                d="M354.043,359.489c-4.512,0-8.17,3.658-8.17,8.17v43.574c0,4.512,3.658,8.17,8.17,8.17s8.17-3.658,8.17-8.17V367.66 
          C362.213,363.147,358.555,359.489,354.043,359.489z"
              />
              <path
                d="M157.957,359.489c-4.512,0-8.17,3.658-8.17,8.17v43.574c0,4.512,3.658,8.17,8.17,8.17s8.17-3.658,8.17-8.17V367.66
            C166.128,363.147,162.47,359.489,157.957,359.489z"
              />
            </svg>
          </router-link>
        </div>

        <div
          v-if="store.flatdeviceInfo.Connected && !isNavItemHidden('flat')"
          :style="{ order: getNavOrder('flat') }"
          :data-label="t('nav.flatDevice')"
        >
          <router-link to="/flat" class="nav-button touch-target" active-class="active-nav-button">
            <LightBulbIcon
              class="icon force-visible"
              :class="[
                store.flatdeviceInfo.LightOn
                  ? 'text-yellow-500'
                  : store.flatdeviceInfo.CoverState === 'Closed'
                    ? 'text-red-500'
                    : 'text-white',
              ]"
            />
          </router-link>
        </div>

        <div
          v-if="store.switchInfo.Connected && !isNavItemHidden('switch')"
          :style="{ order: getNavOrder('switch') }"
          :data-label="t('nav.switch')"
        >
          <router-link to="/switch" class="nav-button" active-class="active-nav-button">
            <AdjustmentsVerticalIcon class="icon force-visible" />
          </router-link>
        </div>

        <div
          v-if="
            store.profileInfo?.FilterWheelSettings?.FilterWheelFilters?.length &&
            !isNavItemHidden('filter')
          "
          :style="{ order: getNavOrder('filter') }"
          :data-label="t('nav.filterWheel')"
        >
          <router-link to="/filterwheel" class="nav-button" active-class="active-nav-button">
            <div class="relative">
              <svg
                baseProfile="full"
                version="1.1"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                class="icon force-visible"
              >
                <defs />
                <circle cx="50.0" cy="50.0" fill="currentColor" r="40.0" stroke="black" />
                <circle cx="70.0" cy="50.0" fill="black" r="5.0" />
                <circle cx="56.180339887498945" cy="69.02113032590307" fill="black" r="5.0" />
                <circle cx="33.819660112501055" cy="61.75570504584947" fill="black" r="5.0" />
                <circle cx="33.81966011250105" cy="38.24429495415054" fill="black" r="5.0" />
                <circle cx="56.180339887498945" cy="30.978869674096927" fill="black" r="5.0" />
              </svg>
              <!-- Disconnect Icon - positioned below the filter wheel icon -->
              <LinkSlashIcon
                v-if="!store.filterInfo.Connected"
                class="absolute -bottom-2 -right-2 w-4 h-4 text-red-500 bg-gray-800 rounded-full p-0.5"
              />
            </div>
          </router-link>
        </div>

        <div
          v-if="store.rotatorInfo.Connected && !isNavItemHidden('rotator')"
          :style="{ order: getNavOrder('rotator') }"
          :data-label="t('nav.rotator')"
        >
          <router-link to="/rotator" class="nav-button" active-class="active-nav-button">
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              class="icon force-visible"
            >
              <path
                d="M6 7L7 6L4.70711 3.70711L5.19868 3.21553C5.97697 2.43724 7.03256 2 8.13323 2C11.361 2 14 4.68015 14 7.93274C14 11.2589 11.3013 14 8 14C6.46292 14 4.92913 13.4144 3.75736 12.2426L2.34315 13.6569C3.90505 15.2188 5.95417 16 8 16C12.4307 16 16 12.3385 16 7.93274C16 3.60052 12.4903 0 8.13323 0C6.50213 0 4.93783 0.647954 3.78447 1.80132L3.29289 2.29289L1 0L0 1V7H6Z"
              />
            </svg>
          </router-link>
        </div>

        <div
          v-if="store.guiderInfo.Connected && !isNavItemHidden('guider')"
          :style="{ order: getNavOrder('guider') }"
          :data-label="t('nav.guider')"
        >
          <router-link to="/guider" class="nav-button" active-class="active-nav-button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :class="[
                'icon force-visible icon-tabler icons-tabler-outline icon-tabler-viewfinder',
                store.guiderInfo.State == 'Guiding' ? 'text-green-500' : 'text-white',
              ]"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
              <path d="M12 3l0 4" />
              <path d="M12 21l0 -3" />
              <path d="M3 12l4 0" />
              <path d="M21 12l-3 0" />
              <path d="M12 12l0 .01" />
            </svg>
          </router-link>
        </div>

        <!-- Fixed Sequence Button -->
        <div
          v-if="!isNavItemHidden('sequence')"
          :style="{ order: getNavOrder('sequence') }"
          :data-label="t('nav.sequence')"
        >
          <router-link
            to="/sequence"
            class="nav-button touch-target"
            active-class="active-nav-button"
            @touchstart.passive="handleTouchStart"
            @touchend.passive="handleTouchEnd"
          >
            <ListBulletIcon
              class="icon force-visible"
              :class="sequenceStore.sequenceRunning ? 'text-green-500' : 'text-white'"
            />
          </router-link>
        </div>

        <div
          v-if="!isNavItemHidden('monitoring')"
          :style="{ order: getNavOrder('monitoring') }"
          :data-label="t('nav.monitoring')"
        >
          <router-link to="/seq-mon" class="nav-button" active-class="active-nav-button">
            <svg
              fill="#FFFFFF"
              height="400px"
              width="400px"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-100 0 639.479 439.479"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              enable-background="new 0 0 439.479 439.479"
              class="icon force-visible"
            >
              <g>
                <path
                  d="m407.18,60.082h-374.882c-17.81,0-32.298,14.489-32.298,32.299v226.626c0,17.81 14.488,32.299 32.298,32.299h106.252l-12.162,13.091h-18.23c-4.143,0-7.5,3.358-7.5,7.5s3.357,7.5 7.5,7.5h223.162c4.143,0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5h-18.23l-12.162-13.091h106.252c17.81,0 32.299-14.489 32.299-32.299v-226.626c0-17.81-14.49-32.299-32.299-32.299zm-392.18,250.422v-209.62h409.479v209.621h-409.479zm17.298-235.423h374.882c7.24,0 13.447,4.475 16.021,10.801h-406.924c2.575-6.325 8.781-10.801 16.021-10.801zm260.318,289.314h-145.754l12.162-13.091h121.43l12.162,13.091zm114.564-28.09h-374.882c-7.24,0-13.446-4.475-16.021-10.801h406.924c-2.575,6.325-8.781,10.801-16.021,10.801z"
                />
                <path
                  d="m374.171,159.137c-9.064-9.064-23.814-9.065-32.879,0-4.392,4.391-6.811,10.23-6.811,16.44 0,3.34 0.721,6.562 2.051,9.52l-59.872,47.207c-6.806-3.618-15.042-3.618-21.847,0l-59.883-47.216c3.825-8.549 2.259-18.944-4.748-25.95-9.065-9.064-23.813-9.066-32.88,0-7.006,7.007-8.573,17.401-4.748,25.95l-59.883,47.216c-8.789-4.672-19.965-3.317-27.363,4.08-9.064,9.065-9.064,23.814 0,32.879 4.533,4.532 10.486,6.799 16.439,6.799 5.954,0 11.907-2.266 16.44-6.799 7.006-7.007 8.573-17.401 4.748-25.95l59.883-47.216c3.403,1.809 7.162,2.719 10.923,2.719 3.762,0 7.521-0.91 10.924-2.719l59.883,47.216c-3.825,8.549-2.259,18.944 4.748,25.95 4.533,4.533 10.485,6.798 16.44,6.798 5.952,0 11.907-2.266 16.439-6.798 0,0 0,0 0.001,0 7.006-7.007 8.572-17.401 4.747-25.95l59.884-47.216c3.403,1.809 7.162,2.719 10.924,2.719 5.953,0 11.906-2.266 16.439-6.799 9.065-9.065 9.065-23.815 0.001-32.88zm-286.591,99.519c-3.214,3.216-8.449,3.217-11.665,0-3.217-3.217-3.217-8.45 0-11.666 1.607-1.608 3.72-2.412 5.832-2.412 2.113,0 4.226,0.804 5.833,2.412 3.217,3.216 3.217,8.45 1.42109e-14,11.666zm80.329-77.246c-3.217-3.217-3.217-8.45 0-11.666 1.607-1.608 3.72-2.412 5.832-2.412 2.113,0 4.226,0.804 5.833,2.412 3.217,3.217 3.217,8.45 0,11.666-3.213,3.216-8.448,3.217-11.665,0zm103.661,77.246c-3.217,3.217-8.452,3.216-11.667,0-3.217-3.217-3.217-8.45 0-11.666 1.607-1.608 3.72-2.412 5.833-2.412 2.112,0 4.226,0.804 5.833,2.412 3.217,3.216 3.217,8.45 0.001,11.666zm91.993-77.246c-3.215,3.216-8.449,3.216-11.666,0-1.559-1.558-2.416-3.629-2.416-5.833 0-2.203 0.857-4.275 2.417-5.833 1.607-1.608 3.72-2.412 5.833-2.412 2.112,0 4.225,0.804 5.832,2.412 3.217,3.216 3.217,8.449 0,11.666z"
                />
              </g>
            </svg>
          </router-link>
        </div>

        <!-- Fixed Flats Button -->
        <div
          v-if="store.cameraInfo.Connected && !isNavItemHidden('flats')"
          :style="{ order: getNavOrder('flats') }"
          :data-label="t('nav.flatWizard')"
        >
          <router-link
            to="/flats"
            class="nav-button touch-target"
            active-class="active-nav-button"
            @touchstart.passive="handleTouchStart"
            @touchend.passive="handleTouchEnd"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="#FFFFFF"
              class="icon force-visible"
            >
              <path
                d="m5,5.5v-2c0-1.93,1.57-3.5,3.5-3.5h2c.276,0,.5.224.5.5s-.224.5-.5.5h-2c-1.379,0-2.5,1.121-2.5,2.5v2c0,.276-.224.5-.5.5s-.5-.224-.5-.5Zm18.5,7.5c-.276,0-.5.224-.5.5v2c0,1.379-1.121,2.5-2.5,2.5h-2c-.276,0-.5.224-.5.5s.224.5.5.5h2c1.93,0,3.5-1.57,3.5-3.5v-2c0-.276-.224-.5-.5-.5ZM20.5,0h-2c-.276,0-.5.224-.5.5s.224.5.5.5h2c1.379,0,2.5,1.121,2.5,2.5v2c0,.276.224.5.5.5s.5-.224.5-.5v-2c0-1.93-1.57-3.5-3.5-3.5Zm-2.949,13.567l-2.199-.225-1.026,2.03c-.227.453-.691.733-1.19.733-.058,0-.115-.004-.173-.011-.562-.073-1.017-.494-1.134-1.048l-.379-1.79L.854,23.854c-.098.098-.226.146-.354.146s-.256-.049-.354-.146c-.195-.195-.195-.512,0-.707l10.579-10.579-1.739-.345c-.26-.05-.497-.177-.686-.365-.202-.202-.336-.47-.377-.754-.081-.56.202-1.111.704-1.373l2.034-1.066-.227-2.209c-.046-.565.263-1.096.769-1.33.505-.232,1.109-.125,1.503.267l1.522,1.523,2.067-.981c.508-.232,1.111-.124,1.504.268.394.392.502.994.27,1.499l-.983,2.072,1.522,1.521c.396.396.502,1.003.266,1.508-.235.506-.774.806-1.324.766Z"
              />
            </svg>
          </router-link>
        </div>

        <div
          v-if="store.isBackendReachable && !isNavItemHidden('framing')"
          :style="{ order: getNavOrder('framing') }"
          :data-label="t('nav.framing')"
        >
          <router-link to="/framing" class="nav-button" active-class="active-nav-button">
            <CameraFramingIcon class="icon force-visible" />
          </router-link>
        </div>

        <div
          v-if="store.isBackendReachable && !isNavItemHidden('skyview')"
          :style="{ order: getNavOrder('skyview') }"
          :data-label="t('nav.skyView')"
        >
          <router-link
            to="/"
            class="nav-button"
            :class="{ 'active-nav-button': store.showStellarium }"
            @click="store.showStellarium = true"
          >
            <SparklesIcon class="icon force-visible" />
          </router-link>
        </div>
        <!-- Plugin navigation items -->
        <template v-for="item in filteredNavigationItems" :key="item.pluginId">
          <div
            v-if="!isNavItemHidden('plugin-' + item.pluginId)"
            :style="{ order: getNavOrder('plugin-' + item.pluginId) }"
            :data-label="item.title"
          >
            <router-link
              :to="item.path"
              class="nav-button"
              active-class="active-nav-button"
              :title="item.title"
            >
              <component :is="item.icon" class="icon force-visible" />
            </router-link>
          </div>
        </template>

        <!--  Settings Link -->
        <div :style="{ order: getNavOrder('settings') }" :data-label="t('nav.settings')">
          <router-link
            to="/settings"
            class="nav-button touch-target"
            active-class="active-nav-button"
            @touchstart.passive="handleTouchStart"
            @touchend.passive="handleTouchEnd"
          >
            <Cog6ToothIcon class="icon force-visible" />
          </router-link>
        </div>

        <!--  About Button -->
        <div
          v-if="!isNavItemHidden('about')"
          :style="{ order: getNavOrder('about') }"
          :data-label="t('nav.about')"
        >
          <button
            @click="showAboutModal = true"
            @touchstart.passive="handleTouchStart"
            @touchend.passive="handleTouchEnd"
            class="nav-button touch-target"
            :class="{ 'active-nav-button': showAboutModal }"
          >
            <InformationCircleIcon class="icon force-visible" />
          </button>
        </div>
      </div>
    </div>
  </div>

  <exposureCountdown />
  <!-- About modal -->
  <AboutModal v-if="showAboutModal" :version="appVersion" @close="showAboutModal = false" />
</template>

<script setup>
import {
  LinkIcon,
  CameraIcon,
  EyeIcon,
  ListBulletIcon,
  Cog6ToothIcon,
  LightBulbIcon,
  AdjustmentsVerticalIcon,
  SparklesIcon,
  InformationCircleIcon,
  LinkSlashIcon,
} from '@heroicons/vue/24/outline';
import CameraFramingIcon from '@/components/icons/CameraFramingIcon.vue';
import { watch, computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { apiStore } from '@/store/store';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCameraStore } from '@/store/cameraStore';
import exposureCountdown from '@/components/helpers/ExposureCountdown.vue';
import { usePluginStore } from '@/store/pluginStore';
import AboutModal from './status/AboutModal.vue';
import version from '@/version';
import { useOrientation } from '@/composables/useOrientation';

const { t } = useI18n();
const store = apiStore();
const sequenceStore = useSequenceStore();
const settingsStore = useSettingsStore();
const pluginStore = usePluginStore();
const cameraStore = useCameraStore();
const route = useRoute();
const selectedInstanceId = computed(() => settingsStore.selectedInstanceId);
const appVersion = ref(version);
const showAboutModal = ref(false);

// Orientierung tracking
const { isLandscape } = useOrientation();

// Scroll indicator states
const navContentRef = ref(null);
const canScrollStart = ref(false);
const canScrollEnd = ref(false);

// Touch feedback states
const touchedButton = ref(null);

// Nav label state
const navTouched = ref(false);

// Force icons visibility after mount
const iconsLoaded = ref(false);

const activeInstanceColor = computed(() => {
  const color = settingsStore.getInstanceColorById(selectedInstanceId.value);
  return color;
});

// Orientierung-spezifische CSS-Klassen
const orientationClasses = computed(() => ({
  'nav-portrait': !isLandscape.value,
  'nav-landscape': isLandscape.value,
}));

const contentClasses = computed(() => ({
  'flex mx-auto justify-start overflow-x-auto overflow-y-hidden': !isLandscape.value,
  'flex flex-col mx-auto justify-start overflow-y-auto overflow-x-hidden': isLandscape.value,
}));

const wrapperClasses = computed(() => ({
  'flex space-x-2 px-2': !isLandscape.value,
  'flex flex-col space-y-2 px-2 py-4': isLandscape.value,
}));

function getNavOrder(id) {
  const order = settingsStore.navbar?.itemOrder;
  if (!order) return 99;
  const idx = order.indexOf(id);
  return idx === -1 ? 99 : idx;
}

function isNavItemHidden(id) {
  return settingsStore.navbar?.hiddenItems?.includes(id) ?? false;
}

const filteredNavigationItems = computed(() => {
  return pluginStore.navigationItems.filter((item) => {
    const plugin = pluginStore.plugins.find((p) => p.id === item.pluginId);
    if (!plugin || !plugin.enabled) return false;
    if (plugin.isPins) return store.isPINS;
    return true;
  });
});

// Nav label touch handlers
let navLabelTimer = null;
function handleNavTouchStart() {
  if (navLabelTimer) clearTimeout(navLabelTimer);
  navTouched.value = true;
}

function handleNavTouchEnd() {
  navLabelTimer = setTimeout(() => {
    navTouched.value = false;
  }, 400);
}

// Touch event handlers for better compatibility
function handleTouchStart(event) {
  touchedButton.value = event.currentTarget;
  event.currentTarget.classList.add('touch-active');
}

function handleTouchEnd() {
  setTimeout(() => {
    if (touchedButton.value) {
      touchedButton.value.classList.remove('touch-active');
      touchedButton.value = null;
    }
  }, 150);
}

// Force icon visibility
function forceIconVisibility() {
  nextTick(() => {
    const icons = document.querySelectorAll('.icon');
    icons.forEach((icon) => {
      icon.style.opacity = '1';
      icon.style.visibility = 'visible';
      icon.style.display = 'block';
    });
    iconsLoaded.value = true;
  });
}

function handleOrientationChange() {
  setTimeout(() => {
    // Force icon visibility after orientation change
    forceIconVisibility();
    // Update scroll indicators after orientation change
    updateScrollIndicators();
  }, 100);
}

// Update scroll fade indicators based on scroll position
function updateScrollIndicators() {
  const el = navContentRef.value;
  if (!el) return;

  if (isLandscape.value) {
    // Vertical scrolling in landscape
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const threshold = 5;

    canScrollStart.value = scrollTop > threshold;
    canScrollEnd.value = scrollTop + clientHeight < scrollHeight - threshold;
  } else {
    // Horizontal scrolling in portrait
    const scrollLeft = el.scrollLeft;
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const threshold = 5;

    canScrollStart.value = scrollLeft > threshold;
    canScrollEnd.value = scrollLeft + clientWidth < scrollWidth - threshold;
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('resize', handleOrientationChange);

  // Force icon visibility on mount
  forceIconVisibility();

  // Additional force after a short delay for Android
  setTimeout(() => {
    forceIconVisibility();
    // Initial scroll indicator check
    updateScrollIndicators();
  }, 500);
});

onBeforeUnmount(() => {
  window.removeEventListener('orientationchange', handleOrientationChange);
  window.removeEventListener('resize', handleOrientationChange);
});

watch(
  () => route.path,
  (newPath) => {
    if (newPath !== '/') {
      store.showStellarium = false;
    }
    // Force icon visibility after route change
    nextTick(() => {
      forceIconVisibility();
    });
  },
  { immediate: true }
);

// Watch for store changes that might affect icon visibility and scroll indicators
watch(
  [
    () => store.isBackendReachable,
    () => store.cameraInfo.Connected,
    () => store.focuserInfo.Connected,
    () => store.mountInfo.Connected,
    () => store.domeInfo.Connected,
    () => store.flatdeviceInfo.Connected,
    () => store.switchInfo.Connected,
    () => store.filterInfo.Connected,
    () => store.guiderInfo.Connected,
    () => sequenceStore.sequenceIsLoaded,
    () => isLandscape.value,
  ],
  () => {
    nextTick(() => {
      forceIconVisibility();
      // Update scroll indicators when nav items change
      setTimeout(() => updateScrollIndicators(), 100);
    });
  },
  { deep: true }
);
</script>

<style scoped>
/* Base Navigation Container */
.navigation-container {
  @apply flex justify-center h-20 top-0 z-50 transition-all duration-300 ease-in-out;
}

/* Portrait Mode - Navigation oben */
.nav-portrait {
  @apply fixed top-0 left-0 right-0 w-full h-20;
}

/* Landscape Mode - Navigation links */
.nav-landscape {
  @apply fixed left-0 top-0 bottom-0 h-full w-32 flex-col justify-start;
  height: 100vh !important;
  padding-left: 3rem;
}

/* Content Area Anpassungen */
.nav-content {
  @apply scrollbar-hide transition-all duration-300 ease-in-out;
  scroll-snap-type: x mandatory;
}

/* Portrait Mode Content */
.nav-portrait .nav-content {
  @apply flex mx-auto items-center justify-start overflow-x-auto overflow-y-hidden;
  scroll-snap-type: x mandatory;
}

/* Landscape Mode Content */
.nav-landscape .nav-content {
  @apply flex flex-col mx-auto items-stretch justify-start overflow-y-auto overflow-x-hidden h-full;
  scroll-snap-type: none;
}

/* Navigation Items Wrapper */
.nav-items-wrapper {
  scroll-snap-align: start;
  @apply transition-all duration-300 ease-in-out;
}

/* Portrait Mode Wrapper */
.nav-portrait .nav-items-wrapper {
  @apply flex space-x-2 px-2;
}

/* Landscape Mode Wrapper */
.nav-landscape .nav-items-wrapper {
  @apply flex flex-col space-y-2 px-2 pt-4 pb-2 h-full;
}

/* Navigation Buttons - Base Styles with improved rendering */
.nav-button {
  @apply w-10 h-10 lg:w-12 lg:h-12 
    border border-slate-600/30 
    bg-slate-800/40 
    text-gray-300 
    rounded-full 
    hover:bg-slate-700/60
    hover:border-slate-500/50
    hover:text-gray-200
    backdrop-blur-sm
    transition-all
    duration-200
    ease-out
    focus:outline-none 
    focus:ring-2 
    focus:ring-cyan-500/40;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 4px;
  flex-shrink: 0;
  /* iOS touch improvements */
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  /* Minimum touch target size */
  min-width: 44px;
  min-height: 44px;
  /* Prevent scroll momentum interference */
  touch-action: manipulation;
  /* Force hardware acceleration for better rendering */
  transform: translateZ(0);
  will-change: transform;
}

/* Enhanced touch target class for problematic buttons */
.touch-target {
  /* Ensure adequate touch target size */
  min-width: 48px !important;
  min-height: 48px !important;
  /* Add invisible padding for better touch detection */
  position: relative;
}

.touch-target::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  /* Invisible but touchable area */
  background: transparent;
  border-radius: inherit;
}

/* Touch feedback states */
.nav-button.touch-active {
  @apply bg-slate-600/80 
    border-slate-400/70 
    transform scale-95;
  transition: all 0.1s ease-out;
}

/* Active Navigation Button Styles */
.active-nav-button {
  @apply bg-cyan-600/80 
    border-cyan-500/60 
    text-white 
    shadow-lg
    shadow-cyan-500/25;
}

.active-nav-button:hover {
  @apply bg-cyan-500/90 
    border-cyan-400/70 
    shadow-xl
    shadow-cyan-500/30;
}

/* Icon Styles - FORCE VISIBILITY */
.icon {
  @apply w-5 h-5 lg:w-6 lg:h-6;
  /* Force icon visibility */
  opacity: 1 !important;
  visibility: visible !important;
  display: block !important;
  /* Prevent icon from interfering with touch events */
  pointer-events: none;
  /* Force hardware acceleration */
  transform: translateZ(0);
  will-change: opacity;
}

/* Force visible class for Android compatibility */
.force-visible {
  opacity: 1 !important;
  visibility: visible !important;
  display: block !important;
  /* Prevent any transitions that might hide icons initially */
  transition: none !important;
}

/* Camera Button Special Styles */
.camera-button {
  position: relative;
}

.camera-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.progress-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  transition: all 0.3s ease;
  /* Prevent interference with touch events */
  pointer-events: none;
}

.camera-icon {
  position: relative;
  z-index: 10;
  transition: all 0.2s ease;
  /* Prevent interference with touch events */
  pointer-events: none;
}

/* Portrait Mode Button Adjustments */
.nav-portrait .nav-button {
  @apply w-12 h-12 lg:w-14 lg:h-14;
  margin: 4px;
  /* Ensure minimum touch target on mobile */
  min-width: 48px;
  min-height: 48px;
}

/* Landscape Mode Button Adjustments */
.nav-landscape .nav-button {
  @apply w-12 h-12 lg:w-14 lg:h-14;
  margin: 4px 0;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  /* Ensure minimum touch target on mobile */
  min-width: 48px;
  min-height: 48px;
}

/* Landscape Mode - größere Progress Ringe */
.nav-landscape .progress-ring {
  width: 56px;
  height: 56px;
}

.nav-landscape .progress-ring circle {
  r: 24;
}

/* Responsive Icon Sizes */
.nav-portrait .icon {
  @apply w-6 h-6 lg:w-7 lg:h-7;
}

.nav-landscape .icon {
  @apply w-6 h-6 lg:w-7 lg:h-7;
}

/* Status Indicator Colors for active buttons */
.active-nav-button .icon.text-green-500 {
  @apply text-green-400;
}

.active-nav-button .icon.text-yellow-500 {
  @apply text-yellow-400;
}

.active-nav-button .icon.text-red-500 {
  @apply text-red-400;
}

/* Smooth transitions for all states */
.nav-button,
.nav-button .icon {
  @apply transition-all duration-200 ease-out;
}

/* Android specific fixes */
@media screen and (-webkit-min-device-pixel-ratio: 0) {
  .nav-button {
    /* Force repaint on Android */
    backface-visibility: hidden;
    perspective: 1000px;
  }

  .icon {
    /* Ensure icons are rendered immediately */
    opacity: 1 !important;
    will-change: opacity, transform;
  }
}

/* Webkit specific fixes */
@supports (-webkit-touch-callout: none) {
  .nav-button {
    /* Prevent iOS button styling */
    -webkit-appearance: none;
    border-radius: 50%;
    /* Ensure buttons are properly positioned */
    position: relative;
    z-index: 1;
  }

  /* Fix for iOS Safari button tap delays */
  .nav-button,
  .touch-target {
    cursor: pointer;
  }

  /* Prevent iOS zoom on double tap */
  .navigation-container {
    touch-action: manipulation;
  }
}

/* Fix for buttons that might be covered by other elements */
.nav-button {
  isolation: isolate;
  z-index: 10;
}

/* Ensure buttons are properly clickable on all devices */
.nav-button:not(:disabled) {
  cursor: pointer;
}

/* Additional spacing for touch targets in landscape mode */
.nav-landscape .touch-target {
  margin: 6px 0;
}

/* Ensure SVG icons don't interfere with touch events */
.nav-button svg {
  pointer-events: none;
  display: block;
  opacity: 1 !important;
  visibility: visible !important;
}

/* Fix for potential z-index issues */
.nav-items-wrapper > div {
  position: relative;
  z-index: 1;
}

/* Additional mobile-specific improvements */
@media (max-width: 768px) {
  .nav-button {
    min-width: 50px;
    min-height: 50px;
  }

  .touch-target {
    min-width: 52px !important;
    min-height: 52px !important;
  }

  /* Force icon visibility on mobile */
  .icon {
    opacity: 1 !important;
    visibility: visible !important;
  }
}

/* Prevent button bounce effect */
.nav-button:active {
  transform: none;
}

.touch-target:active {
  transform: scale(0.95);
}

/* Ensure proper button spacing in portrait mode */
.nav-portrait .nav-button {
  margin: 2px 4px;
}

/* Improve landscape mode spacing */
.nav-landscape .nav-button {
  margin: 6px auto;
  width: 50px;
  height: 50px;
}

/* Fix for camera button progress ring in landscape */
.nav-landscape .camera-button .progress-ring {
  width: 50px;
  height: 50px;
}

/* Ensure all buttons are properly aligned */
.nav-button,
.touch-target {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box;
}

/* Fix potential overflow issues */
.navigation-container {
  overflow: visible;
}

.nav-content {
  overflow-x: auto;
  overflow-y: hidden;
}

.nav-landscape .nav-content {
  overflow-x: hidden;
  overflow-y: auto;
}

/* Additional fixes for button interaction */
.nav-button:focus-visible {
  outline: 2px solid #06b6d4;
  outline-offset: 2px;
}

/* Prevent text selection in navigation */
.navigation-container {
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
}

/* Force immediate icon rendering */
.icon,
.force-visible {
  animation: forceVisible 0.1s ease-out;
}

@keyframes forceVisible {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Scroll Fade Indicators */
.scroll-fade {
  position: absolute;
  pointer-events: none;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Portrait Mode - Horizontal Fades (Left/Right) */
.scroll-fade-left {
  top: 0;
  left: 0;
  bottom: 0;
  width: 60px;
  background: linear-gradient(
    to right,
    rgba(15, 23, 42, 1) 0%,
    rgba(15, 23, 42, 0.8) 40%,
    rgba(15, 23, 42, 0) 100%
  );
}

.scroll-fade-right {
  top: 0;
  right: 0;
  bottom: 0;
  width: 60px;
  background: linear-gradient(
    to left,
    rgba(15, 23, 42, 1) 0%,
    rgba(15, 23, 42, 0.8) 40%,
    rgba(15, 23, 42, 0) 100%
  );
}

/* Landscape Mode - Vertical Fades (Top/Bottom) */
.scroll-fade-top {
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(
    to bottom,
    rgba(15, 23, 42, 1) 0%,
    rgba(15, 23, 42, 0.8) 40%,
    rgba(15, 23, 42, 0) 100%
  );
}

.scroll-fade-bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(
    to top,
    rgba(15, 23, 42, 1) 0%,
    rgba(15, 23, 42, 0.8) 40%,
    rgba(15, 23, 42, 0) 100%
  );
}

/* Scroll Arrow Indicators */
.scroll-arrow {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.35);
}

.scroll-arrow svg {
  width: 100%;
  height: 100%;
}

/* Arrow positioning - at the edge */
.arrow-left {
  position: absolute;
  left: 4px;
}

.arrow-right {
  position: absolute;
  right: 4px;
}

.arrow-up {
  position: absolute;
  top: 4px;
}

.arrow-down {
  position: absolute;
  bottom: 4px;
}

/* Adjust for safe area in landscape */
.nav-landscape .scroll-fade-top {
  left: 3rem;
}

.nav-landscape .scroll-fade-bottom {
  left: 3rem;
}

/* Nav item labels – overlay inside the icon circle */
.nav-items-wrapper > div {
  position: relative;
}

.nav-items-wrapper > div::after {
  content: attr(data-label);
  position: absolute;
  top: calc(100% - 16px);
  left: 50%;
  transform: translateX(-50%);
  width: auto;
  min-width: 50px;
  max-width: 60px;
  height: auto;
  max-height: 48px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(100, 116, 139, 0.3);
  color: rgba(255, 255, 255, 0.8);
  font-size: 8.5px;
  font-weight: 600;
  display: block;
  text-align: center;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: 20;
}

.nav-labels-visible .nav-items-wrapper > div::after {
  opacity: 1;
}

@media (hover: hover) {
  .navigation-container:hover .nav-items-wrapper > div::after {
    opacity: 1;
  }
}
</style>
