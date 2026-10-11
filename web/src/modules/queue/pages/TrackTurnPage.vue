<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { isAxiosError } from 'axios';
import { useI18n } from 'vue-i18n';

import useAlerts from 'src/modules/shared/composables/useAlerts';
import { getPublicTurn } from '../api/queueApi';
import useQueueStream from '../composables/useQueueStream';

const { t } = useI18n();
const route = useRoute();
const { playChime } = useAlerts();
const token = computed(() => String(route.params.token ?? ''));

const {
  data: turn,
  error,
  refetch,
} = useQuery({
  queryKey: ['queue', 'track', token],
  queryFn: () => getPublicTurn(token.value),
  refetchInterval: 30_000,
  retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 2,
});

const notFound = computed(() => isAxiosError(error.value) && error.value.response?.status === 404);
const isCalled = computed(() => turn.value?.status === 'CALLED');
const isClosed = computed(() =>
  ['DONE', 'NO_SHOW', 'CANCELLED'].includes(turn.value?.status ?? ''),
);

useQueueStream(
  () => null,
  () => void refetch(),
);

// Aviso en el celular cuando llaman este turno: sonido y vibración
watch(isCalled, (called, before) => {
  if (!called || before === undefined) return;
  void playChime();
  navigator.vibrate?.([300, 150, 300, 150, 600]);
});
</script>

<template>
  <div class="track">
    <div class="track__card">
      <div v-if="notFound" class="text-center q-pa-lg">
        <q-icon name="sym_r_confirmation_number" size="48px" color="grey-6" />
        <div class="text-h6 q-mt-sm">{{ t('track.notFound') }}</div>
      </div>

      <template v-else-if="turn">
        <div class="track__label">{{ t('track.yourNumber') }}</div>
        <div class="track__code" :style="{ color: turn.color ?? '#1A4FD6' }">{{ turn.code }}</div>
        <div class="track__section">{{ turn.section }}</div>

        <div v-if="isCalled" class="track__called">
          <q-icon name="sym_r_campaign" size="40px" />
          <div class="text-h5 text-weight-bold">{{ t('track.itsYourTurn') }}</div>
          <div class="text-h6">{{ t('track.goTo', { counter: turn.counter }) }}</div>
        </div>
        <div v-else-if="isClosed" class="track__status text-grey-8">
          {{ t(`track.status.${turn.status}`) }}
        </div>
        <div v-else class="track__status">
          <div class="track__ahead">{{ turn.ahead }}</div>
          <div>{{ t('track.ahead', { n: turn.ahead }, turn.ahead) }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">{{ t('track.keepOpen') }}</div>
        </div>
      </template>

      <div v-else class="row justify-center q-pa-xl">
        <q-spinner-dots size="40px" color="primary" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.track {
  min-height: 100vh;
  background: #f4f6fb;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.track__card {
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 12px 40px rgba(11, 33, 73, 0.12);
  padding: 32px 24px;
  width: 100%;
  max-width: 420px;
  text-align: center;
}
.track__label {
  color: #5b6475;
}
.track__code {
  font-size: 5rem;
  font-weight: 900;
  line-height: 1.05;
}
.track__section {
  font-size: 1.3rem;
  font-weight: 700;
  color: #0b2149;
}
.track__status {
  margin-top: 24px;
  font-size: 1.1rem;
}
.track__ahead {
  font-size: 3rem;
  font-weight: 800;
  color: #0b2149;
}
.track__called {
  margin-top: 24px;
  background: #00a896;
  color: #fff;
  border-radius: 18px;
  padding: 20px;
  animation: pop 0.6s ease;
}
@keyframes pop {
  0% {
    transform: scale(0.9);
  }
  60% {
    transform: scale(1.04);
  }
}
</style>
