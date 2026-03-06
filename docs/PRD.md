# vidkrate: Product Requirements Document

## 1. Overview

vidkrate is a commercial-grade, browser-based video converter built entirely as a React web application. The product enables users to transcode multi-gigabyte video files — with full codec selection, quality control, AI enhancement, and metadata preservation — without installing software, without uploading to a server, and without crashing the browser.

The core technical bet: the browser's native WebCodecs API, paired with the Origin Private File System (OPFS), eliminates the two fundamental problems that make browser-based video processing historically impractical — CPU bottlenecks and RAM limits. WebCodecs provides direct hardware-accelerated encoding/decoding; OPFS provides byte-level local file access that streams around the browser's memory ceiling entirely.

**The product must remain proprietary and commercially distributable.** Any bundled WebAssembly binary (FFmpeg.wasm) must be compiled under LGPL terms only — never with `--enable-gpl` or `--enable-nonfree`.

---

## 2. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Process large files without crashing | Maximum file size handled without tab crash or OOM | ≥ 4GB |
| Fast daily transcoding | Real-time ratio for 1080p H.264 → H.264 on a mid-range GPU | ≤ 1x (real-time or faster) |
| Responsive UI during processing | Main thread frame rate while transcoding | ≥ 60fps |
| Initial load performance | Time to interactive on a 4G connection | < 2s |
| Metadata fidelity | HDR10 and Dolby Vision metadata intact after transcode | 100% passthrough |
| Codec breadth | Output formats supported at launch | H.264, AV1, VP9, HEVC |

---

## 3. Users & Context

### Persona 1 — The Content Creator

A YouTuber or videographer who shoots on an iPhone (HEVC/H.265) or mirrorless camera (ProRes, H.264). Their editing software (Premiere Pro, DaVinci Resolve) accepts specific formats; their upload targets (YouTube, Vimeo) have bitrate and container preferences. They need reliable batch conversion without a subscription to Handbrake-as-a-Service or a desktop app that takes 20 minutes to install.

- **Technical literacy:** Medium. Knows what H.264 and MP4 mean. Does not know what a muxer is.
- **Key need:** Fast conversion to a specific output format, no quality degradation, no file size surprises.
- **Primary interaction:** Drop files → pick output format → convert → download. Done.

### Persona 2 — The Home Theater Archivist

A person with a large collection of Blu-ray rips (MKV, HEVC, Dolby Vision HDR, TrueHD audio) who wants to transcode for a Plex server or a device with limited codec support. They care deeply about not destroying what they have — HDR metadata, all audio tracks, subtitle streams must survive.

- **Technical literacy:** High. Understands codecs, bitrate modes, audio passthrough.
- **Key need:** Fine-grained control over codec settings, HDR passthrough, multi-track audio preservation.
- **Primary interaction:** Configure advanced options, run queued batch jobs, inspect output metadata.

### Persona 3 — The Video Professional

A post-production or streaming engineer who needs repeatable, precise transcodes at scale — mezzanine-quality archival encodes, delivery-spec files, or AI-enhanced upscales of legacy footage.

- **Technical literacy:** Expert. Understands rate control, filter graphs, LUTs, color spaces.
- **Key need:** Capped CRF, LUT integration, AI upscaling, HDR tone mapping, and a pipeline they can trust.
- **Primary interaction:** Upload processing presets, run AI enhancements, export as part of a larger workflow.

---

## 4. Feature Requirements

### P0 — Launch Blockers

These must work before the product ships to any user.

#### 4.1 Core Transcoding Pipeline

The pipeline runs five sequential stages: **demux → decode → process → encode → mux**.

**Acceptance criteria:**
- Input files in MP4, MKV, MOV, WebM are parsed and all streams (video, audio, subtitles) are identified
- Demuxer handles variable frame rate (VFR) timestamps and corrupted container headers without crash
- Video is decoded to raw YUV/RGB frames; audio to PCM
- Encoded output is muxed back into the chosen container with correctly aligned PTS/DTS across all streams
- A/V sync is maintained to within ±1 frame on output

#### 4.2 OPFS-Based File Handling

Video files must never be fully loaded into browser RAM.

**Acceptance criteria:**
- Files up to 4GB are processed without tab crash or OOM error on Chrome/Edge with 8GB system RAM
- File data is streamed through OPFS in chunks; no full-file buffer is held in memory at any point
- OPFS write/read errors surface a clear user-facing message (not a silent crash)

#### 4.3 WebCodecs Primary Engine

Hardware-accelerated encoding/decoding via WebCodecs is the default path.

