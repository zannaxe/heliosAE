# HeliosAE ⚡
**Personal AI Assistant — AERIS Nexus**

HeliosAE adalah AI assistant personal yang berjalan langsung di sistem kamu via CLI. Dia bisa mengontrol Windows, mengelola file, menjalankan program, menjawab pertanyaan, dan melakukan hampir semua yang kamu minta — **semuanya gratis, tanpa bayar sepeser pun**.

Built on top of OpenClaude (Claude Code fork), dirombak total jadi personal system assistant ala Jarvis.

---

## Fitur Utama

- **Full auto-execution** — jalankan perintah langsung tanpa tanya-tanya (kecuali aksi destruktif)
- **Windows 11 native** — paham PowerShell, winget, Task Manager, registry, services, dll
- **Dual provider gratis** — Gemini (1M context) + Groq (super cepat), auto-switch berdasarkan kebutuhan
- **Smart routing** — otomatis pindah ke Gemini kalau konteks panjang, kembali ke Groq kalau ringan
- **Bahasa Indonesia** — ngobrol natural, jawab pakai bahasa yang sama
- **Context-aware** — ingat riwayat percakapan dalam satu sesi

---

## Provider yang Didukung (100% Gratis)

| Provider | Model Default | Keunggulan | Ambil Key |
|---|---|---|---|
| **Groq** | llama-3.3-70b-versatile | Super cepat, real-time, 128K context | [console.groq.com](https://console.groq.com) |
| **Gemini** | gemini-2.0-flash | Konteks 1 juta token, reasoning dalam | [aistudio.google.com](https://aistudio.google.com) |

**Smart Routing:** Kalau kamu set **kedua** API key, Helios otomatis pakai Groq untuk query cepat/ringan, dan switch ke Gemini kalau konteks panjang (>50k token) atau query kompleks. Seamless.

---

## Prerequisites

- **Windows 11** (atau Windows 10 baru)
- **Bun** runtime (bukan Node.js)
- API key dari Groq dan/atau Gemini (gratis)

---

## Setup (Step by Step)

### Step 1 — Install Bun

Buka PowerShell dan jalankan:
```powershell
irm bun.sh/install.ps1 | iex
```

Restart terminal setelah install. Verifikasi:
```powershell
bun --version
```

### Step 2 — Extract & Install Dependencies

```powershell
# Extract zip ke folder pilihan kamu
# lalu masuk ke folder:
cd C:\Users\kamu\HeliosAE

# Install dependencies
bun install
```

### Step 3 — Ambil API Key (gratis)

**Groq** (direkomendasikan untuk mulai — super cepat):
1. Buka [console.groq.com](https://console.groq.com)
2. Sign up / Login
3. API Keys → Create API Key
4. Copy key-nya

**Gemini** (untuk konteks panjang & reasoning):
1. Buka [aistudio.google.com](https://aistudio.google.com)
2. Login dengan akun Google
3. Get API Key → Create API key in new project
4. Copy key-nya

### Step 4 — Set API Key

**Cara 1 — File `.env` (direkomendasikan, permanen):**
```powershell
# Buat folder config
mkdir $HOME\.helios

# Buat file .env
notepad $HOME\.helios\.env
```

Isi file `.env` dengan:
```
# HeliosAE Configuration
GEMINI_API_KEY=AIza...your_gemini_key_here
GROQ_API_KEY=gsk_...your_groq_key_here
HELIOS_PROVIDER=auto
```

**Cara 2 — Environment variable (hanya untuk sesi ini):**
```powershell
$env:GROQ_API_KEY = "gsk_..."
$env:GEMINI_API_KEY = "AIza..."
```

**Cara 3 — Permanent di Windows:**
```powershell
[System.Environment]::SetEnvironmentVariable("GROQ_API_KEY", "gsk_...", "User")
[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "AIza...", "User")
```

### Step 5 — Build

```powershell
bun run build
```

Build pertama memakan waktu ~30 detik. Selanjutnya lebih cepat.

### Step 6 — Jalankan

```powershell
# Cara langsung:
node dist/cli.mjs

# Atau pakai script dev (rebuild otomatis):
bun run dev
```

### Step 7 (Opsional) — Add ke PATH

Supaya bisa dipanggil dengan `helios` dari mana saja:

```powershell
# Buat wrapper script di folder yang ada di PATH
# Contoh: C:\Users\kamu\AppData\Local\Microsoft\WindowsApps\helios.cmd

@echo off
node C:\Users\kamu\HeliosAE\dist\cli.mjs %*
```

Atau tambahkan folder HeliosAE ke PATH:
```powershell
$currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
[System.Environment]::SetEnvironmentVariable("PATH", "$currentPath;C:\Users\kamu\HeliosAE\bin", "User")
```

Lalu test:
```powershell
helios --version
# Output: HeliosAE v0.1.0
```

---

## Konfigurasi Lanjutan

### Provider & Model

```powershell
# Di ~/.helios/.env atau sebagai env var:

# Auto (default) — pakai Groq kalau ada, fallback ke Gemini
HELIOS_PROVIDER=auto

# Paksa Gemini (bagus untuk analisis panjang, dokumen besar)
HELIOS_PROVIDER=gemini

# Paksa Groq (bagus untuk respon cepat, query ringan)
HELIOS_PROVIDER=groq

# Override model (opsional)
HELIOS_MODEL=gemini-2.5-pro-exp-03-25    # Gemini paling canggih (gratis)
HELIOS_MODEL=llama-3.1-8b-instant        # Groq paling cepat
HELIOS_MODEL=deepseek-r1-distill-llama-70b  # Groq untuk reasoning

# Disable smart routing (pakai provider fixed sesuai HELIOS_PROVIDER)
HELIOS_SMART_ROUTE=0
```

### Model yang Tersedia

**Gemini (via GEMINI_API_KEY):**
| Model | Keunggulan |
|---|---|
| `gemini-2.0-flash` | Default — cepat, 1M context |
| `gemini-2.5-pro-exp-03-25` | Paling canggih, gratis experimental |
| `gemini-2.0-flash-lite` | Tercepat, latency rendah |

**Groq (via GROQ_API_KEY):**
| Model | Keunggulan |
|---|---|
| `llama-3.3-70b-versatile` | Default — kualitas terbaik |
| `llama-3.1-8b-instant` | Tercepat, cocok untuk query ringan |
| `deepseek-r1-distill-llama-70b` | Reasoning & math |

---

## Smart Routing — Cara Kerjanya

Kalau kamu punya **kedua** API key (Groq + Gemini), HeliosAE otomatis memilih provider terbaik:

```
Query masuk
    │
    ├── Konteks > 50.000 token? ──── YA ──→ Gemini (bisa handle 1M token)
    │
    ├── Query kompleks? ──────────── YA ──→ Gemini (reasoning lebih dalam)
    │   (analisis, debug, explain,
    │    compare, rancang, dll)
    │
    └── Lainnya ─────────────────────────→ Groq (lebih cepat, real-time)
```

Switch terjadi otomatis mid-session. Kamu bakal lihat notif:
```
[HELIOS ⚡] Switch ke GEMINI — konteks panjang (67k token)
```

Untuk disable: `HELIOS_SMART_ROUTE=0` di `.env`.

---

## Troubleshooting

### "No API key found"
```
[HELIOS] ⚠️  Tidak ada API key yang ditemukan!
```
→ Cek `~/.helios/.env` sudah ada dan berisi key yang benar.
→ Cek tidak ada typo di nama variabel.

### Build gagal: "Cannot find module"
```powershell
# Clean install:
Remove-Item node_modules -Recurse -Force
bun install
bun run build
```

### Bun tidak ditemukan setelah install
```powershell
# Refresh PATH di session ini:
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
```

### Error "bun: command not found" di PowerShell
```powershell
# Tambahkan Bun ke PATH manual:
$env:PATH += ";$HOME\.bun\bin"
```

### Rate limit Groq / Gemini
→ Groq free tier: 30 requests/menit, 14.400/hari
→ Gemini free tier: 15 requests/menit, 1.500/hari
→ Kalau kena limit, set `HELIOS_PROVIDER` ke provider satunya sementara.

### Output tidak muncul / terminal hang
→ Coba `Ctrl+C` untuk cancel, lalu tanya ulang dengan kalimat lebih pendek.

---

## Struktur Folder

```
HeliosAE/
├── src/
│   ├── constants/
│   │   ├── heliosPersona.ts      ← Persona & system prompt Helios
│   │   └── prompts.ts            ← Injeksi persona ke sistem
│   ├── services/api/
│   │   ├── heliosProviders.ts    ← Provider config + smart router
│   │   └── openaiShim.ts         ← Bridge ke Gemini/Groq via OpenAI format
│   ├── utils/
│   │   └── heliosEnv.ts          ← Loader ~/.helios/.env
│   ├── tools/PowerShellTool/
│   │   └── powershellPermissions.ts  ← Full-auto patch
│   └── main.tsx                  ← Entry point, bootstrap
├── dist/
│   └── cli.mjs                   ← Build output (jalankan ini)
├── smart_router.py               ← Python router (referensi/opsional)
├── ~/.helios/.env                ← Config user (di luar project folder)
└── README.md                     ← File ini
```

---

## Contoh Penggunaan

```
helios> cek RAM dan CPU sekarang
[HELIOS ⚡] Mengecek resource...
RAM: 8.2 GB / 16 GB (51%)
CPU: 23% (8 cores)
Proses teratas: chrome.exe (4.1%), code.exe (2.8%)

helios> matiin semua proses chrome
[HELIOS ⚡] Stop-Process -Name chrome -Force
Done. 6 proses chrome dihentikan.

helios> install notepad++
[HELIOS ⚡] winget install Notepad++.Notepad++
Downloading... Installing... Done ✓

helios> analisis kenapa boot windows lambat
[HELIOS ⚡] Switch ke GEMINI — query kompleks terdeteksi
Menganalisis startup programs dan event log...
[hasil analisis mendalam]
```

---

## Bagian dari AERIS Nexus

HeliosAE adalah komponen AI assistant dari ekosistem **AERIS Nexus** — platform personal AI yang berjalan sepenuhnya lokal di sistemmu.

---

*Built on OpenClaude — free, open, no subscriptions needed.*

---

## Linux Setup

### 1. Install Bun
```bash
curl -fsSL https://bun.sh/install | bash
# Tambahkan ke PATH (atau restart terminal):
export PATH="$HOME/.bun/bin:$PATH"
```

### 2. Clone & Build
```bash
git clone <repo-url> HeliosAE
cd HeliosAE
bash install.sh
```

### 3. Setup API Keys
```bash
nano ~/.helios/.env
# Isi GEMINI_API_KEY dan/atau GROQ_API_KEY
```

### 4. Jalankan
```bash
helios
# atau langsung:
node dist/cli.mjs
```

### PowerShell di Linux (opsional)
HeliosAE tetap berjalan penuh di Linux tanpa PowerShell — BashTool menangani semua kontrol sistem. Kalau kamu ingin PowerShell juga tersedia:
```bash
# Ubuntu/Debian
sudo apt install -y powershell

# Fedora/RHEL
sudo dnf install -y powershell

# Via snap
sudo snap install powershell --classic
```
