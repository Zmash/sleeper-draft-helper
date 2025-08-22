// src/utils/settingsTransfer.js

const VERSIONED_PREFIXES = ["sdh.playerPreferences", "sdh.setup", "sdh.strategy"];
const FIXED_KEYS = ["sdh_openai_api_key", "draft-helper-theme"];

function getAllLocalStorageKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

function findHighestVersionKey(prefix) {
  // passt auf z. B.: sdh.setup.v3  -> Gruppe (3)
  const rx = new RegExp(`^${prefix}\\.v(\\d+)$`);
  let best = null;

  for (const k of getAllLocalStorageKeys()) {
    const m = k.match(rx);
    if (m) {
      const v = Number(m[1]);
      if (!Number.isNaN(v) && (!best || v > best.v)) {
        best = { key: k, v };
      }
    }
  }
  return best ? best.key : null;
}

function collectKeysToExport() {
  const keys = new Set();

  // höchste versionierte Keys je Prefix
  for (const p of VERSIONED_PREFIXES) {
    const k = findHighestVersionKey(p);
    if (k) keys.add(k);
  }

  // Fixe Keys
  for (const k of FIXED_KEYS) {
    if (localStorage.getItem(k) !== null) keys.add(k);
  }

  return Array.from(keys);
}

/**
 * Exportiert die relevanten Settings in eine JSON-Datei (Download).
 * @param {string=} notes Freitext-Notiz, wird in die Datei geschrieben.
 * @returns {object} Die Export-Payload (z. B. für Tests)
 */
export function exportSettings(notes) {
  const keys = collectKeysToExport();
  const data = {};

  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = v;
  }

  const payload = {
    app: "SleeperDraftHelper",
    exportedAt: new Date().toISOString(),
    notes,
    data,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const stamp = Date.now(); // Millisekunden seit 1970
  const filename = `SleeperDraftHelper_Settings_${stamp}.json`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();

  return payload;
}

/**
 * Importiert eine zuvor exportierte JSON (als Objekt) und überschreibt vorhandene Keys.
 * Optional: alte vX-Versionen der gleichen Prefixe aufräumen.
 * @param {any} bundle Das geparste JSON-Objekt
 * @param {{ cleanupOldVersions?: boolean }=} options
 * @returns {{ applied: string[], skipped: string[] }}
 */
export function importSettingsObject(bundle, options) {
  const applied = [];
  const skipped = [];

  if (
    !bundle ||
    typeof bundle !== "object" ||
    bundle.app !== "SleeperDraftHelper" ||
    typeof bundle.data !== "object" ||
    bundle.data === null
  ) {
    throw new Error("Ungültiges Settings-Bundle.");
  }

  const data = bundle.data;

  // Vorbereitung für optionales Aufräumen
  const cleanupTargets = new Map(); // prefix -> keysToRemove[]
  if (options && options.cleanupOldVersions) {
    for (const prefix of VERSIONED_PREFIXES) {
      cleanupTargets.set(prefix, []);
    }

    const allKeys = getAllLocalStorageKeys();
    for (const k of allKeys) {
      for (const prefix of VERSIONED_PREFIXES) {
        if (new RegExp(`^${prefix}\\.v\\d+$`).test(k)) {
          cleanupTargets.get(prefix).push(k);
        }
      }
    }
  }

  // Anwenden & optional säubern
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== "string") {
      skipped.push(k);
      continue;
    }

    localStorage.setItem(k, v);
    applied.push(k);

    if (options && options.cleanupOldVersions) {
      const match = k.match(/^(.+)\.v(\d+)$/);
      if (match) {
        const prefix = match[1];
        const keep = k;
        const candidates = cleanupTargets.get(prefix);
        if (candidates && candidates.length) {
          for (const oldKey of candidates) {
            if (oldKey !== keep) {
              localStorage.removeItem(oldKey);
            }
          }
          // Liste für dieses Prefix leeren
          cleanupTargets.set(prefix, []);
        }
      }
    }
  }

  return { applied, skipped };
}

/**
 * Komfort: Import direkt von einer Datei (z. B. über <input type="file">).
 * @param {File} file
 * @param {{ cleanupOldVersions?: boolean }=} options
 * @returns {Promise<{ applied: string[], skipped: string[] }>}
 */
export async function importSettingsFromFile(file, options) {
  const text = await file.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error("Die Datei enthält kein gültiges JSON.");
  }
  return importSettingsObject(json, options);
}