**Acceptance criteria:**
- The app detects WebCodecs availability on load and logs which codecs are hardware-accelerated on the device
- H.264, AV1, VP9 encoding uses the device's hardware encoder (NVENC, VideoToolbox, or equivalent) when available
- Encoding does not block the main UI thread at any point during processing
- FFmpeg.wasm fallback is used automatically when the target codec is unsupported by WebCodecs

#### 4.4 Worker Architecture via Comlink

All encoding, decoding, and heavy computation runs inside Web Workers.

**Acceptance criteria:**
- Zero video processing logic runs on the main React thread
- Worker communication uses Comlink RPC — no raw `postMessage` string protocols
- The UI can be interacted with (scroll, navigate, update settings for queued files) while a transcode is running
- Worker errors are caught and surfaced to the UI as readable messages, not unhandled exceptions

#### 4.5 Basic Queue Management UI

**Acceptance criteria:**
- Users can add multiple files to a queue before starting
- Each queue item displays: filename, source format, target format, progress %, current FPS, estimated time remaining
- Users can cancel an individual job mid-transcode
- Completed files download automatically or are available in a persistent "Done" list

---

### P1 — Important, Not Launch Blockers

#### 4.6 Codec Support

| Codec | Direction | Engine |
|-------|-----------|--------|
| H.264 / AVC | Encode + Decode | WebCodecs (HW) → FFmpeg.wasm fallback |
| H.265 / HEVC | Encode + Decode | WebCodecs (HW) → FFmpeg.wasm fallback |
| AV1 | Encode + Decode | WebCodecs (HW) → FFmpeg.wasm fallback |
| VP9 | Encode + Decode | WebCodecs (HW) → FFmpeg.wasm fallback |
| ProRes | Decode only | FFmpeg.wasm |

**Acceptance criteria:**
- Each codec pair converts a known reference file to bitrate-accurate output
- Codec availability indicator shown to user before they select an unsupported codec
- If a codec is software-only (FFmpeg.wasm path), the user is shown a performance warning

#### 4.7 Rate Control Options

Surface three rate control modes with sensible defaults. Complexity is hidden under a progressive disclosure toggle.

| Mode | Default for | User-facing label |
|------|-------------|-------------------|
| Capped CRF | All presets | "Quality" (with max bitrate cap) |
| VBR | Streaming presets | "Variable Bitrate" |
| CBR | Live streaming presets | "Constant Bitrate" |

**Acceptance criteria:**
- Default mode is Capped CRF; default CRF value is 23 (H.264) or 28 (AV1)
- Advanced panel exposes CRF value, max bitrate cap, and target bitrate (VBR/CBR)
- A 1080p CRF 23 H.264 encode produces a file ≤ 8MB/min on typical live-action content
- Selecting CBR with a streaming preset locks the VBR/CRF fields and shows the bitrate input

#### 4.8 Multi-Track Metadata Passthrough

**Acceptance criteria:**
- All audio tracks, subtitle tracks, and chapter markers in the source container are preserved in the output by default
- User can individually select which tracks to include or exclude
- Audio passthrough (copy without re-encoding) is supported for TrueHD, Dolby Atmos, DTS-HD
- HDR10 static metadata (MaxCLL, MaxFALL, mastering display metadata) is read from source and re-injected into output
- Dolby Vision RPU metadata is passed through unmodified when container and codec support it
- Output stream mapping is visually shown to the user before encoding begins

#### 4.9 JavaScript Container Muxing

WebCodecs produces encoded chunks, not container files. Muxing must happen in-browser.

**Acceptance criteria:**
- MP4 output uses `mp4-muxer` or `mp4box.js` for container packaging
- MKV output uses a compatible JS muxer (or FFmpeg.wasm mux-only path)
- Muxed output is byte-for-byte valid — playable in VLC, QuickTime, and Chrome's native player
- PTS/DTS values are correctly written such that seeking works in all tested players

#### 4.10 Progressive Disclosure UI

**Acceptance criteria:**
- Default state: file drop zone, format picker, quality preset selector (Fast / Balanced / Archival), convert button
- "Advanced" toggle reveals: codec-specific options (CRF, max bitrate, B-frames, profile/level), audio options, subtitle options, stream selector
- Advanced settings are persisted to `localStorage` per output format profile
- UI loads in < 2s on a 4G connection; no layout shift during initial load

---

### P2 — Post-Launch

#### 4.11 AI Frame Interpolation
- RIFE model served via FastAPI microservice for FPS upconversion (e.g., 24fps → 60fps)
- DAIN as optional alternative; disabled by default due to compute cost
- User selects target FPS; model choice is an advanced option

