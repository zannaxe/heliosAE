/**
 * HeliosAE Runtime Detection
 * Part of AERIS Nexus
 *
 * Detects OS, available shells, and capabilities at startup.
 * Used by tools and persona to pick the right execution path.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

export const IS_WINDOWS = process.platform === 'win32'
export const IS_LINUX = process.platform === 'linux'
export const IS_MAC = process.platform === 'darwin'

export const HOME_DIR = process.env['USERPROFILE'] ?? process.env['HOME'] ?? '~'
export const HELIOS_CONFIG_DIR = join(HOME_DIR, '.helios')
export const HELIOS_ENV_FILE = join(HELIOS_CONFIG_DIR, '.env')

// ── Shell detection ──────────────────────────────────────────────────────────

function commandExists(cmd: string): boolean {
  try {
    const check = IS_WINDOWS ? `where ${cmd}` : `which ${cmd}`
    execSync(check, { stdio: 'pipe', timeout: 2000 })
    return true
  } catch {
    return false
  }
}

// PowerShell: built-in on Windows, optional on Linux
export const HAS_POWERSHELL = IS_WINDOWS
  ? (commandExists('pwsh') || commandExists('powershell'))
  : commandExists('pwsh')

export const POWERSHELL_BIN = (() => {
  if (commandExists('pwsh')) return 'pwsh'
  if (IS_WINDOWS && commandExists('powershell')) return 'powershell'
  return null
})()

// Bash: built-in on Linux, optional on Windows (Git Bash / WSL)
export const BASH_BIN = (() => {
  if (!IS_WINDOWS) return '/bin/bash'
  // Windows: try Git Bash, then WSL
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe'
  if (existsSync(gitBash)) return gitBash
  if (commandExists('wsl')) return 'wsl'
  if (commandExists('bash')) return 'bash'
  return null
})()

export const HAS_BASH = BASH_BIN !== null

// Primary shell recommendation per OS
export const PRIMARY_SHELL: 'powershell' | 'bash' = IS_WINDOWS ? 'powershell' : 'bash'

// ── OS info ──────────────────────────────────────────────────────────────────

function getWindowsVersion(): string {
  try {
    // ver returns e.g. "Microsoft Windows [Version 10.0.22621.3296]"
    const raw = execSync('ver', { stdio: 'pipe', timeout: 2000, shell: true })
      .toString().trim()
    // Parse major.minor from version string
    const match = raw.match(/\[Version (\d+)\.(\d+)\.(\d+)/)
    if (match) {
      const major = parseInt(match[1] ?? '0')
      const minor = parseInt(match[2] ?? '0')
      const build = parseInt(match[3] ?? '0')
      // Windows 11 builds start at 22000+
      if (major === 10 && build >= 22000) return `Windows 11 (build ${build})`
      if (major === 10) return `Windows 10 (build ${build})`
      return `Windows ${major}.${minor} (build ${build})`
    }
    // Fallback: return raw output trimmed
    return raw.replace(/^Microsoft /, '').replace(/\[|\]/g, '').trim() || 'Windows'
  } catch {
    return 'Windows'
  }
}

function getLinuxDistro(): string {
  try {
    // Fix: tambahkan { shell: true } agar pipe dan redirect operator bekerja
    const osRelease = execSync('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME', {
      stdio: 'pipe', timeout: 1000, shell: true,
    }).toString()
    const match = osRelease.match(/PRETTY_NAME="([^"]+)"/)
    if (match) return match[1] ?? 'Linux'
  } catch {}
  try {
    return execSync('uname -sr', { stdio: 'pipe', timeout: 1000 }).toString().trim()
  } catch {}
  return 'Linux'
}

// Fix: OS_NAME sekarang detect versi Windows yang benar, bukan hardcode "Windows 11"
export const OS_NAME = IS_WINDOWS
  ? getWindowsVersion()
  : IS_LINUX
    ? getLinuxDistro()
    : IS_MAC ? 'macOS' : process.platform

// ── Capability summary (used in system prompt) ────────────────────────────────

export interface HeliosCapabilities {
  os: string
  primaryShell: 'powershell' | 'bash'
  hasPowerShell: boolean
  powershellBin: string | null
  hasBash: boolean
  bashBin: string | null
  homeDir: string
}

let _capabilities: HeliosCapabilities | null = null

export function getHeliosCapabilities(): HeliosCapabilities {
  if (_capabilities) return _capabilities
  _capabilities = {
    os: OS_NAME,
    primaryShell: PRIMARY_SHELL,
    hasPowerShell: HAS_POWERSHELL,
    powershellBin: POWERSHELL_BIN,
    hasBash: HAS_BASH,
    bashBin: BASH_BIN,
    homeDir: HOME_DIR,
  }
  return _capabilities
}

export function getCapabilitySummary(): string {
  const c = getHeliosCapabilities()
  const shells = [
    c.hasPowerShell ? `PowerShell (${c.powershellBin})` : null,
    c.hasBash ? `Bash (${c.bashBin})` : null,
  ].filter(Boolean).join(', ')

  return `OS: ${c.os} | Primary shell: ${c.primaryShell} | Available: ${shells || 'none detected'}`
}
