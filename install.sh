#!/usr/bin/env bash
# ==============================================================================
# LinUwU Launcher - The last launcher you will need.
# Universal Linux Installer Script
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Nirusaki-Malaal/LinUwU-Launcher/main/install.sh | bash
# Or:
#   ./install.sh [--user | --system | --uninstall | --build]
# ==============================================================================

set -euo pipefail

APP_NAME="LinUwU"
APP_DISPLAY_NAME="LinUwU Launcher"
APP_TAGLINE="The last launcher you will need"
REPO_OWNER="Nirusaki-Malaal"
REPO_NAME="LinUwU-Launcher"
GITHUB_REPO="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
GITHUB_RAW="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main"
API_LATEST_RELEASE="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"

# Styling
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_CYAN='\033[36m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_RED='\033[31m'
C_MAGENTA='\033[35m'

print_banner() {
    echo -e "${C_CYAN}${C_BOLD}"
    cat << "EOF"
  _     _       _   _          _   _ 
 | |   (_)_ __ | | | |_      _| | | |
 | |   | | '_ \| | | \ \ /\ / / | | |
 | |___| | | | | |_| |\ V  V /| |_| |
 |_____|_|_| |_|\___/  \_/\_/  \___/ 
EOF
    echo -e "${C_MAGENTA}   >> ${APP_DISPLAY_NAME} <<${C_RESET}"
    echo -e "${C_BOLD}   \"${APP_TAGLINE}\"${C_RESET}\n"
}

log_info() {
    echo -e "${C_CYAN}[INFO]${C_RESET} $*"
}

log_success() {
    echo -e "${C_GREEN}[SUCCESS]${C_RESET} $*"
}

log_warn() {
    echo -e "${C_YELLOW}[WARNING]${C_RESET} $*"
}

log_error() {
    echo -e "${C_RED}[ERROR]${C_RESET} $*" >&2
}

# Determine install mode (user vs system)
INSTALL_MODE="auto"
FORCE_BUILD=false
UNINSTALL=false

for arg in "$@"; do
    case "$arg" in
        --user)
            INSTALL_MODE="user"
            ;;
        --system)
            INSTALL_MODE="system"
            ;;
        --build)
            FORCE_BUILD=true
            ;;
        --uninstall)
            UNINSTALL=true
            ;;
        -h|--help)
            echo "LinUwU Launcher Universal Installer"
            echo "Options:"
            echo "  --user       Install for current user only (~/.local)"
            echo "  --system     Install system-wide (/opt and /usr/local/bin)"
            echo "  --build      Force build from source"
            echo "  --uninstall  Remove LinUwU Launcher"
            exit 0
            ;;
    esac
done

print_banner

# Arch check
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "amd64" ]; then
    log_warn "Detected architecture: $ARCH. LinUwU is primarily optimized and pre-packaged for x86_64."
fi

# Detect Sudo availability
CAN_SUDO=false
if [ "$(id -u)" -eq 0 ]; then
    CAN_SUDO=true
elif command -v sudo >/dev/null 2>&1; then
    if sudo -n true 2>/dev/null; then
        CAN_SUDO=true
    fi
fi

if [ "$INSTALL_MODE" = "auto" ]; then
    if [ "$(id -u)" -eq 0 ] || [ "$CAN_SUDO" = true ]; then
        INSTALL_MODE="system"
    else
        INSTALL_MODE="user"
    fi
fi

if [ "$INSTALL_MODE" = "system" ]; then
    TARGET_DIR="/opt/LinUwU"
    BIN_DIR="/usr/local/bin"
    DESKTOP_DIR="/usr/share/applications"
    ICON_DIR="/usr/share/icons/hicolor/512x512/apps"
    SUDO_CMD=""
    if [ "$(id -u)" -ne 0 ]; then
        SUDO_CMD="sudo"
    fi
else
    TARGET_DIR="$HOME/.local/share/LinUwU"
    BIN_DIR="$HOME/.local/bin"
    DESKTOP_DIR="$HOME/.local/share/applications"
    ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
    SUDO_CMD=""
fi

# Uninstall procedure
if [ "$UNINSTALL" = true ]; then
    log_info "Uninstalling ${APP_DISPLAY_NAME} from ${INSTALL_MODE} install..."
    $SUDO_CMD rm -rf "$TARGET_DIR"
    $SUDO_CMD rm -f "$BIN_DIR/linuwu" "$BIN_DIR/linuwu-launcher" "$DESKTOP_DIR/linuwu.desktop" "$ICON_DIR/linuwu.png"
    if [ -f "$DESKTOP_DIR/heroic.desktop" ]; then
        # only remove if it points to linuwu
        if grep -q "linuwu" "$DESKTOP_DIR/heroic.desktop" 2>/dev/null; then
            $SUDO_CMD rm -f "$DESKTOP_DIR/heroic.desktop"
        fi
    fi
    log_success "${APP_DISPLAY_NAME} has been completely uninstalled."
    exit 0
fi

log_info "Installation mode: ${C_BOLD}${INSTALL_MODE}${C_RESET}"
log_info "Destination: ${TARGET_DIR}"

