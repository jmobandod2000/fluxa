<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useMutation, useQuery } from '@tanstack/vue-query';
import { LocalStorage } from 'quasar';
import { useI18n } from 'vue-i18n';

import useHandlerErrors from 'src/modules/shared/composables/useHandlerErrors';
import useNotify from 'src/modules/shared/composables/useNotify';
import { usePublicProfile } from 'src/modules/organization/composables/useOrganization';
import { callNext, getStaffState, transferTurn, turnAction } from '../api/queueApi';
import { useCounters, useSections } from '../composables/useQueueAdmin';
import useQueueStream from '../composables/useQueueStream';
import useVocabulary from '../composables/useVocabulary';
import { minutesSince } from '../helpers/queueHelpers';

const COUNTER_KEY = 'fluxa.counterId';

const { t } = useI18n();
const { handleApiResponseError } = useHandlerErrors();
const { infoNotify } = useNotify();
const { businessType } = usePublicProfile();
const { counterWord, customerWord } = useVocabulary(businessType);
const { counters } = useCounters();
const { sectionOptions } = useSections();

const readCounter = () => {
  try {
    return LocalStorage.getItem(COUNTER_KEY) as number | null;
  } catch {
    return null;
  }
};

const counterId = ref<number | null>(readCounter());
const activeCounters = computed(() => counters.value.filter((counter) => counter.isActive));
const counterOptions = computed(() =>
  activeCounters.value.map(({ id, name }) => ({ value: id, label: name })),
);

// Si el puesto guardado ya no existe, se elige el primero disponible
watch(activeCounters, (list) => {
  if (list.length && !list.some((counter) => counter.id === counterId.value))
    counterId.value = list[0]!.id;
});
watch(counterId, (id) => {
  try {
    LocalStorage.set(COUNTER_KEY, id);
  } catch {
    // sin almacenamiento local: se recuerda solo en esta sesión
  }
});

const { data: state, refetch } = useQuery({
  queryKey: ['queue', 'staff', counterId],
  queryFn: () => getStaffState(counterId.value!),
  enabled: computed(() => !!counterId.value),
  refetchInterval: 60_000,
});

const now = ref(Date.now());
const ticker = setInterval(() => (now.value = Date.now()), 30_000);
onBeforeUnmount(() => clearInterval(ticker));

const current = computed(() => state.value?.current ?? null);
const siteId = computed(() => state.value?.counter.siteId ?? null);
const transferOptions = computed(() =>
  sectionOptions.value.filter((option) => option.value !== current.value?.sectionId),
);

useQueueStream(
  () => siteId.value,
  () => void refetch(),
);

const onSettled = () => void refetch();
const nextMutation = useMutation({
  mutationFn: () => callNext(counterId.value!),
  onSuccess: ({ turn }) => {
    if (!turn) infoNotify(t('attend.emptyQueue'));
  },
  onError: handleApiResponseError,
  onSettled,
});
const actionMutation = useMutation({
  mutationFn: (action: 'recall' | 'finish' | 'no-show') => turnAction(current.value!.id, action),
  onError: handleApiResponseError,
  onSettled,
});
const transferMutation = useMutation({
  mutationFn: (sectionId: number) => transferTurn(current.value!.id, sectionId),
  onError: handleApiResponseError,
  onSettled,
});

const isBusy = computed(
  () =>
    nextMutation.isPending.value ||
    actionMutation.isPending.value ||
    transferMutation.isPending.value,
);

