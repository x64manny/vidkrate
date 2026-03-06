import { useEffect, useMemo, useRef, useState } from "react";
import * as Comlink from "comlink";
import { JobCard } from "./components/job-card";
import { createConverterClient } from "./workers/converter-client";
import type { ConverterClient } from "./workers/converter-client";
import type { QueueJob } from "./types";

type EngineState = "idle" | "loading" | "ready" | "error";

function createJob(file: File): QueueJob {
  return {
    id: crypto.randomUUID(),
    sourceFile: file,
    outputFormat: "mp4",
    qualityPreset: "balanced",
    status: "queued",
    progress: 0,
    outputUrl: null,
    outputFileName: null,
    errorMessage: null,
  };
}

export function App() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const converterClientRef = useRef<ConverterClient | null>(null);
  const stopRequestedRef = useRef(false);

  const queueStats = useMemo(() => {
    const total = jobs.length;
    const done = jobs.filter((job) => job.status === "success").length;
    const failed = jobs.filter((job) => job.status === "error").length;
    const canceled = jobs.filter((job) => job.status === "canceled").length;
    return { total, done, failed, canceled };
  }, [jobs]);

  useEffect(() => {
    const client = createConverterClient();
    converterClientRef.current = client;

    setEngineState("loading");
    void client.api
      .initialize()
      .then(() => {
        setEngineState("ready");
      })
      .catch(() => {
        setEngineState("error");
      });

    return () => {
      setJobs((currentJobs) => {
        for (const job of currentJobs) {
          if (job.outputUrl !== null) {
            URL.revokeObjectURL(job.outputUrl);
          }
        }
        return currentJobs;
      });
      client.terminate();
    };
  }, []);

  const updateJob = (jobId: string, updater: (job: QueueJob) => QueueJob) => {
    setJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === jobId ? updater(job) : job)),
    );
  };

  const onPickFiles = (files: FileList | null) => {
    if (files === null || files.length === 0) {
      return;
    }

    const nextJobs = Array.from(files)
      .filter((file) => file.type.startsWith("video/") || file.name.match(/\.(mp4|mov|mkv|webm|avi|m4v)$/i))
      .map(createJob);

    setJobs((currentJobs) => [...currentJobs, ...nextJobs]);
  };

  const onCancelJob = async (jobId: string) => {
    updateJob(jobId, (job) => ({
      ...job,
      status: "canceled",
      errorMessage: null,
    }));

    if (activeJobId === jobId && converterClientRef.current !== null) {
      stopRequestedRef.current = true;
      await converterClientRef.current.api.cancel(jobId);
    }
  };

  const runQueue = async () => {
    if (converterClientRef.current === null || isRunning) {
      return;
    }

    setIsRunning(true);
    stopRequestedRef.current = false;

    if (engineState !== "ready") {
      setEngineState("loading");
      try {
        await converterClientRef.current.api.initialize();
        setEngineState("ready");
      } catch {
        setEngineState("error");
        setIsRunning(false);
        return;
      }
    }

    const pendingJobs = jobs.filter((job) => job.status === "queued");

    for (const job of pendingJobs) {
      if (stopRequestedRef.current) {
        break;
      }

      setActiveJobId(job.id);
      updateJob(job.id, (currentJob) => ({
        ...currentJob,
        status: "running",
        progress: 0,
        errorMessage: null,
      }));

      try {
        const inputBuffer = await job.sourceFile.arrayBuffer();
        const result = await converterClientRef.current.api.convert(
          {
            jobId: job.id,
            inputBuffer,
            inputFileName: job.sourceFile.name,
            outputFormat: job.outputFormat,
            qualityPreset: job.qualityPreset,
          },
          Comlink.proxy(({ progress }) => {
            updateJob(job.id, (currentJob) => ({
              ...currentJob,
              progress,
            }));
          }),
        );

        const blob = new Blob([result.outputData], { type: result.mimeType });
        const outputUrl = URL.createObjectURL(blob);

        updateJob(job.id, (currentJob) => {
          if (currentJob.outputUrl !== null) {
            URL.revokeObjectURL(currentJob.outputUrl);
          }

          return {
            ...currentJob,
            outputUrl,
            outputFileName: result.outputFileName,
            progress: 1,
            status: "success",
          };
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message.toLowerCase().includes("cancel")
            ? "Conversion canceled"
            : "Conversion failed. This format/codec combination may be unsupported in wasm core.";

        updateJob(job.id, (currentJob) => ({
          ...currentJob,
          status: message === "Conversion canceled" ? "canceled" : "error",
          errorMessage: message,
        }));
      }
    }

    stopRequestedRef.current = false;
    setActiveJobId(null);
    setIsRunning(false);
  };

  const clearFinished = () => {
    setJobs((currentJobs) => {
      for (const job of currentJobs) {
        if (job.status === "success" && job.outputUrl !== null) {
          URL.revokeObjectURL(job.outputUrl);
        }
      }

      return currentJobs.filter(
        (job) => job.status !== "success" && job.status !== "error" && job.status !== "canceled",
      );
    });
  };

  return (
    <main className="min-h-screen bg-ink text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-[0_25px_120px_rgba(14,165,233,0.15)] backdrop-blur md:p-10">
          <div className="pointer-events-none absolute -left-32 top-0 h-64 w-64 rounded-full bg-orbit/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-0 h-56 w-56 rounded-full bg-signal/35 blur-3xl" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-wave">
                Browser Native Conversion
              </p>
              <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
                vidkrate
              </h1>
              <p className="text-zinc-300">
                Drop videos, queue multiple jobs, and convert in a background worker so the UI stays responsive.
                Output currently supports MP4, WebM, and MKV.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-700 bg-zinc-900/75 px-4 py-3 text-sm">
              <p className="font-mono uppercase tracking-[0.16em] text-zinc-400">Engine</p>
              <p className="mt-1 font-display text-lg text-zinc-100">
                {engineState === "loading" ? "Loading ffmpeg.wasm" : null}
                {engineState === "ready" ? "Ready" : null}
                {engineState === "error" ? "Failed to initialize" : null}
                {engineState === "idle" ? "Idle" : null}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 px-6 py-8 text-center transition hover:border-signal md:min-w-[320px]">
              <span className="font-display text-lg">Add videos to queue</span>
              <span className="text-sm text-zinc-400">MP4, MOV, MKV, WebM, AVI</span>
              <input
                type="file"
                className="hidden"
                accept="video/*,.mkv,.avi,.mov,.mp4,.webm"
                multiple
                onChange={(event) => onPickFiles(event.target.files)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 text-sm text-zinc-300 md:grid-cols-4">
              <Stat label="Total" value={queueStats.total} />
              <Stat label="Done" value={queueStats.done} />
              <Stat label="Failed" value={queueStats.failed} />
              <Stat label="Canceled" value={queueStats.canceled} />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="cursor-pointer rounded-xl bg-linear-to-r from-signal to-wave px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRunning || jobs.every((job) => job.status !== "queued")}
                onClick={() => {
                  void runQueue();
                }}
              >
                {isRunning ? "Converting..." : "Start Queue"}
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
                disabled={isRunning}
                onClick={clearFinished}
              >
                Clear Finished
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 text-center text-zinc-400">
              Your queue is empty. Add one or more video files to start converting.
            </div>
          ) : (
            jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isActive={activeJobId === job.id}
                onFormatChange={(jobId, format) => {
                  updateJob(jobId, (currentJob) => ({
                    ...currentJob,
                    outputFormat: format,
                  }));
                }}
                onPresetChange={(jobId, preset) => {
                  updateJob(jobId, (currentJob) => ({
                    ...currentJob,
                    qualityPreset: preset,
                  }));
                }}
                onCancel={(jobId) => {
                  void onCancelJob(jobId);
                }}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="font-display text-xl text-zinc-100">{value}</p>
    </div>
  );
}
