import React, { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { generateSecret } from '../services/syncCrypto'
import {
  couple, decouple, isCoupled, loadSyncState, buildPairingUrl, syncOnce, SYNC_EVENT,
} from '../services/syncClient'
import Icon from './Icon'

function qrSvg(text) {
  const qr = qrcode(0, 'M') // 0 = Version automatisch, M = mittlere Fehlerkorrektur
  qr.addData(text)
  qr.make()
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
}

export default function SyncSection() {
  const [coupled, setCoupled] = useState(() => isCoupled())
  const [showQr, setShowQr] = useState(false)
  const [badKey, setBadKey] = useState(false)

  useEffect(() => {
    const onStatus = (e) => setBadKey(e.detail === 'badkey')
    window.addEventListener(SYNC_EVENT, onStatus)
    return () => window.removeEventListener(SYNC_EVENT, onStatus)
  }, [])

  const url = useMemo(() => {
    const s = loadSyncState()
    if (!s?.secret || typeof location === 'undefined') return null
    return buildPairingUrl(s.secret, location.origin)
  }, [coupled, showQr])

  // WebCrypto gibt es nur im Secure Context. Ohne diesen Hinweis sieht der
  // Nutzer auf http:// nur einen Sync, der stumm nichts tut.
  const secure = typeof globalThis.crypto?.subtle !== 'undefined'

  function onCouple() {
    couple(generateSecret())
    setCoupled(true)
    setShowQr(true)
    // Sofort hochladen, nicht erst beim naechsten Takt: das zweite Geraet
    // startet beim Oeffnen des Links unmittelbar seinen ersten Abgleich. Bliebe
    // der Raum bis dahin leer, gaebe es dort den Stand des hinzukommenden
    // Geraets — und dieses Geraet zoege ihn sich. Wer koppelt, gibt den Ton an.
    syncOnce()
  }

  function onDecouple() {
    decouple()
    setCoupled(false)
    setShowQr(false)
    setBadKey(false)
  }

  return (
    <div className="sync-section">
      <div className="sync-head">
        <h3 className="sync-title">Geräte-Sync</h3>
        <span className={`sync-badge ${coupled ? 'is-on' : ''}`}>
          {coupled ? 'gekoppelt' : 'nicht gekoppelt'}
        </span>
      </div>

      <p className="muted text-xs">
        Deine Daten werden im Browser verschlüsselt, bevor sie hochgeladen werden.
        Der Schlüssel bleibt auf deinen Geräten — der Server kann den Inhalt nicht lesen.
        Beim Abgleich gewinnt immer der zuletzt gespeicherte Stand.
      </p>

      {!secure && (
        <p className="sync-warn text-xs">
          Ohne HTTPS steht die Verschlüsselung nicht zur Verfügung. Der Sync bleibt hier aus.
        </p>
      )}

      {badKey && (
        <p className="sync-warn text-xs">
          Die Kopplung passt nicht zu dem, was hinterlegt ist — der Stand wurde nicht
          übernommen. Koppel die Geräte neu.
        </p>
      )}

      {!coupled && (
        <button className="btn btn-primary" onClick={onCouple}>
          <Icon name="key" size={15} /> Geräte koppeln
        </button>
      )}

      {coupled && (
        <div className="sync-actions">
          <button className="btn btn-secondary" onClick={() => setShowQr((v) => !v)}>
            <Icon name="plus" size={15} /> {showQr ? 'QR ausblenden' : 'Weiteres Gerät koppeln'}
          </button>
          <button className="btn btn-ghost" onClick={onDecouple}>Trennen</button>
        </div>
      )}

      {coupled && showQr && url && (
        <div className="sync-pairing">
          {/* Der QR traegt einen Link, keinen Rohschluessel: dann genuegt die
              normale Kamera-App und die Seite braucht keinen eigenen Scanner. */}
          <div className="sync-qr" dangerouslySetInnerHTML={{ __html: qrSvg(url) }} />
          <label className="sync-url-label text-xs">
            Ohne Kamera: diesen Link auf dem anderen Gerät öffnen
            <input className="control" readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
        </div>
      )}
    </div>
  )
}