// Atajo: barra espaciadora o Enter llaman al siguiente (fuera de campos de texto)
const onKey = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
  if ((event.code === 'Space' || event.code === 'Enter') && counterId.value && !isBusy.value) {
    event.preventDefault();
    nextMutation.mutate();
  }
};
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <q-page padding>
    <div class="attend">
      <div class="row items-center q-col-gutter-md q-mb-md">
        <div class="col-12 col-sm">
          <div class="page-title">{{ t('attend.title') }}</div>
          <div class="text-grey-7">
            {{ t('attend.subtitle', { customer: customerWord.toLowerCase() }) }}
          </div>
        </div>
        <div class="col-12 col-sm-auto" style="min-width: 240px">
          <q-select
            v-model="counterId"
            :options="counterOptions"
            :label="counterWord"
            emit-value
            map-options
            outlined
            dense
          />
        </div>
      </div>

      <q-banner v-if="!activeCounters.length" rounded class="bg-orange-1 text-orange-10">
        {{ t('attend.noCounters', { counter: counterWord.toLowerCase() }) }}
      </q-banner>

      <div v-else class="row q-col-gutter-lg">
        <div class="col-12 col-md-7">
          <q-card flat bordered class="attend__current">
            <q-card-section v-if="current" class="text-center">
              <div class="text-grey-7">{{ t('attend.serving') }}</div>
              <div class="attend__code" :style="{ color: current.Section.color ?? '#1A4FD6' }">
                {{ current.code }}
              </div>
              <div class="text-h6">{{ current.Section.name }}</div>
              <div class="text-caption text-grey-7">
                {{
                  t('attend.waited', {
                    n: minutesSince(current.createdAt, new Date(current.calledAt ?? now).getTime()),
                  })
                }}
                <span v-if="current.recallCount">
                  · {{ t('attend.recalled', { n: current.recallCount }) }}</span
                >
              </div>
              <div class="row justify-center q-gutter-sm q-mt-md">
                <q-btn
                  outline
                  no-caps
                  color="primary"
                  icon="sym_r_campaign"
                  :label="t('attend.recall')"
                  :disable="isBusy"
                  @click="actionMutation.mutate('recall')"
                />
                <q-btn
                  outline
                  no-caps
                  color="positive"
                  icon="sym_r_check_circle"
                  :label="t('attend.finish')"
                  :disable="isBusy"
                  @click="actionMutation.mutate('finish')"
                />
                <q-btn
                  outline
                  no-caps
                  color="grey-8"
                  icon="sym_r_person_off"
                  :label="t('attend.noShow')"
                  :disable="isBusy"
                  @click="actionMutation.mutate('no-show')"
                />
                <q-btn-dropdown
                  v-if="transferOptions.length"
                  outline
                  no-caps
                  color="grey-8"
                  icon="sym_r_swap_horiz"
                  :label="t('attend.transfer')"
                  :disable="isBusy"
                >
                  <q-list>
                    <q-item
                      v-for="option in transferOptions"
                      :key="option.value"
                      v-close-popup
                      clickable
                      @click="transferMutation.mutate(option.value)"
                    >
                      <q-item-section>{{ option.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </div>
            </q-card-section>
            <q-card-section v-else class="text-center text-grey-7 q-py-xl">
              <q-icon name="sym_r_coffee" size="40px" />
              <div class="q-mt-sm">{{ t('attend.idle') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <q-btn
                unelevated
                no-caps
                color="primary"
                size="xl"
                class="full-width attend__next"
                icon="sym_r_skip_next"
                :label="t('attend.callNext')"
                :loading="nextMutation.isPending.value"
                :disable="!counterId || isBusy"
                @click="nextMutation.mutate()"
              />
              <div class="text-caption text-grey-6 text-center q-mt-xs">
                {{ t('attend.shortcut') }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-5 q-gutter-md">
          <div class="row q-col-gutter-sm">
            <div class="col-4">
              <q-card flat bordered class="text-center q-pa-sm">
                <div class="text-h5 text-weight-bold">{{ state?.waiting.length ?? 0 }}</div>
                <div class="text-caption text-grey-7">{{ t('attend.waitingCount') }}</div>
              </q-card>
            </div>
            <div class="col-4">
              <q-card flat bordered class="text-center q-pa-sm">
                <div class="text-h5 text-weight-bold">{{ state?.stats.served ?? 0 }}</div>
                <div class="text-caption text-grey-7">{{ t('attend.served') }}</div>
              </q-card>
            </div>
            <div class="col-4">
              <q-card flat bordered class="text-center q-pa-sm">
                <div class="text-h5 text-weight-bold">{{ state?.stats.avgWaitMinutes ?? '—' }}</div>
                <div class="text-caption text-grey-7">{{ t('attend.avgWait') }}</div>
              </q-card>
            </div>
          </div>

          <q-card flat bordered>
            <q-card-section class="text-subtitle2">{{ t('attend.queue') }}</q-card-section>
            <q-separator />
            <q-list separator class="attend__list">
              <q-item v-if="!state?.waiting.length">
                <q-item-section class="text-grey-7">{{ t('attend.emptyQueue') }}</q-item-section>
              </q-item>
              <q-item v-for="turn in state?.waiting" :key="turn.id" dense>
                <q-item-section avatar>
                  <q-badge
                    :style="{ background: turn.Section.color ?? '#1A4FD6' }"
                    class="text-weight-bold q-px-sm q-py-xs"
                  >
                    {{ turn.code }}
                  </q-badge>
                </q-item-section>
                <q-item-section>{{ turn.Section.name }}</q-item-section>
                <q-item-section side class="text-caption">{{
                  t('attend.minutes', { n: minutesSince(turn.createdAt, now) })
                }}</q-item-section>
              </q-item>
            </q-list>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.attend {
  max-width: 1100px;
  margin: 0 auto;
}
.attend__current {
  border-radius: 18px;
}
.attend__code {
  font-size: 5.5rem;
  font-weight: 900;
  line-height: 1.05;
}
.attend__next {
  border-radius: 14px;
  min-height: 72px;
}
.attend__list {
  max-height: 420px;
  overflow-y: auto;
}
</style>
