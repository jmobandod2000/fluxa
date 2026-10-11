<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';

import useHandlerErrors from 'src/modules/shared/composables/useHandlerErrors';
import useDates from 'src/modules/shared/composables/useDates';
import QrCode from '../components/QrCode.vue';
import { getPublicConfig, issueTurn } from '../api/queueApi';
import { buildTrackUrl, parseSiteParam, type PaperWidth } from '../helpers/queueHelpers';
import type { PublicConfig, PublicTurn } from '../interfaces/queue';

const RESULT_SECONDS = 12;

const { t } = useI18n();
const route = useRoute();
const { handleApiResponseError } = useHandlerErrors();
const { formatDateTime } = useDates();

const siteId = computed(() => parseSiteParam(route.query.sede));
const paper = computed<PaperWidth>(() => {
  const value = String(route.query.papel ?? '0');
  return value === '58' || value === '80' ? value : '0';
});

const { data: config, isLoading } = useQuery({
  queryKey: ['queue', 'public-config'],
  queryFn: getPublicConfig,
  refetchInterval: 5 * 60_000,
});

const ticket = ref<PublicTurn | null>(null);
const pendingSection = ref<number | null>(null);
const countdown = ref(0);
const now = ref(new Date());
let countdownTimer: ReturnType<typeof setInterval> | undefined;
const clock = setInterval(() => (now.value = new Date()), 30_000);

const siteName = computed(
  () => config.value?.sites.find((site) => site.id === siteId.value)?.name ?? null,
);
const trackUrl = computed(() => (ticket.value ? buildTrackUrl(ticket.value.token) : ''));

const reset = () => {
  clearInterval(countdownTimer);
  ticket.value = null;
};

const startCountdown = () => {
  countdown.value = RESULT_SECONDS;
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) reset();
  }, 1000);
};

const take = async (section: PublicConfig['sections'][number]) => {
  if (pendingSection.value) return;
  pendingSection.value = section.id;
  try {
    ticket.value = await issueTurn(section.id, siteId.value);
    startCountdown();
    if (paper.value !== '0') {
      // Espera a que el QR se dibuje antes de imprimir
      await nextTick();
      setTimeout(() => window.print(), 400);
    }
  } catch (error) {
    handleApiResponseError(error);
  } finally {
    pendingSection.value = null;
  }
};

onMounted(() => document.body.classList.add(`print-paper-${paper.value}`));
onBeforeUnmount(() => {
  clearInterval(countdownTimer);
  clearInterval(clock);
  document.body.classList.remove(`print-paper-${paper.value}`);
});
</script>

