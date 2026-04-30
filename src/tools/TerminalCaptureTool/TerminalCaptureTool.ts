/**
 * TerminalCaptureTool — Capture terminal output / scrollback buffer
 * Part of HeliosAE / AERIS Nexus
 *
 * Captures the visible terminal buffer or last N lines of output.
 * Works via:
 *   Linux:   `script` (built-in), tmux capture-pane, xterm scrollback
 *   Windows: PowerShell console buffer ($Host.UI.RawUI)
 */

import { execSync, spawnSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const TERMINAL_CAPTURE_TOOL_NAME = 'TerminalCapture'

const inputSchema = lazySchema(() =>
  z.strictObject({
    lines: z
      .number()
      .int()
      .min(1)
      .max(5000)
      .default(100)
      .describe('Number of lines to capture from scrollback buffer (default: 100)'),
    save_to: z
      .string()
      .optional()
      .describe('Optional path to save captured output as a text file'),
    include_timestamps: z
      .boolean()
      .default(false)
      .describe('Include timestamp header in output (default: false)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    content: z.string(),
    lines_captured: z.number(),
    backend: z.string(),
    saved_to: z.string().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

function commandAvailable(cmd: string): boolean {
  try {
    const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`
    execSync(check, { stdio: 'pipe', timeout: 1500 })
    return true
  } catch {
    return false
  }
}

// ── Linux backends ────────────────────────────────────────────────────────────

function captureViaTmux(lines: number): { text: string; backend: string } | null {
  const tmuxSocket = process.env.TMUX
  if (!tmuxSocket || !commandAvailable('tmux')) return null

  try {
    const result = spawnSync(
      'tmux',
      ['capture-pane', '-p', '-S', String(-lines)],
      { timeout: 3000, encoding: 'utf8' },
    )
    if (result.status === 0 && result.stdout) {
      return { text: result.stdout, backend: 'tmux' }
    }
  } catch {}
  return null
}

function captureViaScriptFile(lines: number): { text: string; backend: string } | null {
  // Many terminals log to typescript (script command default output)
  const typescriptFile = join(process.cwd(), 'typescript')
  if (!existsSync(typescriptFile)) return null

  try {
    const { readFileSync } = require('fs') as typeof import('fs')
    const content = readFileSync(typescriptFile, 'utf8')
    // Remove ANSI escape codes from script output
    const clean = content
      .replace(/\x1b\[[0-9;]*[mGKHF]/g, '')
      .replace(/\x1b\[[0-9;]*[ABCD]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
    const allLines = clean.split('\n')
    return { text: allLines.slice(-lines).join('\n'), backend: 'script-file' }
  } catch {}
  return null
}

function captureFallbackLinux(lines: number): { text: string; backend: string } {
  // Read from /proc/self/fd/0 or /dev/stdin history — not always available
  // Best universal fallback: read from shell history file
  const histfile = process.env.HISTFILE
    ?? join(homedir(), '.bash_history')

  try {
    const { readFileSync } = require('fs') as typeof import('fs')
    if (existsSync(histfile)) {
      const content = readFileSync(histfile, 'utf8')
      const allLines = content.trim().split('\n')
      const lastLines = allLines.slice(-Math.min(lines, allLines.length))
      return {
        text: `[Shell History — last ${lastLines.length} commands]\n${lastLines.join('\n')}`,
        backend: 'shell-history',
      }
    }
  } catch {}

  return {
    text: '[TerminalCaptureTool: No scrollback backend available in this environment.\nInstall tmux for best results: sudo apt install tmux]',
    backend: 'none',
  }
}

function captureLinux(lines: number): { text: string; backend: string } {
  // 1. tmux — best option (preserves full scrollback)
  const tmux = captureViaTmux(lines)
  if (tmux) return tmux

  // 2. script typescript file
  const scriptFile = captureViaScriptFile(lines)
  if (scriptFile) return scriptFile

  // 3. Fallback
  return captureFallbackLinux(lines)
}

// ── Windows backend ───────────────────────────────────────────────────────────

function captureWindows(lines: number): { text: string; backend: string } {
  const psScript = `
$bufHeight = $Host.UI.RawUI.BufferSize.Height
$bufWidth  = $Host.UI.RawUI.BufferSize.Width
$rect = New-Object System.Management.Automation.Host.Rectangle(
    0, [Math]::Max(0, $bufHeight - ${lines}), $bufWidth - 1, $bufHeight - 1
)
$buffer = $Host.UI.RawUI.GetBufferContents($rect)
$lines = @()
for ($row = 0; $row -lt $buffer.GetLength(0); $row++) {
    $line = ''
    for ($col = 0; $col -lt $buffer.GetLength(1); $col++) {
        $line += $buffer[$row, $col].Character
    }
    $lines += $line.TrimEnd()
}
$lines -join "\`n"
`
  try {
    const result = spawnSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 10_000, encoding: 'utf8', windowsHide: true },
    )
    if (result.status === 0 && result.stdout?.trim()) {
      return { text: result.stdout, backend: 'powershell-buffer' }
    }
  } catch {}

  return {
    text: '[TerminalCaptureTool: PowerShell buffer capture failed. Run in Windows Terminal for best results.]',
    backend: 'none',
  }
}

export const TerminalCaptureTool = buildTool({
  name: TERMINAL_CAPTURE_TOOL_NAME,
  searchHint: 'capture terminal output, read scrollback buffer, save terminal session',
  maxResultSizeChars: 50_000,
  async description() {
    return 'Capture the current terminal scrollback buffer or last N lines of output. Useful for reviewing what ran in the terminal.'
  },
  async prompt() {
    return `Capture terminal output from the current session's scrollback buffer.

Platform backends:
  Linux:   tmux capture-pane (best) → script typescript file → shell history
  Windows: PowerShell $Host.UI.RawUI console buffer

Use this to:
- Review what commands were run and their output
- Capture error output that scrolled off screen
- Save session logs to a file

Tip: For persistent capture on Linux, run your session inside tmux:
  tmux new-session`
  },
  get inputSchema(): InputSchema { return inputSchema() },
  get outputSchema(): OutputSchema { return outputSchema() },
  userFacingName() { return 'TerminalCapture' },
  isEnabled() { return true },
  isConcurrencySafe() { return true },
  isReadOnly() { return true },
  renderToolUseMessage(_input: z.infer<InputSchema>) { return null },
  async call(input: z.infer<InputSchema>) {
    const { text, backend } =
      process.platform === 'win32'
        ? captureWindows(input.lines)
        : captureLinux(input.lines)

    const allLines = text.split('\n')
    const captured = allLines.length

    let header = ''
    if (input.include_timestamps) {
      header = `[Captured: ${new Date().toISOString()} | Lines: ${captured} | Backend: ${backend}]\n${'─'.repeat(60)}\n`
    }

    const finalContent = header + text

    let savedTo: string | undefined
    if (input.save_to) {
      try {
        const dir = join(input.save_to, '..')
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        writeFileSync(input.save_to, finalContent, 'utf8')
        savedTo = input.save_to
      } catch (err) {
        // non-fatal — still return content
      }
    }

    return {
      data: {
        content: finalContent,
        lines_captured: captured,
        backend,
        saved_to: savedTo,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const { content: text, lines_captured, backend } = content as Output
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: `[TerminalCapture — ${lines_captured} lines via ${backend}]\n${text}`,
    }
  },
} satisfies ToolDef<InputSchema, Output>)

export default TerminalCaptureTool
