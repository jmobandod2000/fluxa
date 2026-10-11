<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMutation, useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';

import useHandlerErrors from 'src/modules/shared/composables/useHandlerErrors';
import useNotify from 'src/modules/shared/composables/useNotify';
import { appointmentAction, bookAppointment, getAgenda, getAvailability } from '../api/queueApi';
import { useSections } from '../composables/useQueueAdmin';
import { localDate } from '../helpers/queueHelpers';
import type { Appointment, AppointmentStatus } from '../interfaces/queue';

const { t, locale } = useI18n();
const { handleApiResponseError } = useHandlerErrors();
const { successNotify } = useNotify();
const { sections } = useSections();

const date = ref(localDate());
const {
  data: agenda,
  isFetching,
  refetch,
} = useQuery({
  queryKey: ['agenda', date],
  queryFn: () => getAgenda(date.value),
  refetchInterval: 60_000,
});

const shiftDay = (days: number) => {
  const [year, month, day] = date.value.split('-').map(Number);
  date.value = localDate(new Date(year!, month! - 1, day! + days));
};
const dayLabel = computed(() => {
  const [year, month, day] = date.value.split('-').map(Number);
  const label = new Date(year!, month! - 1, day!).toLocaleDateString(locale.value, { dateStyle: 'full' });
  return label.charAt(0).toUpperCase() + label.slice(1);
});
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  BOOKED: 'primary',
  CHECKED_IN: 'positive',
  CANCELLED: 'grey-6',
  NO_SHOW: 'orange-9',
};
const counts = computed(() => ({
  total: agenda.value?.filter((item) => item.status !== 'CANCELLED').length ?? 0,
  pending: agenda.value?.filter((item) => item.status === 'BOOKED').length ?? 0,
}));

const actionMutation = useMutation({
  mutationFn: ({ id, action }: { id: number; action: 'check-in' | 'cancel' | 'no-show' }) =>
    appointmentAction(id, action),
  onSuccess: (result: { turn?: { code: string } }, { action }) => {
    if (action === 'check-in' && result.turn)
      successNotify(t('agenda.checkedIn', { code: result.turn.code }));
    void refetch();
  },
  onError: handleApiResponseError,
});

// ---------- nueva cita desde el mostrador o por teléfono ----------
const isDialogOpen = ref(false);
const draft = ref({
  sectionId: null as number | null,
  date: localDate(),
  startsAt: null as string | null,
  name: '',
  phone: '',
});
const bookable = computed(() =>
  sections.value.filter((section) => section.bookable && section.isActive),
);
const { data: slots } = useQuery({
  queryKey: [
    'agenda',
    'slots',
    computed(() => draft.value.sectionId),
    computed(() => draft.value.date),
  ],
  queryFn: () => getAvailability(draft.value.sectionId!, draft.value.date, null, true),
  enabled: computed(() => isDialogOpen.value && !!draft.value.sectionId),
});
const openDialog = () => {
  draft.value = {
    sectionId: bookable.value[0]?.id ?? null,
    date: date.value,
    startsAt: null,
    name: '',
    phone: '',
  };
  isDialogOpen.value = true;
};
const createMutation = useMutation({
  mutationFn: () =>
    bookAppointment(
      {
        sectionId: draft.value.sectionId!,
        startsAt: draft.value.startsAt!,
        customerName: draft.value.name.trim(),
        customerPhone: draft.value.phone.trim() || null,
      },
      true,
    ),
  onSuccess: () => {
    isDialogOpen.value = false;
    date.value = draft.value.date;
    void refetch();
  },
  onError: handleApiResponseError,
});

const contact = (item: Appointment) =>
  [item.customerPhone, item.customerEmail].filter(Boolean).join(' · ');
</script>