<template>
  <div class="kiosk">
    <header class="kiosk__header no-print">
      <div>
        <div class="kiosk__business">{{ config?.name }}</div>
        <div v-if="siteName" class="kiosk__site">{{ siteName }}</div>
      </div>
      <div class="kiosk__clock">
        {{ now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
      </div>
    </header>

    <main class="kiosk__main no-print">
      <div v-if="isLoading" class="row justify-center q-pa-xl">
        <q-spinner-dots size="56px" color="white" />
      </div>

      <template v-else-if="!ticket">
        <h1 class="kiosk__title">{{ t('kiosk.title') }}</h1>
        <div v-if="!config?.sections.length" class="kiosk__empty">{{ t('kiosk.noSections') }}</div>
        <div class="kiosk__grid">
          <button
            v-for="section in config?.sections"
            :key="section.id"
            type="button"
            class="kiosk__option"
            :style="{ '--accent': section.color ?? '#1A4FD6' }"
            :disabled="!!pendingSection"
            @click="take(section)"
          >
            <span class="kiosk__prefix">{{ section.prefix }}</span>
            <span class="kiosk__name">{{ section.name }}</span>
            <q-spinner v-if="pendingSection === section.id" size="28px" />
          </button>
        </div>
      </template>

      <div v-else class="kiosk__result">
        <div class="kiosk__result-label">{{ t('kiosk.yourNumber') }}</div>
        <div class="kiosk__code" :style="{ color: ticket.color ?? '#1A4FD6' }">
          {{ ticket.code }}
        </div>
        <div class="kiosk__result-section">{{ ticket.section }}</div>
        <div class="kiosk__ahead">
          {{ ticket.ahead ? t('kiosk.ahead', { n: ticket.ahead }, ticket.ahead) : t('kiosk.next') }}
        </div>
        <div class="row items-center justify-center q-gutter-lg q-mt-md">
          <QrCode :value="trackUrl" :size="150" class="kiosk__qr" />
          <div class="kiosk__qr-hint">{{ t('kiosk.scan') }}</div>
        </div>
        <button type="button" class="kiosk__done" @click="reset">
          {{ t('kiosk.done', { s: countdown }) }}
        </button>
      </div>
    </main>

    <!-- Ticket impreso (solo papel) -->
    <section v-if="ticket" class="print-ticket">
      <div class="print-ticket__business">{{ config?.name }}</div>
      <div v-if="siteName" class="print-ticket__small">{{ siteName }}</div>
      <div class="print-ticket__code">{{ ticket.code }}</div>
      <div class="print-ticket__section">{{ ticket.section }}</div>
      <div class="print-ticket__small">{{ formatDateTime(ticket.createdAt) }}</div>
      <div class="print-ticket__small">
        {{ ticket.ahead ? t('kiosk.ahead', { n: ticket.ahead }, ticket.ahead) : t('kiosk.next') }}
      </div>
      <QrCode :value="trackUrl" :size="paper === '58' ? 110 : 140" class="print-ticket__qr" />
      <div class="print-ticket__small">{{ t('kiosk.scanShort') }}</div>
    </section>
  </div>
</template>

<style scoped>
.kiosk {
  min-height: 100vh;
  background: radial-gradient(circle at 20% 0%, #1a4fd6 0%, #0b2149 55%, #070f24 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  user-select: none;
}
.kiosk__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 32px;
}
.kiosk__business {
  font-size: 1.6rem;
  font-weight: 700;
}
.kiosk__site {
  opacity: 0.75;
}
.kiosk__clock {
  font-size: 1.8rem;
  font-weight: 600;
  opacity: 0.9;
}
.kiosk__main {
  flex: 1;
  padding: 16px 32px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.kiosk__title {
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 800;
  text-align: center;
  margin: 0 0 32px;
  line-height: 1.1;
}
.kiosk__empty {
  text-align: center;
  opacity: 0.8;
  font-size: 1.2rem;
}
.kiosk__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
}
.kiosk__option {
  border: none;
  border-radius: 24px;
  background: #fff;
  color: #0b2149;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  border-bottom: 10px solid var(--accent);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
  transition: transform 0.12s ease;
  font-family: inherit;
}
.kiosk__option:active {
  transform: scale(0.97);
}
.kiosk__option:disabled {
  opacity: 0.7;
}
.kiosk__prefix {
  background: var(--accent);
  color: #fff;
  font-weight: 800;
  font-size: 1.4rem;
  border-radius: 12px;
  padding: 4px 14px;
}
.kiosk__name {
  font-size: 1.7rem;
  font-weight: 700;
  text-align: center;
  padding: 0 12px;
}
.kiosk__result {
  background: #fff;
  color: #0b2149;
  border-radius: 28px;
  max-width: 620px;
  width: 100%;
  margin: 0 auto;
  padding: 32px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}
.kiosk__result-label {
  font-size: 1.3rem;
  opacity: 0.75;
}
.kiosk__code {
  font-size: clamp(4rem, 12vw, 7rem);
  font-weight: 900;
  line-height: 1;
  margin: 8px 0;
}
.kiosk__result-section {
  font-size: 1.6rem;
  font-weight: 700;
}
.kiosk__ahead {
  font-size: 1.2rem;
  margin-top: 6px;
  opacity: 0.85;
}
.kiosk__qr-hint {
  max-width: 220px;
  text-align: left;
  font-size: 1.05rem;
}
.kiosk__done {
  margin-top: 24px;
  border: none;
  border-radius: 14px;
  background: #0b2149;
  color: #fff;
  font-size: 1.2rem;
  font-weight: 700;
  padding: 14px 40px;
  cursor: pointer;
  font-family: inherit;
}
.print-ticket {
  display: none;
}
</style>

<style>
/* Ticketera térmica: el ancho se fija con ?papel=58 u ?papel=80 */
@media print {
  body.print-paper-58 .kiosk,
  body.print-paper-80 .kiosk {
    background: #fff !important;
    min-height: 0;
  }
  body.print-paper-58 .no-print,
  body.print-paper-80 .no-print {
    display: none !important;
  }
  body.print-paper-58 .print-ticket,
  body.print-paper-80 .print-ticket {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    text-align: center;
    color: #000;
    font-family: Arial, sans-serif;
    padding: 2mm 0 6mm;
  }
  body.print-paper-58 .print-ticket {
    width: 48mm;
  }
  body.print-paper-80 .print-ticket {
    width: 72mm;
  }
  .print-ticket__business {
    font-size: 13pt;
    font-weight: 700;
  }
  .print-ticket__code {
    font-size: 40pt;
    font-weight: 900;
    line-height: 1.1;
    margin: 2mm 0 1mm;
  }
  .print-ticket__section {
    font-size: 13pt;
    font-weight: 700;
  }
  .print-ticket__small {
    font-size: 9pt;
  }
  .print-ticket__qr {
    margin: 2mm 0 1mm;
  }
}
@page {
  margin: 0;
}
</style>
