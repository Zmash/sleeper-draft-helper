import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SyncSection from './SyncSection'
import { SYNC_KEY } from '../services/syncBundle'
import { loadSyncState, SYNC_EVENT } from '../services/syncClient'

beforeEach(() => localStorage.clear())

describe('SyncSection', () => {
  it('bietet ungekoppelt das Koppeln an', () => {
    render(<SyncSection />)
    expect(screen.getByRole('button', { name: /koppeln/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /trennen/i })).not.toBeInTheDocument()
  })

  it('erzeugt beim Koppeln ein Geheimnis und zeigt den QR-Code', () => {
    render(<SyncSection />)
    fireEvent.click(screen.getByRole('button', { name: /koppeln/i }))
    expect(loadSyncState()?.secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(document.querySelector('.sync-qr svg')).toBeTruthy()
  })

  // Der Schluessel muss auch ohne Kamera uebertragbar sein — viele PCs
  // haben keine, und dann ist der QR-Code nutzlos.
  it('zeigt den Kopplungslink zusaetzlich als Text', () => {
    render(<SyncSection />)
    fireEvent.click(screen.getByRole('button', { name: /koppeln/i }))
    const secret = loadSyncState().secret
    expect(screen.getByDisplayValue(new RegExp(secret.slice(0, 12)))).toBeInTheDocument()
  })

  it('zeigt gekoppelt den Trennen-Knopf', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ secret: 'A'.repeat(43), lastSeenStamp: null, lastSentBundle: null }))
    render(<SyncSection />)
    expect(screen.getByRole('button', { name: /trennen/i })).toBeInTheDocument()
  })

  it('raeumt beim Trennen den Speicher', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ secret: 'A'.repeat(43), lastSeenStamp: null, lastSentBundle: null }))
    render(<SyncSection />)
    fireEvent.click(screen.getByRole('button', { name: /trennen/i }))
    expect(localStorage.getItem(SYNC_KEY)).toBeNull()
    expect(screen.getByRole('button', { name: /koppeln/i })).toBeInTheDocument()
  })

  // Beim Koppeln gewinnt der zuletzt gespeicherte Stand — das muss dort
  // stehen, wo geklickt wird, nicht nur in der Spec.
  it('warnt, dass ein Stand verloren gehen kann', () => {
    render(<SyncSection />)
    expect(screen.getByText(/zuletzt gespeicherte Stand/i)).toBeInTheDocument()
  })

  // Ohne diese Anzeige sucht der Nutzer bei einer falschen Kopplung lange:
  // der Sync taete stumm nichts.
  it('meldet eine unpassende Kopplung', async () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ secret: 'A'.repeat(43), lastSeenStamp: null, lastSentBundle: null }))
    render(<SyncSection />)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: 'badkey' }))
    expect(await screen.findByText(/Kopplung passt nicht/i)).toBeInTheDocument()
  })

  it('meldet nichts, wenn der Abgleich laeuft', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ secret: 'A'.repeat(43), lastSeenStamp: null, lastSentBundle: null }))
    render(<SyncSection />)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: 'pushed' }))
    expect(screen.queryByText(/Kopplung passt nicht/i)).not.toBeInTheDocument()
  })
})
