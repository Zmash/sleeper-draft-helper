import '@testing-library/jest-dom'
import { webcrypto } from 'node:crypto'

// Expose global crypto for node environment tests
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto
}
