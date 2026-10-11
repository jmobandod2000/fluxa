<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { copyToClipboard } from 'quasar';
import { useI18n } from 'vue-i18n';

import useNotify from 'src/modules/shared/composables/useNotify';
import { usePublicProfile } from 'src/modules/organization/composables/useOrganization';
import { useSites } from 'src/modules/organization/composables/useSites';
import { getToday } from 'src/modules/queue/api/queueApi';
import useQueueStream from 'src/modules/queue/composables/useQueueStream';
import useVocabulary from 'src/modules/queue/composables/useVocabulary';
import { buildDisplayUrl, buildKioskUrl, type PaperWidth } from 'src/modules/queue/helpers/queueHelpers';
import { QueueRoutes } from 'src/modules/queue/interfaces/queue';

const { t } = useI18n();
const { successNotify, errorNotify } = useNotify();
const { organizationName, businessType } = usePublicProfile();
const { customerWord } = useVocabulary(businessType);
const { siteOptions } = useSites();

const { data: today, refetch } = useQuery({ queryKey: ['queue', 'today'], queryFn: getToday, refetchInterval: 60_000 });
useQueueStream(() => null, () => void refetch());

const siteId = ref<number | null>(null);
const paper = ref<PaperWidth>('80');
const siteChoices = computed(() => [{ value: null, label: t('home.allSites') }, ...siteOptions.value]);
const paperOptions = computed(() => [
  { value: '80', label: t('home.paper80') },
  { value: '58', label: t('home.paper58') },
  { value: '0', label: t('home.paperNone') },
]);

const kioskUrl = computed(() => buildKioskUrl(siteId.value, paper.value));
const displayUrl = computed(() => buildDisplayUrl(siteId.value));

const stats = computed(() => [
  { label: t('home.stats.waiting'), value: today.value?.waiting ?? 0, icon: 'sym_r_hourglass' },
  { label: t('home.stats.served'), value: today.value?.served ?? 0, icon: 'sym_r_check_circle' },
  { label: t('home.stats.avgWait'), value: today.value?.avgWaitMinutes ?? '—', icon: 'sym_r_timer' },
  { label: t('home.stats.noShow'), value: today.value?.noShow ?? 0, icon: 'sym_r_person_off' },
]);

const copy = async (url: string) => {
  try {
    await copyToClipboard(url);
    successNotify(t('common.copied'));
  } catch {
    errorNotify(t('common.copyFailed'));
  }
};
</script>

<template>
  <q-page padding>
    <div class="home">
      <div class="q-mb-md">
        <div class="page-title">{{ organizationName }}</div>
        <div class="text-grey-7">{{ t('home.subtitle', { customer: customerWord.toLowerCase() }) }}</div>
      </div>

      <div class="row q-col-gutter-md q-mb-lg">
        <div v-for="stat in stats" :key="stat.label" class="col-6 col-md-3">
          <q-card flat bordered class="q-pa-md">
            <div class="row items-center no-wrap">
              <div class="col">
                <div class="text-caption text-grey-7">{{ stat.label }}</div>
                <div class="text-h4 text-weight-bold">{{ stat.value }}</div>
              </div>
              <q-icon :name="stat.icon" size="32px" color="grey-5" />
            </div>
          </q-card>
        </div>
      </div>

      <div class="row items-center q-col-gutter-md q-mb-md">
        <div class="col-12 col-sm text-subtitle1 text-weight-medium">{{ t('home.devicesTitle') }}</div>
        <div v-if="siteOptions.length > 1" class="col-12 col-sm-4">
          <q-select v-model="siteId" :options="siteChoices" :label="t('home.site')" emit-value map-options outlined dense />
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-4">
          <q-card flat bordered class="full-height device-card">
            <q-card-section>
              <q-icon name="sym_r_badge" size="36px" color="primary" />
              <div class="text-h6 q-mt-sm">{{ t('home.attend.title') }}</div>
              <div class="text-body2 text-grey-8">{{ t('home.attend.body') }}</div>
            </q-card-section>
            <q-card-actions>
              <q-btn unelevated no-caps color="primary" icon="sym_r_play_arrow" :label="t('home.attend.open')" :to="{ name: QueueRoutes.ATTEND }" />
            </q-card-actions>
          </q-card>
        </div>

        <div class="col-12 col-md-4">
          <q-card flat bordered class="full-height device-card">
            <q-card-section>
              <q-icon name="sym_r_touch_app" size="36px" color="primary" />
              <div class="text-h6 q-mt-sm">{{ t('home.kiosk.title') }}</div>
              <div class="text-body2 text-grey-8">{{ t('home.kiosk.body') }}</div>
              <q-select v-model="paper" :options="paperOptions" :label="t('home.paper')" emit-value map-options outlined dense class="q-mt-sm" />
              <div class="text-caption text-grey-7 q-mt-xs">{{ t('home.kiosk.silentPrint') }}</div>
            </q-card-section>
            <q-card-actions>
              <q-btn unelevated no-caps color="primary" icon="sym_r_open_in_new" :label="t('home.open')" :href="kioskUrl" target="_blank" rel="noopener" />
              <q-btn flat no-caps color="primary" icon="sym_r_content_copy" :label="t('common.copy')" @click="copy(kioskUrl)" />
            </q-card-actions>
          </q-card>
        </div>

        <div class="col-12 col-md-4">
          <q-card flat bordered class="full-height device-card">
            <q-card-section>
              <q-icon name="sym_r_tv" size="36px" color="primary" />
              <div class="text-h6 q-mt-sm">{{ t('home.display.title') }}</div>
              <div class="text-body2 text-grey-8">{{ t('home.display.body') }}</div>
            </q-card-section>
            <q-card-actions>
              <q-btn unelevated no-caps color="primary" icon="sym_r_open_in_new" :label="t('home.open')" :href="displayUrl" target="_blank" rel="noopener" />
              <q-btn flat no-caps color="primary" icon="sym_r_content_copy" :label="t('common.copy')" @click="copy(displayUrl)" />
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.home {
  max-width: 1100px;
  margin: 0 auto;
}
.device-card {
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
</style>