<template>
  <q-page padding>
    <div class="agenda">
      <div class="row items-center q-col-gutter-md q-mb-md">
        <div class="col-12 col-sm">
          <div class="page-title">{{ t('agenda.title') }}</div>
          <div class="text-grey-7">{{ t('agenda.subtitle', counts) }}</div>
        </div>
        <div class="col-12 col-sm-auto row items-center no-wrap q-gutter-sm">
          <q-btn flat round icon="sym_r_chevron_left" @click="shiftDay(-1)" />
          <q-btn flat no-caps :label="t('agenda.today')" @click="date = localDate()" />
          <q-btn flat round icon="sym_r_chevron_right" @click="shiftDay(1)" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="sym_r_add"
            :label="t('agenda.new')"
            :disable="!bookable.length"
            @click="openDialog"
          />
        </div>
      </div>
      <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ dayLabel }}</div>

      <q-banner v-if="!bookable.length" rounded class="bg-orange-1 text-orange-10 q-mb-md">
        {{ t('agenda.noServices') }}
      </q-banner>

      <q-card flat bordered>
        <q-linear-progress v-if="isFetching" indeterminate color="primary" />
        <q-list separator>
          <q-item v-if="!agenda?.length">
            <q-item-section class="text-grey-7 text-center q-py-lg">{{
              t('agenda.empty')
            }}</q-item-section>
          </q-item>
          <q-item
            v-for="item in agenda"
            :key="item.id"
            :class="{ agenda__muted: ['CANCELLED', 'NO_SHOW'].includes(item.status) }"
          >
            <q-item-section avatar class="agenda__time">
              <div class="text-h6 text-weight-bold">{{ formatTime(item.startsAt) }}</div>
              <div class="text-caption text-grey-7">{{ formatTime(item.endsAt) }}</div>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ item.customerName }}</q-item-label>
              <q-item-label caption>
                <q-badge :style="{ background: item.Section.color ?? '#1A4FD6' }" class="q-mr-xs">{{
                  item.Section.name
                }}</q-badge>
                {{ item.Counter.name }}<span v-if="contact(item)"> · {{ contact(item) }}</span>
              </q-item-label>
              <q-item-label v-if="item.notes" caption class="text-grey-8"
                >“{{ item.notes }}”</q-item-label
              >
            </q-item-section>
            <q-item-section side>
              <div class="row items-center no-wrap q-gutter-xs">
                <q-chip dense :color="STATUS_COLOR[item.status]" text-color="white">
                  {{ item.Turn ? item.Turn.code : t(`booking.status.${item.status}`) }}
                </q-chip>
                <template v-if="item.status === 'BOOKED'">
                  <q-btn
                    unelevated
                    dense
                    no-caps
                    color="positive"
                    icon="sym_r_how_to_reg"
                    :label="t('agenda.arrived')"
                    @click="actionMutation.mutate({ id: item.id, action: 'check-in' })"
                  />
                  <q-btn flat dense round icon="sym_r_more_vert">
                    <q-menu>
                      <q-list dense>
                        <q-item
                          v-close-popup
                          clickable
                          @click="actionMutation.mutate({ id: item.id, action: 'no-show' })"
                        >
                          <q-item-section>{{ t('agenda.noShow') }}</q-item-section>
                        </q-item>
                        <q-item
                          v-close-popup
                          clickable
                          @click="actionMutation.mutate({ id: item.id, action: 'cancel' })"
                        >
                          <q-item-section class="text-negative">{{
                            t('agenda.cancel')
                          }}</q-item-section>
                        </q-item>
                      </q-list>
                    </q-menu>
                  </q-btn>
                </template>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>

    <q-dialog v-model="isDialogOpen">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="text-h6">{{ t('agenda.new') }}</q-card-section>
        <q-form @submit.prevent="createMutation.mutate()">
          <q-card-section class="q-gutter-md q-pt-none">
            <q-select
              v-model="draft.sectionId"
              :options="bookable.map((s) => ({ value: s.id, label: s.name }))"
              :label="t('agenda.service')"
              emit-value
              map-options
              outlined
              dense
            />
            <q-input v-model="draft.date" type="date" :label="t('agenda.date')" outlined dense />
            <div class="row q-gutter-xs">
              <q-btn
                v-for="slot in slots"
                :key="slot.startsAt"
                dense
                no-caps
                :unelevated="slot.startsAt === draft.startsAt"
                :outline="slot.startsAt !== draft.startsAt"
                color="primary"
                :label="formatTime(slot.startsAt)"
                @click="draft.startsAt = slot.startsAt"
              />
              <div v-if="draft.sectionId && !slots?.length" class="text-caption text-grey-7">
                {{ t('booking.public.noSlots') }}
              </div>
            </div>
            <q-input
              v-model="draft.name"
              :label="t('booking.public.name')"
              outlined
              dense
              maxlength="80"
            />
            <q-input
              v-model="draft.phone"
              type="tel"
              :label="t('booking.public.phone')"
              outlined
              dense
              maxlength="25"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup flat no-caps :label="t('common.cancel')" />
            <q-btn
              type="submit"
              unelevated
              no-caps
              color="primary"
              :label="t('common.save')"
              :disable="!draft.startsAt || draft.name.trim().length < 2"
              :loading="createMutation.isPending.value"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.agenda {
  max-width: 1000px;
  margin: 0 auto;
}
.agenda__time {
  min-width: 80px;
}
.agenda__muted {
  opacity: 0.55;
}
</style>
