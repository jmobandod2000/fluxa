<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ScheduleBlock } from '../interfaces/queue';

// Lunes a domingo (0 = domingo, como Date.getDay)
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_START = 9 * 60;
const DEFAULT_END = 18 * 60;

const blocks = defineModel<ScheduleBlock[]>({ required: true });
const { t } = useI18n();

const toTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const toMinute = (value: string | number | null) => {
  const [hours, minutes] = String(value ?? '00:00')
    .split(':')
    .map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

const days = computed(() =>
  WEEK.map((weekday) => ({
    weekday,
    block: blocks.value.find((block) => block.weekday === weekday) ?? null,
  })),
);

const toggle = (weekday: number, enabled: boolean) => {
  blocks.value = enabled
    ? [...blocks.value, { weekday, startMinute: DEFAULT_START, endMinute: DEFAULT_END }]
    : blocks.value.filter((block) => block.weekday !== weekday);
};

const update = (
  weekday: number,
  field: 'startMinute' | 'endMinute',
  value: string | number | null,
) => {
  blocks.value = blocks.value.map((block) =>
    block.weekday === weekday ? { ...block, [field]: toMinute(value) } : block,
  );
};

const copyMonday = () => {
  const monday = blocks.value.find((block) => block.weekday === 1);
  if (!monday) return;
  blocks.value = [1, 2, 3, 4, 5].map((weekday) => ({ ...monday, weekday }));
};
</script>

<template>
  <div class="q-gutter-xs">
    <div
      v-for="{ weekday, block } in days"
      :key="weekday"
      class="row items-center no-wrap q-gutter-sm"
    >
      <q-toggle
        :model-value="!!block"
        dense
        class="schedule-day"
        :label="t(`schedule.days.${weekday}`)"
        @update:model-value="(enabled) => toggle(weekday, enabled)"
      />
      <template v-if="block">
        <q-input
          :model-value="toTime(block.startMinute)"
          type="time"
          dense
          outlined
          class="schedule-time"
          @update:model-value="(value) => update(weekday, 'startMinute', value)"
        />
        <span class="text-grey-7">–</span>
        <q-input
          :model-value="toTime(block.endMinute)"
          type="time"
          dense
          outlined
          class="schedule-time"
          :error="block.endMinute <= block.startMinute"
          hide-bottom-space
          @update:model-value="(value) => update(weekday, 'endMinute', value)"
        />
      </template>
      <span v-else class="text-caption text-grey-6">{{ t('schedule.closed') }}</span>
    </div>
    <q-btn
      v-if="blocks.some((block) => block.weekday === 1)"
      flat
      dense
      no-caps
      size="sm"
      color="primary"
      icon="sym_r_content_copy"
      :label="t('schedule.copyWeekdays')"
      @click="copyMonday"
    />
  </div>
</template>

<style scoped>
.schedule-day {
  width: 120px;
}
.schedule-time {
  width: 120px;
}
</style>
