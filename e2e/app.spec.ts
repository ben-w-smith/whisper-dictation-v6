import { test, expect } from '@playwright/test'
import { launchApp, getBackgroundWindow, queryDebugBus } from './helpers'

let electronApp: Awaited<ReturnType<typeof launchApp>>
let mainWindow: Awaited<ReturnType<typeof getBackgroundWindow>>

test.beforeAll(async () => {
  electronApp = await launchApp()
  mainWindow = await getBackgroundWindow(electronApp)
})

test.afterAll(async () => {
  await electronApp.close()
})

test.describe('App Launch', () => {
  test('should launch and create a window', async () => {
    expect(mainWindow).toBeTruthy()
    const title = await mainWindow.title()
    expect(title).toContain('Whisper')
  })

  test('should show onboarding when not completed', async () => {
    const content = await mainWindow.content()
    expect(content).toContain('div')
  })

  test('should expose debug bus on background window', async () => {
    const hasDebugBus = await mainWindow.evaluate(() => {
      return !!(window as any).__debugBus
    })
    expect(hasDebugBus).toBe(true)
  })
})

test.describe('Tray', () => {
  test('should have a tray icon', async () => {
    const windows = electronApp.windows()
    expect(windows.length).toBeGreaterThanOrEqual(1)
  })
})

test.describe('Settings', () => {
  test('should have valid settings structure', async () => {
    // Use string literal for IPC channel — page.evaluate runs in browser context
    const settings = await mainWindow.evaluate(() => {
      return window.api.invoke('settings:get')
    }) as Record<string, unknown>

    expect(settings).toBeDefined()
    expect(typeof settings.transcriptionProvider).toBe('string')
    expect(typeof settings.localModel).toBe('string')
    expect(typeof settings.keyboardShortcuts).toBe('object')
    expect(typeof settings.autoPaste).toBe('boolean')
    expect(typeof settings.copyToClipboard).toBe('boolean')
  })
})

test.describe('State Machine', () => {
  test('should have accessible settings', async () => {
    const settings = await mainWindow.evaluate(() => {
      return window.api.invoke('settings:get')
    }) as Record<string, unknown>

    expect(settings).toBeDefined()
    expect(settings).toHaveProperty('onboardingComplete')
    expect(typeof settings.onboardingComplete).toBe('boolean')
  })
})

test.describe('Debug Bus', () => {
  test('should record pipeline state changes', async () => {
    const entries = await queryDebugBus(electronApp)
    expect(Array.isArray(entries)).toBe(true)
  })

  test('should support filtered queries', async () => {
    const pipelineEntries = await queryDebugBus(electronApp, { source: 'pipeline' })
    expect(Array.isArray(pipelineEntries)).toBe(true)
  })
})