TMP_DIR=$(mktemp -d /tmp/linuwu-install-XXXXXX)
cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

INSTALLED_FILES_SRC=""

# Check if we are running inside the repository directory with ready-made build
LOCAL_DIR=""
if [ -f "./package.json" ] && grep -q '"productName": "LinUwU"\|"name": "linuwu-launcher"\|"name": "heroic"' ./package.json 2>/dev/null; then
    LOCAL_DIR="$(pwd)"
fi

if [ -n "$LOCAL_DIR" ] && [ "$FORCE_BUILD" = false ] && [ -d "$LOCAL_DIR/dist/linux-unpacked" ]; then
    log_info "Detected local build in current directory ($LOCAL_DIR/dist/linux-unpacked). Using it directly!"
    INSTALLED_FILES_SRC="$LOCAL_DIR/dist/linux-unpacked"
fi

# Try downloading release asset if not using local build
if [ -z "$INSTALLED_FILES_SRC" ] && [ "$FORCE_BUILD" = false ]; then
    log_info "Checking for latest release from GitHub..."
    LATEST_TAR_URL=""
    if command -v curl >/dev/null 2>&1; then
        LATEST_JSON=$(curl -fsSL "$API_LATEST_RELEASE" 2>/dev/null || true)
        if [ -n "$LATEST_JSON" ]; then
            LATEST_TAR_URL=$(echo "$LATEST_JSON" | grep -o 'https://[^" ]*linux[^" ]*\.tar\.[a-zA-Z0-9]*' | head -n 1 || true)
        fi
    fi

    if [ -n "$LATEST_TAR_URL" ]; then
        log_info "Found prebuilt release package: ${LATEST_TAR_URL}"
        log_info "Downloading release package..."
        curl -fSL "$LATEST_TAR_URL" -o "$TMP_DIR/linuwu-archive"
        log_info "Extracting package..."
        mkdir -p "$TMP_DIR/unpacked"
        tar -xf "$TMP_DIR/linuwu-archive" -C "$TMP_DIR/unpacked"
        # Find directory containing executable
        BIN_FOUND=$(find "$TMP_DIR/unpacked" -type f \( -name "linuwu-launcher" -o -name "heroic" -o -name "linuwu" \) | head -n 1 || true)
        if [ -n "$BIN_FOUND" ]; then
            INSTALLED_FILES_SRC="$(dirname "$BIN_FOUND")"
        fi
    fi
fi

# Fallback: build from source
if [ -z "$INSTALLED_FILES_SRC" ]; then
    log_info "No prebuilt release package found or --build specified. Building from source..."

    BUILD_DIR=""
    if [ -n "$LOCAL_DIR" ]; then
        BUILD_DIR="$LOCAL_DIR"
    else
        log_info "Cloning repository from ${GITHUB_REPO}..."
        git clone --depth 1 "$GITHUB_REPO" "$TMP_DIR/repo"
        BUILD_DIR="$TMP_DIR/repo"
    fi

    cd "$BUILD_DIR"

    # Ensure Node.js and package manager exist
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js (>=20) is required to build from source. Please install Node.js."
        exit 1
    fi

    PKG_MGR="npm"
    if command -v pnpm >/dev/null 2>&1; then
        PKG_MGR="pnpm"
    fi

    log_info "Installing dependencies with $PKG_MGR..."
    $PKG_MGR install

    log_info "Building frontend and backend..."
    $PKG_MGR run build

    log_info "Packaging application..."
    ./node_modules/.bin/electron-builder --linux --dir

    INSTALLED_FILES_SRC="$BUILD_DIR/dist/linux-unpacked"
fi

if [ ! -d "$INSTALLED_FILES_SRC" ]; then
    log_error "Could not find unpacked installation files at $INSTALLED_FILES_SRC"
    exit 1
fi

# Perform Installation
log_info "Installing files to ${TARGET_DIR}..."
$SUDO_CMD mkdir -p "$TARGET_DIR" "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"

# Stop running instances to avoid text file busy error
killall heroic 2>/dev/null || true
killall linuwu 2>/dev/null || true
sleep 1

