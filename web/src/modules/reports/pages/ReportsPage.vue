<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';

import useHandlerErrors from 'src/modules/shared/composables/useHandlerErrors';
import { usePublicProfile } from 'src/modules/organization/composables/useOrganization';
import { useSites } from 'src/modules/organization/composables/useSites';
import { localDate } from 'src/modules/queue/helpers/queueHelpers';
import BarChart from '../components/BarChart.vue';
import { getReport } from '../api/reportsApi';
import { exportReport } from '../helpers/exportExcel';

type Preset = 'today' | 'week' | 'month' | 'thisMonth';

const { t, locale } = useI18n();
const { handleApiResponseError } = useHandlerErrors();
const { organizationName } = usePublicProfile();
const { siteOptions } = useSites();

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDate(date);
};
const range = ref({ from: daysAgo(6), to: localDate() });
const preset = ref<Preset | null>('week');
const siteId = ref<number | null>(null);
const isExporting = ref(false);

const applyPreset = (value: Preset) => {
  preset.value = value;
  const today = new Date();
  const from = {
    today: localDate(),
    week: daysAgo(6),
    month: daysAgo(29),
    thisMonth: localDate(new Date(today.getFullYear(), today.getMonth(), 1)),
  }[value];
  range.value = { from, to: localDate() };
};

const {
  data: report,
  isFetching,
  error,
} = useQuery({
  queryKey: ['reports', range, siteId],
  queryFn: () => getReport(range.value.from, range.value.to, siteId.value),
});

const decimal = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 1 });
const minutesText = (value: number | null) =>
  value === null ? '—' : t('reports.minutes', { n: decimal(value) });
const kpis = computed(() => {
  const s = report.value?.summary;
  const a = report.value?.appointments;
  return [
    { label: t('reports.kpi.issued'), value: s?.issued ?? 0, icon: 'sym_r_confirmation_number' },
    {
      label: t('reports.kpi.served'),
      value: s?.served ?? 0,
      icon: 'sym_r_check_circle',
      caption: s?.issued ? t('reports.rate', { n: Math.round((s.served / s.issued) * 100) }) : '',
    },
    {
      label: t('reports.kpi.avgWait'),
      value: minutesText(s?.avgWait ?? null),
      icon: 'sym_r_hourglass',
      caption:
        s?.p90Wait !== null && s?.p90Wait !== undefined ? t('reports.p90', { n: decimal(s.p90Wait) }) : '',
    },
    {
      label: t('reports.kpi.avgService'),
      value: minutesText(s?.avgService ?? null),
      icon: 'sym_r_timer',
    },
    { label: t('reports.kpi.noShow'), value: s?.noShow ?? 0, icon: 'sym_r_person_off' },
    {
      label: t('reports.kpi.appointments'),
      value: a?.booked ?? 0,
      icon: 'sym_r_event_available',
      caption: a ? t('reports.checkedInOf', { n: a.checkedIn }) : '',
    },
  ];
});

const hours = computed(() =>
  (report.value?.byHour ?? [])
    .filter((row, index, all) => {
      // Solo el tramo con actividad (de la primera a la última hora con turnos)
      const active = all.filter((item) => item.issued > 0).map((item) => item.hour);
      return active.length
        ? row.hour >= Math.min(...active) && row.hour <= Math.max(...active)
        : false;
    })
    .map((row) => ({
      label: `${String(row.hour).padStart(2, '0')}h`,
      value: row.issued,
      hint: row.avgWait === null ? undefined : t('reports.waitHint', { n: decimal(row.avgWait) }),
    })),
);
const days = computed(() =>
  (report.value?.byDay ?? []).map((row) => {
    const [year, month, day] = row.date.split('-').map(Number);
    return {
      label: new Date(year!, month! - 1, day!).toLocaleDateString(locale.value, {
        day: '2-digit',
        month: 'short',
      }),
      value: row.issued,
      hint: t('reports.servedHint', { n: row.served }),
    };
  }),
);
const peakHour = computed(() => {
  const busiest = [...(report.value?.byHour ?? [])].sort((a, b) => b.issued - a.issued)[0];
  return busiest && busiest.issued ? `${String(busiest.hour).padStart(2, '0')}:00` : null;
});

const sectionColumns = computed(() => [
  { name: 'section', label: t('reports.section'), field: 'section', align: 'left' as const },
  { name: 'issued', label: t('reports.kpi.issued'), field: 'issued' },
  { name: 'served', label: t('reports.kpi.served'), field: 'served' },
  { name: 'noShow', label: t('reports.kpi.noShow'), field: 'noShow' },
  { name: 'avgWait', label: t('reports.kpi.avgWait'), field: 'avgWait', format: minutesText },
  {
    name: 'avgService',
    label: t('reports.kpi.avgService'),
    field: 'avgService',
    format: minutesText,
  },
]);
const staffColumns = computed(() => [
  { name: 'staff', label: t('reports.staff'), field: 'staff', align: 'left' as const },
  ...sectionColumns.value.slice(2),
]);

