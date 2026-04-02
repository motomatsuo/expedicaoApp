import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BipagemSseService {
  private readonly events = new Subject<MessageEvent>();

  emitListChanged(): void {
    this.events.next({
      data: JSON.stringify({ type: 'bipagem-list-changed' }),
    });
  }

  /** Uma conexão SSE por cliente; todos recebem os mesmos eventos. */
  stream(): Observable<MessageEvent> {
    const keepalive = interval(30000).pipe(
      map(
        () =>
          ({
            data: JSON.stringify({ type: 'ping' }),
          }) as MessageEvent,
      ),
    );
    return merge(this.events.asObservable(), keepalive);
  }
}
