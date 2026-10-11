import { onBeforeUnmount, onMounted, ref } from 'vue';

import { streamUrl } from '../api/queueApi';
import type { QueueEvent } from '../interfaces/queue';

// Escucha los eventos en tiempo real (SSE). EventSource se reconecta solo si se cae la red.
const useQueueStream = (siteId: () => number | null, onEvent: (event: QueueEvent) => void) => {
  const isConnected = ref(false);
  let source: EventSource | null = null;

  const connect = () => {
    source?.close();
    source = new EventSource(streamUrl(siteId()));
    source.onopen = () => (isConnected.value = true);
    source.onerror = () => (isConnected.value = false);
    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as QueueEvent;
        if (event.type !== 'ping') onEvent(event);
      } catch {
        // mensaje no válido: se ignora
      }
    };
  };

  onMounted(connect);
  onBeforeUnmount(() => source?.close());

  return { isConnected, reconnect: connect };
};

export default useQueueStream;