#### 4.12 AI Upscaling & Artifact Restoration
- Real-ESRGAN for general video upscaling and compression artifact removal
- Anime4K for animated content (auto-detected or manually selected)
- Upscale factor selectable: 2x or 4x

#### 4.13 HDR Tone Mapping
- Automated HDR-to-SDR tone mapping for displays without HDR support
- Mobius operator as default (superior highlight preservation vs. Hable)
- User-configurable NPL value (default 100 nits)
- Supports Rec.2020 → Rec.709 color space + gamma conversion

#### 4.14 3D LUT Integration
- Accept `.cube` and `.3dl` LUT files via drag-and-drop
- Apply during the processing stage (between decode and encode)
- Tetrahedral interpolation for accurate color mapping between LUT grid points

#### 4.15 AI-Powered Preset Recommendation
- FastAPI + LiteLLM microservice that accepts a natural-language description of intent ("I want to upload this for YouTube in the smallest file size without visible quality loss") and returns a codec/CRF/bitrate preset
- Preset is applied to the current queue item with one click

#### 4.16 User Accounts & Job History
- MongoDB-backed user accounts via Node.js API
- Persist conversion history, saved presets, and queue state across sessions
- Authentication via Node.js API layer; frontend never touches auth secrets

---

## 5. Technical Architecture

### 5.1 System Overview

```
Browser (React + Web Workers)
  ├── Main Thread: React UI, queue management, Comlink orchestration
  ├── Video Worker: WebCodecs encode/decode, OPFS streaming, pipeline stages
  └── FFmpeg Worker: FFmpeg.wasm for unsupported codecs and filter graphs

Node.js API (Backend)
  ├── WebSocket: Real-time job progress relay
  ├── Auth: User sessions, JWT
  └── Gateway: Routes to AI microservices

Python Microservices (FastAPI)
  ├── /enhance: RIFE, Real-ESRGAN, Anime4K inference
  └── /recommend: LiteLLM proxy for preset recommendation

MongoDB: users, jobs, presets, history
```

### 5.2 Transcoding Pipeline Stages

| Stage | Responsibility | Implementation |
|-------|---------------|----------------|
| Demux | Parse container, extract encoded packets per stream | `mp4box.js` (MP4) / `FFmpeg.wasm` (MKV, MOV) |
| Decode | Decompress video → YUV/RGB frames; audio → PCM | `WebCodecs VideoDecoder` → FFmpeg.wasm fallback |
| Process | Scale, deinterlace, tone map, LUT, AI enhance | WebGL shaders + FFmpeg filters + FastAPI |
| Encode | Compress processed frames to target codec | `WebCodecs VideoEncoder` → FFmpeg.wasm fallback |
| Mux | Package encoded streams into output container | `mp4-muxer` (MP4) / FFmpeg.wasm (MKV) |

### 5.3 Dual-Engine Strategy

WebCodecs and FFmpeg.wasm are not interchangeable — they occupy distinct roles:

| Dimension | WebCodecs | FFmpeg.wasm |
|-----------|-----------|-------------|
| Speed | Real-time (hardware) | 5–10x slower than native |
| Quality | Hardware pre-filtering may blur detail | Full rate-distortion optimization |
| Codec support | H.264, HEVC, AV1, VP9 (device-dependent) | Any codec compiled into build |
| Memory | Streaming, no full-frame buffer required | Can hit memory walls on large files |
| Use case | Daily transcoding, speed-sensitive tasks | Archival, unsupported codecs, filter graphs |

The engine selection is automatic: WebCodecs is tried first; FFmpeg.wasm is used when hardware support is absent or the operation requires filter graph capabilities (LUT, deinterlace, tone map).

### 5.4 Codec Reference

| Codec | 1080p Bitrate | Compression vs H.264 | License | Best For |
|-------|--------------|---------------------|---------|----------|
| H.264 / AVC | ~5,000 kbps | Baseline | MPEG LA royalty | Universal compatibility |
| VP9 | ~2,800 kbps | ~45% savings | Royalty-free | Web video |
| H.265 / HEVC | ~2,500 kbps | ~50% savings | 3 patent pools (costly) | 4K capture, mobile |
| AV1 | ~1,500–2,000 kbps | ~60–70% savings | Royalty-free | Next-gen VOD, streaming |
| H.266 / VVC | N/A (8K focus) | ~78% savings at 8K | Access Advance | Emerging 8K |

### 5.5 Rate Control

