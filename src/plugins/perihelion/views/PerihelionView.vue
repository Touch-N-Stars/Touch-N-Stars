<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Not the Perihelion NINA plugin's own tracking failing -- the whole HTTP server it's
         supposed to be talking to isn't reachable at all, so nothing below would work anyway. -->
    <div v-if="pluginInstalled === false" class="p-4">
      <div class="tns-card text-center">
        <p class="text-sm text-content-faint">{{ t('perihelion.notDetected') }}</p>
      </div>
    </div>
    <template v-else-if="pluginInstalled === true">
      <SubNav :items="tabItems" v-model:activeItem="activeTab" />

      <div class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <!-- ===================== BROWSE ===================== -->
        <template v-if="activeTab === 'browse'">
          <div class="flex items-center gap-3">
            <div
              class="w-11 h-11 rounded-chip bg-violet-400/15 flex items-center justify-center shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a78bfa"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M20.341 6.484A10 10 0 0 1 10.266 21.85m-6.607-4.334A10 10 0 0 1 13.74 2.152"
                />
                <circle cx="12" cy="12" r="3" />
                <circle cx="19" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <h1 class="text-lg font-bold text-content leading-tight">
                {{ t('perihelion.title') }}
              </h1>
              <p class="text-[11px] text-content-muted leading-snug">
                {{ t('perihelion.subtitle') }}
              </p>
            </div>
            <PerihelionAbout />
          </div>

          <div class="flex items-center gap-2">
            <span
              class="w-6 h-6 rounded-full border-2 border-accent flex items-center justify-center text-xs font-bold text-accent shrink-0"
              >1</span
            >
            <span class="text-xs font-semibold text-content">{{
              t('perihelion.browse.step')
            }}</span>
          </div>

          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('perihelion.browse.searchPlaceholder')"
            class="tns-input"
          />

          <div class="flex items-center gap-2">
            <button
              v-for="f in filterOptions"
              :key="f.value"
              class="shrink-0 px-3 py-1.5 rounded-chip text-xs font-semibold cursor-pointer transition-colors"
              :class="
                filter === f.value
                  ? 'bg-accent/10 border border-accent/40 text-accent'
                  : 'bg-transparent border border-line text-content-muted hover:bg-surface-2'
              "
              @click="filter = f.value"
            >
              {{ t(f.labelKey) }}
            </button>
            <span class="flex-1"></span>
            <label class="flex items-center gap-1.5 text-[11px] text-content-faint shrink-0">
              {{ t('perihelion.browse.sortBy') }}
              <select
                v-model="sortMode"
                class="bg-transparent border border-line rounded-chip text-content-muted px-1.5 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50"
              >
                <option value="brightness">{{ t('perihelion.browse.sortBrightness') }}</option>
                <option value="name">{{ t('perihelion.browse.sortName') }}</option>
              </select>
            </label>
          </div>

          <div
            v-if="filter !== 'Asteroid'"
            class="flex items-center gap-2 text-[11px] text-content-faint"
          >
            <span
              >{{ t('perihelion.browse.cometsStatus', { status: syncStatusLabel }) }}
              <span class="text-content-faint">·</span>
              {{ cobsStatusLabel }}</span
            >
            <span class="flex-1"></span>
            <button
              class="text-content-faint hover:text-content-muted shrink-0"
              :aria-label="t('perihelion.browse.observedTooltip')"
              @click="showObservedMagLegend = true"
            >
              <InformationCircleIcon class="w-4 h-4" />
            </button>
            <button
              class="shrink-0 px-2 py-1 rounded-chip font-semibold text-content-muted border border-line hover:bg-surface-2 disabled:opacity-50 cursor-pointer"
              :disabled="refreshingCobs"
              @click="onRefreshCobs"
            >
              {{ refreshingCobs ? t('perihelion.browse.refreshingCobs') : t('perihelion.browse.refreshCobs') }}
            </button>
            <button
              class="shrink-0 px-2 py-1 rounded-chip font-semibold text-accent border border-accent/30 hover:bg-accent/10 disabled:opacity-50 cursor-pointer"
              :disabled="syncing"
              @click="onSyncComets"
            >
              {{ syncing ? t('perihelion.browse.syncing') : t('perihelion.browse.syncNow') }}
            </button>
          </div>
          <p
            v-if="filter !== 'Asteroid' && syncMessage"
            class="text-[11px]"
            :class="syncMessage.ok ? 'text-status-ok' : 'text-status-danger'"
          >
            {{ syncMessage.text }}
          </p>
          <p
            v-if="filter !== 'Asteroid' && cobsRefreshMessage"
            class="text-[11px]"
            :class="cobsRefreshMessage.ok ? 'text-status-ok' : 'text-status-danger'"
          >
            {{ cobsRefreshMessage.text }}
          </p>
          <p v-if="filter === 'Asteroid'" class="text-[11px] text-content-faint">
            {{ t('perihelion.browse.asteroidCount', { count: asteroidCount }) }}
          </p>

          <p v-if="objectsLoading" class="text-sm text-content-muted">
            {{ t('perihelion.browse.loading') }}
          </p>
          <p v-else-if="objectsError" class="text-sm text-status-danger">{{ objectsError }}</p>
          <p v-else-if="filteredObjects.length === 0" class="text-sm text-content-faint italic">
            {{ t('perihelion.browse.noMatch') }}
          </p>

          <div class="space-y-2">
            <button
              v-for="o in filteredObjects"
              :key="o.id"
              class="tns-card w-full flex items-center gap-3 text-left cursor-pointer transition-colors"
              :class="o.id === selectedId ? 'border-accent/40 bg-accent/5' : 'hover:bg-surface-2'"
              @click="selectedId = o.id"
            >
              <div
                class="w-9 h-9 rounded-chip flex items-center justify-center shrink-0"
                :class="o.objectType === 'Comet' ? 'bg-violet-400/15' : 'bg-surface-3'"
              >
                <CometIcon v-if="o.objectType === 'Comet'" :id="o.id" />
                <AsteroidIcon v-else />
              </div>
              <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                <span class="text-sm font-bold text-content truncate">{{ o.name }}</span>
                <span class="text-[11px] text-content-muted">{{ o.objectType }}</span>
              </div>
              <div class="flex flex-col items-end gap-0.5 shrink-0">
                <span class="text-[15px] font-bold tabular-nums text-content">
                  {{ o.magnitude != null ? o.magnitude.toFixed(1) : '—' }}
                </span>
                <span class="text-[9px] font-bold uppercase tracking-wide text-content-faint">{{
                  t('perihelion.browse.mag')
                }}</span>
                <span
                  v-if="o.observedMagnitude != null"
                  class="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full border"
                  :class="magDiffColorClass(o.magnitude, o.observedMagnitude)"
                >
                  <EyeIcon class="w-3 h-3" />
                  {{ o.observedMagnitude.toFixed(1) }}
                </span>
              </div>
            </button>
          </div>
        </template>

        <!-- ===================== POSITION & PATH ===================== -->
        <template v-else-if="activeTab === 'position'">
          <p v-if="!selected" class="text-sm text-content-faint italic">
            {{ t('perihelion.position.pickFirst') }}
          </p>
          <template v-else>
            <div class="flex items-center gap-2">
              <span
                class="w-6 h-6 rounded-full border-2 border-accent flex items-center justify-center text-xs font-bold text-accent shrink-0"
                >2</span
              >
              <span class="text-xs font-semibold text-content">{{
                t('perihelion.position.step')
              }}</span>
            </div>

            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-card flex items-center justify-center shrink-0"
                :class="selected.objectType === 'Comet' ? 'bg-violet-400/15' : 'bg-surface-3'"
              >
                <CometIcon
                  v-if="selected.objectType === 'Comet'"
                  :size="20"
                  :id="'selected-' + selected.id"
                />
                <AsteroidIcon v-else :size="20" />
              </div>
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-base font-bold text-content truncate">{{ selected.name }}</span>
                <span class="text-[11px] text-content-muted">{{ selected.objectType }}</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5">
                <span class="tns-stat-label">{{ t('perihelion.position.ra') }}</span>
                <span class="text-[15px] font-bold tabular-nums text-content">{{
                  formatRaHours(selected.raHours)
                }}</span>
              </div>
              <div class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5">
                <span class="tns-stat-label">{{ t('perihelion.position.dec') }}</span>
                <span class="text-[15px] font-bold tabular-nums text-content">{{
                  formatDecDeg(selected.decDeg)
                }}</span>
              </div>
              <div class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5">
                <span class="tns-stat-label">{{ t('perihelion.position.mag') }}</span>
                <span class="text-[15px] font-bold tabular-nums text-content">
                  {{ selected.magnitude != null ? selected.magnitude.toFixed(1) : '—' }}
                </span>
              </div>
            </div>

            <!-- Real, if lower-priority, facts a user might want alongside the above -- collapsed
                 by default so they don't add permanent scroll weight to an already-busy tab.
                 Alt/Az needs a real site (hasLocation); Sun/Earth distance, solar elongation and
                 constellation are free from the object's own already-computed geocentric
                 position (see OrbitalTracking.BrowseObject's own comments), so those always show
                 regardless of location. Perihelion date is comet-only. -->
            <div class="rounded-chip bg-surface-2/60 border border-line-strong/50 overflow-hidden">
              <button
                class="flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer"
                @click="showMoreDetails = !showMoreDetails"
              >
                <ChevronRightIcon
                  class="w-4 h-4 shrink-0 text-content-faint transition-transform duration-200"
                  :class="{ 'rotate-90': showMoreDetails }"
                />
                <span class="tns-stat-label flex-1">{{ t('perihelion.position.moreDetails') }}</span>
              </button>
              <div v-if="showMoreDetails" class="p-3 pt-0 flex flex-col gap-2">
                <div v-if="hasLocation" class="grid grid-cols-2 gap-2">
                  <div
                    class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5"
                  >
                    <span class="tns-stat-label">{{ t('perihelion.position.alt') }}</span>
                    <span class="text-[15px] font-bold tabular-nums text-content">{{
                      altAz ? `${altAz.altitude.toFixed(0)}°` : '—'
                    }}</span>
                  </div>
                  <div
                    class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5"
                  >
                    <span class="tns-stat-label">{{ t('perihelion.position.az') }}</span>
                    <span class="text-[15px] font-bold tabular-nums text-content">{{
                      altAz ? `${altAz.azimuth.toFixed(0)}°` : '—'
                    }}</span>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <div
                    class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5"
                  >
                    <span class="tns-stat-label">{{ t('perihelion.position.sunDistance') }}</span>
                    <span class="text-[15px] font-bold tabular-nums text-content"
                      >{{ selected.sunDistanceAu.toFixed(2) }} au</span
                    >
                  </div>
                  <div
                    class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5"
                  >
                    <span class="tns-stat-label">{{
                      t('perihelion.position.earthDistance')
                    }}</span>
                    <span class="text-[15px] font-bold tabular-nums text-content"
                      >{{ selected.earthDistanceAu.toFixed(2) }} au</span
                    >
                  </div>
                  <div
                    class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5"
                  >
                    <span class="tns-stat-label">{{
                      t('perihelion.position.solarElongation')
                    }}</span>
                    <span class="text-[15px] font-bold tabular-nums text-content"
                      >{{ selected.solarElongationDeg.toFixed(0) }}°</span
                    >
                  </div>
                </div>
                <div class="grid gap-2" :class="selected.perihelionDateUtc ? 'grid-cols-2' : ''">
                  <div
                    class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5"
                  >
                    <span class="tns-stat-label">{{ t('perihelion.position.constellation') }}</span>
                    <span class="text-[15px] font-bold text-content">{{
                      selected.constellationName
                    }}</span>
                  </div>
                  <div
                    v-if="selected.perihelionDateUtc"
                    class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5"
                  >
                    <span class="tns-stat-label">{{
                      t('perihelion.position.perihelionDate')
                    }}</span>
                    <span class="text-[15px] font-bold tabular-nums text-content">{{
                      formatPerihelionDate(selected.perihelionDateUtc)
                    }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="cometActivity" class="tns-card">
              <div class="flex items-center gap-2 mb-1">
                <span class="tns-stat-label flex-1">{{
                  t('perihelion.position.observedBrightness')
                }}</span>
                <button
                  class="text-content-faint hover:text-content-muted shrink-0"
                  :aria-label="t('perihelion.browse.observedTooltip')"
                  @click="showObservedMagLegend = true"
                >
                  <InformationCircleIcon class="w-4 h-4" />
                </button>
                <span
                  class="text-xs font-bold tabular-nums"
                  :class="magDiffTextClass(selected.magnitude, cometActivity.mostRecentMagnitude)"
                  >{{
                    t('perihelion.position.observedLatest', {
                      mag: cometActivity.mostRecentMagnitude.toFixed(1),
                    })
                  }}</span
                >
                <span
                  class="text-xs font-bold tabular-nums"
                  :class="magDiffTextClass(selected.magnitude, cometActivity.recentAverageMagnitude)"
                  >{{
                    t('perihelion.position.observedAverage', {
                      mag: cometActivity.recentAverageMagnitude.toFixed(1),
                    })
                  }}</span
                >
              </div>
              <p class="text-[11px] leading-relaxed text-content-muted">
                {{
                  t('perihelion.position.observedBrightnessDescription', {
                    count: Math.min(cometActivity.observationCount, 5),
                    predicted: selected.magnitude != null ? selected.magnitude.toFixed(1) : '—',
                    when: relativeTime(cometActivity.mostRecentDateUtc),
                  })
                }}
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="tns-card">
                <div class="flex items-center gap-2 mb-1">
                  <span class="tns-stat-label flex-1">{{
                    t('perihelion.position.altitudeTitle')
                  }}</span>
                </div>
                <div
                  v-if="altAz"
                  class="flex flex-wrap items-baseline gap-x-1 text-xs font-bold mb-2"
                >
                  <span :class="altitudeColorClass(altAz.altitude)">
                    {{ altAz.altitude.toFixed(0) }}°
                    {{
                      altAz.altitude >= 0
                        ? t('perihelion.position.aboveHorizon')
                        : t('perihelion.position.belowHorizon')
                    }}
                  </span>
                  <span class="text-content-faint">·</span>
                  <span
                    v-if="tonightsPeakAltitude"
                    :class="altitudeColorClass(tonightsPeakAltitude.altitude)"
                    >{{
                      t('perihelion.position.altitudePeak', {
                        deg: tonightsPeakAltitude.altitude.toFixed(0),
                        time: tonightsPeakAltitude.label,
                      })
                    }}</span
                  >
                  <span v-else class="text-status-danger">{{
                    t('perihelion.position.noPeakInDarkWindow')
                  }}</span>
                </div>
                <p v-if="!hasLocation" class="text-xs text-content-faint">
                  {{ t('perihelion.position.noLocation') }}
                </p>
                <SkyChart
                  v-else
                  :target="{ RA: selected.raHours * 15, Dec: selected.decDeg }"
                  :coordinates="{
                    latitude: store.profileInfo.AstrometrySettings.Latitude,
                    longitude: store.profileInfo.AstrometrySettings.Longitude,
                  }"
                  @peak-altitude="tonightsPeakAltitude = $event"
                />
                <p v-if="hasLocation" class="text-[11px] leading-relaxed text-content-faint mt-2">
                  {{ t('perihelion.position.altitudeDescription', { name: selected.name }) }}
                </p>
              </div>

              <div class="tns-card">
                <div class="flex items-center gap-3 mb-2">
                  <span class="tns-stat-label flex-1">{{
                    t('perihelion.position.pathTitle')
                  }}</span>
                  <span class="flex items-center gap-1 text-[11px] text-content-muted">
                    <span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span
                    >{{ t('perihelion.position.pathLegendPath') }}
                  </span>
                  <span class="flex items-center gap-1 text-[11px] text-content-muted">
                    <span class="w-1.5 h-1.5 rounded-full bg-accent"></span
                    >{{ t('perihelion.position.pathLegendTonight') }}
                  </span>
                </div>
                <p v-if="pathLoading" class="text-xs text-content-muted">
                  {{ t('perihelion.browse.loading') }}
                </p>
                <p v-else-if="pathError" class="text-xs text-status-danger">{{ pathError }}</p>
                <OrbitalPathChart v-else-if="path.length" :points="path" />
                <p class="text-[11px] leading-relaxed text-content-muted mt-2">
                  {{ t('perihelion.position.pathDescription', { name: selected.name }) }}
                </p>
              </div>
            </div>

            <div class="tns-card">
              <div class="flex items-center gap-2 mb-2">
                <span class="tns-stat-label flex-1">{{
                  t('perihelion.position.framingTitle')
                }}</span>
                <span
                  v-if="framingOffset"
                  class="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-accent/40 bg-accent/10 text-accent"
                  >{{ t('perihelion.position.offsetSet') }}</span
                >
              </div>
              <FramingOffsetView
                :key="selected.id"
                :ra-hours="selected.raHours"
                :dec-deg="selected.decDeg"
                :target-name="selected.name"
                :object-type="selected.objectType"
                :initial-offset="framingOffset"
                @offset="onFramingOffset"
              >
                <template #after-actions>
                  <div
                    v-if="showFramingCapturedPrompt"
                    class="flex items-center gap-3 p-3 rounded-chip bg-accent/10 border border-accent/30"
                  >
                    <CheckCircleIcon class="w-5 h-5 text-accent shrink-0" />
                    <span class="flex-1 text-sm text-content-muted">{{
                      t('perihelion.position.framingCapturedPrompt')
                    }}</span>
                    <button
                      class="tns-btn w-auto shrink-0 px-4 bg-emerald-700 text-white hover:bg-emerald-600"
                      @click="goToTrackFromFraming"
                    >
                      {{ t('perihelion.position.goToTrack') }}
                    </button>
                  </div>
                </template>
              </FramingOffsetView>
            </div>
          </template>
        </template>

        <!-- ===================== TRACK ===================== -->
        <template v-else>
          <p v-if="!selected" class="text-sm text-content-faint italic">
            {{ t('perihelion.track.pickFirst') }}
          </p>
          <template v-else>
            <div class="flex items-center gap-2">
              <span
                class="w-6 h-6 rounded-full border-2 border-accent flex items-center justify-center text-xs font-bold text-accent shrink-0"
                >3</span
              >
              <span class="text-xs font-semibold text-content">{{
                t('perihelion.track.step')
              }}</span>
            </div>

            <div class="tns-card flex flex-col gap-2">
              <span class="tns-stat-label">{{ t('perihelion.track.status') }}</span>
              <div class="flex items-center gap-2">
                <span
                  class="tns-dot"
                  :class="trackingMode !== 'idle' ? 'bg-status-ok' : 'bg-content-faint'"
                ></span>
                <span
                  class="text-xl font-bold"
                  :class="trackingMode !== 'idle' ? 'text-status-ok' : 'text-content-muted'"
                >
                  {{ statusLabel }}
                </span>
              </div>
              <span v-if="trackingMode !== 'idle'" class="text-xs text-content-muted">
                {{ selected.name }} · {{ selected.objectType }}
              </span>
            </div>

            <div
              v-if="trackingMode === 'quick' && quickTrackStatus"
              class="tns-card flex flex-col gap-1.5"
            >
              <div class="flex items-center justify-between">
                <span class="tns-stat-label">{{ t('perihelion.track.liveStatus') }}</span>
                <span class="text-[10px] text-content-faint">{{
                  t('perihelion.track.liveStatusSubtitle')
                }}</span>
              </div>
              <p
                v-if="quickTrackStatus.lastRaArcsecPerSec != null"
                class="text-xs text-content-muted tabular-nums"
              >
                {{
                  t('perihelion.track.appliedRate', {
                    ra: quickTrackStatus.lastRaArcsecPerSec.toFixed(4),
                    dec: quickTrackStatus.lastDecArcsecPerSec.toFixed(4),
                  })
                }}
              </p>
              <p class="text-xs text-content-muted">
                <span v-if="elapsedSinceStarted != null">{{
                  t('perihelion.track.trackingFor', { duration: elapsedSinceStarted })
                }}</span>
                <span v-if="elapsedSinceApplied != null">
                  {{ t('perihelion.track.appliedAgo', { duration: elapsedSinceApplied }) }}</span
                >
              </p>
              <p
                v-if="quickTrackStatus.autoReapplyMinutes && nextReapplyIn != null"
                class="text-xs text-content-muted"
              >
                {{ t('perihelion.track.nextReapply', { duration: nextReapplyIn }) }}
              </p>
              <p class="text-xs text-content-muted">
                {{ t('perihelion.track.guiderShift') }}
                <span :class="quickTrackStatus.guiding ? 'text-status-ok' : 'text-content-faint'">{{
                  quickTrackStatus.guiding ? t('perihelion.track.on') : t('perihelion.track.off')
                }}</span>
              </p>
              <p
                v-if="!quickTrackStatus.lastApplySucceeded && quickTrackStatus.lastError"
                class="text-xs text-status-danger"
              >
                {{ t('perihelion.track.lastAttemptFailed', { error: quickTrackStatus.lastError }) }}
              </p>
            </div>

            <div
              v-if="actionStatus"
              class="tns-card"
              :class="actionStatus.ok ? 'border-status-ok/40' : 'border-status-danger/40'"
            >
              <p class="text-xs" :class="actionStatus.ok ? 'text-status-ok' : 'text-status-danger'">
                {{ actionStatus.message }}
              </p>
            </div>

            <div v-if="trackingMode === 'idle'" class="flex flex-col gap-3">
              <div class="tns-card flex flex-col gap-2">
                <div class="flex items-center gap-2 mb-1">
                  <span class="tns-stat-label flex-1">{{ t('perihelion.track.imagingPlan') }}</span>
                  <span class="text-[10px] text-content-faint">{{
                    t('perihelion.track.forAddToSequenceOnly')
                  }}</span>
                </div>
                <label class="block">
                  <span class="block text-[10px] text-content-faint mb-1">{{
                    t('perihelion.track.filterLabel')
                  }}</span>
                  <select v-model="exposureFilter" class="tns-select">
                    <option value="">{{ t('perihelion.track.dontChangeFilter') }}</option>
                    <option
                      v-for="f in store.filterInfo?.AvailableFilters ?? []"
                      :key="f.Name"
                      :value="f.Name"
                    >
                      {{ f.Name }}
                    </option>
                  </select>
                </label>
                <div class="flex gap-2">
                  <label class="flex-1">
                    <span class="block text-[10px] text-content-faint mb-1">{{
                      t('perihelion.track.exposureLabel')
                    }}</span>
                    <input
                      v-model.number="exposureSeconds"
                      type="number"
                      min="1"
                      class="tns-input"
                    />
                  </label>
                  <label class="flex-1">
                    <span class="block text-[10px] text-content-faint mb-1">{{
                      t('perihelion.track.framesLabel')
                    }}</span>
                    <input v-model.number="frameCount" type="number" min="1" class="tns-input" />
                  </label>
                </div>
              </div>

              <div class="tns-card flex flex-col">
                <span class="tns-stat-label mb-2">{{ t('perihelion.track.beforeYouStart') }}</span>
                <button
                  class="flex items-center justify-between gap-3 py-2 cursor-pointer text-left"
                  @click="guiding = !guiding"
                >
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span class="text-sm font-semibold text-content">{{
                      t('perihelion.track.guidingToggleTitle')
                    }}</span>
                    <span class="text-[11px] text-content-muted leading-tight">
                      {{ t('perihelion.track.guidingToggleDescription') }}
                    </span>
                  </div>
                  <span
                    class="relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors"
                    :class="guiding ? 'bg-accent/35' : 'bg-surface-3'"
                  >
                    <span
                      class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform"
                      :class="
                        guiding ? 'translate-x-5 bg-accent' : 'translate-x-0.5 bg-content-muted'
                      "
                    ></span>
                  </span>
                </button>

                <button
                  class="flex items-center justify-between gap-3 py-2 cursor-pointer text-left"
                  @click="autoReapply = !autoReapply"
                >
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span class="text-sm font-semibold text-content">{{
                      t('perihelion.track.autoReapplyToggleTitle', {
                        minutes: AUTO_REAPPLY_MINUTES,
                      })
                    }}</span>
                    <span class="text-[11px] text-content-muted leading-tight">
                      {{ t('perihelion.track.autoReapplyToggleDescription') }}
                    </span>
                  </div>
                  <span
                    class="relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors"
                    :class="autoReapply ? 'bg-accent/35' : 'bg-surface-3'"
                  >
                    <span
                      class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform"
                      :class="
                        autoReapply ? 'translate-x-5 bg-accent' : 'translate-x-0.5 bg-content-muted'
                      "
                    ></span>
                  </span>
                </button>

                <button
                  class="flex items-center justify-between gap-3 py-2 cursor-pointer text-left"
                  @click="meridianFlip = !meridianFlip"
                >
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span class="text-sm font-semibold text-content">{{
                      t('perihelion.track.meridianFlipToggleTitle')
                    }}</span>
                    <span class="text-[11px] text-content-muted leading-tight">
                      {{ t('perihelion.track.meridianFlipToggleDescription') }}
                    </span>
                  </div>
                  <span
                    class="relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors"
                    :class="meridianFlip ? 'bg-accent/35' : 'bg-surface-3'"
                  >
                    <span
                      class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform"
                      :class="
                        meridianFlip
                          ? 'translate-x-5 bg-accent'
                          : 'translate-x-0.5 bg-content-muted'
                      "
                    ></span>
                  </span>
                </button>

                <button
                  class="flex items-center justify-between gap-3 py-2 cursor-pointer text-left"
                  @click="autofocus = !autofocus"
                >
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span class="text-sm font-semibold text-content">{{
                      t('perihelion.track.autofocusToggleTitle')
                    }}</span>
                    <span class="text-[11px] text-content-muted leading-tight">
                      {{ t('perihelion.track.autofocusToggleDescription') }}
                    </span>
                  </div>
                  <span
                    class="relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors"
                    :class="autofocus ? 'bg-accent/35' : 'bg-surface-3'"
                  >
                    <span
                      class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform"
                      :class="
                        autofocus ? 'translate-x-5 bg-accent' : 'translate-x-0.5 bg-content-muted'
                      "
                    ></span>
                  </span>
                </button>
                <label v-if="autofocus" class="block pb-1">
                  <span class="block text-[10px] text-content-faint mb-1">{{
                    t('perihelion.track.autofocusEveryLabel')
                  }}</span>
                  <input
                    v-model.number="autofocusMinutes"
                    type="number"
                    min="1"
                    class="tns-input"
                  />
                </label>
              </div>

              <div class="flex gap-2">
                <button
                  class="tns-btn-primary flex-1"
                  :disabled="actionBusy"
                  @click="onAddToSequence"
                >
                  {{
                    actionBusy
                      ? t('perihelion.track.working')
                      : t('perihelion.track.addToSequence')
                  }}
                </button>
                <button
                  class="shrink-0 min-h-touch min-w-touch flex items-center justify-center rounded-full border border-line-strong text-content-muted hover:bg-surface-2 hover:text-content disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                  :disabled="actionBusy"
                  :title="t('perihelion.track.downloadSequence')"
                  @click="onDownloadSequence"
                >
                  <ArrowDownTrayIcon class="w-5 h-5" />
                </button>
              </div>
              <div class="flex gap-2">
                <!-- flex-[3]/flex-[2] (not flex-1 each) -- "Slew & Center" plus its gear button
                     needs more room than "Quick Track" alone to fit its own label on one line at
                     typical mobile widths; an even 50/50 split wrapped it to two lines. -->
                <div
                  class="flex-[3] flex items-stretch border border-line-strong rounded-control overflow-hidden"
                >
                  <button
                    class="flex-1 min-h-touch px-3 text-sm font-semibold text-content bg-surface-3 hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-3 transition-colors duration-150"
                    :disabled="actionBusy"
                    @click="onSlewAndCenter"
                  >
                    {{
                      actionBusy
                        ? t('perihelion.track.working')
                        : t('perihelion.track.slewAndCenter')
                    }}
                  </button>
                  <button
                    class="px-3 min-w-touch flex items-center justify-center border-l border-line-strong bg-surface-3 hover:bg-surface-2 text-content-muted hover:text-content disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                    :disabled="actionBusy"
                    :title="t('components.settings.title')"
                    @click="showSlewSettingsModal = true"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
                <button
                  class="tns-btn-secondary flex-[2]"
                  :disabled="actionBusy"
                  @click="onQuickTrack"
                >
                  {{
                    actionBusy ? t('perihelion.track.working') : t('perihelion.track.quickTrack')
                  }}
                </button>
              </div>

              <Modal
                :show="showSlewSettingsModal"
                @close="showSlewSettingsModal = false"
                :zIndex="'z-[60]'"
              >
                <template #header>
                  <h2 class="text-xl font-bold">{{ t('components.settings.title') }}</h2>
                </template>
                <template #body>
                  <div class="space-y-4">
                    <div
                      class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg border border-gray-600/30"
                    >
                      <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-cyan-400"></div>
                        <span class="text-sm font-medium">{{
                          t('components.framing.useCenter')
                        }}</span>
                      </div>
                      <div class="ml-6">
                        <toggleButton
                          @click="toggleUseCenter"
                          :status-value="settingsStore.mount.useCenter"
                        />
                      </div>
                    </div>

                    <div
                      class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg border border-gray-600/30"
                    >
                      <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-purple-400"></div>
                        <span class="text-sm font-medium">{{
                          t('components.framing.useRotate')
                        }}</span>
                      </div>
                      <div class="ml-6">
                        <toggleButton
                          @click="toggleUseRotate"
                          :status-value="settingsStore.mount.useRotate"
                          :disabled="!store.rotatorInfo.Connected"
                        />
                      </div>
                    </div>

                    <div class="border-t border-gray-600/30 pt-4">
                      <SettingInput
                        labelKey="components.mount.settings.telescope_settle_time"
                        settingKey="TelescopeSettings-SettleTime"
                        :modelValue="store.profileInfo.TelescopeSettings.SettleTime"
                        :max="600"
                      />
                    </div>
                  </div>
                </template>
              </Modal>
              <p class="text-[11px] leading-relaxed text-content-faint">
                <strong class="text-content-muted">{{
                  t('perihelion.track.addToSequence')
                }}</strong>
                {{ t('perihelion.track.addToSequenceDescriptionRest') }}
              </p>
              <p class="text-[11px] leading-relaxed text-content-faint">
                <strong class="text-content-muted">{{
                  t('perihelion.track.downloadSequence')
                }}</strong>
                {{ t('perihelion.track.downloadSequenceDescriptionRest') }}
              </p>
              <p class="text-[11px] leading-relaxed text-content-faint">
                <strong class="text-content-muted">{{
                  t('perihelion.track.slewAndCenter')
                }}</strong>
                {{ t('perihelion.track.slewAndCenterDescriptionRest') }}
              </p>
              <p class="text-[11px] leading-relaxed text-content-faint">
                <strong class="text-content-muted">{{ t('perihelion.track.quickTrack') }}</strong>
                {{ t('perihelion.track.quickTrackDescriptionRest') }}
              </p>
            </div>

            <button v-else class="tns-btn-danger" :disabled="actionBusy" @click="onStop">
              {{ actionBusy ? t('perihelion.track.working') : stopButtonLabel }}
            </button>
            <p
              v-if="trackingMode === 'quick' && autoReapply"
              class="text-[11px] text-content-faint text-center"
            >
              {{ t('perihelion.track.autoReapplyingFooter', { minutes: AUTO_REAPPLY_MINUTES }) }}
            </p>

            <p class="text-[11px] leading-relaxed text-content-faint text-center">
              {{ t('perihelion.track.footer') }}
            </p>
          </template>
        </template>
      </div>

      <!-- Shared across Browse and Position & Path -- a native title tooltip doesn't work on
           touch, so this is a tap-to-open explanation instead, matching the InformationCircleIcon
           + Modal pattern already used elsewhere in the app (e.g. PatternEditorCore.vue). -->
      <Modal
        :show="showObservedMagLegend"
        @close="showObservedMagLegend = false"
        :zIndex="'z-[60]'"
      >
        <template #header>
          <h2 class="text-xl font-bold">{{ t('perihelion.browse.observedLegendTitle') }}</h2>
        </template>
        <template #body>
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-status-ok shrink-0"></span>
              <span>{{ t('perihelion.browse.observedLegendBrighter') }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-accent shrink-0"></span>
              <span>{{ t('perihelion.browse.observedLegendNormal') }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-status-warn shrink-0"></span>
              <span>{{ t('perihelion.browse.observedLegendFainter') }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-status-danger shrink-0"></span>
              <span>{{ t('perihelion.browse.observedLegendMuchFainter') }}</span>
            </div>
          </div>
        </template>
      </Modal>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import SubNav from '@/components/SubNav.vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { raDecToAltAz, wait } from '@/utils/utils';
import { fetchBrowseObjects, refreshCobs } from '../utils/fetchBrowseObjects';
import { fetchPath } from '../utils/fetchPath';
import { fetchSyncStatus, syncComets } from '../utils/syncComets';
import { fetchCometActivity } from '../utils/fetchCometActivity';
import { sendPerihelionSequence } from '../utils/sendPerihelionSequence';
import { buildPerihelionSequence } from '../utils/buildPerihelionSequence';
import { startQuickTrack, stopQuickTrack } from '../utils/quickTrack';
import { fetchQuickTrackStatus } from '../utils/fetchQuickTrackStatus';
import { usePerihelionStore } from '../store/perihelionStore';
import { useFramingStore } from '@/store/framingStore';
import { useSettingsStore } from '@/store/settingsStore';
import OrbitalPathChart from '../components/OrbitalPathChart.vue';
import FramingOffsetView from '../components/FramingOffsetView.vue';
import PerihelionAbout from '../components/PerihelionAbout.vue';
import SkyChart from '@/components/framing/SkyChart.vue';
// Same Center/Rotate toggle + settle-time modal as ButtonSlewCenterRotate.vue's own gear icon
// (the app-wide Slew & Center control) -- reusing the pieces rather than that whole component,
// since it calls framingStore.slewAndCenterRotate() which only console.errors on failure; this
// view's own onSlewAndCenter() keeps calling apiService.slewAndCenter() directly so a real
// failure still surfaces in actionStatus like every other Track-tab action here.
import Modal from '@/components/helpers/Modal.vue';
import toggleButton from '@/components/helpers/toggleButton.vue';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';
import {
  EyeIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline';

// Matches OryxAstro's own comet category glyph (AstroCategoryIcon.vue) exactly -- same
// tapered-tail-into-glowing-coma shape, not an independent redesign. That component uses
// stop-color="currentColor" resolved from the CSS `color` property, but this file's icons set
// an explicit stroke="#hex" instead (see AsteroidIcon below) rather than relying on inherited
// `color` -- so the hex is baked directly into the gradient stops here instead of copying
// currentColor verbatim, which would have silently resolved to whatever text color happens to
// be inherited rather than violet. `id` must be unique per rendered instance (a comet's own
// list-row id works well) since two instances sharing one gradient id is invalid SVG, same
// concern OryxAstro's own component solves with Vue's useId().
const CometIcon = {
  props: { size: { type: Number, default: 16 }, id: { type: String, default: 'default' } },
  render() {
    const uid = this.id;
    return h(
      'svg',
      {
        width: this.size,
        height: this.size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: '#a78bfa',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      [
        h('defs', {}, [
          h(
            'linearGradient',
            {
              id: `comet-tail-${uid}`,
              x1: 17,
              y1: 7,
              x2: 4,
              y2: 17,
              gradientUnits: 'userSpaceOnUse',
            },
            [
              h('stop', { offset: '0%', 'stop-color': '#a78bfa', 'stop-opacity': '0.9' }),
              h('stop', { offset: '100%', 'stop-color': '#a78bfa', 'stop-opacity': '0' }),
            ]
          ),
          h('radialGradient', { id: `comet-coma-${uid}` }, [
            h('stop', { offset: '0%', 'stop-color': '#a78bfa', 'stop-opacity': '1' }),
            h('stop', { offset: '100%', 'stop-color': '#a78bfa', 'stop-opacity': '0' }),
          ]),
        ]),
        h('path', {
          stroke: `url(#comet-tail-${uid})`,
          d: 'M17 7 C13 11, 8 14, 4 16.5',
          'stroke-width': 4.5,
        }),
        h('circle', { cx: 17, cy: 7, r: 6, fill: `url(#comet-coma-${uid})`, stroke: 'none' }),
        h('circle', { cx: 17, cy: 7, r: 2.5, fill: '#a78bfa', stroke: 'none' }),
      ]
    );
  },
};
const AsteroidIcon = {
  props: { size: { type: Number, default: 16 } },
  render() {
    return h(
      'svg',
      {
        width: this.size,
        height: this.size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: '#8fa3bf',
        'stroke-width': 1.8,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      [h('path', { d: 'M9 3.5l6 1.3 4 4.6-1 6.4-5.2 4.7-6.4-1.6L4 13z' })]
    );
  },
};

const { t } = useI18n();
const store = apiStore();
const framingStore = useFramingStore();
const perihelionStore = usePerihelionStore();
const settingsStore = useSettingsStore();
const showSlewSettingsModal = ref(false);
// Persisted across leaving/re-entering this tab (see perihelionStore.js's own doc comment for
// why plain local refs don't survive that) -- everything else below stays a local ref, since
// it's either re-fetched cheaply (objects, path) or purely transient UI feedback (actionStatus,
// actionBusy).
const {
  activeTab,
  selectedId,
  filter,
  sortMode,
  searchQuery,
  exposureFilter,
  exposureSeconds,
  frameCount,
  guiding,
  meridianFlip,
  autofocus,
  autofocusMinutes,
  autoReapply,
  trackingMode,
  framingOffset,
  pluginInstalled,
} = storeToRefs(perihelionStore);

const AUTO_REAPPLY_MINUTES = 15;

// Perihelion's own backend is a separate standalone HTTP server, not something ninaAPI knows
// about -- GET /status happens to already exist (it also backs the Live Status card), so it
// doubles as the simplest possible "is this actually installed and reachable" probe: any
// response at all (even Active: false, meaning nothing is currently tracking) proves the server
// exists; a network failure means it doesn't, same as nightsummaryStore.js's own
// checkPluginStatus() treats a thrown request as "not installed".
async function checkPluginInstalled() {
  try {
    await fetchQuickTrackStatus();
    pluginInstalled.value = true;
  } catch {
    pluginInstalled.value = false;
  }
}

// computed, not a plain array -- SubNav renders item.name directly with no i18n resolution of
// its own, so this has to stay reactive to a locale switch itself.
const tabItems = computed(() => [
  { name: t('perihelion.tabs.browse'), value: 'browse' },
  { name: t('perihelion.tabs.position'), value: 'position' },
  { name: t('perihelion.tabs.track'), value: 'track' },
]);

// --- Browse ---
const objects = ref([]);
const objectsLoading = ref(false);
const objectsError = ref(null);
// Stores the key, not the resolved string -- t(f.labelKey) is called in the template itself
// (unlike SubNav's tabItems, which bakes the resolved string into the array and so needs that
// array to be a computed instead), so a plain array here already reacts to a locale switch.
const filterOptions = [
  { labelKey: 'perihelion.browse.filterAll', value: 'all' },
  { labelKey: 'perihelion.browse.filterComets', value: 'Comet' },
  { labelKey: 'perihelion.browse.filterAsteroids', value: 'Asteroid' },
];

async function loadObjects() {
  objectsLoading.value = true;
  objectsError.value = null;
  try {
    objects.value = await fetchBrowseObjects();
    if (!selectedId.value && objects.value.length) selectedId.value = objects.value[0].id;
    fillCobsInBackground();
  } catch (error) {
    objectsError.value = error?.message ?? 'Could not load objects from Perihelion';
  } finally {
    objectsLoading.value = false;
  }
}

// Real hardware feedback: waiting on COBS before the Browse list could render at all was felt
// as "the page is slow" even when the per-comet cache was warm, and much worse cold (14-16s
// measured on real hardware for 14 comets). /objects now returns predicted-magnitude-only data
// instantly (see OrbitalTracking.ListBrowseObjectsAsync's own includeCobs doc comment); this
// fills in real observed-brightness badges afterward, one comet at a time, mutating the same
// reactive objects already in objects.value so each badge just pops in as its own request
// resolves rather than blocking the whole list. cobsFillToken guards against a stale sweep (from
// a previous loadObjects()/tab switch) writing into whatever's currently displayed after a newer
// load has already replaced objects.value with a new array.
let cobsFillToken = 0;
async function fillCobsInBackground() {
  const token = ++cobsFillToken;
  const comets = objects.value.filter((o) => o.objectType === 'Comet');
  const concurrency = 6;
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < comets.length) {
      if (cobsFillToken !== token) return;
      const comet = comets[nextIndex++];
      try {
        const activity = await fetchCometActivity(comet.name);
        if (cobsFillToken !== token) return;
        if (activity.available) {
          comet.observedMagnitude = activity.mostRecentMagnitude;
          comet.observedAverageMagnitude = activity.recentAverageMagnitude;
        }
      } catch {
        // Leave predicted-only -- same "no cross-check available" fallback as before.
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}
// --- Comet data sync (on-disk cache on the plugin side, see CometOrbits.cs) ---
const cometsLastSyncedUtc = ref(null);
const cobsLastRefreshedUtc = ref(null);
const syncing = ref(false);
const syncMessage = ref(null);

async function loadSyncStatus() {
  try {
    const status = await fetchSyncStatus();
    cometsLastSyncedUtc.value = status.cometsLastSyncedUtc;
    cobsLastRefreshedUtc.value = status.cobsLastRefreshedUtc;
  } catch {
    // Not worth surfacing an error just for the status line -- the Sync Now/Refresh COBS
    // buttons and any comet-fetch error elsewhere in the panel already cover the cases that
    // actually matter.
  }
}

// checkPluginInstalled() has to resolve first -- a single combined onMounted rather than two
// separate ones, since otherwise loadObjects/loadSyncStatus could fire (and needlessly fail)
// before pluginInstalled is known, or run right alongside the "not detected" check instead of
// being skipped by it.
onMounted(async () => {
  await checkPluginInstalled();
  if (pluginInstalled.value) {
    loadObjects();
    loadSyncStatus();
  }
});

const syncStatusLabel = computed(() =>
  cometsLastSyncedUtc.value
    ? t('perihelion.browse.syncedAgo', { when: relativeTime(cometsLastSyncedUtc.value) })
    : t('perihelion.browse.neverSynced')
);

const cobsStatusLabel = computed(() =>
  cobsLastRefreshedUtc.value
    ? t('perihelion.browse.cobsRefreshedAgo', { when: relativeTime(cobsLastRefreshedUtc.value) })
    : t('perihelion.browse.cobsNeverRefreshed')
);

async function onSyncComets() {
  syncing.value = true;
  syncMessage.value = null;
  const result = await syncComets();
  syncMessage.value = { ok: result.ok, text: result.message };
  if (result.lastSyncedUtc) cometsLastSyncedUtc.value = result.lastSyncedUtc;
  syncing.value = false;
  if (result.ok) await loadObjects();
}

// --- COBS refresh -- deliberately separate from Sync Now (comet elements), see
// fetchBrowseObjects.js's own refreshCobs() doc comment for why. Replaces objects.value
// directly from the response rather than re-calling loadObjects(), since the plugin already
// returns the full, freshly-refreshed list -- no need for a second round trip.
const refreshingCobs = ref(false);
const cobsRefreshMessage = ref(null);

async function onRefreshCobs() {
  refreshingCobs.value = true;
  cobsRefreshMessage.value = null;
  // Invalidate any in-flight ambient background fill (fillCobsInBackground) -- its per-comet
  // requests are for the OLD cache state and could otherwise land after this explicit refresh
  // and stomp its fresher results with stale ones.
  cobsFillToken++;
  try {
    objects.value = await refreshCobs();
    cobsRefreshMessage.value = { ok: true, text: t('perihelion.browse.cobsRefreshed') };
    await loadSyncStatus();
  } catch (error) {
    cobsRefreshMessage.value = {
      ok: false,
      text: error?.message ?? t('perihelion.status.syncFailed'),
    };
  } finally {
    refreshingCobs.value = false;
  }
}

// A 1+ magnitude gap between predicted and observed is exactly the "predicted model doesn't
// know about a real outburst" case this badge exists to surface (10P/Tempel and 220P/McNaught
// are verified real examples several magnitudes off) -- flagged in the warning color rather
// than the same quiet accent used when the two roughly agree, so a genuinely surprising comet
// stands out in the list without needing to open it first.
const showObservedMagLegend = ref(false);

// Collapsed by default -- Alt/Az, Sun/Earth distance, elongation, constellation, and perihelion
// date are real facts someone might want, but stacking them onto an already-busy tab as
// permanently-visible rows was worse than tucking them behind one disclosure.
const showMoreDetails = ref(false);

// Magnitude is a reverse scale (lower number = brighter), so "observed differs from predicted"
// isn't one kind of surprise -- it's two opposite ones. Brighter-than-predicted (diff very
// negative) is a genuinely exciting outburst, worth flagging as good news, not a warning;
// fainter-than-predicted (diff positive) means the comet is underperforming the model, which is
// the "something to be aware of" direction amber/red are actually for. 10P/Tempel's real case
// (predicted 13.3, observed 7.9, diff -5.4) should read as a bright-green highlight, not amber.
// Shared by the Browse list badge and the Position & Path card's Latest/Avg values, each of
// which compares its own observed number against the same predicted magnitude independently --
// Latest and Avg can legitimately land in different tiers.
function magDiffTier(predictedMag, observedMag) {
  if (predictedMag == null || observedMag == null) return 'accent';
  const diff = observedMag - predictedMag; // negative = brighter than predicted
  if (diff <= -1) return 'ok';
  if (diff >= 3) return 'danger';
  if (diff >= 1) return 'warn';
  return 'accent';
}
// Full literal class strings per tier -- NOT built via template-literal interpolation (e.g.
// `bg-status-${tier}/10`), which Tailwind's JIT scanner can't see since it only picks up
// complete, literal class names actually present in the source, not runtime-assembled ones.
const PILL_CLASS_BY_TIER = {
  accent: 'bg-accent/10 border-accent/30 text-accent',
  ok: 'bg-status-ok/10 border-status-ok/40 text-status-ok',
  warn: 'bg-status-warn/10 border-status-warn/40 text-status-warn',
  danger: 'bg-status-danger/10 border-status-danger/40 text-status-danger',
};
const TEXT_CLASS_BY_TIER = {
  accent: 'text-accent',
  ok: 'text-status-ok',
  warn: 'text-status-warn',
  danger: 'text-status-danger',
};
// Full pill styling for the Browse list's compact badge.
function magDiffColorClass(predictedMag, observedMag) {
  return PILL_CLASS_BY_TIER[magDiffTier(predictedMag, observedMag)];
}
// Plain text color for the Position & Path card's inline Latest/Avg values (no pill there).
function magDiffTextClass(predictedMag, observedMag) {
  return TEXT_CLASS_BY_TIER[magDiffTier(predictedMag, observedMag)];
}

// Below horizon or very low (under the atmosphere/local-obstruction danger zone) -> red; a
// usable but not great altitude -> amber; comfortably clear of the horizon -> green. 15deg
// matches the altitude limit amateur setups commonly use as a cutoff for atmospheric extinction
// and local obstructions (trees, buildings); 30deg is a common "comfortably imageable" line.
// Both are reasonable defaults, not a value read from the profile's own horizon settings.
function altitudeColorClass(altitudeDeg) {
  if (altitudeDeg < 15) return TEXT_CLASS_BY_TIER.danger;
  if (altitudeDeg < 30) return TEXT_CLASS_BY_TIER.warn;
  return TEXT_CLASS_BY_TIER.ok;
}

function sortObjects(list) {
  const arr = [...list];
  if (sortMode.value === 'name') {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // Nulls (no magnitude available) sort last regardless of direction.
    arr.sort((a, b) => {
      if (a.magnitude == null) return b.magnitude == null ? 0 : 1;
      if (b.magnitude == null) return -1;
      return a.magnitude - b.magnitude;
    });
  }
  return arr;
}

const filteredObjects = computed(() => {
  let list = objects.value;
  if (filter.value !== 'all') list = list.filter((o) => o.objectType === filter.value);
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter((o) => o.name.toLowerCase().includes(q));
  }
  // On the combined "all" view, comets are grouped before asteroids rather than interleaved by
  // raw magnitude -- a comet's magnitude is a TOTAL brightness over its whole diffuse coma, not
  // a point source the way an asteroid's is, so a straight numeric sort across both overstates
  // how directly comparable they really are. Grouping avoids that false precision, and comets
  // first also matches that most people using this panel are after comets specifically.
  if (filter.value === 'all') {
    return [
      ...sortObjects(list.filter((o) => o.objectType === 'Comet')),
      ...sortObjects(list.filter((o) => o.objectType === 'Asteroid')),
    ];
  }
  return sortObjects(list);
});

// Computed rather than hardcoded so the "N asteroids" note below never silently goes stale if
// the embedded list in AsteroidOrbits.cs ever changes.
const asteroidCount = computed(
  () => objects.value.filter((o) => o.objectType === 'Asteroid').length
);

const selected = computed(() => objects.value.find((o) => o.id === selectedId.value) ?? null);

function formatRaHours(raHours) {
  const h = Math.floor(raHours);
  const m = (raHours - h) * 60;
  return `${h}h ${m.toFixed(1)}m`;
}
function formatDecDeg(decDeg) {
  const sign = decDeg < 0 ? '-' : '+';
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = (abs - d) * 60;
  return `${sign}${d}° ${m.toFixed(0)}′`;
}

// Absolute, not relative (relativeTime() below reads oddly for a date that can be months in the
// future or the past for a long-period comet) -- yyyy-MM-dd, same convention the 10-Night Path
// chart's own date labels already use.
function formatPerihelionDate(date) {
  return date.toISOString().slice(0, 10);
}

/** "3h ago" / "just now" -- shared by the comet-sync status line and the COBS activity note. */
function relativeTime(date) {
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return t('perihelion.relativeTime.justNow');
  if (seconds < 3600)
    return t('perihelion.relativeTime.minutesAgo', { n: Math.floor(seconds / 60) });
  if (seconds < 86400)
    return t('perihelion.relativeTime.hoursAgo', { n: Math.floor(seconds / 3600) });
  return t('perihelion.relativeTime.daysAgo', { n: Math.floor(seconds / 86400) });
}

// --- Position & Path ---
const hasLocation = computed(() => {
  const s = store.profileInfo?.AstrometrySettings;
  return s?.Latitude != null && s?.Longitude != null;
});
const altAz = computed(() => {
  if (!selected.value || !hasLocation.value) return null;
  const s = store.profileInfo.AstrometrySettings;
  // raDecToAltAz (src/utils/utils.js) expects RA in degrees; Perihelion returns decimal hours.
  return raDecToAltAz(selected.value.raHours * 15, selected.value.decDeg, s.Latitude, s.Longitude);
});
// { altitude, label } | null -- from SkyChart's own peak-altitude emit, so "currently low" and
// "climbing to a good altitude tonight" aren't indistinguishable in the same red/amber badge.
const tonightsPeakAltitude = ref(null);

const path = ref([]);
const pathLoading = ref(false);
const pathError = ref(null);
async function loadPath() {
  if (!selected.value) return;
  pathLoading.value = true;
  pathError.value = null;
  try {
    path.value = await fetchPath({
      objectType: selected.value.objectType,
      targetName: selected.value.name,
    });
  } catch (error) {
    pathError.value = error?.response?.data?.Message ?? error?.message ?? 'Could not load path';
  } finally {
    pathLoading.value = false;
  }
}
watch([activeTab, selected], ([tab]) => {
  if (tab === 'position' && selected.value) loadPath();
});

// Real hardware feedback: Browse/Position & Path/Track are tabs within this one component, not
// separate routes, so the router-level scrollBehavior fix (src/router/index.js) never fires for
// switching between them -- a scrolled-down Browse list left Position & Path (or Track) opening
// already scrolled down too. Reset explicitly on every tab switch instead.
watch(activeTab, () => {
  window.scrollTo({ top: 0 });
});

// --- Observed brightness (COBS) -- comet-only cross-check against the predicted magnitude ---
const cometActivity = ref(null);
// Guards against a stale response overwriting a newer one: navigating away from the Position &
// Path tab and back (or switching comets) before an in-flight fetch resolves used to let that
// older response land last and silently replace the correct, more recent one -- looked exactly
// like the observed-brightness value randomly changing or disagreeing with cobs.si, when it was
// really just showing a response for an earlier moment/selection.
let cometActivityRequestId = 0;
async function loadCometActivity() {
  if (!selected.value || selected.value.objectType !== 'Comet') {
    cometActivity.value = null;
    return;
  }
  const requestId = ++cometActivityRequestId;
  const targetName = selected.value.name;
  try {
    const result = await fetchCometActivity(targetName);
    if (requestId !== cometActivityRequestId) return; // a newer request has since started
    cometActivity.value = result.available ? result : null;
  } catch {
    if (requestId !== cometActivityRequestId) return;
    cometActivity.value = null;
  }
}
watch([activeTab, selected], ([tab]) => {
  if (tab === 'position' && selected.value) loadCometActivity();
});

// --- Framing offset -- see FramingOffsetView.vue's own doc comment for the mechanism.
// null means "no offset, center exactly on the object's true position" (the default).
// framingOffset itself now lives in perihelionStore (see its own comment) so it survives
// leaving and re-entering this tab, same as guiding/autoReapply/etc. already did.
watch(selected, (newVal, oldVal) => {
  // Only a genuine re-selection (a different object while one was already selected) should
  // drop the offset -- an offset captured for one object has no meaning for a different one.
  // Plain `watch(selected, ...)` without this guard also fired on the very same object simply
  // *reappearing*: objects.value starts empty on every fresh mount of this view (no
  // <KeepAlive> on the app's router-view, so navigating away and back tears this component
  // down entirely), so `selected` goes null -> (same, persisted) object the instant
  // loadObjects() resolves -- indistinguishable from a real change without checking ids, and
  // this watcher's callback runs before FramingOffsetView (freshly mounting at the same
  // moment) ever gets to read its restored initialOffset prop, silently discarding it on every
  // single return to this tab.
  if (oldVal && newVal && oldVal.id !== newVal.id) {
    framingOffset.value = null;
    showFramingCapturedPrompt.value = false;
    // SkyChart's own peak-altitude emit is target-identity-aware (see its own dedup-guard
    // comment), so it always re-emits on a genuine object switch -- this reset just avoids a
    // stale flash of the previous object's peak in the gap before that fresh emit lands.
    tonightsPeakAltitude.value = null;
  }
});

// Confirmation shown after "Use this Framing" instead of forcibly navigating to Track --
// captures the offset like before, but leaves the choice of when to move on to the user (they
// may still want to check Tonight's Altitude / 10-Night Path on this same tab first).
const showFramingCapturedPrompt = ref(false);
function onFramingOffset(offset) {
  framingOffset.value = offset;
  showFramingCapturedPrompt.value = offset != null;
}
function goToTrackFromFraming() {
  showFramingCapturedPrompt.value = false;
  activeTab.value = 'track';
}

// --- Track ---
// trackingMode: 'idle' | 'quick' | 'sequence' -- lives in perihelionStore, see above.
const actionBusy = ref(false);
const actionStatus = ref(null);

const statusLabel = computed(() => {
  if (trackingMode.value === 'sequence') return t('perihelion.track.statusSequence');
  if (trackingMode.value === 'quick') return t('perihelion.track.statusQuick');
  return t('perihelion.track.statusIdle');
});
const stopButtonLabel = computed(() =>
  trackingMode.value === 'sequence'
    ? t('perihelion.track.stopSequence')
    : t('perihelion.track.stopQuickTrack')
);

// --- Live Quick Track status -- polls Perihelion's own /status route rather than trusting
// stale local state, so e.g. a silently-failing auto-reapply tick is actually visible.
const quickTrackStatus = ref(null);
const now = ref(Date.now());
let statusPollHandle = null;

async function pollQuickTrackStatus() {
  try {
    quickTrackStatus.value = await fetchQuickTrackStatus();
  } catch {
    // Leave the last known value in place on a transient fetch error -- clearing it would make
    // a one-off network blip look identical to tracking actually having stopped.
  }
  now.value = Date.now();
}

watch(
  trackingMode,
  (mode) => {
    if (statusPollHandle) {
      clearInterval(statusPollHandle);
      statusPollHandle = null;
    }
    if (mode === 'quick') {
      pollQuickTrackStatus();
      statusPollHandle = setInterval(pollQuickTrackStatus, 10000);
    } else {
      quickTrackStatus.value = null;
    }
  },
  { immediate: true }
);
onUnmounted(() => {
  if (statusPollHandle) clearInterval(statusPollHandle);
});

/** Coarse duration ("3m", "1h 05m") without a directional suffix -- caller supplies "for"/"in ~". */
function formatDuration(ms) {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 60) return 'under a minute';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;
}

const elapsedSinceStarted = computed(() => {
  const startedUtc = quickTrackStatus.value?.startedUtc;
  if (!startedUtc) return null;
  return formatDuration(now.value - new Date(startedUtc).getTime());
});
const elapsedSinceApplied = computed(() => {
  const lastAppliedUtc = quickTrackStatus.value?.lastAppliedUtc;
  if (!lastAppliedUtc) return null;
  return relativeTime(new Date(lastAppliedUtc));
});
const nextReapplyIn = computed(() => {
  const s = quickTrackStatus.value;
  if (!s?.autoReapplyMinutes || !s.lastAppliedUtc) return null;
  const nextAtMs = new Date(s.lastAppliedUtc).getTime() + s.autoReapplyMinutes * 60000;
  return formatDuration(nextAtMs - now.value);
});

// Shared by onAddToSequence (loads it live into NINA) and onDownloadSequence (saves the exact
// same JSON as a file) -- both send the identical target shape to buildPerihelionSequence, so
// there's exactly one place that has to stay in sync with its own param docs.
function buildSequenceTarget() {
  return {
    objectType: selected.value.objectType.toLowerCase(),
    targetName: selected.value.name,
    raHours: selected.value.raHours,
    decDeg: selected.value.decDeg,
    guiding: guiding.value,
    meridianFlip: meridianFlip.value,
    autofocusMinutes: autofocus.value ? autofocusMinutes.value : null,
    frameOffset: framingOffset.value,
    exposure: {
      filterName: exposureFilter.value || null,
      exposureSeconds: exposureSeconds.value,
      frameCount: frameCount.value,
    },
  };
}

async function onAddToSequence() {
  if (!selected.value) return;
  actionBusy.value = true;
  actionStatus.value = null;
  const result = await sendPerihelionSequence(buildSequenceTarget());
  actionStatus.value = result;
  actionBusy.value = false;
  // Deliberately stays 'idle' even on success -- Add to Sequence only loads the sequence, it
  // doesn't start it (see sendPerihelionSequence's own doc comment), so there's nothing here
  // for a "Stop Sequence" button to stop yet.
}

// Lighter-weight alternative to Add to Sequence for someone who doesn't want it loaded straight
// into NINA -- same buildPerihelionSequence() JSON, saved as a file instead of POSTed. Carries
// the exact same "today's position baked in" property Add to Sequence already has, so no new
// staleness risk versus that existing action. Comet/asteroid names can contain "/" (e.g.
// "220P/McNaught"), which would otherwise be read as a path separator in the filename.
function onDownloadSequence() {
  if (!selected.value) return;
  const root = buildPerihelionSequence(buildSequenceTarget());
  const safeName = selected.value.name.replace(/[/\\?%*:|"<>]/g, '-');
  const blob = new Blob([JSON.stringify(root, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName}-sequence.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// Deliberately calls apiService.slewAndCenter() directly rather than framingStore's own
// slewAndCenterRotate() wrapper -- that wrapper only console.errors on failure and surfaces
// nothing to the caller, which doesn't match how every other Track-tab action here reports a
// real actionStatus. Reuses ninaAPI's existing GET /equipment/mount/slew route (already proven
// by observationplaner's own Slew/Slew+Center buttons) -- no new backend code needed at all,
// and reuses framingStore.rotationAngle so it also applies whatever rotation was set or
// determined-from-camera on the Position & Path tab's own Framing card.
function toggleUseCenter() {
  settingsStore.mount.useCenter = !settingsStore.mount.useCenter;
  settingsStore.saveMountSettings();
}

function toggleUseRotate() {
  settingsStore.mount.useRotate = !settingsStore.mount.useRotate;
  settingsStore.saveMountSettings();
}

// Real hardware report: on an OnStep mount (and ASCOM/INDI mounts generally), a parked mount
// refuses to slew at all -- Slew and Center did nothing with no clear explanation. Same
// check-then-unpark-then-settle pattern as the app-wide ButtonSlewCenterRotate.vue's own
// unparkMount(), not reused directly since that component swallows failures into a console.log
// with nothing surfaced to the caller (same reason onSlewAndCenter below doesn't call
// framingStore.slewAndCenterRotate() either -- see its own doc comment). The 2s wait gives the
// mount time to physically release its park position before the slew command follows.
async function unparkMountIfNeeded() {
  if (!store.mountInfo.AtPark) return;
  const response = await apiService.mountAction('unpark');
  if (!response?.Success) {
    throw new Error(t('components.mount.control.errors.unpark'));
  }
  await wait(2000);
}

async function onSlewAndCenter() {
  if (!selected.value) return;
  actionBusy.value = true;
  actionStatus.value = null;
  try {
    await unparkMountIfNeeded();
    const response = await apiService.slewAndCenter(
      selected.value.raHours * 15,
      selected.value.decDeg,
      settingsStore.mount.useCenter,
      settingsStore.mount.useRotate && store.rotatorInfo.Connected,
      framingStore.rotationAngle
    );
    actionStatus.value = {
      ok: true,
      message: response?.Response ?? t('perihelion.track.slewAndCenterDone'),
    };
  } catch (error) {
    actionStatus.value = {
      ok: false,
      message:
        error?.response?.data?.Error ?? error?.message ?? t('perihelion.track.slewAndCenterFailed'),
    };
  }
  actionBusy.value = false;
}

async function onQuickTrack() {
  if (!selected.value) return;
  actionBusy.value = true;
  actionStatus.value = null;
  const result = await startQuickTrack({
    objectType: selected.value.objectType.toLowerCase(),
    targetName: selected.value.name,
    guiding: guiding.value,
    autoReapplyMinutes: autoReapply.value ? AUTO_REAPPLY_MINUTES : null,
  });
  actionStatus.value = result;
  actionBusy.value = false;
  if (result.ok) trackingMode.value = 'quick';
}

async function onStop() {
  actionBusy.value = true;
  actionStatus.value = null;
  const result =
    trackingMode.value === 'sequence'
      ? await apiService.sequenceAction('stop')
      : await stopQuickTrack();
  actionStatus.value = {
    ok: !!(result?.Success ?? result?.ok),
    message: result?.Message ?? result?.message ?? 'Stopped',
  };
  actionBusy.value = false;
  trackingMode.value = 'idle';
}
</script>
