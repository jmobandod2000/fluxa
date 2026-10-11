<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';

import useHandlerErrors from 'src/modules/shared/composables/useHandlerErrors';
import { bookAppointment, getAvailability, getBookingConfig } from '../api/queueApi';
import useVocabulary from '../composables/useVocabulary';
import { localDate } from '../helpers/queueHelpers';
import { QueueRoutes, type BookableService } from '../interfaces/queue';

const { t, locale } = useI18n();
const router = useRouter();
const { handleApiResponseError } = useHandlerErrors();

const { data: config, isLoading } = useQuery({
  queryKey: ['booking', 'config'],
  queryFn: getBookingConfig,
});
const businessType = computed(() => config.value?.businessType ?? null);
const { counterWord } = useVocabulary(businessType);

const step = ref(1);
const service = ref<BookableService | null>(null);
const counterId = ref<number | null>(null);
const date = ref(localDate());
const startsAt = ref<string | null>(null);
const form = ref({
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  notes: '',
  website: '',
});
const isSaving = ref(false);

const days = computed(() =>
  Array.from({ length: config.value?.bookingDays ?? 14 }, (_, index) => {
    const value = new Date();
    value.setDate(value.getDate() + index);
    return {
      value: localDate(value),
      weekday: value.toLocaleDateString(locale.value, { weekday: 'short' }),
      day: value.getDate(),
      month: value.toLocaleDateString(locale.value, { month: 'short' }),
    };
  }),
);

const { data: slots, isFetching: loadingSlots } = useQuery({
  queryKey: ['booking', 'slots', service, counterId, date],
  queryFn: () => getAvailability(service.value!.id, date.value, counterId.value),
  enabled: computed(() => !!service.value && step.value === 2),
});

watch([service, counterId, date], () => (startsAt.value = null));

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
const selectedLabel = computed(() =>
  startsAt.value
    ? new Date(startsAt.value).toLocaleString(locale.value, {
        dateStyle: 'full',
        timeStyle: 'short',
      })
    : '',
);

const chooseService = (item: BookableService) => {
  service.value = item;
  counterId.value = null;
  step.value = 2;
};

const contactRule = () =>
  !!form.value.customerPhone.trim() ||
  !!form.value.customerEmail.trim() ||
  t('booking.public.contactRequired');