| Mode | Mechanism | Ideal Use Case |
|------|-----------|----------------|
| CBR | Fixed data rate; QP adjusted per frame | Live broadcast / RTMP |
| VBR | Bitrate varies with scene complexity | VOD storage |
| CRF | Constant perceptual quality; bitrate floats freely | Archival |
| Capped CRF | CRF with a hard bitrate ceiling | Streaming delivery (default) |

Default preset uses **Capped CRF** — consistent quality with predictable file sizes.

### 5.6 LGPL Licensing Constraint (Hard)

FFmpeg.wasm must be compiled without `--enable-gpl` and `--enable-nonfree`. This is a hard constraint that keeps the product commercially distributable. Any CI check that bundles a new WASM binary must verify this at build time. Libraries excluded as a result: `libx264`, `libx265`, `libfdk-aac`, `libaom` (certain builds).

---

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Max file size (no crash) | ≥ 4GB on Chrome/Edge with 8GB system RAM |
| UI responsiveness during transcode | ≥ 60fps main thread, < 16ms render budget |
| Initial page load (4G) | < 2s time to interactive |
| FFmpeg.wasm bundle size | ≤ 30MB gzipped (LGPL build, no GPL codecs) |
| Browser support | Chrome 94+, Edge 94+, Safari 16.4+, Firefox 130+ |
| WebCodecs requirement | Graceful fallback to FFmpeg.wasm if WebCodecs unavailable |
| OPFS requirement | Graceful fallback to in-memory streaming for files < 500MB if OPFS unavailable |
| TypeScript | Strict mode — no `any` types, no suppressed errors |
| Accessibility | WCAG 2.1 AA — keyboard navigation, screen reader labels, contrast ratios |
| Security | No user files leave the browser without explicit consent; backend API enforces auth on all endpoints |

---

## 7. Out of Scope

The following are not part of this product's current scope:

- **Live streaming or real-time broadcast** — CBR support is included for file output; actual RTMP/HLS live ingest is not
- **Video editing** — No trimming, cutting, merging, or timeline editing
- **Server-side transcoding** — All heavy processing runs in the browser; the backend API is for auth, job metadata, and AI microservice routing only
- **DRM-protected content** — No decryption of Widevine, PlayReady, or FairPlay streams
- **H.266/VVC output** — Tracked for future; insufficient hardware support and no viable JS encoder
- **Audio-only conversion** — No MP3/AAC/FLAC extraction workflows in v1
- **Cloud storage integrations** — No direct upload to YouTube, Google Drive, Dropbox in v1

---

## 8. Open Questions

| Question | Owner | Notes |
|----------|-------|-------|
| Which JS muxer for MKV? `mkvtoolnix-js` is unmaintained; FFmpeg mux-only may be the only path | Engineering | Blocks 4.9 |
| HEVC licensing — should we expose HEVC *output* at all given the 3-pool royalty structure? | Legal / Product | Affects codec menu |
| Safari WebCodecs support for AV1 — hardware encode is not available on Apple Silicon via browser; fallback latency may be unacceptable | Engineering | Affects P1 UX on Mac |
| Should Anime4K run client-side (WebGL shader) or server-side (FastAPI)? Client-side is faster; server-side gives us billing leverage | Architecture | Affects 4.12 |
| MongoDB vs. PostgreSQL for job history — job documents have variable structure but relational queries on user+status are common | Engineering | Affects 4.16 |

---

## 9. Appendix

### A. Deinterlacing Algorithm Reference

| Filter | Quality | Speed | Best For |
|--------|---------|-------|----------|
| Yadif (`mode=send_field`) | Good | Fast | General 30i → 60p |
| Bwdif (`mode=send_field`) | Better (edge preservation) | Moderate | 1080i HD content |
| NNEDI | Best (neural, hallucinates missing data) | Very slow | SD archival only |

### B. AI Enhancement Model Reference

| Model | Task | Speed | Notes |
|-------|------|-------|-------|
| RIFE | Frame interpolation (FPS boost) | Very fast, low VRAM | Default choice for FPS upconversion |
| DAIN | Frame interpolation (depth-aware) | Very slow | Optional; better occlusion handling |
| Real-ESRGAN | Upscaling + artifact removal | Moderate | Default general upscaler |
| Anime4K | Animation upscaling | Real-time (shader) | Auto-detect or manual selection |

### C. HDR Tone Mapping Operators

| Operator | Behavior | Recommended When |
|----------|----------|-----------------|
| Hable | Rolls off highlights; can darken overall image | General use, tolerates color shift |
| Mobius | Continuous trade-off between accuracy and detail | Default — better highlight retention |

NPL (Nominal Peak Luminance) default: 100 nits. Adjust based on source mastering metadata.
