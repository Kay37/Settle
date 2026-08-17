export interface Settings {
  useAi: boolean
  /** Optional personal proxy that files dumps. See README. */
  filingEndpoint: string
  filingToken: string
}

const KEY = 'settle.settings.v1'
const LEGACY = 'unload.settings.v1'

const defaults: Settings = {
  useAi: false,
  filingEndpoint: '',
  filingToken: '',
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
    }
  } catch {
    return defaults
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
}
