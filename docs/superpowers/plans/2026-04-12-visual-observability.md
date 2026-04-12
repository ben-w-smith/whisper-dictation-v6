# Visual Observability Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Storybook, design mockup infrastructure, and a screenshot script so an AI agent can autonomously iterate on UI/UX by comparing screenshots against design mockups.

**Architecture:** Storybook runs as a standalone Vite dev server with component stories isolated from Electron/IPC. Each component gets stories with hardcoded props from shared mock fixtures. A `design/` directory holds reference mockup PNGs. A `pnpm screenshot` Playwright script captures full-app states.

**Tech Stack:** @storybook/react-vite 9, @storybook/addon-essentials, Playwright, React 19, Tailwind v4, Vite

---

## File Structure

### New Files
- `src/renderer/src/__fixtures__/settings.ts` — mock `AppSettings` objects
- `src/renderer/src/__fixtures__/transcriptions.ts` — mock `TranscriptionEntry[]` arrays
- `src/renderer/src/__fixtures__/pipeline.ts` — mock XState snapshots per pipeline state
- `src/renderer/src/__fixtures__/mockApi.ts` — window.api mock for Storybook
- `src/renderer/src/__fixtures__/index.ts` — barrel re-export
- `.storybook/main.ts` — Storybook config (Vite builder, Tailwind, aliases)
- `.storybook/preview.ts` — global decorators, CSS import
- `src/renderer/src/components/ToggleSwitch.stories.tsx`
- `src/renderer/src/components/ShortcutRecorder.stories.tsx`
- `src/renderer/src/components/Overlay.stories.tsx`
- `src/renderer/src/components/Onboarding.stories.tsx`
- `src/renderer/src/views/Settings.stories.tsx`
- `src/renderer/src/views/settings/GeneralPage.stories.tsx`
- `src/renderer/src/views/settings/ModelPage.stories.tsx`
- `src/renderer/src/views/settings/AIPage.stories.tsx`
- `src/renderer/src/views/settings/HistoryPage.stories.tsx`
- `src/renderer/src/views/settings/AboutPage.stories.tsx`
- `scripts/screenshot.ts` — Playwright full-app screenshot capture
- `design/README.md` — naming convention docs

---

> **Note:** The Settings → Home rename is handled on a separate branch. This plan uses the current `Settings` naming throughout. Story files reference `Settings` component and `views/settings/` paths.

---

### Task 1: Create Mock Fixtures

**Files:**
- Create: `src/renderer/src/__fixtures__/settings.ts`
- Create: `src/renderer/src/__fixtures__/transcriptions.ts`
- Create: `src/renderer/src/__fixtures__/pipeline.ts`
- Create: `src/renderer/src/__fixtures__/index.ts`

- [ ] **Step 1: Create settings fixtures**

Create `src/renderer/src/__fixtures__/settings.ts`:

```typescript
import type { AppSettings } from '@shared/types'

export const defaultSettings: AppSettings = {
  localModel: 'base.en',
  recordingMode: 'toggle',
  keyboardShortcut: 'Command+Shift+D',
  mouseButton: null,
  microphoneDeviceId: '',
  autoPaste: true,
  copyToClipboard: true,
  refinementEnabled: false,
  refinementModelPath: '',
  refinementIntensity: 'medium',
  showOverlay: true,
  playSounds: true,
  onboardingComplete: true,
}

export const refinementEnabledSettings: AppSettings = {
  ...defaultSettings,
  refinementEnabled: true,
  refinementModelPath: '/Users/example/models/gemma-4-E2B-Q4_K_M.gguf',
  refinementIntensity: 'medium',
}

export const pushToTalkSettings: AppSettings = {
  ...defaultSettings,
  recordingMode: 'push-to-talk',
  mouseButton: 3,
  keyboardShortcut: null,
}
```

- [ ] **Step 2: Create transcription fixtures**