const download = async () => {
  if (!report.value) return;
  isExporting.value = true;
  try {
    await exportReport(report.value, organizationName.value ?? '', t);
  } catch (err) {
    handleApiResponseError(err);
  } finally {
    isExporting.value = false;
  }
};
</script>

<template>
  <q-page padding>
    <div class="reports">
      <div class="row items-center q-col-gutter-md q-mb-md">
        <div class="col-12 col-md">
          <div class="page-title">{{ t('reports.title') }}</div>
          <div class="text-grey-7">{{ t('reports.subtitle') }}</div>
        </div>
        <div class="col-12 col-md-auto">
          <q-btn
            unelevated
            no-caps
            color="positive"
            icon="sym_r_download"
            :label="t('reports.excel')"
            :loading="isExporting"
            :disable="!report?.summary.issued"
            @click="download"
          />
        </div>
      </div>

      <q-card flat bordered class="q-mb-md">
        <q-card-section class="row items-center q-col-gutter-sm">
          <div class="col-12 col-md-auto">
            <q-btn-toggle
              v-model="preset"
              no-caps
              unelevated
              toggle-color="primary"
              :options="[
                { label: t('reports.presets.today'), value: 'today' },
                { label: t('reports.presets.week'), value: 'week' },
                { label: t('reports.presets.month'), value: 'month' },
                { label: t('reports.presets.thisMonth'), value: 'thisMonth' },
              ]"
              @update:model-value="applyPreset"
            />
          </div>
          <div class="col-6 col-md-2">
            <q-input
              v-model="range.from"
              type="date"
              :label="t('reports.from')"
              outlined
              dense
              @update:model-value="preset = null"
            />
          </div>
          <div class="col-6 col-md-2">
            <q-input
              v-model="range.to"
              type="date"
              :label="t('reports.to')"
              outlined
              dense
              @update:model-value="preset = null"
            />
          </div>
          <div v-if="siteOptions.length > 1" class="col-12 col-md-3">
            <q-select
              v-model="siteId"
              :options="[{ value: null, label: t('home.allSites') }, ...siteOptions]"
              :label="t('home.site')"
              emit-value
              map-options
              outlined
              dense
            />
          </div>
        </q-card-section>
        <q-linear-progress v-if="isFetching" indeterminate color="primary" />
      </q-card>

      <q-banner v-if="error" rounded class="bg-red-1 text-red-10 q-mb-md">{{
        (error as any)?.response?.data?.message ?? t('errors.request')
      }}</q-banner>

      <div class="row q-col-gutter-md q-mb-md">
        <div v-for="kpi in kpis" :key="kpi.label" class="col-6 col-md-4 col-lg-2">
          <q-card flat bordered class="full-height q-pa-md">
            <div class="row no-wrap items-start">
              <div class="col">
                <div class="text-caption text-grey-7">{{ kpi.label }}</div>
                <div class="text-h5 text-weight-bold">{{ kpi.value }}</div>
                <div v-if="kpi.caption" class="text-caption text-grey-6">{{ kpi.caption }}</div>
              </div>
              <q-icon :name="kpi.icon" size="26px" color="grey-5" />
            </div>
          </q-card>
        </div>
      </div>

      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-6">
          <BarChart
            :title="peakHour ? t('reports.byHourPeak', { hour: peakHour }) : t('reports.byHour')"
            :items="hours"
            :value-label="t('reports.kpi.issued')"
            highlight-max
          />
        </div>
        <div class="col-12 col-md-6">
          <BarChart
            :title="t('reports.byDay')"
            :items="days"
            :value-label="t('reports.kpi.issued')"
            color="#0B2149"
          />
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12 col-lg-6">
          <q-table
            flat
            bordered
            dense
            :title="t('reports.bySection')"
            :rows="report?.bySection ?? []"
            :columns="sectionColumns"
            row-key="section"
            hide-pagination
            :rows-per-page-options="[0]"
            :no-data-label="t('reports.noData')"
          />
        </div>
        <div class="col-12 col-lg-6">
          <q-table
            flat
            bordered
            dense
            :title="t('reports.byStaff')"
            :rows="report?.byStaff ?? []"
            :columns="staffColumns"
            row-key="staff"
            hide-pagination
            :rows-per-page-options="[0]"
            :no-data-label="t('reports.noData')"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.reports {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
