import { BrowserWindow } from 'electron'

/**
 * Window title policy: titles are user-facing and may be overwritten by renderer
 * HTML. Do not use titles for IPC routing — use this registry by role.
 */

export type WindowRole = 'background' | 'home' | 'overlay' | 'onboarding' | 'about'

const registry = new Map<WindowRole, number>() // role → BrowserWindow.id

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
