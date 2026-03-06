import type { OutputFormat, QualityPreset } from "../types";

interface FormatMeta {
  extension: string;
  label: string;
  mimeType: string;
}

export const FORMAT_META: Record<OutputFormat, FormatMeta> = {
  mp4: {
    extension: "mp4",
    label: "MP4 (H.264)",
    mimeType: "video/mp4",
  },
  webm: {
    extension: "webm",
    label: "WebM (VP9)",
    mimeType: "video/webm",
  },
  mkv: {
    extension: "mkv",
    label: "MKV (H.264)",
    mimeType: "video/x-matroska",
  },
  mp3: {
    extension: "mp3",
    label: "MP3 (Audio)",
    mimeType: "audio/mpeg",
  },
};

const PRESET_ARGS: Record<QualityPreset, { preset: string; crf: string }> = {
  fast: { preset: "ultrafast", crf: "30" },
  balanced: { preset: "veryfast", crf: "24" },
  archival: { preset: "slow", crf: "19" },
};

const AUDIO_BITRATE_BY_PRESET: Record<QualityPreset, string> = {
  fast: "128k",
  balanced: "192k",
  archival: "320k",
};

export function buildOutputFileName(
  inputFileName: string,
  outputFormat: OutputFormat,
): string {
  const sanitized = inputFileName.replace(/\.[^/.]+$/, "");
  return `${sanitized}.${FORMAT_META[outputFormat].extension}`;
}

export function buildFfmpegArgs(
  inputName: string,
  outputName: string,
  outputFormat: OutputFormat,
  qualityPreset: QualityPreset,
): string[] {
  const quality = PRESET_ARGS[qualityPreset];

  if (outputFormat === "mp3") {
    return [
      "-i",
      inputName,
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      AUDIO_BITRATE_BY_PRESET[qualityPreset],
      outputName,
    ];
  }

  if (outputFormat === "webm") {
    return [
      "-i",
      inputName,
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "0",
      "-crf",
      quality.crf,
      "-c:a",
      "libopus",
      outputName,
    ];
  }

  return [
    "-i",
    inputName,
    "-c:v",
    "libx264",
    "-preset",
    quality.preset,
    "-crf",
    quality.crf,
    "-c:a",
    "aac",
    outputName,
  ];
}
