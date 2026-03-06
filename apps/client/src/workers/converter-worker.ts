/// <reference lib="webworker" />

import * as Comlink from "comlink";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import type {
  ConvertProgress,
  ConvertRequest,
  ConvertResult,
  ConverterWorkerApi,
} from "../types";
import { buildFfmpegArgs, buildOutputFileName, FORMAT_META } from "../lib/format";

class WorkerConverterApi implements ConverterWorkerApi {
  private ffmpeg: FFmpeg;
  private loaded = false;
  private activeJobId: string | null = null;
  private cancelledJobIds = new Set<string>();

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  public async initialize(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const coreURL = await toBlobURL("/ffmpeg-core.js", "text/javascript");
      const wasmURL = await toBlobURL("/ffmpeg-core.wasm", "application/wasm");

      await this.ffmpeg.load({ coreURL, wasmURL });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`ffmpeg engine init failed: ${detail}`);
    }

    this.loaded = true;
  }

  public async convert(
    request: ConvertRequest,
    onProgress: (event: ConvertProgress) => void,
  ): Promise<ConvertResult> {
    await this.initialize();

    if (this.cancelledJobIds.has(request.jobId)) {
      this.cancelledJobIds.delete(request.jobId);
      throw new Error("Job canceled before start");
    }

    this.activeJobId = request.jobId;
    const inputName = `input-${request.jobId}`;
    const outputFileName = buildOutputFileName(
      request.inputFileName,
      request.outputFormat,
    );
    const outputName = `output-${request.jobId}.${FORMAT_META[request.outputFormat].extension}`;

    const progressHandler = ({ progress }: { progress: number }) => {
      onProgress({ progress: Math.max(0, Math.min(progress, 1)) });
    };

    this.ffmpeg.on("progress", progressHandler);

    try {
      await this.ffmpeg.writeFile(inputName, new Uint8Array(request.inputBuffer));

      const args = buildFfmpegArgs(
        inputName,
        outputName,
        request.outputFormat,
        request.qualityPreset,
      );

      await this.ffmpeg.exec(args);

      if (this.cancelledJobIds.has(request.jobId)) {
        this.cancelledJobIds.delete(request.jobId);
        throw new Error("Job canceled");
      }

      const outputData = await this.ffmpeg.readFile(outputName);

      if (!(outputData instanceof Uint8Array)) {
        throw new Error("Unexpected output format from ffmpeg");
      }

      return {
        outputData,
        outputFileName,
        mimeType: FORMAT_META[request.outputFormat].mimeType,
      };
    } finally {
      this.activeJobId = null;
      this.ffmpeg.off("progress", progressHandler);
      await this.safeDelete(inputName);
      await this.safeDelete(outputName);
    }
  }

  public async cancel(jobId: string): Promise<void> {
    this.cancelledJobIds.add(jobId);

    if (this.activeJobId !== jobId) {
      return;
    }

    this.ffmpeg.terminate();
    this.ffmpeg = new FFmpeg();
    this.loaded = false;
    this.activeJobId = null;
  }

  private async safeDelete(fileName: string): Promise<void> {
    try {
      await this.ffmpeg.deleteFile(fileName);
    } catch {
      // Ignore missing file errors during cleanup.
    }
  }
}

Comlink.expose(new WorkerConverterApi());
