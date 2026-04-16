# Window ID Addressing (Replace Title-Based IPC Routing)

**Date:** 2026-04-16
**Status:** Done
**Owner:** Ben
**Related:** [shortcut-architecture.md](../shortcut-architecture.md), [2026-04-16-shortcut-unification.md](./2026-04-16-shortcut-unification.md)

## Problem

IPC relays in `src/main/ipc.ts` route messages between windows by looking them up with `BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Whisper Dictation')`. This is brittle for several reasons:

1. **Titles are user-visible strings** that HTML `<title>` tags can overwrite. `src/main/ipc.ts` L173 includes a defensive `e.preventDefault()` on `page-title-updated` specifically because HTML title changes broke routing.
2. **Localization / renaming risk** — if we ever rename the product or localize the window title, IPC silently breaks.
3. **String comparison is fragile** — typos and trailing whitespace drift produce runtime failures rather than compile errors.
4. **Test flakiness** — in E2E, if a window's title hasn't settled yet, the first IPC messages can route nowhere and disappear silently.
5. **Coupling with shortcut bugs** — bug #6 in `shortcut-architecture.md` ("Wrong window for capture response") traced back to title-based routing.

## Goal

A small, typed window registry keyed by logical role (`background`, `home`, `overlay`, `onboarding`) that is the single authority for window addressing in the main process.

## Non-Goals

- Changing window lifecycle or visibility rules
- Merging the background and overlay windows (tempting but out of scope)
- Removing window titles entirely — the user-facing app switcher still uses them

---

## Approach Summary

Introduce `src/main/windows.ts` with `registerWindow(role, win)` and `getWindow(role)`. Register windows at creation time (immediately after `new BrowserWindow(...)`, before load). Automatically unregister on `closed`. Replace every `getTitle()` lookup in `ipc.ts`, `tray.ts`, and other callers. Delete the `page-title-updated` guards once nothing depends on titles.

---

## Phase 1 — Window Registry Module

### New file

`src/main/windows.ts`

```ts
import { BrowserWindow } from 'electron'

export type WindowRole = 'background' | 'home' | 'overlay' | 'onboarding'

const registry = new Map<WindowRole, number>()  // role → BrowserWindow.id

export function registerWindow(role: WindowRole, win: BrowserWindow): void {
  registry.set(role, win.id)
  win.once('closed', () => {
    if (registry.get(role) === win.id) {
      registry.delete(role)
    }
  })
}

export function getWindow(role: WindowRole): BrowserWindow | null {
  const id = registry.get(role)
  if (id === undefined) return null
  const win = BrowserWindow.fromId(id)
  if (!win || win.isDestroyed()) {
    registry.delete(role)
    return null
  }
  return win
}

export function getAllRegistered(): Array<{ role: WindowRole; win: BrowserWindow }> {
  const out: Array<{ role: WindowRole; win: BrowserWindow }> = []
  for (const role of registry.keys()) {
    const win = getWindow(role)
    if (win) out.push({ role, win })
  }
  return out
}

/** Broadcast to every alive registered window. Convenience for settings/state updates. */
export function broadcast(channel: string, ...args: unknown[]): void {
  for (const { win } of getAllRegistered()) {
    win.webContents.send(channel, ...args)
  }
}

/** Safe send — no-ops if window doesn't exist or is destroyed. */
export function sendTo(role: WindowRole, channel: string, ...args: unknown[]): void {
  const win = getWindow(role)
  if (win) win.webContents.send(channel, ...args)
}
```

### Design notes

- **Why store `id` not the `BrowserWindow` directly?** Avoids holding a reference to a destroyed window if `closed` fires in an unexpected order. `BrowserWindow.fromId()` returns `null` cleanly after destruction.
- **Why auto-unregister on `closed`?** So consumers can't accidentally send to a zombie window. `closed` fires after the window is no longer usable, which is the right moment.
- **Why expose `broadcast` and `sendTo`?** These are the two patterns in `ipc.ts` today (`BrowserWindow.getAllWindows().forEach(win => win.webContents.send(...))` and the title-filtered send). Wrapping them prevents callers from having to import `BrowserWindow`.

