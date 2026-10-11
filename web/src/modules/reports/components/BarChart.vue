<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

export interface BarItem {
  label: string;
  value: number;
  hint?: string | undefined;
}

interface Props {
  title: string;
  items: BarItem[];
  color?: string;
  valueLabel: string;
  highlightMax?: boolean;
}

const props = withDefaults(defineProps<Props>(), { color: '#1A4FD6', highlightMax: false });
const { t } = useI18n();
const isTable = ref(false);

const HEIGHT = 180;
const max = computed(() => Math.max(1, ...props.items.map((item) => item.value)));
const peak = computed(() =>
  props.highlightMax ? Math.max(...props.items.map((item) => item.value)) : -1,
);
const heightOf = (value: number) => `${value ? Math.max(3, (value / max.value) * HEIGHT) : 0}px`;
</script>

<template>
  <q-card flat bordered class="full-height">
    <q-card-section class="row items-center q-pb-sm">
      <div class="col text-subtitle2">{{ title }}</div>
      <q-btn
        flat
        dense
        no-caps
        size="sm"
        :icon="isTable ? 'sym_r_bar_chart' : 'sym_r_table'"
        :label="isTable ? t('reports.chart') : t('reports.table')"
        @click="isTable = !isTable"
      />
    </q-card-section>
    <q-card-section class="q-pt-none">
      <div v-if="!items.length" class="text-grey-6 text-italic">{{ t('reports.noData') }}</div>
      <q-markup-table v-else-if="isTable" flat dense separator="horizontal">
        <thead>
          <tr>
            <th class="text-left"></th>
            <th class="text-right">{{ valueLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.label">
            <td>{{ item.label }}</td>
            <td class="text-right">
              {{ item.value }}<span v-if="item.hint" class="text-grey-7"> · {{ item.hint }}</span>
            </td>
          </tr>
        </tbody>
      </q-markup-table>
      <div v-else class="chart" :style="{ height: `${HEIGHT + 28}px` }">
        <div v-for="item in items" :key="item.label" class="chart__col">
          <div
            class="chart__bar"
            :style="{
              height: heightOf(item.value),
              background: item.value === peak && peak > 0 ? '#EC4899' : color,
            }"
          >
            <q-tooltip
              >{{ item.label }}: {{ item.value }} {{ valueLabel.toLowerCase()
              }}<span v-if="item.hint"> · {{ item.hint }}</span></q-tooltip
            >
          </div>
          <div class="chart__label">{{ item.label }}</div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid #e3e7ef;
}
.chart__col {
  flex: 1 0 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
}
.chart__bar {
  width: 70%;
  max-width: 28px;
  border-radius: 4px 4px 0 0;
  transition: opacity 0.15s;
}
.chart__bar:hover {
  opacity: 0.8;
}
.chart__label {
  font-size: 0.7rem;
  color: #5b6475;
  height: 24px;
  line-height: 24px;
  white-space: nowrap;
}
</style>
