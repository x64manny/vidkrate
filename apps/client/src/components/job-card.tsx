import type { QueueJob, QualityPreset } from "../types";
import { FORMAT_META } from "../lib/format";

interface JobCardProps {
  job: QueueJob;
  isActive: boolean;
  onFormatChange: (jobId: string, format: QueueJob["outputFormat"]) => void;
  onPresetChange: (jobId: string, preset: QualityPreset) => void;
  onCancel: (jobId: string) => void;
}

const STATUS_LABELS: Record<QueueJob["status"], string> = {
  queued: "Queued",
  initializing: "Initializing engine",
  running: "Converting",
  success: "Completed",
  error: "Failed",
  canceled: "Canceled",
};

export function JobCard({
  job,
  isActive,
  onFormatChange,
  onPresetChange,
  onCancel,
}: JobCardProps) {
  const progressWidth = `${Math.round(job.progress * 100)}%`;
  const isLocked = job.status === "running" || job.status === "initializing";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--color-orbit)] blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold tracking-wide text-zinc-100">
              {job.sourceFile.name}
            </h3>
            <p className="text-sm text-zinc-400">
              {(job.sourceFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.16em] text-zinc-300">
            {STATUS_LABELS[job.status]}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-zinc-300">
            Output format
            <select
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-[var(--color-signal)]"
              value={job.outputFormat}
              disabled={isLocked}
              onChange={(event) => onFormatChange(job.id, event.target.value as QueueJob["outputFormat"])}
            >
              {(Object.keys(FORMAT_META) as Array<QueueJob["outputFormat"]>).map((format) => (
                <option key={format} value={format}>
                  {FORMAT_META[format].label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-300">
            Quality profile
            <select
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-[var(--color-signal)]"
              value={job.qualityPreset}
              disabled={isLocked}
              onChange={(event) => onPresetChange(job.id, event.target.value as QualityPreset)}
            >
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="archival">Archival</option>
            </select>
          </label>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-zinc-400">
            <span>Progress</span>
            <span>{Math.round(job.progress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-signal)] to-[var(--color-wave)] transition-all duration-300"
              style={{ width: progressWidth }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {job.outputUrl !== null && job.outputFileName !== null ? (
            <a
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white"
              href={job.outputUrl}
              download={job.outputFileName}
            >
              Download
            </a>
          ) : null}

          {job.status === "running" || job.status === "initializing" || isActive ? (
            <button
              type="button"
              className="cursor-pointer rounded-xl border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-400"
              onClick={() => onCancel(job.id)}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {job.errorMessage !== null ? (
          <p className="text-sm text-red-300">{job.errorMessage}</p>
        ) : null}
      </div>
    </article>
  );
}
