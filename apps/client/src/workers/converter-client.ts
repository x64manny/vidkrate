import * as Comlink from "comlink";
import type { ConverterWorkerApi } from "../types";

export interface ConverterClient {
  api: Comlink.Remote<ConverterWorkerApi>;
  terminate: () => void;
}

export function createConverterClient(): ConverterClient {
  const worker = new Worker(new URL("./converter-worker.ts", import.meta.url), {
    type: "module",
  });

  return {
    api: Comlink.wrap<ConverterWorkerApi>(worker),
    terminate: () => worker.terminate(),
  };
}
