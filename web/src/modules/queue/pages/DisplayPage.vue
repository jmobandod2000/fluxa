<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';

import useAlerts from 'src/modules/shared/composables/useAlerts';
import { getBoard, getPublicConfig } from '../api/queueApi';
import useQueueStream from '../composables/useQueueStream';
import useVocabulary from '../composables/useVocabulary';
import { announce, parseSiteParam, spokenCode } from '../helpers/queueHelpers';
import type { QueueEvent } from '../interfaces/queue';

const HIGHLIGHT_MS = 8000;

const { t, locale } = useI18n();
const route = useRoute();
const { playChime } = useAlerts();
const siteId = computed(() => parseSiteParam(route.query.sede));

const { data: config } = useQuery({
  queryKey: ['queue', 'public-config'],
  queryFn: getPublicConfig,
});
const { data: board, refetch } = useQuery({
  queryKey: ['queue', 'board', siteId],
  queryFn: () => getBoard(siteId.value),
  refetchInterval: 60_000,
});

const businessType = computed(() => config.value?.businessType ?? null);
const { counterWord } = useVocabulary(businessType);

const soundOn = ref(false);
const flash = ref(false);
const now = ref(new Date());
const clock = setInterval(() => (now.value = new Date()), 15_000);
let flashTimer: ReturnType<typeof setTimeout> | undefined;

const current = computed(
  () => board.value?.called.find((call) => call.status === 'CALLED') ?? board.value?.called[0],
);
const recent = computed(
  () => board.value?.called.filter((call) => call !== current.value).slice(0, 5) ?? [],
);
const siteName = computed(
  () => config.value?.sites.find((site) => site.id === siteId.value)?.name ?? null,
);

// El navegador solo permite sonido después de un toque: el primer clic lo habilita
const enableSound = () => {
  soundOn.value = true;
  void playChime();
  announce(t('display.soundReady'), locale.value);
};

const onEvent = async (event: QueueEvent) => {
  await refetch();
  if (event.type !== 'called' || !event.turn) return;
  flash.value = true;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (flash.value = false), HIGHLIGHT_MS);
  if (!soundOn.value) return;
  await playChime();
  setTimeout(
    () =>
      announce(
        t('display.announce', { code: spokenCode(event.turn!.code), counter: event.turn!.counter }),
        locale.value,
      ),
    700,
  );
};

const { isConnected } = useQueueStream(
  () => siteId.value,
  (event) => void onEvent(event),
);

onBeforeUnmount(() => {
  clearInterval(clock);
  clearTimeout(flashTimer);
});
</script>

<template>
  <div class="display" @click="!soundOn && enableSound()">
    <header class="display__header">
      <div>
        <div class="display__business">{{ config?.name }}</div>
        <div v-if="siteName" class="display__site">{{ siteName }}</div>
      </div>
      <div class="row items-center q-gutter-md">
        <q-icon v-if="!isConnected" name="sym_r_wifi_off" size="28px" color="orange-5">
          <q-tooltip>{{ t('display.offline') }}</q-tooltip>
        </q-icon>
        <div class="display__clock">
          {{ now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
        </div>
      </div>
    </header>

    <main class="display__main">
      <section class="display__current" :class="{ 'display__current--flash': flash }">
        <template v-if="current">
          <div class="display__label">{{ t('display.nowServing') }}</div>
          <div class="display__code" :style="{ color: current.color ?? '#fff' }">
            {{ current.code }}
          </div>
          <div class="display__counter">
            <q-icon name="sym_r_arrow_forward" />
            {{ current.counter ?? counterWord }}
          </div>
          <div class="display__section">{{ current.section }}</div>
        </template>
        <div v-else class="display__idle">{{ t('display.idle') }}</div>
      </section>

      <aside class="display__side">
        <div class="display__side-title">{{ t('display.recent') }}</div>
        <div v-for="call in recent" :key="call.code + call.calledAt" class="display__row">
          <span class="display__row-code" :style="{ borderColor: call.color ?? '#1A4FD6' }">{{
            call.code
          }}</span>
          <span class="display__row-counter">{{ call.counter }}</span>
        </div>
        <div v-if="!recent.length" class="display__muted">—</div>
      </aside>
    </main>

    <footer class="display__footer">
      <div v-for="section in board?.sections" :key="section.id" class="display__chip">
        <span class="display__chip-prefix" :style="{ background: section.color ?? '#1A4FD6' }">{{
          section.prefix
        }}</span>
        {{ section.name }} · {{ t('display.waiting', { n: section.waiting }, section.waiting) }}
      </div>
    </footer>

    <div v-if="!soundOn" class="display__overlay">
      <q-icon name="sym_r_volume_up" size="64px" />
      <div class="text-h5 q-mt-md">{{ t('display.enableSound') }}</div>
    </div>
  </div>
</template>

<style scoped>
.display {
  min-height: 100vh;
  background: #070f24;
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: default;
}
.display__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background: #0b2149;
}
.display__business {
  font-size: 2rem;
  font-weight: 800;
}
.display__site {
  opacity: 0.7;
  font-size: 1.1rem;
}
.display__clock {
  font-size: 2.4rem;
  font-weight: 700;
}
.display__main {
  flex: 1;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  padding: 24px 40px;
}
.display__current {
  border-radius: 32px;
  background: linear-gradient(135deg, #12306f 0%, #1a1f5e 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: box-shadow 0.3s ease;
}
.display__current--flash {
  animation: pulse 1s ease-in-out 4;
  box-shadow: 0 0 0 6px #00a896;
}
@keyframes pulse {
  50% {
    transform: scale(1.02);
  }
}
.display__label {
  font-size: 1.8rem;
  opacity: 0.75;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.display__code {
  font-size: clamp(6rem, 16vw, 13rem);
  font-weight: 900;
  line-height: 1;
}
.display__counter {
  font-size: clamp(2.4rem, 5vw, 4.4rem);
  font-weight: 800;
  margin-top: 8px;
}
.display__section {
  font-size: 1.6rem;
  opacity: 0.8;
}
.display__idle {
  font-size: 2.2rem;
  opacity: 0.6;
}
.display__side {
  border-radius: 32px;
  background: #0f1d40;
  padding: 24px;
}
.display__side-title {
  font-size: 1.3rem;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}
.display__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 2rem;
  font-weight: 700;
}
.display__row-code {
  border-left: 8px solid;
  padding-left: 12px;
}
.display__row-counter {
  font-size: 1.5rem;
  opacity: 0.85;
}
.display__muted {
  opacity: 0.5;
  font-size: 1.5rem;
}
.display__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 40px 24px;
}
.display__chip {
  background: #0f1d40;
  border-radius: 999px;
  padding: 8px 18px 8px 8px;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  gap: 10px;
}
.display__chip-prefix {
  border-radius: 999px;
  padding: 2px 12px;
  font-weight: 800;
}
.display__overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 15, 36, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
@media (max-width: 900px) {
  .display__main {
    grid-template-columns: 1fr;
  }
}
</style>