Create `src/renderer/src/__fixtures__/transcriptions.ts`:

```typescript
import type { TranscriptionEntry } from '@shared/types'

export const emptyHistory: TranscriptionEntry[] = []

export const populatedHistory: TranscriptionEntry[] = [
  {
    id: '1',
    text: 'The quick brown fox jumps over the lazy dog. This is a sample transcription that demonstrates how the history list looks with a longer text entry.',
    rawText: 'the quick brown fox jumps over the lazy dog this is a sample transcription that demonstrates how the history list looks with a longer text entry',
    audioDurationMs: 4500,
    transcriptionProvider: 'local',
    timestamp: Date.now() - 300000, // 5 minutes ago
    wordCount: 27,
  },
  {
    id: '2',
    text: 'Hello world, this is a test transcription.',
    rawText: 'hello world this is a test transcription',
    audioDurationMs: 2000,
    transcriptionProvider: 'local',
    refinedWith: 'gemma-4-E2B',
    timestamp: Date.now() - 3600000, // 1 hour ago
    wordCount: 8,
  },
  {
    id: '3',
    text: 'Meeting notes: discuss the project timeline and deliverables for next quarter.',
    rawText: 'meeting notes discuss the project timeline and deliverables for next quarter',
    audioDurationMs: 3200,
    transcriptionProvider: 'local',
    timestamp: Date.now() - 86400000, // 1 day ago
    wordCount: 11,
  },
  {
    id: '4',
    text: 'Remind me to buy groceries on the way home.',
    rawText: 'remind me to buy groceries on the way home',
    audioDurationMs: 1800,
    transcriptionProvider: 'local',
    timestamp: Date.now() - 172800000, // 2 days ago
    wordCount: 9,
  },
  {
    id: '5',
    text: 'The implementation plan looks solid. Let\'s schedule a review session with the team to go over the architecture decisions before we start coding.',
    rawText: 'the implementation plan looks solid lets schedule a review session with the team to go over the architecture decisions before we start coding',
    audioDurationMs: 6100,
    transcriptionProvider: 'local',
    refinedWith: 'gemma-4-E2B',
    timestamp: Date.now() - 259200000, // 3 days ago
    wordCount: 26,
  },
]
```

- [ ] **Step 3: Create pipeline fixtures**

Create `src/renderer/src/__fixtures__/pipeline.ts`:

These are minimal mock XState snapshots that provide just enough shape for the Overlay component to render each state. The Overlay component accesses `state.matches()`, `state.context.audioLevels`, `state.context.error`, and `state.context.transcriptionText`.

```typescript
import type { AppError } from '@shared/types'

interface MockSnapshot {
  value: string
  context: {
    audioLevels: number[]
    elapsedMs: number
    transcriptionText: string
    rawTranscriptionText: string
    error: AppError | null
    audioDurationMs: number
  }
  matches: (state: string) => boolean
}

function createMockSnapshot(
  value: string,
  overrides: Partial<MockSnapshot['context']> = {}
): MockSnapshot {
  return {
    value,
    context: {
      audioLevels: [0.3, 0.5, 0.7, 0.4, 0.6],
      elapsedMs: 5000,
      transcriptionText: '',
      rawTranscriptionText: '',
      error: null,
      audioDurationMs: 5000,
      ...overrides,
    },
    matches(state: string) {
      return this.value === state
    },
  }
}

export const recordingState = createMockSnapshot('recording', {
  audioLevels: [0.3, 0.5, 0.7, 0.4, 0.6],
  elapsedMs: 5000,
})

export const transcribingState = createMockSnapshot('transcribing', {
  audioLevels: [],
  elapsedMs: 5200,
})

export const completeState = createMockSnapshot('complete', {
  audioLevels: [],
  elapsedMs: 0,
  transcriptionText: 'Hello, this is a test transcription that was just completed.',
  rawTranscriptionText: 'hello this is a test transcription that was just completed',
})

export const errorState = createMockSnapshot('error', {
  audioLevels: [],
  elapsedMs: 0,
  error: {
    code: 'MICROPHONE_DENIED',
    message: 'Microphone access denied',
    suggestion: 'Enable access in System Settings to use dictation.',
  },
})

export const recordingSilentState = createMockSnapshot('recording', {
  audioLevels: [0.05, 0.02, 0.03, 0.01, 0.04],
  elapsedMs: 12000,
})

export const recordingLoudState = createMockSnapshot('recording', {
  audioLevels: [0.8, 0.9, 0.95, 0.85, 0.92],
  elapsedMs: 3000,
})
```

