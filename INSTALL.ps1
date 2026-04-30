# HeliosAE Auto-Installer untuk Windows 11
# Bagian dari AERIS Nexus
# Jalankan di PowerShell: .\INSTALL.ps1

$ErrorActionPreference = "Stop"
$HeliosDir = "$env:USERPROFILE\.helios"
$EnvFile = "$HeliosDir\.env"

Write-Host ""
Write-Host "  ██╗  ██╗███████╗██╗     ██╗ ██████╗ ███████╗" -ForegroundColor Cyan
Write-Host "  ██║  ██║██╔════╝██║     ██║██╔═══██╗██╔════╝" -ForegroundColor Cyan
Write-Host "  ███████║█████╗  ██║     ██║██║   ██║███████╗" -ForegroundColor Cyan
Write-Host "  ██╔══██║██╔══╝  ██║     ██║██║   ██║╚════██║" -ForegroundColor Cyan
Write-Host "  ██║  ██║███████╗███████╗██║╚██████╔╝███████║" -ForegroundColor Cyan
Write-Host "  ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝ ╚═════╝ ╚══════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  AERIS Nexus — Personal AI System Installer" -ForegroundColor Yellow
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── 1. Cek Bun ────────────────────────────────────────────────────────────────
Write-Host "[1/5] Cek Bun..." -ForegroundColor Yellow
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "  → Bun tidak ditemukan. Install sekarang..." -ForegroundColor Gray
    try {
        irm bun.sh/install.ps1 | iex
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";" + $env:PATH
        Write-Host "  ✓ Bun berhasil diinstall" -ForegroundColor Green
        Write-Host "  ⚠  Restart terminal setelah install selesai jika ada error PATH" -ForegroundColor Yellow
    } catch {
        Write-Host "  ✗ Gagal install Bun: $_" -ForegroundColor Red
        Write-Host "  Install manual: https://bun.sh/docs/installation" -ForegroundColor Gray
        exit 1
    }
} else {
    $bunVersion = bun --version
    Write-Host "  ✓ Bun $bunVersion sudah terinstall" -ForegroundColor Green
}

# ── 2. Cek Python ────────────────────────────────────────────────────────────
Write-Host "[2/5] Cek Python..." -ForegroundColor Yellow
$pythonCmd = $null
foreach ($cmd in @("python3", "python")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $pythonCmd = $cmd
        break
    }
}
if ($pythonCmd) {
    $pyVersion = & $pythonCmd --version
    Write-Host "  ✓ $pyVersion ditemukan" -ForegroundColor Green
} else {
    Write-Host "  ⚠  Python tidak ditemukan. Smart router tidak akan berjalan." -ForegroundColor Yellow
    Write-Host "  Install Python 3.10+ dari https://python.org" -ForegroundColor Gray
}

# ── 3. Install dependencies ───────────────────────────────────────────────────
Write-Host "[3/5] Install dependencies..." -ForegroundColor Yellow
try {
    # Tanpa --frozen-lockfile agar aman saat lockfile belum ada
    & bun install
    Write-Host "  ✓ Dependencies terinstall" -ForegroundColor Green
} catch {
    Write-Host "  ✗ bun install gagal: $_" -ForegroundColor Red
    exit 1
}

# ── 3b. Install Python deps untuk smart router ───────────────────────────────
if ($pythonCmd) {
    Write-Host "[3b] Install Python deps (httpx untuk smart router)..." -ForegroundColor Yellow
    try {
        & $pythonCmd -m pip install httpx --quiet 2>&1 | Out-Null
        Write-Host "  ✓ httpx terinstall" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠  httpx gagal diinstall — smart router pakai mode offline" -ForegroundColor Yellow
    }
}

