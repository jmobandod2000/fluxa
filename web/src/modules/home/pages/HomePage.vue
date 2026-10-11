<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { usePublicProfile } from 'src/modules/organization/composables/useOrganization';

const { t } = useI18n();
const { organizationName } = usePublicProfile();
</script>

<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold">{{ t('home.title') }}</div>
    <div class="text-body2 text-grey-8 q-mb-lg">{{ organizationName }}</div>
    <q-card flat bordered class="q-pa-lg text-center">
      <q-icon name="sym_r_confirmation_number" size="56px" color="primary" />
      <div class="text-h6 q-mt-sm">{{ t('home.comingTitle') }}</div>
      <div class="text-body2 text-grey-8">{{ t('home.comingBody') }}</div>
    </q-card>
  </q-page>
</template>
