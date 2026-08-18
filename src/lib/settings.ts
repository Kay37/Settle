export interface Settings {
  useAi: boolean
  /** Optional personal proxy that files dumps. See README. */
  filingEndpoint: string
  filingToken: string
  /** Local due notifications (installed PWA / supporting browsers). */
  reminders: boolean
  mutedPhrases: string[]
  defaultSnooze: 'tonight' | 'tomorrow' | 'weekend'
}

const KEY = 'settle.settings.v1'
const LEGACY = 'unload.settings.v1'

const defaults: Settings = {
  useAi: false,
  filingEndpoint: '',
  filingToken: '',
  reminders: false,
  mutedPhrases: [],
  defaultSnooze: 'tomorrow',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Settings> & {
      openaiApiKey?: string
    }
    return {
      useAi: Boolean(parsed.useAi),
      filingEndpoint:
        typeof parsed.filingEndpoint === 'string'
          ? parsed.filingEndpoint
          : '',
      filingToken:
        typeof parsed.filingToken === 'string'
          ? parsed.filingToken
          : typeof parsed.openaiApiKey === 'string'
            ? parsed.openaiApiKey
            : '',
      reminders: Boolean(parsed.reminders),
      mutedPhrases: Array.isArray(parsed.mutedPhrases)
        ? parsed.mutedPhrases.filter((p): p is string => typeof p === 'string')
        : [],
      defaultSnooze:
        parsed.defaultSnooze === 'tonight' ||
        parsed.defaultSnooze === 'weekend'
          ? parsed.defaultSnooze
          : 'tomorrow',
    }
  } catch {
    return defaults
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
}
