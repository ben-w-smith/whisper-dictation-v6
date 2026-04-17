# Agent transcripts

Temporary holding area for Cursor agent chat exports that other agentic sessions may want to reference for context. These are not part of the product — delete when no longer needed for in-flight work.

## Index

| File | What it is | Keep until |
|---|---|---|
| `cursor_application_review.md` | Initial thorough review of the whisper-dictation-v6 app that seeded the three major plans (shortcut overhaul, window-id addressing, audio-capture modernization). | After the three plans ship. |
| `cursor_ui_ux_review_for_jakub_antalek_s.md` | UI/UX review referenced while scoping `themeable-foundation`, `editorial-polish`, `overlay-border-beam`. | After editorial-polish and overlay-border-beam merge. |
| `cursor_themeable_foundation_review.md` | Code-review transcript for `plan/themeable-foundation`. | Now merged — keep briefly for audit trail. |
| `cursor_audio_capture_modernization_revi.md` | Code-review transcript for `plan/audio-capture-modernization`. | Now merged — keep briefly for audit trail. |
| `cursor_overlay_border_beam_review.md` | Code-review transcript for `plan/overlay-border-beam` (not yet merged). | After overlay-border-beam merges. |

## Conventions

- Filenames follow Cursor's default export naming (`cursor_<slug>.md`). Don't rename — keeps them traceable to their export.
- `.gitignore` blocks `cursor_*.md` at the repo root (to prevent accidental re-exports landing there). Files under this folder are explicitly tracked.
- Do not extend this folder with transcripts that aren't actively needed by another agent — put those in the private `agent-transcripts` folder under `~/.cursor/projects/…` instead.
