#!/usr/bin/env bash
# HeliosAE Auto-Installer untuk Linux
# Bagian dari AERIS Nexus
# Jalankan: bash install.sh

set -e

HELIOS_DIR="$HOME/.helios"
ENV_FILE="$HELIOS_DIR/.env"
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  ██╗  ██╗███████╗██╗     ██╗ ██████╗ ███████╗     █████╗ ███████╗${NC}"
echo -e "${CYAN}  ██║  ██║██╔════╝██║     ██║██╔═══██╗██╔════╝    ██╔══██╗██╔════╝${NC}"
echo -e "${CYAN}  ███████║█████╗  ██║     ██║██║   ██║███████╗    ███████║█████╗  ${NC}"
echo -e "${CYAN}  ██╔══██║██╔══╝  ██║     ██║██║   ██║╚════██║    ██╔══██║██╔══╝  ${NC}"
echo -e "${CYAN}  ██║  ██║███████╗███████╗██║╚██████╔╝███████║    ██║  ██║███████╗${NC}"
echo -e "${CYAN}  ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝ ╚═════╝ ╚══════╝    ╚═╝  ╚═╝╚══════╝${NC}"
echo ""
echo -e "${YELLOW}  AERIS Nexus — Personal AI System Installer (Linux)${NC}"
echo -e "${GRAY}  ─────────────────────────────────────────────${NC}"
echo ""

# ── 1. Cek Bun ────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/5] Cek Bun...${NC}"
if ! command -v bun &>/dev/null; then
    echo -e "${GRAY}  → Bun tidak ditemukan. Install sekarang...${NC}"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
    echo -e "${GREEN}  ✓ Bun berhasil diinstall${NC}"
    echo -e "${YELLOW}  ⚠  Tambahkan ke shell config: export PATH=\"\$HOME/.bun/bin:\$PATH\"${NC}"
else
    BUN_VER=$(bun --version)
    echo -e "${GREEN}  ✓ Bun ${BUN_VER} sudah terinstall${NC}"
fi

# ── 2. Cek Python ────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Cek Python...${NC}"
PYTHON_CMD=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PYTHON_CMD="$cmd"
        break
    fi
done
if [ -n "$PYTHON_CMD" ]; then
    PY_VER=$($PYTHON_CMD --version 2>&1)
    echo -e "${GREEN}  ✓ ${PY_VER} ditemukan${NC}"
    # Fix: coba --break-system-packages (Ubuntu 22.04+), fallback ke --user
    if $PYTHON_CMD -m pip install httpx --quiet --break-system-packages 2>/dev/null; then
        echo -e "${GREEN}  ✓ httpx terinstall${NC}"
    elif $PYTHON_CMD -m pip install httpx --quiet --user 2>/dev/null; then
        echo -e "${GREEN}  ✓ httpx terinstall (user mode)${NC}"
    else
        echo -e "${YELLOW}  ⚠  httpx gagal diinstall — smart router pakai mode offline${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠  Python tidak ditemukan. Smart router tidak akan berjalan.${NC}"
    echo -e "${GRAY}  Install: sudo apt install python3 / sudo dnf install python3${NC}"
fi

# ── 3. Install dependencies ───────────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Install dependencies...${NC}"
# Catatan: bun install (tanpa --frozen-lockfile) aman dipakai saat lockfile belum ada.
# Kalau lockfile sudah ada, bun otomatis menghormatinya.
bun install
echo -e "${GREEN}  ✓ Dependencies terinstall${NC}"

# ── 4. Build ──────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/5] Build HeliosAE...${NC}"
bun run build
if [ -f "dist/cli.mjs" ]; then
    echo -e "${GREEN}  ✓ Build berhasil → dist/cli.mjs${NC}"
else
    echo -e "${RED}  ✗ Build gagal — coba: bun run build${NC}"
    exit 1
fi

# ── 5. Setup config ───────────────────────────────────────────────────────────
echo -e "${YELLOW}[5/5] Setup konfigurasi...${NC}"
mkdir -p "$HELIOS_DIR"
echo -e "${GREEN}  ✓ Config dir: $HELIOS_DIR${NC}"

if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << 'ENVEOF'
# HeliosAE Configuration — AERIS Nexus
# ─────────────────────────────────────────────────────────
# Isi minimal SATU dari dua API key di bawah ini.
# Keduanya GRATIS, tidak butuh kartu kredit.

# Gemini (Google AI Studio) — 1M context, reasoning dalam (2.5 Pro)
# Ambil key gratis: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=

# Groq — super cepat, response real-time
# Ambil key gratis: https://console.groq.com/keys
GROQ_API_KEY=

# ── Optional ──────────────────────────────────────────────
# HELIOS_PROVIDER=auto
# HELIOS_MODEL=
# HELIOS_SMART_ROUTE=1
ENVEOF
    echo -e "${GREEN}  ✓ Template config dibuat: $ENV_FILE${NC}"
    echo -e "${YELLOW}  → Edit file tersebut dan isi API key kamu${NC}"
else
    echo -e "${GREEN}  ✓ Config sudah ada: $ENV_FILE${NC}"
fi

# Buat launcher script
INSTALL_DIR="$(pwd)"
LAUNCHER="$HELIOS_DIR/helios.sh"
cat > "$LAUNCHER" << LAUNCHEOF
#!/usr/bin/env bash
node "${INSTALL_DIR}/dist/cli.mjs" "\$@"
LAUNCHEOF
chmod +x "$LAUNCHER"

# Tambah alias ke shell config — deteksi shell aktif
ALIAS_LINE_BASH="alias helios='bash $LAUNCHER'"
ALIAS_LINE_FISH="alias helios \"bash $LAUNCHER\""

for RC_FILE in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$RC_FILE" ] && ! grep -q "helios" "$RC_FILE" 2>/dev/null; then
        echo "" >> "$RC_FILE"
        echo "# HeliosAE — AERIS Nexus" >> "$RC_FILE"
        echo "$ALIAS_LINE_BASH" >> "$RC_FILE"
        echo -e "${GREEN}  ✓ Alias 'helios' ditambahkan ke $(basename $RC_FILE)${NC}"
    fi
done

FISH_CONFIG="$HOME/.config/fish/config.fish"
if [ -f "$FISH_CONFIG" ] && ! grep -q "helios" "$FISH_CONFIG" 2>/dev/null; then
    echo "" >> "$FISH_CONFIG"
    echo "# HeliosAE — AERIS Nexus" >> "$FISH_CONFIG"
    echo "$ALIAS_LINE_FISH" >> "$FISH_CONFIG"
    echo -e "${GREEN}  ✓ Alias 'helios' ditambahkan ke config.fish${NC}"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  ════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓  HeliosAE berhasil diinstall!${NC}"
echo -e "${CYAN}  ════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}  Langkah selanjutnya:${NC}"
echo -e "  1. Edit ${CYAN}$ENV_FILE${NC}"
echo -e "     Isi GEMINI_API_KEY atau GROQ_API_KEY"
echo ""
echo -e "  2. Restart terminal (biar alias 'helios' aktif)"
echo ""
echo -e "  3. Jalankan:"
echo -e "     ${CYAN}helios${NC}"
echo ""
echo -e "  Atau langsung sekarang:"
echo -e "     ${CYAN}node dist/cli.mjs${NC}"
echo ""
