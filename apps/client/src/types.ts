export type OutputFormat = "mp4" | "webm" | "mkv" | "mp3";

export type QualityPreset = "fast" | "balanced" | "archival";

export type JobStatus =
  | "queued"
  | "initializing"
  | "running"
  | "success"
  | "error"
  | "canceled";

export interface ConvertRequest {
  jobId: string;
  inputFileName: string;
  inputBuffer: ArrayBuffer;
  outputFormat: OutputFormat;
  qualityPreset: QualityPreset;
}

export interface ConvertProgress {
  progress: number;
}

export interface ConvertResult {
  outputFileName: string;
  mimeType: string;
  outputData: Uint8Array;
}

export interface ConverterWorkerApi {
  initialize: () => Promise<void>;
  convert: (
    request: ConvertRequest,
    onProgress: (event: ConvertProgress) => void,
  ) => Promise<ConvertResult>;
  cancel: (jobId: string) => Promise<void>;
}

export interface QueueJob {
  id: string;
  sourceFile: File;
  outputFormat: OutputFormat;
  qualityPreset: QualityPreset;
  status: JobStatus;
  progress: number;
  outputUrl: string | null;
  outputFileName: string | null;
  errorMessage: string | null;
}
