import type { Settings } from '../types'

/** Bottom sheet with reader settings. All values persist via useSettings. */
export function SettingsSheet({ settings, updateSettings, onClose }: {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="rounded-t-2xl bg-white px-5 pt-4 text-slate-900 dark:bg-[#101a2e] dark:text-slate-100"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reader settings</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 active:bg-slate-200 dark:active:bg-slate-700"
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <Row label="Theme">
          <Segmented
            value={settings.theme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(theme) => updateSettings({ theme })}
          />
        </Row>

        <Row label="Font size">
          <Segmented
            value={settings.fontSize}
            options={[
              { value: 's', label: 'S' },
              { value: 'm', label: 'M' },
              { value: 'l', label: 'L' },
              { value: 'xl', label: 'XL' },
            ]}
            onChange={(fontSize) => updateSettings({ fontSize })}
          />
        </Row>

        <Row label="Font">
          <Segmented
            value={settings.fontFamily}
            options={[
              { value: 'sans', label: 'Sans' },
              { value: 'serif', label: 'Serif' },
            ]}
            onChange={(fontFamily) => updateSettings({ fontFamily })}
          />
        </Row>

        <Row label="Smart timing" hint="Longer pauses at punctuation and paragraphs">
          <button
            role="switch"
            aria-checked={settings.smartTiming}
            onClick={() => updateSettings({ smartTiming: !settings.smartTiming })}
            className={`relative h-8 w-14 rounded-full transition-colors ${
              settings.smartTiming ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                settings.smartTiming ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </Row>

        {settings.smartTiming && (
          <Row label={`Pause length ×${settings.pauseMultiplier.toFixed(1)}`}>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.pauseMultiplier}
              onChange={(e) => updateSettings({ pauseMultiplier: Number(e.target.value) })}
              className="w-40"
              aria-label="Pause length multiplier"
            />
          </Row>
        )}

        <Row label={`Speed: ${settings.wpm} wpm`}>
          <input
            type="range"
            min={100}
            max={1000}
            step={25}
            value={settings.wpm}
            onChange={(e) => updateSettings({ wpm: Number(e.target.value) })}
            className="w-40"
            aria-label="Words per minute"
          />
        </Row>
      </div>
    </div>
  )
}

function Row({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-11 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            value === o.value
              ? 'bg-white text-slate-900 shadow dark:bg-slate-600 dark:text-white'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
