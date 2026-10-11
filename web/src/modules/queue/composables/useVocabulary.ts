import { computed, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { findBusinessType } from '../config/businessTypes';

// Palabras según el tipo de negocio: "Mostrador"/"Silla"/"Consultorio", "Cliente"/"Paciente"/"Vehículo"
const useVocabulary = (businessType: Ref<string | null | undefined>) => {
  const { t } = useI18n();
  const type = computed(() => findBusinessType(businessType.value));

  const counterWord = computed(() => t(`business.${type.value.key}.counter`));
  const customerWord = computed(() => t(`business.${type.value.key}.customer`));

  return { type, counterWord, customerWord };
};

export default useVocabulary;
