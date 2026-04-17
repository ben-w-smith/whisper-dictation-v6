import type { Meta, StoryObj } from '@storybook/react'

function TokenAudit() {
  return (
    <div className="p-6 space-y-8 bg-canvas min-h-screen">
      <h2 className="text-text-primary text-lg font-semibold">Token Audit — Switch themes in toolbar</h2>

      {/* Surfaces */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Surfaces</h3>
        <div className="flex gap-3">
          <div className="w-24 h-16 rounded-lg bg-canvas border border-border-custom flex items-center justify-center text-text-primary text-xs">canvas</div>
          <div className="w-24 h-16 rounded-lg bg-surface border border-border-custom flex items-center justify-center text-text-primary text-xs">surface</div>
          <div className="w-24 h-16 rounded-lg bg-surface-hover border border-border-custom flex items-center justify-center text-text-primary text-xs">hover</div>
          <div className="w-24 h-16 rounded-lg bg-surface-active border border-border-custom flex items-center justify-center text-text-primary text-xs">active</div>
        </div>
      </section>

      {/* Text */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Text</h3>
        <div className="space-y-1">
          <p className="text-text-primary text-sm">Primary text — The quick brown fox</p>
          <p className="text-text-secondary text-sm">Secondary text — The quick brown fox</p>
          <p className="text-text-muted text-sm">Muted text — The quick brown fox</p>
        </div>
      </section>

      {/* Accent */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Accent</h3>
        <div className="flex gap-3 items-center">
          <div className="w-24 h-10 rounded-lg bg-accent flex items-center justify-center text-white text-xs">accent</div>
          <div className="w-24 h-10 rounded-lg bg-accent-hover flex items-center justify-center text-white text-xs">hover</div>
          <div className="w-24 h-10 rounded-lg bg-accent-subtle flex items-center justify-center text-text-primary text-xs">subtle</div>
        </div>
      </section>

      {/* Borders */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Borders</h3>
        <div className="flex gap-3">
          <div className="w-24 h-16 rounded-lg bg-surface border border-border-custom flex items-center justify-center text-text-primary text-xs">custom</div>
          <div className="w-24 h-16 rounded-lg bg-surface border border-border-hover flex items-center justify-center text-text-primary text-xs">hover</div>
          <div className="w-24 h-16 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-text-primary text-xs">subtle</div>
        </div>
      </section>

      {/* Semantic Colors */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Semantic</h3>
        <div className="space-y-2">
          <div className="flex gap-3 items-center">
            <span className="text-success text-sm font-medium">Success text</span>
            <div className="w-24 h-8 rounded-lg bg-success-subtle flex items-center justify-center text-success text-xs">subtle</div>
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-warning text-sm font-medium">Warning text</span>
            <div className="w-24 h-8 rounded-lg bg-warning-subtle flex items-center justify-center text-warning text-xs">subtle</div>
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-danger text-sm font-medium">Danger text</span>
            <div className="w-24 h-8 rounded-lg bg-danger-subtle flex items-center justify-center text-danger text-xs">subtle</div>
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-info text-sm font-medium">Info text</span>
            <div className="w-24 h-8 rounded-lg bg-info-subtle flex items-center justify-center text-info text-xs">subtle</div>
          </div>
        </div>
      </section>

      {/* Toggle */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Toggle Off</h3>
        <div className="w-12 h-6 rounded-full bg-toggle-off" />
      </section>

      {/* Radius preview */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Radius Scale</h3>
        <div className="flex gap-3">
          <div className="w-16 h-16 bg-accent rounded-sm flex items-center justify-center text-white text-xs">sm</div>
          <div className="w-16 h-16 bg-accent rounded-md flex items-center justify-center text-white text-xs">md</div>
          <div className="w-16 h-16 bg-accent rounded-lg flex items-center justify-center text-white text-xs">lg</div>
          <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center text-white text-xs">xl</div>
          <div className="w-16 h-16 bg-accent rounded-pill flex items-center justify-center text-white text-xs">pill</div>
        </div>
      </section>

      {/* Buttons */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Buttons</h3>
        <div className="flex gap-3 items-center">
          <button className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">Primary</button>
          <button className="px-4 py-2 text-accent border border-accent rounded-lg hover:bg-accent-subtle text-sm font-medium transition-colors">Secondary</button>
        </div>
      </section>

      {/* Input */}
      <section>
        <h3 className="text-text-secondary text-sm font-medium mb-3 uppercase tracking-wide">Input</h3>
        <input
          className="px-3 py-1.5 border border-border-custom rounded-lg text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          placeholder="Sample input..."
        />
      </section>
    </div>
  )
}

const meta: Meta<typeof TokenAudit> = {
  title: 'Audit/TokenAudit',
  component: TokenAudit,
}

export default meta
type Story = StoryObj<typeof TokenAudit>

export const AllTokens: Story = {
  render: () => <TokenAudit />,
}