- [ ] **Step 4: Create barrel export**

Create `src/renderer/src/__fixtures__/index.ts`:

```typescript
export { defaultSettings, refinementEnabledSettings, pushToTalkSettings } from './settings'
export { emptyHistory, populatedHistory } from './transcriptions'
export {
  recordingState,
  transcribingState,
  completeState,
  errorState,
  recordingSilentState,
  recordingLoudState,
} from './pipeline'
```

- [ ] **Step 5: Verify fixtures compile**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/__fixtures__/
git commit -m "feat: add mock fixtures for Storybook stories"
```

---

### Task 2: Set Up Storybook

**Files:**
- Create: `.storybook/main.ts`
- Create: `.storybook/preview.ts`
- Modify: `package.json` (add storybook scripts and dependencies)

- [ ] **Step 1: Install Storybook dependencies**

Run:
```bash
pnpm add -D storybook @storybook/react-vite @storybook/addon-essentials
```

- [ ] **Step 2: Create .storybook/main.ts**

Create `.storybook/main.ts`:

```typescript
import type { StorybookConfig } from '@storybook/react-vite'
import { resolve } from 'path'

const config: StorybookConfig = {
  stories: ['../src/renderer/src/**/*.stories.tsx'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: (config) => {
    // Mirror the renderer Vite config from electron.vite.config.ts
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...config.resolve.alias,
      '@shared': resolve(__dirname, '../src/shared'),
      '@renderer': resolve(__dirname, '../src/renderer/src'),
    }
    return config
  },
}

export default config
```

- [ ] **Step 3: Create .storybook/preview.ts**

Create `.storybook/preview.ts`:

```typescript
import '../src/renderer/src/styles/tokens.css'

export const parameters = {
  backgrounds: {
    default: 'canvas',
    values: [
      { name: 'canvas', value: '#fafaf9' },
      { name: 'surface', value: '#ffffff' },
    ],
  },
}
```

- [ ] **Step 4: Add Storybook scripts to package.json**

Add to `package.json` scripts:
```json
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

- [ ] **Step 5: Start Storybook and verify it launches**

Run: `pnpm storybook`
Expected: Storybook starts on http://localhost:6006. No stories yet (that's fine — just verify the server starts without errors).

- [ ] **Step 6: Commit**

```bash
git add .storybook/ package.json pnpm-lock.yaml
git commit -m "feat: add Storybook with React-Vite builder"
```

---

### Task 3: Write Stories for ToggleSwitch and ShortcutRecorder

These are the simplest components — good for validating the Storybook setup works end-to-end.

**Files:**
- Create: `src/renderer/src/components/ToggleSwitch.stories.tsx`
- Create: `src/renderer/src/components/ShortcutRecorder.stories.tsx`

- [ ] **Step 1: Write ToggleSwitch stories**

Create `src/renderer/src/components/ToggleSwitch.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { ToggleSwitch } from './ToggleSwitch'

const meta: Meta<typeof ToggleSwitch> = {
  title: 'Components/ToggleSwitch',
  component: ToggleSwitch,
  argTypes: {
    onChange: { action: 'changed' },
  },
}

export default meta
type Story = StoryObj<typeof ToggleSwitch>

export const Off: Story = {
  args: {
    checked: false,
    label: 'Toggle setting',
  },
}

export const On: Story = {
  args: {
    checked: true,
    label: 'Toggle setting',
  },
}

export const Disabled: Story = {
  args: {
    checked: false,
    disabled: true,
    label: 'Toggle setting',
  },
}

export const DisabledOn: Story = {
  args: {
    checked: true,
    disabled: true,
    label: 'Toggle setting',
  },
}
```

