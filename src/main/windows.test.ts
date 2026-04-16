import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron BrowserWindow
const mockFromId = vi.fn()
vi.mock('electron', () => ({
  BrowserWindow: {
    fromId: mockFromId,
  },
}))

// Import after mocks are set up
const { registerWindow, getWindow, getAllRegistered, broadcast, sendTo } = await import('./windows')

function makeMockWin(id: number) {
  const listeners: Record<string, Function[]> = {}
  return {
    id,
    isDestroyed: vi.fn(() => false),
    webContents: {
      send: vi.fn(),
    },
    once: vi.fn((event: string, cb: Function) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    }),
    // Test helper: simulate the 'closed' event
    _fireClosed() {
      for (const cb of listeners['closed'] ?? []) cb()
    },
  }
}

describe('windows registry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-import resets module state — but vitest caches modules by default.
    // We work around this by clearing the internal registry via the test-only
    // pattern: register a fresh set of windows each test.
  })

  it('register + getWindow returns the window', () => {
    const mockWin = makeMockWin(1)
    mockFromId.mockReturnValue(mockWin)

    registerWindow('background', mockWin as any)
    const result = getWindow('background')

    expect(mockFromId).toHaveBeenCalledWith(1)
    expect(result).toBe(mockWin)
  })

  it('getWindow returns null after window is destroyed', () => {
    const mockWin = makeMockWin(2)
    mockFromId.mockReturnValue(mockWin)

    registerWindow('overlay', mockWin as any)

    // Simulate destroy
    mockWin.isDestroyed.mockReturnValue(true)
    mockFromId.mockReturnValue(null)

    const result = getWindow('overlay')
    expect(result).toBeNull()

    // Subsequent call skips fromId entirely (entry already cleaned)
    getWindow('overlay')
    expect(mockFromId).toHaveBeenCalledTimes(1) // only the first call above
  })

  it('getWindow returns null and cleans up when fromId returns null', () => {
    const mockWin = makeMockWin(3)
    mockFromId.mockReturnValue(mockWin)

    registerWindow('home', mockWin as any)

    // Now fromId returns null (window was destroyed externally)
    mockFromId.mockReturnValue(null)

    const result = getWindow('home')
    expect(result).toBeNull()
  })

  it('two different roles are independent', () => {
    const win1 = makeMockWin(10)
    const win2 = makeMockWin(20)

    mockFromId.mockImplementation((id: number) =>
      id === 10 ? win1 : id === 20 ? win2 : null,
    )

    registerWindow('background', win1 as any)
    registerWindow('overlay', win2 as any)

    expect(getWindow('background')).toBe(win1)
    expect(getWindow('overlay')).toBe(win2)
  })

  it('registering same role twice replaces the first', () => {
    const win1 = makeMockWin(11)
    const win2 = makeMockWin(12)

    mockFromId.mockImplementation((id: number) =>
      id === 11 ? win1 : id === 12 ? win2 : null,
    )

    registerWindow('home', win1 as any)
    registerWindow('home', win2 as any)

    // First window's closed handler should NOT clear the registry
    // (because win1.id !== the current registry value for 'home')
    win1._fireClosed()
    mockFromId.mockImplementation((id: number) =>
      id === 12 ? win2 : null,
    )

    expect(getWindow('home')).toBe(win2)
  })

  it('broadcast sends to all alive registered windows', () => {
    const win1 = makeMockWin(21)
    const win2 = makeMockWin(22)
    const win3 = makeMockWin(23)

    mockFromId.mockImplementation((id: number) => {
      if (id === 21) return win1
      if (id === 22) return win2
      if (id === 23) return win3
      return null
    })

    registerWindow('background', win1 as any)
    registerWindow('home', win2 as any)
    registerWindow('overlay', win3 as any)

    broadcast('test-channel', { foo: 'bar' })

    expect(win1.webContents.send).toHaveBeenCalledWith('test-channel', { foo: 'bar' })
    expect(win2.webContents.send).toHaveBeenCalledWith('test-channel', { foo: 'bar' })
    expect(win3.webContents.send).toHaveBeenCalledWith('test-channel', { foo: 'bar' })
  })

  it('broadcast skips destroyed windows', () => {
    const win1 = makeMockWin(31)
    const win2 = makeMockWin(32)

    mockFromId.mockImplementation((id: number) =>
      id === 31 ? win1 : id === 32 ? win2 : null,
    )

    registerWindow('background', win1 as any)
    registerWindow('home', win2 as any)

    // Destroy win1
    win1.isDestroyed.mockReturnValue(true)
    mockFromId.mockImplementation((id: number) => {
      if (id === 31) return null
      if (id === 32) return win2
      return null
    })

    broadcast('test-channel', 'data')

    expect(win1.webContents.send).not.toHaveBeenCalled()
    expect(win2.webContents.send).toHaveBeenCalledWith('test-channel', 'data')
  })

  it('sendTo sends to the specified role', () => {
    const win = makeMockWin(41)
    mockFromId.mockReturnValue(win)

    registerWindow('overlay', win as any)

    sendTo('overlay', 'my-channel', 42, 'hello')

    expect(win.webContents.send).toHaveBeenCalledWith('my-channel', 42, 'hello')
  })

  it('sendTo is a silent no-op if role is not registered', () => {
    // Should not throw
    sendTo('onboarding', 'any-channel', 'data')
    expect(mockFromId).not.toHaveBeenCalled()
  })

  it('closed handler cleans up registry entry', () => {
    const mockWin = makeMockWin(50)
    mockFromId.mockReturnValue(mockWin)

    registerWindow('onboarding', mockWin as any)

    // Verify it's there
    expect(getWindow('onboarding')).toBe(mockWin)

    // Simulate closed event
    mockWin._fireClosed()

    // fromId would return null now, but the registry entry is already gone
    // so getWindow returns null without calling fromId
    mockFromId.mockReturnValue(null)
    expect(getWindow('onboarding')).toBeNull()
  })
})
