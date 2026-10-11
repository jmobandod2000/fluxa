<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useQueueAdminMutations, useSections } from '../composables/useQueueAdmin';
import type { Section, SectionPayload } from '../interfaces/queue';

const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];
const COLORS: string[] = [
  '#1A4FD6',
  '#00A896',
  '#E11D48',
  '#F59E0B',
  '#7C3AED',
  '#0EA5E9',
  '#16A34A',
  '#64748B',
];

const { t } = useI18n();
const $q = useQuasar();
const { sections, isFetching } = useSections();
const { saveSection, toggleSection, removeSection } = useQueueAdminMutations();

const isDialogOpen = ref(false);
const editingId = ref<number | undefined>();
const form = ref<SectionPayload>({
  name: '',
  prefix: '',
  description: null,
  color: '#1A4FD6',
  bookable: false,
  durationMinutes: 30,
});

const openDialog = (section?: Section) => {
  editingId.value = section?.id;
  form.value = {
    name: section?.name ?? '',
    prefix: section?.prefix ?? '',
    description: section?.description ?? null,
    color: section?.color ?? COLORS[sections.value.length % COLORS.length] ?? null,
    bookable: section?.bookable ?? false,
    durationMinutes: section?.durationMinutes ?? 30,
  };
  isDialogOpen.value = true;
};

const submit = () =>
  saveSection.mutate(
    {
      id: editingId.value,
      payload: {
        ...form.value,
        name: form.value.name.trim(),
        prefix: form.value.prefix.toUpperCase(),
      },
    },
    { onSuccess: () => (isDialogOpen.value = false) },
  );

const confirmRemove = (section: Section) =>
  $q
    .dialog({
      title: t('sections.deleteTitle'),
      message: t('sections.deleteMessage', { name: section.name }),
      cancel: true,
      ok: { label: t('common.delete'), color: 'negative', unelevated: true },
    })
    .onOk(() => removeSection.mutate(section.id));

const nameRule = (value: string) => (value?.trim().length ?? 0) >= 2 || t('sections.rules.name');
const prefixRule = (value: string) =>
  /^[A-Za-z]{1,3}$/.test(value ?? '') || t('sections.rules.prefix');
</script>

<template>
  <div class="q-gutter-md">
    <div class="row items-center">
      <div class="col text-body2 text-grey-8">{{ t('sections.description') }}</div>
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_r_add"
        :label="t('sections.add')"
        @click="openDialog()"
      />
    </div>

    <q-list bordered separator class="rounded-borders">
      <q-item v-if="!sections.length && !isFetching">
        <q-item-section class="text-grey-7">{{ t('sections.empty') }}</q-item-section>
      </q-item>
      <q-item v-for="section in sections" :key="section.id">
        <q-item-section avatar>
          <q-avatar
            :style="{ background: section.color ?? '#1A4FD6' }"
            text-color="white"
            class="text-weight-bold"
          >
            {{ section.prefix }}
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ section.name }}</q-item-label>
          <q-item-label caption>{{
            t('sections.example', { code: `${section.prefix}-001` })
          }}</q-item-label>
          <q-item-label v-if="section.bookable" caption class="text-primary">
            <q-icon name="sym_r_event_available" size="14px" />
            {{ t('sections.bookableBadge', { n: section.durationMinutes }) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row items-center no-wrap q-gutter-xs">
            <q-toggle
              :model-value="section.isActive"
              color="positive"
              @update:model-value="(isActive) => toggleSection.mutate({ id: section.id, isActive })"
            >
              <q-tooltip>{{
                section.isActive ? t('common.active') : t('common.inactive')
              }}</q-tooltip>
            </q-toggle>
            <q-btn flat round dense icon="sym_r_edit" @click="openDialog(section)" />
            <q-btn
              flat
              round
              dense
              color="negative"
              icon="sym_r_delete"
              @click="confirmRemove(section)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <q-dialog v-model="isDialogOpen">
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ editingId ? t('sections.editTitle') : t('sections.createTitle') }}
        </q-card-section>
        <q-form @submit.prevent="submit">
          <q-card-section class="row q-col-gutter-md q-pt-none">
            <div class="col-12 col-sm-8">
              <q-input
                v-model="form.name"
                :label="t('sections.fields.name')"
                outlined
                autofocus
                maxlength="60"
                :rules="[nameRule]"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                v-model="form.prefix"
                :label="t('sections.fields.prefix')"
                :hint="t('sections.hints.prefix')"
                outlined
                maxlength="3"
                input-class="text-uppercase"
                :rules="[prefixRule]"
              />
            </div>
            <div class="col-12 row items-center q-gutter-md">
              <q-toggle
                v-model="form.bookable"
                color="primary"
                :label="t('sections.fields.bookable')"
              />
              <q-select
                v-if="form.bookable"
                v-model="form.durationMinutes"
                :options="DURATIONS"
                :option-label="(value: number) => t('sections.minutes', { n: value })"
                :label="t('sections.fields.duration')"
                outlined
                dense
                style="min-width: 150px"
              />
            </div>
            <div class="col-12">
              <div class="text-caption text-grey-8 q-mb-xs">{{ t('sections.fields.color') }}</div>
              <div class="row q-gutter-sm">
                <q-btn
                  v-for="color in COLORS"
                  :key="color"
                  round
                  unelevated
                  size="sm"
                  :style="{ background: color }"
                  :icon="form.color === color ? 'sym_r_check' : undefined"
                  text-color="white"
                  @click="form.color = color"
                />
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup flat no-caps :label="t('common.cancel')" />
            <q-btn
              type="submit"
              unelevated
              no-caps
              color="primary"
              :label="t('common.save')"
              :loading="saveSection.isPending.value"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </div>
</template>
