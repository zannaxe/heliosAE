/**
 * HeliosAE — Environment Loader
 * Loads ~/.helios/.env before provider bootstrap.
 *
 * Features:
 * - Skips comment lines (#)
 * - Supports quoted values ("value" or 'value')
 * - Handles inline comments (KEY=value # comment)
 * - Does NOT override existing env vars (shell env takes priority)
 * - Graceful fail — never throws, always returns
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export function loadHeliosEnv(): void {
  // Support both USERPROFILE (Windows) and HOME (Linux/macOS)
  const homeDir = process.env['USERPROFILE'] ?? process.env['HOME'] ?? homedir()
  const envPath = join(homeDir, '.helios', '.env')
  if (!existsSync(envPath)) return

  let lines: string[]
  try {
    lines = readFileSync(envPath, 'utf8').split('\n')
  } catch {
    // Permission error or file disappeared — silently skip
    return
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    if (!key) continue

    // Get raw value, strip inline comment
    let val = trimmed.slice(eqIdx + 1)

    // Strip inline comment (only outside quotes)
    const hashIdx = val.search(/\s+#/)
    if (hashIdx !== -1) {
      val = val.slice(0, hashIdx)
    }

    val = val.trim()

    // Strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }

    // Shell env vars take priority — never override what's already set
    if (key && !(key in process.env)) {
      process.env[key] = val
    }
  }
}
