import { provide, inject } from "vue";
import { useStream } from "@langchain/vue";
import type { UseStreamOptions } from "@langchain/vue";

const STREAM_CONTEXT_KEY = Symbol("agents-stream");

export function provideStream(options: UseStreamOptions<any>): ReturnType<typeof useStream> {
    const stream = useStream(options);
    provide(STREAM_CONTEXT_KEY, stream);
    return stream;
}

export function useStreamContext() {
    const context = inject(STREAM_CONTEXT_KEY);
    if (context == null) throw new Error("useStreamContext() requires a parent component to call provideStream().");
    return context as ReturnType<typeof useStream>;
}
