// Tipos de negocio del asistente inicial. Los textos están en i18n (business.<key>.*):
// label, hint, counter (puesto), customer (quien espera) y sections.<n> con el nombre de cada sección sugerida.
export interface BusinessType {
  key: string;
  icon: string;
  prefixes: string[];
}

export const BUSINESS_TYPES: BusinessType[] = [
  { key: 'butcher', icon: 'sym_r_restaurant', prefixes: ['C', 'CH', 'P'] },
  { key: 'barbershop', icon: 'sym_r_content_cut', prefixes: ['C', 'B', 'CB'] },
  { key: 'salon', icon: 'sym_r_face_retouching_natural', prefixes: ['C', 'T', 'M'] },
  { key: 'carWash', icon: 'sym_r_local_car_wash', prefixes: ['E', 'L', 'A'] },
  { key: 'clinic', icon: 'sym_r_medical_services', prefixes: ['G', 'C', 'R'] },
  { key: 'pharmacy', icon: 'sym_r_local_pharmacy', prefixes: ['D', 'R', 'C'] },
  { key: 'bank', icon: 'sym_r_account_balance', prefixes: ['C', 'A', 'T'] },
  { key: 'other', icon: 'sym_r_storefront', prefixes: ['A'] },
];

export const DEFAULT_BUSINESS_TYPE = 'other';

export const findBusinessType = (key?: string | null) =>
  BUSINESS_TYPES.find((type) => type.key === key) ??
  BUSINESS_TYPES.find((type) => type.key === DEFAULT_BUSINESS_TYPE)!;
