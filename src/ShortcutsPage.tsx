import { useEffect, useMemo, useState } from 'react'
import './index.css'

function sampleUrl(origin: string): string {
  return `${origin}/?dump=${encodeURIComponent('buy milk\ntext Sam tomorrow')}&unload=1`
}

export default function ShortcutsPage() {
  const origin = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    [],
  )
  const shortcutUrl = useMemo(() => sampleUrl(origin), [origin])
  const widgetUrl = `${origin}/widget`
  const shareTemplate = `${origin}/?dump=[text]&unload=1`
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!origin) return
    void import('qrcode').then((QR) =>
      QR.toDataURL(shortcutUrl, {
        margin: 1,
        width: 220,
        color: { dark: '#163328', light: '#f7f3ea' },
      }).then(setQr),
    )
  }, [origin, shortcutUrl])

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied('Could not copy')
    }
  }

  return (
    <div className="app shortcuts-page">
      <header className="hero">
        <h1 className="brand" style={{ fontSize: 'clamp(2rem, 8vw, 3rem)' }}>
          SETTLE
          <span className="brand-sub">iOS Shortcuts</span>
        </h1>
        <p className="tagline">
          Dictate a dump, pin Next 3 to your Home Screen, or share text into
          Settle — no extra app required.
        </p>
      </header>

      <section className="panel shortcuts-panel">
        <div className="shortcuts-card">
          <p className="kicker">Your host</p>
          <code className="shortcuts-url">{origin || '…'}</code>

          {qr && (
            <div className="qr-wrap">
              <img src={qr} alt="QR code for Settle shortcut URL" width={220} height={220} />
              <p className="thought-meta">Scan to open a sample dump on this device</p>
            </div>
          )}

          <h2>Dump shortcut</h2>
          <ol className="shortcuts-steps">
            <li>Open the <strong>Shortcuts</strong> app → <strong>New Shortcut</strong>.</li>
            <li>Add <strong>Ask for Input</strong> (or <strong>Dictate Text</strong>).</li>
            <li>Add <strong>URL</strong> and paste the template below.</li>
            <li>Add <strong>Open URLs</strong>.</li>
            <li>Name it <strong>Settle</strong> → Add to Home Screen.</li>
          </ol>

          <label className="field">
            <span>URL template (replace [text] with Shortcut Input)</span>
            <textarea
              className="sync-textarea"
              readOnly
              rows={3}
              value={shareTemplate}
            />
          </label>
          <div className="dump-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => copy(shareTemplate, 'template')}
            >
              {copied === 'template' ? 'Copied' : 'Copy template'}
            </button>
            <button
              type="button"
              className="btn-ghost light"
              onClick={() => copy(shortcutUrl, 'sample')}
            >
              {copied === 'sample' ? 'Copied' : 'Copy sample URL'}
            </button>
          </div>

          <h2>Today widget</h2>
          <p>
            iOS can&apos;t run a native WidgetKit widget for a web app, so this
            is the close equivalent: a compact Next 3 page you pin as a Home
            Screen icon or a Shortcuts widget.
          </p>
          <ol className="shortcuts-steps">
            <li>Open <a href="/widget">{widgetUrl || '/widget'}</a> in Safari.</li>
            <li>Share → <strong>Add to Home Screen</strong> → name it <strong>Next 3</strong>.</li>
            <li>
              Or: Shortcuts → New → <strong>Open URLs</strong> → paste the
              widget URL → Add to Home Screen / lock-screen widget.
            </li>
          </ol>
          <button
            type="button"
            className="btn-ghost light"
            onClick={() => copy(widgetUrl, 'widget')}
          >
            {copied === 'widget' ? 'Copied' : 'Copy widget URL'}
          </button>

          <h2>Share into Settle</h2>
          <p>
            On iPhone: Shortcuts → New → set it to receive <strong>Text</strong>{' '}
            from Share Sheet → Open URL with the dump template. Then Share from
            Notes, Mail, or Safari into Settle.
          </p>
          <p>
            On Android Chrome (installed PWA): use <strong>Share → Settle</strong>{' '}
            — the dump box fills from the shared text.
          </p>

          <p className="thought-meta" style={{ marginTop: '1rem' }}>
            <code>unload=1</code> auto-submits the dump. Remove it to review
            before Settle.
          </p>
        </div>

        <p className="shortcuts-back">
          <a href="/">← Back to Settle</a>
        </p>
      </section>
    </div>
  )
}
