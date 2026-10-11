<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BusinessTypePicker from 'src/modules/queue/components/BusinessTypePicker.vue';
import SectionsManager from 'src/modules/queue/components/SectionsManager.vue';
import CountersManager from 'src/modules/queue/components/CountersManager.vue';
import BookingSettings from 'src/modules/queue/components/BookingSettings.vue';
import useVueQuery from 'src/modules/shared/composables/useVueQuery';
import OrganizationForm from '../components/OrganizationForm.vue';
import SitesManager from '../components/SitesManager.vue';
import { PUBLIC_PROFILE_KEY, useOrganization } from '../composables/useOrganization';

type SettingsTab = 'organization' | 'business' | 'sites' | 'sections' | 'counters' | 'booking';

const { t } = useI18n();
const { invalidQuery } = useVueQuery();
const { organization, saveMutation } = useOrganization();
const tab = ref<SettingsTab>('organization');
const businessType = ref<string | null>(null);

watch(organization, (value) => (businessType.value = value?.businessType ?? null), {
  immediate: true,
});

// Cambiar el tipo de negocio solo cambia el vocabulario; las secciones existentes se conservan
const saveBusinessType = () => {
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
      businessType: businessType.value,
    },
    { onSuccess: () => invalidQuery({ queryKey: PUBLIC_PROFILE_KEY }) },
  );
};
</script>

<template>
  <q-page padding>
    <div class="settings-container">
      <div class="q-mb-md">
        <div class="page-title">{{ t('settings.title') }}</div>
        <div class="text-grey-7">{{ t('settings.subtitle') }}</div>
      </div>

      <q-card flat bordered>
        <q-tabs
          v-model="tab"
          dense
          no-caps
          align="left"
          active-color="primary"
          indicator-color="primary"
          class="text-grey-8"
        >
          <q-tab
            name="organization"
            icon="sym_r_apartment"
            :label="t('settings.tabs.organization')"
          />
          <q-tab name="business" icon="sym_r_category" :label="t('settings.tabs.business')" />
          <q-tab name="sites" icon="sym_r_store" :label="t('settings.tabs.sites')" />
          <q-tab name="sections" icon="sym_r_view_list" :label="t('settings.tabs.sections')" />
          <q-tab name="counters" icon="sym_r_storefront" :label="t('settings.tabs.counters')" />
          <q-tab name="booking" icon="sym_r_event_available" :label="t('settings.tabs.booking')" />
        </q-tabs>
        <q-separator />
        <q-tab-panels v-model="tab" animated>
          <q-tab-panel name="organization">
            <OrganizationForm
              :organization="organization"
              :submit-label="t('common.save')"
              submit-icon="sym_r_save"
              :loading="saveMutation.isPending.value"
              @submit="(payload) => saveMutation.mutate(payload)"
            />
          </q-tab-panel>
          <q-tab-panel name="business">
            <div class="text-body2 text-grey-8 q-mb-md">{{ t('settings.businessHint') }}</div>
            <BusinessTypePicker v-model="businessType" />
            <div class="row justify-end q-mt-md">
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="sym_r_save"
                :label="t('common.save')"
                :disable="!organization || !businessType"
                :loading="saveMutation.isPending.value"
                @click="saveBusinessType"
              />
            </div>
          </q-tab-panel>
          <q-tab-panel name="sites">
            <SitesManager />
          </q-tab-panel>
          <q-tab-panel name="sections">
            <SectionsManager />
          </q-tab-panel>
          <q-tab-panel name="counters">
            <CountersManager />
          </q-tab-panel>
          <q-tab-panel name="booking">
            <BookingSettings />
          </q-tab-panel>
        </q-tab-panels>
      </q-card>
    </div>
  </q-page>
</template>

<style scoped>
.settings-container {
  max-width: 960px;
  margin: 0 auto;
}
</style>
