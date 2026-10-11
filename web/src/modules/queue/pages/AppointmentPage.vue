<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useMutation, useQuery } from '@tanstack/vue-query';
import { useQuasar } from 'quasar';
import { isAxiosError } from 'axios';
import { useI18n } from 'vue-i18n';

import useHandlerErrors from 'src/modules/shared/composables/useHandlerErrors';
import QrCode from '../components/QrCode.vue';
import { cancelPublicAppointment, getPublicAppointment } from '../api/queueApi';
import { QueueRoutes } from '../interfaces/queue';

const { t, locale } = useI18n();
const route = useRoute();
const $q = useQuasar();
const { handleApiResponseError } = useHandlerErrors();
const token = computed(() => String(route.params.token ?? ''));
const isNew = computed(() => route.query.nueva === '1');

const {
  data: appointment,
  error,
  refetch,
} = useQuery({
  queryKey: ['booking', 'appointment', token],
  queryFn: () => getPublicAppointment(token.value),
  retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 2,
});

const notFound = computed(() => isAxiosError(error.value) && error.value.response?.status === 404);
const when = computed(() =>
  appointment.value
    ? new Date(appointment.value.startsAt).toLocaleString(locale.value, {
        dateStyle: 'full',
        timeStyle: 'short',
      })
    : '',
);
const pageUrl = computed(() => window.location.href.split('?')[0] ?? '');
const canCancel = computed(
  () =>
    appointment.value?.status === 'BOOKED' &&
    new Date(appointment.value.startsAt).getTime() > Date.now(),
);

const cancelMutation = useMutation({
  mutationFn: () => cancelPublicAppointment(token.value),
  onSuccess: () => void refetch(),
  onError: handleApiResponseError,
});

const confirmCancel = () =>
  $q
    .dialog({
      title: t('booking.appointment.cancelTitle'),
      message: t('booking.appointment.cancelMessage'),
      cancel: { label: t('booking.appointment.keep'), flat: true, noCaps: true },
      ok: {
        label: t('booking.appointment.cancel'),
        color: 'negative',
        unelevated: true,
        noCaps: true,
      },
    })
    .onOk(() => cancelMutation.mutate());
</script>

<template>
  <div class="appointment">
    <div class="appointment__card">
      <div v-if="notFound" class="text-center q-pa-lg">
        <q-icon name="sym_r_event_busy" size="48px" color="grey-6" />
        <div class="text-h6 q-mt-sm">{{ t('booking.appointment.notFound') }}</div>
      </div>

      <template v-else-if="appointment">
        <q-banner
          v-if="isNew && appointment.status === 'BOOKED'"
          rounded
          class="bg-green-1 text-green-10 q-mb-md"
        >
          <template #avatar><q-icon name="sym_r_check_circle" color="positive" /></template>
          {{ t('booking.appointment.confirmed') }}
        </q-banner>
        <div class="text-caption text-grey-7">{{ t('booking.appointment.title') }}</div>
        <div class="appointment__service" :style="{ color: appointment.color ?? '#0B2149' }">
          {{ appointment.service }}
        </div>
        <div class="text-h6 text-weight-medium">{{ when }}</div>
        <div class="text-body1 text-grey-8">
          {{ appointment.counter }} · {{ appointment.customerName }}
        </div>

        <q-chip
          class="q-mt-md"
          :color="
            appointment.status === 'BOOKED'
              ? 'primary'
              : appointment.status === 'CHECKED_IN'
                ? 'positive'
                : 'grey-6'
          "
          text-color="white"
        >
          {{ t(`booking.status.${appointment.status}`) }}
        </q-chip>
        <div v-if="appointment.turn" class="q-mt-sm">
          {{ t('booking.appointment.turn') }} <b>{{ appointment.turn.code }}</b>
        </div>

        <div v-if="appointment.status === 'BOOKED'" class="row items-center q-gutter-md q-mt-lg">
          <QrCode :value="pageUrl" :size="110" />
          <div class="col text-body2 text-grey-8">{{ t('booking.appointment.arrive') }}</div>
        </div>

        <div class="row justify-between q-mt-lg">
          <q-btn
            flat
            no-caps
            color="primary"
            icon="sym_r_add"
            :label="t('booking.appointment.another')"
            :to="{ name: QueueRoutes.BOOKING }"
          />
          <q-btn
            v-if="canCancel"
            outline
            no-caps
            color="negative"
            icon="sym_r_event_busy"
            :label="t('booking.appointment.cancel')"
            :loading="cancelMutation.isPending.value"
            @click="confirmCancel"
          />
        </div>
      </template>

      <div v-else class="row justify-center q-pa-xl">
        <q-spinner-dots size="40px" color="primary" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.appointment {
  min-height: 100vh;
  background: #f4f6fb;
  padding: 24px 12px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.appointment__card {
  background: #fff;
  border-radius: 24px;
  width: 100%;
  max-width: 520px;
  padding: 28px 24px;
  box-shadow: 0 12px 40px rgba(11, 33, 73, 0.12);
}
.appointment__service {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.15;
}
</style>
