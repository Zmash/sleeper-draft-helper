import { describe, it, expect } from 'vitest'
import { canOfferUndo } from './SetupPage'

// Reproduziert den Fehlerfall aus dem Code-Review:
// 1. Auto-Import (Force-Overwrite) legt Snapshot A an.
// 2. CSV-Import ueberschreibt das Board mit C, setzt aber NIE einen eigenen
//    Snapshot (handleCsvLoad ist tabu, siehe useBoardStore.js).
// 3. Der Store haelt also weiterhin den alten Snapshot A.
// Ohne Fix wuerde das CSV-Banner trotzdem "Rueckgaengig" anbieten und beim
// Klick faelschlich A statt C wiederherstellen -> stiller Datenverlust.
describe('canOfferUndo', () => {
  it('bietet nach CSV-Import kein Undo an, obwohl im Store noch ein alter Snapshot liegt', () => {
    const csvImportDone = { method: 'CSV', stats: { total: 3 }, canUndo: false }
    const staleSnapshotFromEarlierAutoImport = [{ name: 'Alter Spieler' }]

    expect(canOfferUndo(csvImportDone, staleSnapshotFromEarlierAutoImport)).toBe(false)
  })

  it('bietet nach Auto-Import Undo an, wenn ein Snapshot existiert', () => {
    const autoImportDone = { method: 'FantasyCalc + FFC', stats: { total: 3 }, canUndo: true }
    const snapshot = [{ name: 'Spieler' }]

    expect(canOfferUndo(autoImportDone, snapshot)).toBe(true)
  })

  it('bietet nach KTC-Import Undo an, wenn ein Snapshot existiert', () => {
    const ktcImportDone = { method: 'KTC', stats: { total: 3 }, canUndo: true }
    const snapshot = [{ name: 'Spieler' }]

    expect(canOfferUndo(ktcImportDone, snapshot)).toBe(true)
  })

  it('bietet auch bei undo-faehigem Import kein Undo an, wenn kein Snapshot existiert', () => {
    const autoImportDone = { method: 'FantasyCalc + FFC', stats: { total: 3 }, canUndo: true }

    expect(canOfferUndo(autoImportDone, null)).toBe(false)
  })

  it('gibt false zurueck, wenn kein Import-Ergebnis vorliegt', () => {
    expect(canOfferUndo(null, [{ name: 'x' }])).toBe(false)
  })
})
