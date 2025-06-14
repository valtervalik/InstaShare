import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventPayloads } from 'src/common/interfaces/event-emitter/event-payloads.interface';

@Injectable()
export class TypedEventEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit<K extends keyof EventPayloads>(
    event: K,
    payload: EventPayloads[K],
  ): Promise<any[]> {
    return this.eventEmitter.emitAsync(event, payload);
  }

  on<K extends keyof EventPayloads>(
    event: K,
    listener: (payload: EventPayloads[K]) => void,
  ): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  off<K extends keyof EventPayloads>(
    event: K,
    listener: (payload: EventPayloads[K]) => void,
  ): this {
    this.eventEmitter.off(event, listener);
    return this;
  }
}
