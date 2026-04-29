declare module 'tail' {
  import { EventEmitter } from 'events';

  interface TailOptions {
    fromBeginning?: boolean;
    follow?: boolean;
    useWatchFile?: boolean;
    fsWatchOptions?: { interval?: number };
  }

  export class Tail extends EventEmitter {
    constructor(filename: string, options?: TailOptions);
    watch(): void;
    unwatch(): void;
  }
}
