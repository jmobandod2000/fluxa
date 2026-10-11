<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { copyToClipboard } from 'quasar';
import { useI18n } from 'vue-i18n';

import useNotify from 'src/modules/shared/composables/useNotify';
import useVueQuery from 'src/modules/shared/composables/useVueQuery';
import {
  PUBLIC_PROFILE_KEY,
  useOrganization,
} from 'src/modules/organization/composables/useOrganization';
import { useCounters, useSections } from '../composables/useQueueAdmin';
import { buildBookingUrl } from '../helpers/queueHelpers';
import QrCode from './QrCode.vue';

const { t } = useI18n();
const { successNotify, errorNotify } = useNotify();
const { invalidQuery } = useVueQuery();
const { organization, saveMutation } = useOrganization();
const { sections } = useSections();
const { counters } = useCounters();

const enabled = ref(false);
const days = ref(14);
const bookingUrl = computed(() => buildBookingUrl());

watch(
  organization,
  (value) => {
    enabled.value = value?.bookingEnabled ?? false;
    days.value = value?.bookingDays ?? 14;
  },
  { immediate: true },
);

// Lista de lo que falta para que la reserva funcione
const checklist = computed(() => [
  {
    done: sections.value.some((section) => section.bookable && section.isActive),
    label: t('booking.check.services'),
  },
  {
    done: counters.value.some((counter) => counter.Schedules.length > 0),
    label: t('booking.check.schedules'),
  },
]);

const save = () => {
  const current = organization.value;
  if (!current) return;
  saveMutation.mutate(
    {
      name: current.name,
      taxId: current.taxId,
      email: current.email,
      phone: current.phone,
      address: current.address,
      website: current.website,
      bookingEnabled: enabled.value,
      bookingDays: days.value,
    },
    { onSuccess: () => invalidQuery({ queryKey: PUBLIC_PROFILE_KEY }) },
  );
};

const copy = async () => {
  try {
    await copyToClipboard(bookingUrl.value);
    successNotify(t('common.copied'));
  } catch {
    errorNotify(t('common.copyFailed'));
  }
};
</script>

<template>
  <div class="q-gutter-md">
    <div class="text-body2 text-grey-8">{{ t('booking.settingsHint') }}</div>

    <q-card flat bordered>
      <q-card-section class="row items-center no-wrap q-gutter-md">
        <q-toggle v-model="enabled" color="positive" size="lg" />
        <div class="col">
          <div class="text-subtitle1 text-weight-medium">
            {{ enabled ? t('booking.enabled') : t('booking.disabled') }}
          </div>
          <div class="text-caption text-grey-7">{{ t('booking.enabledHint') }}</div>
        </div>
        <q-input
          v-model.number="days"
          type="number"
          min="1"
          max="90"
          :label="t('booking.days')"
          outlined
          dense
          style="width: 150px"
        />
      </q-card-section>
    </q-card>

    <q-list bordered class="rounded-borders">
      <q-item v-for="item in checklist" :key="item.label" dense>
        <q-item-section avatar>
          <q-icon
            :name="item.done ? 'sym_r_check_circle' : 'sym_r_radio_button_unchecked'"
            :color="item.done ? 'positive' : 'grey-5'"
          />
        </q-item-section>
        <q-item-section>{{ item.label }}</q-item-section>
      </q-item>
    </q-list>

    <q-card flat bordered>
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col-12 col-sm">
          <div class="text-subtitle2">{{ t('booking.linkTitle') }}</div>
          <q-input :model-value="bookingUrl" readonly outlined dense class="q-mt-sm">
            <template #append>
              <q-btn flat round dense icon="sym_r_content_copy" @click="copy" />
              <q-btn
                flat
                round
                dense
                icon="sym_r_open_in_new"
                :href="bookingUrl"
                target="_blank"
                rel="noopener"
              />
            </template>
          </q-input>
          <div class="text-caption text-grey-7 q-mt-xs">{{ t('booking.linkHint') }}</div>
        </div>
        <div class="col-12 col-sm-auto"><QrCode :value="bookingUrl" :size="120" /></div>
      </q-card-section>
    </q-card>

    <div class="row justify-end">
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_r_save"
        :label="t('common.save')"
        :loading="saveMutation.isPending.value"
        @click="save"
      />
    </div>
  </div>
</template>
