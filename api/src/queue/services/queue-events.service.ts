import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';

export interface QueueEvent {
  type: 'changed' | 'called';
  siteId: number | null;
  turn?: { code: string; counter: string; section: string };
}

// Bus en memoria para avisar en tiempo real (SSE) a pantallas, paneles y celulares
@Injectable()
export class QueueEventsService {
  private readonly events = new Subject<QueueEvent>();

  emit(event: QueueEvent) {
    this.events.next(event);
  }

  // Sin siteId se reciben todos los eventos; con siteId, los de esa sucursal y los generales
  stream(siteId: number | null): Observable<{ data: QueueEvent }> {
    return this.events.pipe(
      filter(
        (event) =>
          siteId === null || event.siteId === null || event.siteId === siteId,
      ),
      map((event) => ({ data: event })),
    );
  }
}