# ── 4. Build ───────────────────────────────────────────────────────────────────
Write-Host "[4/5] Build HeliosAE..." -ForegroundColor Yellow
try {
    # Fix: tampilkan output build secara live, tidak di-suppress
    & bun run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build exit code: $LASTEXITCODE"
    }
    if (Test-Path "dist\cli.mjs") {
        Write-Host "  ✓ Build berhasil → dist\cli.mjs" -ForegroundColor Green
    } else {
        throw "dist\cli.mjs tidak ditemukan setelah build"
    }
} catch {
    Write-Host "  ✗ Build gagal: $_" -ForegroundColor Red
    Write-Host "  Coba jalankan manual: bun run build" -ForegroundColor Gray
    exit 1
}

# ── 5. Setup config dir + .env ────────────────────────────────────────────────
Write-Host "[5/5] Setup konfigurasi..." -ForegroundColor Yellow

if (-not (Test-Path $HeliosDir)) {
    New-Item -ItemType Directory -Path $HeliosDir | Out-Null
    Write-Host "  ✓ Dibuat $HeliosDir" -ForegroundColor Green
}

if (-not (Test-Path $EnvFile)) {
    $envTemplate = @"
# HeliosAE Configuration — AERIS Nexus
# ────────────────────────────────────────────────────────
# Isi minimal SATU dari dua API key di bawah ini.
# Keduanya GRATIS, tidak butuh kartu kredit.

# Gemini (Google AI Studio) — 1M context, reasoning dalam (2.5 Pro)
# Ambil key gratis: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=

# Groq — super cepat, response real-time
# Ambil key gratis: https://console.groq.com/keys
GROQ_API_KEY=

# ── Optional ──────────────────────────────────────────────
# HELIOS_PROVIDER=auto        # auto|gemini|groq
# HELIOS_MODEL=               # override model (kosong = default)
# HELIOS_SMART_ROUTE=1        # 1=aktif (default) | 0=nonaktif
"@
    Set-Content -Path $EnvFile -Value $envTemplate -Encoding UTF8
    Write-Host "  ✓ Template config dibuat: $EnvFile" -ForegroundColor Green
    Write-Host "  → Edit file tersebut dan isi API key kamu" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ Config sudah ada: $EnvFile" -ForegroundColor Green
}

# ── Setup PATH shortcut ────────────────────────────────────────────────────────
$heliosScript = "$HeliosDir\helios.ps1"
$currentDir = Get-Location
$cliPath = Join-Path $currentDir "dist\cli.mjs"

$scriptContent = @"
# HeliosAE launcher — generated by INSTALL.ps1
node "$cliPath" `$args
"@
Set-Content -Path $heliosScript -Value $scriptContent -Encoding UTF8

# Tambah alias ke PowerShell profile jika belum ada
$profileDir = Split-Path $PROFILE
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}
if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
}

$aliasLine = "function helios { & `"$heliosScript`" `$args }"
$profileContent = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
if (-not $profileContent -or $profileContent -notlike "*helios*") {
    Add-Content -Path $PROFILE -Value "`n# HeliosAE — AERIS Nexus`n$aliasLine"
    Write-Host "  ✓ Alias 'helios' ditambahkan ke PowerShell profile" -ForegroundColor Green
} else {
    Write-Host "  ✓ Alias 'helios' sudah ada di profile" -ForegroundColor Green
}

# ── Done ───────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✓  HeliosAE berhasil diinstall!" -ForegroundColor Green
Write-Host "  ════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Langkah selanjutnya:" -ForegroundColor Yellow
Write-Host "  1. Edit $EnvFile" -ForegroundColor White
Write-Host "     Isi GEMINI_API_KEY atau GROQ_API_KEY (atau keduanya)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Restart terminal (biar alias 'helios' aktif)" -ForegroundColor White
Write-Host ""
Write-Host "  3. Jalankan:" -ForegroundColor White
Write-Host "     helios" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Atau jalankan langsung sekarang:" -ForegroundColor White
Write-Host "     node dist\cli.mjs" -ForegroundColor Cyan
Write-Host ""
