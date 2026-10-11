<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

import { formatSite, useSites } from 'src/modules/organization/composables/useSites';
import { usePublicProfile } from 'src/modules/organization/composables/useOrganization';
import { useCounters, useQueueAdminMutations, useSections } from '../composables/useQueueAdmin';
import useVocabulary from '../composables/useVocabulary';
import type { Counter, CounterPayload } from '../interfaces/queue';

const { t } = useI18n();
const $q = useQuasar();
const { counters, isFetching } = useCounters();
const { sectionOptions } = useSections();
const { siteOptions } = useSites();
const { businessType } = usePublicProfile();
const { counterWord } = useVocabulary(businessType);
const { saveCounter, removeCounter } = useQueueAdminMutations();

const isDialogOpen = ref(false);
const editingId = ref<number | undefined>();
const form = ref<CounterPayload>({ name: '', siteId: null, sectionIds: [] });
const siteChoices = computed(() => [{ value: null, label: t('counters.allSites') }, ...siteOptions.value]);

const openDialog = (counter?: Counter) => {
  editingId.value = counter?.id;
  form.value = {
    name: counter?.name ?? `${counterWord.value} ${counters.value.length + 1}`,
    siteId: counter?.siteId ?? null,
    sectionIds: counter?.Sections.map(({ id }) => id) ?? sectionOptions.value.map(({ value }) => value),
  };
  isDialogOpen.value = true;
};

const submit = () =>
  saveCounter.mutate(
    { id: editingId.value, payload: { ...form.value, name: form.value.name.trim() } },
    { onSuccess: () => (isDialogOpen.value = false) },
  );

const confirmRemove = (counter: Counter) =>
  $q
    .dialog({
      title: t('counters.deleteTitle'),
      message: t('counters.deleteMessage', { name: counter.name }),
      cancel: true,
      ok: { label: t('common.delete'), color: 'negative', unelevated: true },
    })
    .onOk(() => removeCounter.mutate(counter.id));

const nameRule = (value: string) => (value?.trim().length ?? 0) >= 1 || t('counters.rules.name');
const sectionsRule = (value: number[]) => value.length > 0 || t('counters.rules.sections');
</script>

<template>
  <div class="q-gutter-md">
    <div class="row items-center">
      <div class="col text-body2 text-grey-8">{{ t('counters.description', { counter: counterWord }) }}</div>
      <q-btn unelevated no-caps color="primary" icon="sym_r_add" :label="t('counters.add', { counter: counterWord })" @click="openDialog()" />
    </div>

    <q-list bordered separator class="rounded-borders">
      <q-item v-if="!counters.length && !isFetching">
        <q-item-section class="text-grey-7">{{ t('counters.empty') }}</q-item-section>
      </q-item>
      <q-item v-for="counter in counters" :key="counter.id">
        <q-item-section avatar><q-icon name="sym_r_storefront" color="primary" /></q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ counter.name }}</q-item-label>
          <q-item-label caption>
            {{ counter.Site ? formatSite(counter.Site) : t('counters.allSites') }} ·
            {{ counter.Sections.map((section) => section.name).join(', ') || t('counters.noSections') }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row no-wrap q-gutter-xs">
            <q-btn flat round dense icon="sym_r_edit" @click="openDialog(counter)" />
            <q-btn flat round dense color="negative" icon="sym_r_delete" @click="confirmRemove(counter)" />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <q-dialog v-model="isDialogOpen">
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">{{ editingId ? t('counters.editTitle') : t('counters.createTitle') }}</q-card-section>
        <q-form @submit.prevent="submit">
          <q-card-section class="q-gutter-md q-pt-none">
            <q-input v-model="form.name" :label="t('counters.fields.name')" outlined autofocus maxlength="40" :rules="[nameRule]" />
            <q-select
              v-if="siteOptions.length > 1"
              v-model="form.siteId"
              :options="siteChoices"
              :label="t('counters.fields.site')"
              emit-value
              map-options
              outlined
            />
            <q-select
              v-model="form.sectionIds"
              :options="sectionOptions"
              :label="t('counters.fields.sections')"
              :rules="[sectionsRule]"
              multiple
              use-chips
              emit-value
              map-options
              outlined
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup flat no-caps :label="t('common.cancel')" />
            <q-btn type="submit" unelevated no-caps color="primary" :label="t('common.save')" :loading="saveCounter.isPending.value" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </div>
</template>
