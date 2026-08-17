type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

export function speechSupported(): boolean {
  const w = window as SpeechWindow
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export function createRecognizer(opts: {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onEnd: () => void
  onError: (message: string) => void
}): SpeechRecognitionLike | null {
  const w = window as SpeechWindow
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null

  const rec = new Ctor()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = navigator.language || 'en-US'

  rec.onresult = (event) => {
    let interim = ''
    let finals = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript
      if (event.results[i].isFinal) finals += piece
      else interim += piece
    }
    if (interim) opts.onPartial(interim)
    if (finals) opts.onFinal(finals)
  }

  rec.onerror = (e) => {
    if (e.error === 'aborted' || e.error === 'no-speech') return
    opts.onError(e.error)
  }

  rec.onend = () => opts.onEnd()

  return rec
}