const confirm = async () => {
  if (!service.value || !startsAt.value) return;
  isSaving.value = true;
  try {
    const appointment = await bookAppointment({
      sectionId: service.value.id,
      counterId: counterId.value,
      startsAt: startsAt.value,
      customerName: form.value.customerName.trim(),
      customerPhone: form.value.customerPhone.trim() || null,
      customerEmail: form.value.customerEmail.trim() || null,
      notes: form.value.notes.trim() || null,
      website: form.value.website,
    });
    await router.push({
      name: QueueRoutes.APPOINTMENT,
      params: { token: appointment.token },
      query: { nueva: '1' },
    });
  } catch (error) {
    handleApiResponseError(error);
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="booking">
    <div class="booking__card">
      <div class="booking__business">{{ config?.name }}</div>
      <h1 class="booking__title">{{ t('booking.public.title') }}</h1>

      <div v-if="isLoading" class="row justify-center q-pa-xl">
        <q-spinner-dots size="40px" color="primary" />
      </div>

      <div
        v-else-if="!config?.enabled || !config.services.length"
        class="text-center q-pa-lg text-grey-8"
      >
        <q-icon name="sym_r_event_busy" size="48px" color="grey-6" />
        <div class="q-mt-sm">{{ t('booking.public.unavailable') }}</div>
      </div>

      <q-stepper v-else v-model="step" flat animated color="primary" class="booking__stepper">
        <q-step
          :name="1"
          :title="t('booking.public.stepService')"
          icon="sym_r_list"
          :done="step > 1"
        >
          <div class="column q-gutter-sm">
            <q-btn
              v-for="item in config.services"
              :key="item.id"
              outline
              no-caps
              align="left"
              class="booking__service"
              :style="{ borderColor: item.color ?? '#1A4FD6' }"
              @click="chooseService(item)"
            >
              <div class="column items-start">
                <div class="text-subtitle1 text-weight-bold">{{ item.name }}</div>
                <div class="text-caption text-grey-7">
                  {{ t('sections.minutes', { n: item.durationMinutes }) }}
                </div>
              </div>
            </q-btn>
          </div>
        </q-step>

        <q-step
          :name="2"
          :title="t('booking.public.stepTime')"
          icon="sym_r_schedule"
          :done="step > 2"
        >
          <q-select
            v-if="(service?.counters.length ?? 0) > 1"
            v-model="counterId"
            :options="[
              { value: null, label: t('booking.public.anyone') },
              ...(service?.counters ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]"
            :label="counterWord"
            emit-value
            map-options
            outlined
            dense
            class="q-mb-md"
          />
          <div class="booking__days">
            <button
              v-for="day in days"
              :key="day.value"
              type="button"
              class="booking__day"
              :class="{ 'booking__day--active': day.value === date }"
              @click="date = day.value"
            >
              <span class="text-caption">{{ day.weekday }}</span>
              <span class="text-h6 text-weight-bold">{{ day.day }}</span>
              <span class="text-caption">{{ day.month }}</span>
            </button>
          </div>
          <div v-if="loadingSlots" class="row justify-center q-pa-md">
            <q-spinner-dots size="32px" color="primary" />
          </div>
          <div v-else-if="!slots?.length" class="text-grey-7 q-pa-md text-center">
            {{ t('booking.public.noSlots') }}
          </div>
          <div v-else class="booking__slots">
            <q-btn
              v-for="slot in slots"
              :key="slot.startsAt"
              no-caps
              :unelevated="slot.startsAt === startsAt"
              :outline="slot.startsAt !== startsAt"
              color="primary"
              :label="formatTime(slot.startsAt)"
              @click="startsAt = slot.startsAt"
            />
          </div>
          <q-stepper-navigation class="row justify-between">
            <q-btn flat no-caps :label="t('setup.back')" @click="step = 1" />
            <q-btn
              unelevated
              no-caps
              color="primary"
              :label="t('setup.continue')"
              :disable="!startsAt"
              @click="step = 3"
            />
          </q-stepper-navigation>
        </q-step>

        <q-step :name="3" :title="t('booking.public.stepData')" icon="sym_r_person">
          <div class="booking__summary">
            <q-icon name="sym_r_event" color="primary" size="22px" />
            <div>
              <div class="text-weight-bold">{{ service?.name }}</div>
              <div class="text-caption">{{ selectedLabel }}</div>
            </div>
          </div>
          <q-form class="q-gutter-sm" @submit.prevent="confirm">
            <q-input
              v-model="form.customerName"
              :label="t('booking.public.name')"
              outlined
              maxlength="80"
              :rules="[(v: string) => v.trim().length >= 2 || t('booking.public.nameRequired')]"
            />
            <q-input
              v-model="form.customerPhone"
              type="tel"
              :label="t('booking.public.phone')"
              outlined
              maxlength="25"
              :rules="[contactRule]"
            />
            <q-input
              v-model="form.customerEmail"
              type="email"
              :label="t('booking.public.email')"
              :hint="t('booking.public.emailHint')"
              outlined
              maxlength="254"
            />
            <q-input
              v-model="form.notes"
              :label="t('booking.public.notes')"
              outlined
              maxlength="300"
              autogrow
            />
            <input
              v-model="form.website"
              type="text"
              name="website"
              tabindex="-1"
              autocomplete="off"
              class="booking__trap"
              aria-hidden="true"
            />
            <q-stepper-navigation class="row justify-between">
              <q-btn flat no-caps :label="t('setup.back')" @click="step = 2" />
              <q-btn
                type="submit"
                unelevated
                no-caps
                color="primary"
                icon="sym_r_event_available"
                :label="t('booking.public.confirm')"
                :loading="isSaving"
              />
            </q-stepper-navigation>
          </q-form>
        </q-step>
      </q-stepper>
    </div>
  </div>
</template>

<style scoped>
.booking {
  min-height: 100vh;
  background: linear-gradient(160deg, #0b2149 0%, #1a1f5e 60%, #3a1d4f 100%);
  padding: 24px 12px;
  display: flex;
  justify-content: center;
}
.booking__card {
  background: #fff;
  border-radius: 24px;
  width: 100%;
  max-width: 640px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  align-self: flex-start;
}
.booking__business {
  color: #ec4899;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 0.85rem;
}
.booking__title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #0b2149;
  margin: 4px 0 8px;
  line-height: 1.2;
}
.booking__stepper :deep(.q-stepper__header) {
  border-bottom: none;
}
.booking__service {
  border-radius: 14px;
  border-left-width: 6px;
  padding: 10px 14px;
  justify-content: flex-start;
}
.booking__days {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.booking__day {
  min-width: 64px;
  border: 1px solid #d6dbe6;
  background: #fff;
  border-radius: 14px;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  font-family: inherit;
  color: #0b2149;
}
.booking__day--active {
  background: #0b2149;
  color: #fff;
  border-color: #0b2149;
}
.booking__slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.booking__summary {
  display: flex;
  gap: 10px;
  align-items: center;
  background: #eef3ff;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 12px;
}
.booking__trap {
  position: absolute;
  left: -9999px;
  height: 0;
  width: 0;
  opacity: 0;
}
</style>