### Tests

`src/main/windows.test.ts`:

- Register a window → `getWindow()` returns it
- Destroy the window → `getWindow()` returns null, registry entry gone
- Register two different roles → both retrievable independently
- Register same role twice → second replaces first (old id is orphaned, not leaked)
- `broadcast` delivers to all alive registered windows
- `sendTo` silent no-op if role not registered

---

## Phase 2 — Migrate Window Creation Sites

Register every window immediately after creation, before `loadURL` / `loadFile`.

### `src/main/index.ts` — background window

```ts
function createWindow(): void {
  mainWindow = new BrowserWindow({ /* ... */ })
  registerWindow('background', mainWindow)
  mainWindow.webContents.setBackgroundThrottling(false)
  // ... rest unchanged
}
```

### `src/main/ipc.ts` — onboarding & overlay windows

Search: `new BrowserWindow({` in `ipc.ts`

- L114 onboarding window → `registerWindow('onboarding', onboardingWin)` immediately after construction
- L145 overlay window → `registerWindow('overlay', overlayWin)` immediately after construction

### `src/main/tray.ts` — home window

Search: `openHomeWindow`, `openAboutWindow` creations

- Every `new BrowserWindow` gets a `registerWindow('home', ...)` line
- `openAboutWindow` routes to the home window with a hash; if it creates its own window, use role `'home'` too since they share the same registry slot (About is a tab within Home in the current UI)

### Validation

After Phase 2, `registry` should always reflect the real window set. Add a one-shot assertion in development:

```ts
app.on('browser-window-created', (_, win) => {
  setTimeout(() => {
    if (!getAllRegistered().some(r => r.win.id === win.id)) {
      console.warn(`[Windows] Unregistered window created: title="${win.getTitle()}", id=${win.id}`)
    }
  }, 100)
})
```

Remove the assertion before shipping; it's there to catch missed migration sites.

---

## Phase 3 — Migrate Relay Sites

Replace every `getAllWindows().find(w => w.getTitle() === ...)` call. The full list from `src/main/ipc.ts` as of this plan:

| Line | Purpose | Replace with |
|------|---------|--------------|
| L60 | Overlay state relay to overlay window | `sendTo('overlay', 'overlay:state-update', data)` |
| L75 | Dismiss relay to background window | `sendTo('background', IPC.OVERLAY_DISMISS, data)` |
| L83 | Ready relay to background window | `sendTo('background', IPC.OVERLAY_READY)` |
| L91 | Cancel relay to background window | `sendTo('background', IPC.OVERLAY_CANCEL)` |
| L103 | Main window lookup in SET_WINDOW_MODE | `getWindow('background')` |
| L109 | Existing onboarding check | `getWindow('onboarding')` |
| L143 | Existing overlay check | `getWindow('overlay')` |
| L188 | Overlay hide | `getWindow('overlay')?.hide()` |
| L206 | Main window lookup for shortcut re-register | `getWindow('background')` (also removed entirely in shortcut-unification plan) |
| L597 | Resume hotkey main window lookup | removed in shortcut-unification plan |
| L637 | Debug query main window lookup | `getWindow('background')` |

Also `ipc.ts` has several `BrowserWindow.getAllWindows().forEach((win) => ...)` broadcasts (e.g. L237, L263, L322, L338, L359, L394, L457, L517, L660). Replace with `broadcast(channel, data)`. The semantics are identical when every window is registered.

### `src/main/tray.ts`

- Any `getAllWindows().find(w => w.getTitle() === 'Home')` → `getWindow('home')`
- `setLastTranscription` / `updateTrayState` don't look up windows; no changes

---

## Phase 4 — Remove Title-Based Defenses

