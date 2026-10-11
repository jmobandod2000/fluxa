<script setup lang="ts">
import { ref, watch } from 'vue';
import QRCode from 'qrcode';

interface Props {
  value: string;
  size?: number;
}

const props = withDefaults(defineProps<Props>(), { size: 160 });
const dataUrl = ref('');

watch(
  () => [props.value, props.size] as const,
  async ([value, size]) => {
    dataUrl.value = value
      ? await QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      : '';
  },
  { immediate: true },
);
</script>

<template>
  <img v-if="dataUrl" :src="dataUrl" :width="size" :height="size" alt="QR" class="qr-code" />
</template>

<style scoped>
.qr-code {
  image-rendering: pixelated;
  display: block;
}
</style>
