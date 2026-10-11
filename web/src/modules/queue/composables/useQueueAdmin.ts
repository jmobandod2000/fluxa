import { computed } from 'vue';
import { useMutation, useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';

import useNotify from 'src/modules/shared/composables/useNotify';
import useHandlerErrors from 'src/modules/shared/composables/useHandlerErrors';
import useVueQuery from 'src/modules/shared/composables/useVueQuery';
import {
  createCounter,
  createSection,
  deleteCounter,
  deleteSection,
  getCounters,
  getSections,
  updateCounter,
  updateSection,
} from '../api/queueApi';
import type { CounterPayload, SectionPayload } from '../interfaces/queue';

export const SECTIONS_KEY = ['sections'];
export const COUNTERS_KEY = ['counters'];

export const useSections = () => {
  const { data, isFetching } = useQuery({ queryKey: SECTIONS_KEY, queryFn: getSections });
  const sections = computed(() => data.value ?? []);
  const sectionOptions = computed(() =>
    sections.value
      .filter((section) => section.isActive)
      .map((section) => ({ value: section.id, label: `${section.prefix} · ${section.name}` })),
  );
  return { sections, sectionOptions, isFetching };
};

export const useCounters = () => {
  const { data, isFetching } = useQuery({ queryKey: COUNTERS_KEY, queryFn: getCounters });
  const counters = computed(() => data.value ?? []);
  return { counters, isFetching };
};

// Altas, cambios y bajas de secciones y puestos, con aviso y refresco de listas
export const useQueueAdminMutations = () => {
  const { t } = useI18n();
  const { successNotify } = useNotify();
  const { handleApiResponseError } = useHandlerErrors();
  const { invalidQuery } = useVueQuery();

  const refresh = () => {
    invalidQuery({ queryKey: SECTIONS_KEY });
    invalidQuery({ queryKey: COUNTERS_KEY });
  };
  const done = (message: string) => {
    successNotify(message);
    refresh();
  };

  const saveSection = useMutation({
    mutationFn: ({ id, payload }: { id: number | undefined; payload: SectionPayload }) =>
      id ? updateSection(id, payload) : createSection(payload),
    onSuccess: (section) => done(t('sections.notify.saved', { name: section.name })),
    onError: handleApiResponseError,
  });
  const toggleSection = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateSection(id, { isActive }),
    onSuccess: refresh,
    onError: handleApiResponseError,
  });
  const removeSection = useMutation({
    mutationFn: deleteSection,
    onSuccess: (section) => done(t('sections.notify.deleted', { name: section.name })),
    onError: handleApiResponseError,
  });

  const saveCounter = useMutation({
    mutationFn: ({ id, payload }: { id: number | undefined; payload: CounterPayload }) =>
      id ? updateCounter(id, payload) : createCounter(payload),
    onSuccess: (counter) => done(t('counters.notify.saved', { name: counter.name })),
    onError: handleApiResponseError,
  });
  const removeCounter = useMutation({
    mutationFn: deleteCounter,
    onSuccess: (counter) => done(t('counters.notify.deleted', { name: counter.name })),
    onError: handleApiResponseError,
  });

  return { saveSection, toggleSection, removeSection, saveCounter, removeCounter };
};