$SUDO_CMD cp -a "$INSTALLED_FILES_SRC"/* "$TARGET_DIR/"

# Ensure binary permissions
MAIN_EXE=""
if [ -f "$TARGET_DIR/linuwu-launcher" ]; then
    MAIN_EXE="$TARGET_DIR/linuwu-launcher"
elif [ -f "$TARGET_DIR/linuwu" ]; then
    MAIN_EXE="$TARGET_DIR/linuwu"
elif [ -f "$TARGET_DIR/heroic" ]; then
    MAIN_EXE="$TARGET_DIR/heroic"
fi

if [ -n "$MAIN_EXE" ]; then
    $SUDO_CMD chmod +x "$MAIN_EXE"
    $SUDO_CMD ln -sf "$(basename "$MAIN_EXE")" "$TARGET_DIR/linuwu" 2>/dev/null || true
    $SUDO_CMD ln -sf "$(basename "$MAIN_EXE")" "$TARGET_DIR/heroic" 2>/dev/null || true
fi
if [ -f "$TARGET_DIR/chrome-sandbox" ]; then
    $SUDO_CMD chmod 4755 "$TARGET_DIR/chrome-sandbox" 2>/dev/null || $SUDO_CMD chmod +x "$TARGET_DIR/chrome-sandbox"
fi
if [ -f "$TARGET_DIR/chrome_crashpad_handler" ]; then
    $SUDO_CMD chmod +x "$TARGET_DIR/chrome_crashpad_handler"
fi

# Create native Wayland auto-detection wrapper
WRAPPER_FILE="$TMP_DIR/linuwu-wrapper"
cat << WRAPPER_EOF > "$WRAPPER_FILE"
#!/bin/sh
# LinUwU Launcher - The last launcher you will need
# Native Wayland auto-detection wrapper

EXTRA_ARGS=""
if [ -n "\${WAYLAND_DISPLAY:-}" ]; then
  # Use ozone-platform-hint=auto for safe native Wayland with seamless XWayland fallback
  EXTRA_ARGS="--ozone-platform-hint=auto --enable-features=WaylandWindowDecorations"
fi

TARGET_BIN="${MAIN_EXE}"
if [ ! -f "\$TARGET_BIN" ]; then
  TARGET_BIN="${TARGET_DIR}/linuwu-launcher"
fi
if [ ! -f "\$TARGET_BIN" ]; then
  TARGET_BIN="${TARGET_DIR}/heroic"
fi

exec "\$TARGET_BIN" \$EXTRA_ARGS "\$@"
WRAPPER_EOF

chmod +x "$WRAPPER_FILE"
$SUDO_CMD cp "$WRAPPER_FILE" "$BIN_DIR/linuwu"
$SUDO_CMD chmod +x "$BIN_DIR/linuwu"

# Symlink legacy heroic name for compatibility
$SUDO_CMD ln -sf "$BIN_DIR/linuwu" "$BIN_DIR/linuwu-launcher"
$SUDO_CMD ln -sf "$BIN_DIR/linuwu" "$BIN_DIR/heroic" 2>/dev/null || true

# If installed system-wide, also ensure /usr/bin/linuwu exists so Plasma/systemd always finds it
if [ "$INSTALL_MODE" = "system" ]; then
    $SUDO_CMD ln -sf "$BIN_DIR/linuwu" "/usr/bin/linuwu" 2>/dev/null || true
    $SUDO_CMD ln -sf "$BIN_DIR/linuwu" "/usr/bin/linuwu-launcher" 2>/dev/null || true
    $SUDO_CMD ln -sf "$BIN_DIR/linuwu" "/usr/bin/heroic" 2>/dev/null || true
fi

# Install App Icon
ICON_SRC=""
if [ -f "$TARGET_DIR/resources/app.asar.unpacked/build/icon.png" ]; then
    ICON_SRC="$TARGET_DIR/resources/app.asar.unpacked/build/icon.png"
elif [ -f "$TARGET_DIR/resources/icon.png" ]; then
    ICON_SRC="$TARGET_DIR/resources/icon.png"
elif [ -f "$LOCAL_DIR/public/icon.png" ]; then
    ICON_SRC="$LOCAL_DIR/public/icon.png"
fi

if [ -n "$ICON_SRC" ]; then
    $SUDO_CMD cp "$ICON_SRC" "$ICON_DIR/linuwu.png"
    if [ "$INSTALL_MODE" = "system" ]; then
        $SUDO_CMD mkdir -p /usr/share/pixmaps
        $SUDO_CMD cp "$ICON_SRC" /usr/share/pixmaps/linuwu.png
    fi
fi

# Create Desktop Entry
DESKTOP_FILE="$TMP_DIR/linuwu.desktop"
cat << DESKTOP_EOF > "$DESKTOP_FILE"
[Desktop Entry]
Name=${APP_DISPLAY_NAME}
GenericName=Game Launcher
Comment=${APP_TAGLINE}
Exec=${BIN_DIR}/linuwu %U
Terminal=false
Type=Application
Icon=linuwu
StartupWMClass=linuwu-launcher
Categories=Game;
MimeType=x-scheme-handler/heroic;x-scheme-handler/linuwu;
Keywords=game;launcher;epic;gog;amazon;steam;steamrip;onlinefix;xbox;linuwu;
DESKTOP_EOF

$SUDO_CMD cp "$DESKTOP_FILE" "$DESKTOP_DIR/linuwu.desktop"
$SUDO_CMD chmod 644 "$DESKTOP_DIR/linuwu.desktop"

# Refresh desktop databases
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t "$(dirname "$(dirname "$ICON_DIR")")" >/dev/null 2>&1 || true
fi

echo ""
log_success "${APP_DISPLAY_NAME} is successfully installed!"
echo -e "${C_BOLD}Launch LinUwU with:${C_RESET} ${C_CYAN}linuwu${C_RESET}"
echo -e "${C_BOLD}Or open \"${APP_DISPLAY_NAME}\" from your application menu.${C_RESET}"
echo -e "${C_MAGENTA}${APP_TAGLINE}.${C_RESET}\n"
