<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import useHandlerErrors from 'src/modules/shared/composables/useHandlerErrors';
import useVueQuery from 'src/modules/shared/composables/useVueQuery';
import BusinessTypePicker from 'src/modules/queue/components/BusinessTypePicker.vue';
import SectionsManager from 'src/modules/queue/components/SectionsManager.vue';
import { applySectionPreset } from 'src/modules/queue/api/queueApi';
import { findBusinessType } from 'src/modules/queue/config/businessTypes';
import {
  COUNTERS_KEY,
  SECTIONS_KEY,
  useSections,
} from 'src/modules/queue/composables/useQueueAdmin';
import OrganizationForm from '../components/OrganizationForm.vue';
import SitesManager from '../components/SitesManager.vue';
import { PUBLIC_PROFILE_KEY, useOrganization } from '../composables/useOrganization';
import { formatSite, useSites } from '../composables/useSites';
import type { OrganizationPayload } from '../interfaces/organization';

type SetupStep = 'organization' | 'business' | 'sites' | 'sections' | 'done';

const STEP_ORDER: SetupStep[] = ['organization', 'business', 'sites', 'sections', 'done'];

const { t } = useI18n();
const router = useRouter();
const { handleApiResponseError } = useHandlerErrors();
const { invalidQuery } = useVueQuery();
const { organization, saveMutation } = useOrganization();
const { sites } = useSites();
const { sections } = useSections();

const step = ref<SetupStep>('organization');
const businessType = ref<string | null>(null);
const isApplying = ref(false);

watch(organization, (value) => (businessType.value ??= value?.businessType ?? null), {
  immediate: true,
});

const activeSites = computed(() => sites.value.filter((site) => site.isActive));
const activeSections = computed(() => sections.value.filter((section) => section.isActive));
const isDone = (target: SetupStep) => STEP_ORDER.indexOf(step.value) > STEP_ORDER.indexOf(target);

const saveOrganization = async (payload: OrganizationPayload) => {
  await saveMutation.mutateAsync({ ...payload, businessType: businessType.value });
  step.value = 'business';
};

// Guarda el tipo de negocio y crea sus secciones sugeridas (en el idioma actual) si aún no hay ninguna
const saveBusinessType = async () => {
  const current = organization.value;
  if (!current || !businessType.value) return;
  isApplying.value = true;
  try {
    await saveMutation.mutateAsync({
      name: current.name,
      taxId: current.taxId,
      email: current.email,
      phone: current.phone,
      address: current.address,
      website: current.website,
      businessType: businessType.value,
    });
    const type = findBusinessType(businessType.value);
    await applySectionPreset({
      sections: type.prefixes.map((prefix, index) => ({
        name: t(`business.${type.key}.sections.${index}`),
        prefix,
      })),
      counterName: `${t(`business.${type.key}.counter`)} 1`,
    });
    invalidQuery({ queryKey: SECTIONS_KEY });
    invalidQuery({ queryKey: COUNTERS_KEY });
    invalidQuery({ queryKey: PUBLIC_PROFILE_KEY });
    step.value = 'sites';
  } catch (error) {
    handleApiResponseError(error);
  } finally {
    isApplying.value = false;
  }
};

const finish = () => void router.push({ name: 'dashboard' });
</script>

<template>
  <q-page padding>
    <div class="setup-container">
      <div class="q-mb-md">
        <div class="page-title">{{ t('setup.title') }}</div>
        <div class="text-grey-7">{{ t('setup.subtitle') }}</div>
      </div>

      <q-stepper v-model="step" animated flat bordered color="primary" alternative-labels>
        <q-step
          name="organization"
          :title="t('setup.steps.organization')"
          icon="sym_r_apartment"
          :done="isDone('organization')"
        >
          <div class="text-body2 text-grey-8 q-mb-md">{{ t('setup.organizationIntro') }}</div>
          <OrganizationForm
            :organization="organization"
            :submit-label="t('setup.continue')"
            submit-icon="sym_r_arrow_forward"
            :loading="saveMutation.isPending.value"
            @submit="saveOrganization"
          />
        </q-step>

        <q-step
          name="business"
          :title="t('setup.steps.business')"
          icon="sym_r_category"
          :done="isDone('business')"
        >
          <div class="text-body2 text-grey-8 q-mb-md">{{ t('setup.businessIntro') }}</div>
          <BusinessTypePicker v-model="businessType" />
          <q-stepper-navigation class="row justify-end q-gutter-sm">
            <q-btn flat no-caps :label="t('setup.back')" @click="step = 'organization'" />
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon-right="sym_r_arrow_forward"
              :label="t('setup.continue')"
              :disable="!businessType"
              :loading="isApplying"
              @click="saveBusinessType"
            />
          </q-stepper-navigation>
        </q-step>

        <q-step
          name="sites"
          :title="t('setup.steps.sites')"
          icon="sym_r_store"
          :done="isDone('sites')"
        >
          <SitesManager />
          <q-stepper-navigation class="row justify-end q-gutter-sm">
            <q-btn flat no-caps :label="t('setup.back')" @click="step = 'business'" />
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon-right="sym_r_arrow_forward"
              :label="t('setup.continue')"
              @click="step = 'sections'"
            />
          </q-stepper-navigation>
        </q-step>

        <q-step
          name="sections"
          :title="t('setup.steps.sections')"
          icon="sym_r_view_list"
          :done="isDone('sections')"
        >
          <SectionsManager />
          <q-stepper-navigation class="row justify-end q-gutter-sm">
            <q-btn flat no-caps :label="t('setup.back')" @click="step = 'sites'" />
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon-right="sym_r_arrow_forward"
              :label="t('setup.continue')"
              :disable="!activeSections.length"
              @click="step = 'done'"
            />
          </q-stepper-navigation>
        </q-step>

        <q-step name="done" :title="t('setup.steps.done')" icon="sym_r_task_alt">
          <div class="column items-center text-center q-py-md q-gutter-sm">
            <q-icon name="sym_r_verified" size="56px" color="positive" />
            <div class="text-h6">
              {{ t('setup.doneTitle', { name: organization?.name ?? '' }) }}
            </div>
            <div class="text-body2 text-grey-8">
              {{
                activeSites.length
                  ? t('setup.doneSites', {
                      n: activeSites.length,
                      sites: activeSites.map(formatSite).join(', '),
                    })
                  : t('setup.doneNoSites')
              }}
            </div>
            <div class="text-body2 text-grey-8">
              {{
                t('setup.doneSections', {
                  n: activeSections.length,
                  sections: activeSections.map((s) => s.name).join(', '),
                })
              }}
            </div>
            <div class="text-caption text-grey-7">{{ t('setup.doneHint') }}</div>
          </div>
          <q-stepper-navigation class="row justify-end q-gutter-sm">
            <q-btn flat no-caps :label="t('setup.back')" @click="step = 'sections'" />
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon-right="sym_r_rocket_launch"
              :label="t('setup.finish')"
              @click="finish"
            />
          </q-stepper-navigation>
        </q-step>
      </q-stepper>
    </div>
  </q-page>
</template>

<style scoped>
.setup-container {
  max-width: 960px;
  margin: 0 auto;
}
</style>