Once no code paths depend on window titles, delete the guards:

- `src/main/ipc.ts` L134 — `onboardingWin.on('page-title-updated', ...)` block
- `src/main/ipc.ts` L173 — `overlayWin.on('page-title-updated', ...)` block

Window titles now drift freely. Document this relaxation in a comment at the top of `windows.ts`:

> Window titles are user-facing and may be overwritten by renderer HTML. Do not use titles for IPC routing — use the `windows.ts` registry by role.

---

## Phase 5 — Verify & Test

### Integration test

`e2e/window-routing.spec.ts`:

- Launch app → background window registered
- Open settings → home window registered; IPC to home arrives correctly
- Close settings → home unregistered; IPC to home is no-op (no errors)
- Trigger recording → overlay window registered; overlay IPC routes correctly
- Finish recording → overlay still registered (hidden, not closed)
- Rebind shortcut from settings → capture response routes back to home (not background)

### Manual smoke

- Dictation flow end-to-end with settings open, then closed
- Onboarding flow — first-run ordering of window registration
- Force-quit overlay via Activity Monitor → registry should self-heal on next access

---

## Rollback

Low-risk change: each site is a mechanical replacement. Rollback = revert commit. No feature flag needed.

If the migration accidentally misses a site, behavior degrades silently (message goes nowhere) rather than crashing — which is also how the old system failed. Use the Phase 2 dev assertion to catch this during development.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Window registration happens after a message arrives (race) | Low | Register synchronously after `new BrowserWindow`; messages can't arrive before the window loads |
| A forgotten `getTitle()` site causes routing drift | Medium | Grep for `getTitle()` in `src/` as an acceptance check; add ESLint rule if a pattern exists |
| A third-party window (e.g. DevTools) shows up in `getAllWindows()` broadcasts | Low | `broadcast()` only iterates the registry, not `getAllWindows()`, so this is safer than status quo |
| Shortcut plan renames some IPC channels mid-flight | Medium | Do this plan first, then shortcut plan — order matters |

---

## Acceptance Criteria

- [ ] `src/main/windows.ts` exists and is unit-tested
- [ ] Zero calls to `BrowserWindow.getAllWindows().find(w => w.getTitle() === ...)` in `src/main/`
- [ ] Zero `page-title-updated` handlers in `src/main/`
- [ ] All `BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(...))` patterns replaced with `broadcast()` or `sendTo()`
- [ ] E2E test covers routing across window lifecycle
- [ ] `docs/shortcut-architecture.md` updated to reference registry (remove "title-based routing" section)
- [ ] No regressions in existing Playwright tests

---

## Open Questions

1. **Should we support multiple `home` windows simultaneously?** Today only one is allowed (ipc.ts checks for existing before creating). Registry naturally enforces one-per-role; if that ever changes, swap the registry value from `number` to `number[]`.
2. **Should the registry live in the preload script too?** No — preload runs per-renderer, has its own process boundary, and doesn't need to know about peer windows.
3. **Do we need a role for future windows (e.g. a floating "quick settings" popover)?** The type is a string union; extending it is a one-line change. No forward planning required.

---

## Estimate

- Phase 1 (registry): 2–3 hours
- Phase 2 (migrate creation): 1 hour
- Phase 3 (migrate relays): 2–3 hours
- Phase 4 (delete guards): 30 minutes
- Phase 5 (tests): 2–3 hours

**Total: ~1 day of focused work.** Low-risk prerequisite for the shortcut unification plan.

---

## Execution Order

Do this plan **before** the shortcut unification plan. Reasons:

1. The shortcut plan touches the same files (`ipc.ts`, `hotkeys.ts`) and will want to use `sendTo('home', ...)` for capture responses rather than `event.sender`.
2. This plan is smaller and self-contained — good warm-up and catches any registry design issues before they block the bigger refactor.
3. Rollback is trivial; no feature flag needed.
