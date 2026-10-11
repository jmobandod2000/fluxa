<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { BUSINESS_TYPES } from '../config/businessTypes';

const selected = defineModel<string | null>({ required: true });
const { t } = useI18n();
</script>

<template>
  <div class="row q-col-gutter-md">
    <div v-for="type in BUSINESS_TYPES" :key="type.key" class="col-12 col-sm-6 col-md-3">
      <q-card
        v-ripple
        flat
        bordered
        tabindex="0"
        class="type-card cursor-pointer full-height"
        :class="{ 'type-card--active': selected === type.key }"
        @click="selected = type.key"
        @keyup.enter="selected = type.key"
      >
        <q-card-section class="column items-center text-center q-gutter-xs">
          <q-icon
            :name="type.icon"
            size="36px"
            :color="selected === type.key ? 'white' : 'primary'"
          />
          <div class="text-subtitle2">{{ t(`business.${type.key}.label`) }}</div>
          <div class="text-caption type-card__hint">{{ t(`business.${type.key}.hint`) }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style scoped>
.type-card {
  border-radius: 14px;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.type-card:hover,
.type-card:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(11, 33, 73, 0.12);
  outline: none;
}
.type-card__hint {
  opacity: 0.75;
}
.type-card--active {
  background: linear-gradient(135deg, #1a4fd6 0%, #5b3df5 100%);
  color: #fff;
  border-color: transparent;
}
</style>