- [ ] **Step 2: Write ShortcutRecorder stories**

Create `src/renderer/src/components/ShortcutRecorder.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { ShortcutRecorder } from './ShortcutRecorder'

const meta: Meta<typeof ShortcutRecorder> = {
  title: 'Components/ShortcutRecorder',
  component: ShortcutRecorder,
  argTypes: {
    onChange: { action: 'changed' },
  },
}

export default meta
type Story = StoryObj<typeof ShortcutRecorder>

export const Empty: Story = {
  args: {
    value: null,
    mouseButton: null,
  },
}

export const WithKeyboardShortcut: Story = {
  args: {
    value: 'Command+Shift+D',
    mouseButton: null,
  },
}

export const WithMouseButton: Story = {
  args: {
    value: null,
    mouseButton: 3,
  },
}

export const Disabled: Story = {
  args: {
    value: 'Command+Shift+D',
    mouseButton: null,
    disabled: true,
  },
}
```

- [ ] **Step 3: Verify stories render**

Run: `pnpm storybook`
Expected: Storybook shows "Components" folder with ToggleSwitch and ShortcutRecorder stories. Each story renders correctly.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ToggleSwitch.stories.tsx src/renderer/src/components/ShortcutRecorder.stories.tsx
git commit -m "feat: add Storybook stories for ToggleSwitch and ShortcutRecorder"
```

---

### Task 4: Write Stories for Overlay and Onboarding

**Files:**
- Create: `src/renderer/src/components/Overlay.stories.tsx`
- Create: `src/renderer/src/components/Onboarding.stories.tsx`

- [ ] **Step 1: Write Overlay stories**

Create `src/renderer/src/components/Overlay.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { Overlay } from './Overlay'
import {
  recordingState,
  recordingSilentState,
  recordingLoudState,
  transcribingState,
  completeState,
  errorState,
} from '../__fixtures__'

