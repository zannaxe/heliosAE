<div align="center">

```
 ██╗  ██╗███████╗██╗     ██╗ ██████╗ ███████╗     █████╗ ███████╗
 ██║  ██║██╔════╝██║     ██║██╔═══██╗██╔════╝    ██╔══██╗██╔════╝
 ███████║█████╗  ██║     ██║██║   ██║███████╗    ███████║█████╗
 ██╔══██║██╔══╝  ██║     ██║██║   ██║╚════██║    ██╔══██║██╔══╝
 ██║  ██║███████╗███████╗██║╚██████╔╝███████║    ██║  ██║███████╗
 ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝ ╚═════╝ ╚══════╝    ╚═╝  ╚═╝╚══════╝
```

**Personal AI Assistant — AERIS Nexus**

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-blue.svg)]()
[![Runtime](https://img.shields.io/badge/Runtime-Bun-orange.svg)](https://bun.sh)
[![Free](https://img.shields.io/badge/Cost-100%25%20Free-green.svg)]()

*Kendali penuh atas sistem kamu. Dari satu baris perintah.*

</div>

---

## Apa itu HeliosAE?

HeliosAE adalah AI personal assistant yang jalan langsung di terminal kamu — bukan di cloud, bukan di browser, tapi **di dalam sistem kamu**. Dia bisa mengontrol OS, mengelola file, menjalankan program, menjawab pertanyaan, browsing web, dan hampir semua yang kamu minta — semuanya gratis, tanpa bayar sepeser pun.

Dibangun di atas fondasi **Claude Code** (OpenClaude fork), dirombak total dari coding tool menjadi AI personal assistant. Analoginya: Jarvis dari Iron Man, tapi jalan di laptop kamu.

```
> cek proses yang makan RAM paling banyak
> buka VSCode di folder proyek aku
> list semua file .log lebih dari 10MB di C:\Windows\Logs
> install paket npm ini dan jalankan test-nya
> jelaskan error ini dan perbaiki
> cari berita AI terbaru hari ini
```

---

## Fitur Utama

### Kontrol Sistem Penuh
Akses langsung ke OS via PowerShell (Windows) atau Bash (Linux). Cek hardware, kelola proses dan service, buka aplikasi, kelola file — semua dari satu prompt.

### Smart Routing Otomatis
Dua provider gratis, dipilih otomatis berdasarkan kebutuhan:

| Kondisi | Provider | Model |
|---|---|---|
| Query cepat / pendek | **Groq** | `llama-3.3-70b-versatile` |
| Context panjang (>50K token) | **Gemini** | `gemini-2.0-flash` |
| Task kompleks | **Gemini** | `gemini-2.0-flash` |
| Hanya satu key tersedia | Provider yang ada | Model default |

Switch terjadi otomatis mid-session — kamu tidak perlu melakukan apapun.

### Cross-Platform
Satu codebase, dua OS. Berjalan identik di Windows 11 dan Linux (semua distro). Persona dan instruksi shell menyesuaikan OS yang terdeteksi secara otomatis saat startup.

### Full Auto Execution
Helios mengeksekusi langsung tanpa tanya-tanya, kecuali untuk aksi yang benar-benar destruktif (hapus permanen, modifikasi system files). Kalau tidak berbahaya, langsung jalan.

### Bahasa Indonesia Native
Helios berkomunikasi dalam Bahasa Indonesia secara default, switch ke English natural untuk konten teknis, dan mengikuti bahasa kamu kalau kamu yang mulai duluan.

---

## Quick Start

### Windows 11

**1. Clone project**
```powershell
git clone https://github.com/your-username/HeliosAE.git
cd HeliosAE
```

**2. Jalankan installer**
```powershell
.\INSTALL.ps1
```
Installer otomatis: cek dan install Bun, install dependencies, build project, buat config dir, tambah alias `helios` ke PowerShell profile.

**3. Isi API key**

Edit `%USERPROFILE%\.helios\.env`:
```env
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

**4. Jalankan**
```powershell
helios
```

---

### Linux

**1. Clone project**
```bash
git clone https://github.com/your-username/HeliosAE.git
cd HeliosAE
```

**2. Jalankan installer**
```bash
bash install.sh
```

**3. Isi API key**

Edit `~/.helios/.env`:
```env
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

**4. Jalankan**
```bash
helios
```

---

## Dapetin API Key (Gratis)

| Provider | Link | Batas Free |
|---|---|---|
| **Gemini** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | 1,500 req/hari, 1M token context |
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | 14,400 req/hari, super cepat |

Tidak butuh kartu kredit. Tidak ada trial period. Langsung pakai.

---

## Konfigurasi

Semua konfigurasi di `~/.helios/.env` (Linux) atau `%USERPROFILE%\.helios\.env` (Windows):

```env
# ── API Keys (wajib minimal satu) ─────────────────────────────
GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...

# ── Provider Control (opsional) ───────────────────────────────
HELIOS_PROVIDER=auto          # auto | gemini | groq
HELIOS_MODEL=                 # override model, kosong = default
HELIOS_SMART_ROUTE=1          # 1 = aktif (default) | 0 = nonaktif

# ── Model Alternatives ────────────────────────────────────────
# Gemini faster:    HELIOS_MODEL=gemini-2.0-flash
# Gemini smarter:   HELIOS_MODEL=gemini-2.5-pro-exp-03-25
# Groq fastest:     HELIOS_MODEL=llama-3.1-8b-instant
# Groq reasoning:   HELIOS_MODEL=deepseek-r1-distill-llama-70b
```

---

## Slash Commands

Di dalam sesi HeliosAE, ketik `/` untuk akses commands:

| Command | Alias | Fungsi |
|---|---|---|
| `/helios-status` | `/provider`, `/helios` | Tampilkan provider aktif, model, dan routing info |
| `/helios-models` | `/models` | List semua model Gemini + Groq yang tersedia |
| `/model` | | Ganti model untuk sesi ini |
| `/clear` | | Bersihkan conversation history |
| `/memory` | | Kelola memori Helios |
| `/mcp` | | Kelola MCP servers |
| `/help` | | Tampilkan semua commands |

---

## Cek Status Provider

```bash
# Lihat provider yang aktif dan latency-nya
python3 smart_router.py --status

# Simulasi routing untuk context tertentu
python3 smart_router.py --context-chars 1000    # → Groq
python3 smart_router.py --context-chars 10000   # → Gemini
python3 smart_router.py --is-complex            # → Gemini
```

---

## PowerShell di Linux (Opsional)

HeliosAE berjalan penuh di Linux **tanpa PowerShell** — BashTool menangani semua system control. Kalau kamu ingin PowerShell juga tersedia:

```bash
# Ubuntu / Debian
sudo apt install -y powershell

# Fedora / RHEL
sudo dnf install -y powershell

# Arch
yay -S powershell-bin

# Universal
sudo snap install powershell --classic
```

---

## Build Manual

Kalau tidak mau pakai installer:

```bash
# Install Bun (kalau belum ada)
# Linux/macOS:
curl -fsSL https://bun.sh/install | bash
# Windows:
irm bun.sh/install.ps1 | iex

# Install deps & build
bun install
bun run build

# Jalankan
node dist/cli.mjs
```

---

## Arsitektur

```
User prompt
    │
    ▼
heliosEnv.ts          ← load ~/.helios/.env
heliosProviders.ts     ← pilih Groq atau Gemini
    │
    ▼
QueryEngine.ts         ← loop percakapan
    ├── applySmartRoute()   ← auto-switch provider per request
    └── query()             ← kirim ke provider via OpenAI-compatible shim
            │
            ▼
    Groq API  atau  Gemini API
            │
            ▼
    [HELIOS ⚡] response di terminal
```

**Core tools yang aktif:**
`BashTool` · `PowerShellTool` · `FileReadTool` · `FileWriteTool` · `FileEditTool` · `GlobTool` · `GrepTool` · `WebSearchTool` · `WebFetchTool` · `AgentTool` · `TodoWriteTool` · `MCPTool` · `LSPTool` · `ScheduleCronTool`

---

## Bagian dari AERIS Nexus

HeliosAE adalah komponen AI assistant dari ekosistem **AERIS Nexus** — sistem AI personal yang dirancang untuk berjalan lokal, privat, dan gratis.

---

## Lisensi

MIT — bebas dipakai, dimodifikasi, dan didistribusikan.

---

<div align="center">

**Built on [OpenClaude](https://github.com/gitlawb/openclaude) · Powered by [Gemini](https://aistudio.google.com) & [Groq](https://groq.com)**

</div>