const meta: Meta<typeof Overlay> = {
  title: 'Components/Overlay',
  component: Overlay,
  decorators: [
    (Story) => (
      <div className="h-[80px] w-[400px] bg-stone-900/85 backdrop-blur-xl rounded-full">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof Overlay>

export const Recording: Story = {
  args: {
    state: recordingState,
    send: () => {},
    elapsedMs: 5000,
  },
}

export const RecordingSilent: Story = {
  args: {
    state: recordingSilentState,
    send: () => {},
    elapsedMs: 12000,
  },
}

export const RecordingLoud: Story = {
  args: {
    state: recordingLoudState,
    send: () => {},
    elapsedMs: 3000,
  },
}

export const Transcribing: Story = {
  args: {
    state: transcribingState,
    send: () => {},
  },
}

export const Complete: Story = {
  args: {
    state: completeState,
    send: () => {},
  },
}

export const Error: Story = {
  args: {
    state: errorState,
    send: () => {},
  },
}
```

- [ ] **Step 2: Write Onboarding stories**

The Onboarding component calls `window.api` which doesn't exist in Storybook. We need to mock it. Add a decorator that provides `window.api`.

Create `src/renderer/src/components/Onboarding.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { Onboarding } from './Onboarding'

// Mock window.api for Storybook
const mockApi = {
  invoke: async (channel: string, ..._args: unknown[]) => {
    switch (channel) {
      case 'permissions:check':
        return { microphone: 'prompt', accessibility: 'prompt' }
      case 'settings:get':
        return {
          localModel: 'base.en',
          recordingMode: 'toggle',
          keyboardShortcut: 'Command+Shift+D',
          mouseButton: null,
        }
      case 'model:download':
        return undefined
      case 'settings:set':
        return undefined
      default:
        return undefined
    }
  },
  send: () => {},
  on: () => () => {},
}

const meta: Meta<typeof Onboarding> = {
  title: 'Components/Onboarding',
  component: Onboarding,
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = mockApi
      return (
        <div className="w-[600px] h-[700px]">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof Onboarding>

export const Step1Welcome: Story = {
  args: {
    onComplete: () => console.log('onboarding complete'),
  },
}

export const Step2Permissions: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = {
        ...mockApi,
        invoke: async (channel: string) => {
          if (channel === 'permissions:check') {
            return { microphone: 'granted', accessibility: 'prompt' }
          }
          return mockApi.invoke(channel)
        },
      }
      return <Story />
    },
  ],
  args: {
    onComplete: () => console.log('onboarding complete'),
  },
}

export const Step3ModelSelection: Story = {
  args: {
    onComplete: () => console.log('onboarding complete'),
  },
}
```

Note: Step2 and Step3 stories show the component but since Onboarding manages its own internal `step` state, Step1Welcome will always render step 1 by default. To show step 2/3, the component would need a `initialStep` prop or the story would need to drive the component's internal state. For now, Step1Welcome is the primary visual story. Steps 2 and 3 can be added later if the component gains an `initialStep` prop.

- [ ] **Step 3: Verify stories render**

Run: `pnpm storybook`
Expected: Overlay stories render for each state. Onboarding Step1Welcome renders the welcome screen.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/Overlay.stories.tsx src/renderer/src/components/Onboarding.stories.tsx
git commit -m "feat: add Storybook stories for Overlay and Onboarding"
```

---

### Task 5: Write Stories for Settings View and Sub-Pages

The sub-pages (GeneralPage, ModelPage, AIPage, HistoryPage, AboutPage) all call `window.api.invoke(IPC.GET_SETTINGS)` and other IPC channels. Stories need the `window.api` mock and a decorator that provides it.

**Files:**
- Create: `src/renderer/src/views/Settings.stories.tsx`
- Create: `src/renderer/src/views/settings/GeneralPage.stories.tsx`
- Create: `src/renderer/src/views/settings/ModelPage.stories.tsx`
- Create: `src/renderer/src/views/settings/AIPage.stories.tsx`
- Create: `src/renderer/src/views/settings/HistoryPage.stories.tsx`
- Create: `src/renderer/src/views/settings/AboutPage.stories.tsx`

- [ ] **Step 1: Create shared window.api mock**

Add to `src/renderer/src/__fixtures__/index.ts` a re-export of a new mock file.

Create `src/renderer/src/__fixtures__/mockApi.ts`:

```typescript
import { defaultSettings, refinementEnabledSettings } from './settings'
import { populatedHistory } from './transcriptions'

export function createMockApi(overrides: {
  settings?: Record<string, unknown>
  history?: unknown[]
  permissions?: { microphone: string; accessibility: string }
  downloadedModels?: string[]
} = {}) {
  const settings = overrides.settings ?? defaultSettings
  const history = overrides.history ?? populatedHistory
  const permissions = overrides.permissions ?? { microphone: 'granted', accessibility: 'granted' }
  const downloadedModels = overrides.downloadedModels ?? ['tiny.en', 'base.en', 'small.en']

  return {
    invoke: async (channel: string, ..._args: unknown[]) => {
      switch (channel) {
        case 'settings:get':
          return settings
        case 'settings:set':
          return undefined
        case 'history:get':
          return history
        case 'history:clear':
          return undefined
        case 'history:save':
          return undefined
        case 'permissions:check':
          return permissions
        case 'permissions:request-microphone':
          return true
        case 'model:downloaded-list':
          return downloadedModels
        case 'model:download':
          return undefined
        case 'app:version':
          return '6.0.0'
        default:
          return undefined
      }
    },
    send: () => {},
    on: () => () => {},
  }
}

export const defaultMockApi = createMockApi()

export const refinementMockApi = createMockApi({
  settings: refinementEnabledSettings,
})
```

Update `src/renderer/src/__fixtures__/index.ts` to add:
```typescript
export { createMockApi, defaultMockApi, refinementMockApi } from './mockApi'
```

- [ ] **Step 2: Write GeneralPage stories**

Create `src/renderer/src/views/settings/GeneralPage.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { GeneralPage } from './GeneralPage'
import { defaultMockApi } from '../../__fixtures__'

const meta: Meta<typeof GeneralPage> = {
  title: 'Views/Settings/General',
  component: GeneralPage,
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = defaultMockApi
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof GeneralPage>

export const Default: Story = {}
```

- [ ] **Step 3: Write ModelPage stories**

Create `src/renderer/src/views/settings/ModelPage.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { ModelPage } from './ModelPage'
import { defaultMockApi } from '../../__fixtures__'

const meta: Meta<typeof ModelPage> = {
  title: 'Views/Settings/Model',
  component: ModelPage,
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = defaultMockApi
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof ModelPage>

export const Default: Story = {}
```

- [ ] **Step 4: Write AIPage stories**

Create `src/renderer/src/views/settings/AIPage.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { AIPage } from './AIPage'
import { defaultMockApi, refinementMockApi } from '../../__fixtures__'

const meta: Meta<typeof AIPage> = {
  title: 'Views/Settings/AI',
  component: AIPage,
}

export default meta
type Story = StoryObj<typeof AIPage>

export const Disabled: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = defaultMockApi
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export const Enabled: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = refinementMockApi
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}
```

- [ ] **Step 5: Write HistoryPage stories**

Create `src/renderer/src/views/settings/HistoryPage.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { HistoryPage } from './HistoryPage'
import { createMockApi } from '../../__fixtures__'
import { emptyHistory, populatedHistory } from '../../__fixtures__'

const meta: Meta<typeof HistoryPage> = {
  title: 'Views/Settings/History',
  component: HistoryPage,
}

export default meta
type Story = StoryObj<typeof HistoryPage>

export const Empty: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = createMockApi({ history: emptyHistory })
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export const Populated: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = createMockApi({ history: populatedHistory })
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}
```

- [ ] **Step 6: Write AboutPage stories**

Create `src/renderer/src/views/settings/AboutPage.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { AboutPage } from './AboutPage'
import { defaultMockApi } from '../../__fixtures__'

const meta: Meta<typeof AboutPage> = {
  title: 'Views/Settings/About',
  component: AboutPage,
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = defaultMockApi
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof AboutPage>

export const Default: Story = {}
```

- [ ] **Step 7: Write Settings view stories**

Create `src/renderer/src/views/Settings.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { Settings } from './Settings'
import { defaultMockApi } from '../__fixtures__'

const meta: Meta<typeof Settings> = {
  title: 'Views/Settings',
  component: Settings,
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = defaultMockApi
      return (
        <div className="w-[800px] h-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof Settings>

export const GeneralPage: Story = {
  args: {
    initialPage: 'general',
  },
}

export const ModelPage: Story = {
  args: {
    initialPage: 'model',
  },
}

export const AIPage: Story = {
  args: {
    initialPage: 'ai',
  },
}

export const HistoryPage: Story = {
  args: {
    initialPage: 'history',
  },
}

export const AboutPage: Story = {
  args: {
    initialPage: 'about',
  },
}
```

- [ ] **Step 8: Verify all stories render**

Run: `pnpm storybook`
Expected: All stories render in Storybook without errors. Each sub-page shows realistic content.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/__fixtures__/mockApi.ts src/renderer/src/__fixtures__/index.ts src/renderer/src/views/Settings.stories.tsx src/renderer/src/views/settings/
git commit -m "feat: add Storybook stories for all views and components"
```

---

### Task 6: Create design/ Directory and Naming Convention

**Files:**
- Create: `design/.gitkeep`

- [ ] **Step 1: Create the directory with a README**

Create `design/README.md`:

```markdown
# Design Mockups

Drop mockup PNGs here for AI-driven visual iteration.

## Naming Convention

`{component}-{state}.png`

The AI pairs files against Storybook stories by name:

| Mockup File | Storybook Story |
|------------|----------------|
| `settings-general.png` | `Views/Settings/GeneralPage` |
| `settings-model.png` | `Views/Settings/ModelPage` |
| `settings-ai.png` | `Views/Settings/AIPage` |
| `settings-history.png` | `Views/Settings/HistoryPage` |
| `settings-about.png` | `Views/Settings/AboutPage` |
| `overlay-recording.png` | `Components/Overlay/Recording` |
| `overlay-transcribing.png` | `Components/Overlay/Transcribing` |
| `overlay-complete.png` | `Components/Overlay/Complete` |
| `overlay-error.png` | `Components/Overlay/Error` |
| `onboarding-welcome.png` | `Components/Onboarding/Step1Welcome` |
| `toggle-on.png` | `Components/ToggleSwitch/On` |
| `toggle-off.png` | `Components/ToggleSwitch/Off` |
```

- [ ] **Step 2: Commit**

```bash
git add design/
git commit -m "feat: add design/ directory for visual mockup references"
```

---

### Task 7: Add pnpm screenshot Script

**Files:**
- Create: `scripts/screenshot.ts`
- Modify: `package.json` (add screenshot script)

- [ ] **Step 1: Create the screenshot script**

Create `scripts/screenshot.ts`:

```typescript
import { _electron as electron, test } from '@playwright/test'
import { join } from 'path'
import { mkdirSync } from 'fs'

const SCREENSHOT_DIR = join(import.meta.dirname, '..', 'screenshots', 'current')

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const app = await electron.launch({
    args: [join(import.meta.dirname, '..')],
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: undefined,
    },
  })

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Navigate to settings view
  await window.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await window.waitForTimeout(500)

  // Screenshot the settings view
  await window.screenshot({ path: join(SCREENSHOT_DIR, 'settings-general.png') })

  // Navigate to each sub-page by clicking sidebar buttons
  const pages = ['Model', 'AI', 'History', 'About']
  for (const page of pages) {
    await window.click(`button:has-text("${page}")`)
    await window.waitForTimeout(300)
    await window.screenshot({ path: join(SCREENSHOT_DIR, `settings-${page.toLowerCase()}.png`) })
  }

  await app.close()
  console.log(`Screenshots saved to ${SCREENSHOT_DIR}`)
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Add script to package.json**

Add to `package.json` scripts:
```json
"screenshot": "npx tsx scripts/screenshot.ts"
```

- [ ] **Step 3: Create screenshots directory**

Create `screenshots/.gitkeep` and add to `.gitignore`:
```
screenshots/current/
```

- [ ] **Step 4: Commit**

```bash
git add scripts/screenshot.ts screenshots/.gitkeep package.json .gitignore
git commit -m "feat: add pnpm screenshot script for full-app captures"
```

---

## Self-Review

**1. Spec coverage:**
- Storybook setup: Task 2
- Stories with mock fixtures: Tasks 3, 4, 5
- design/ directory: Task 6
- pnpm screenshot: Task 7
- Mock fixtures: Task 1
- Settings → Home rename: handled on separate branch (not in this plan)

**2. Placeholder scan:** No TBD/TODO found. All code blocks contain actual implementation.

**3. Type consistency:**
- `SettingsPage` type used consistently (rename not part of this plan)
- `SettingsProps` interface matches usage
- Mock fixtures export types matching `@shared/types`
- `window.api` mock matches the IPC channels used by components
