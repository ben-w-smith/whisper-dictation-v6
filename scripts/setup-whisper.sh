#!/usr/bin/env bash
# setup-whisper.sh — Installs the whisper-cpp binary required for local transcription.
#
# Strategy (in order):
#   1. If bin/whisper-cpp already exists → skip
#   2. If whisper-cli or whisper-cpp is on PATH → copy it
#   3. If Homebrew is available → brew install whisper-cpp, then copy whisper-cli
#   4. Build from source using cmake (requires Xcode CLT)
#
# Usage:
#   pnpm setup
#   bash scripts/setup-whisper.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$REPO_ROOT/bin"
BIN_PATH="$BIN_DIR/whisper-cpp"

echo "Checking for whisper-cpp binary..."

# 1. Already installed
if [[ -x "$BIN_PATH" ]]; then
  echo "whisper-cpp already present at bin/whisper-cpp"
  exit 0
fi

mkdir -p "$BIN_DIR"

# Helper: copy a found binary, patch its rpath for Homebrew libs, re-sign, then exit
copy_binary() {
  local src="$1"
  echo "Found whisper binary at $src — copying to bin/whisper-cpp"
  cp "$src" "$BIN_PATH"
  chmod +x "$BIN_PATH"

  # Patch rpath so dylibs resolve from Homebrew on arm64 and Intel
  for rpath in \
    /opt/homebrew/lib \
    /opt/homebrew/opt/ggml/lib \
    /usr/local/lib \
    /usr/local/opt/ggml/lib; do
    if [[ -d "$rpath" ]]; then
      install_name_tool -add_rpath "$rpath" "$BIN_PATH" 2>/dev/null || true
    fi
  done

  # Re-sign with ad-hoc signature (required after rpath modification)
  if command -v codesign &>/dev/null; then
    codesign --force --sign - "$BIN_PATH" 2>/dev/null || true
  fi

  echo "Done! Binary at bin/whisper-cpp"
  exit 0
}

# 2. Check common binary names on PATH
for name in whisper-cli whisper-cpp; do
  if command -v "$name" &>/dev/null; then
    copy_binary "$(command -v "$name")"
  fi
done

# Check common Homebrew arm64 paths for whisper-cli (new name in 1.8.x)
for candidate in \
  /opt/homebrew/bin/whisper-cli \
  /opt/homebrew/bin/whisper-cpp \
  /usr/local/bin/whisper-cli \
  /usr/local/bin/whisper-cpp; do
  if [[ -x "$candidate" ]]; then
    copy_binary "$candidate"
  fi
done

# 3. Install via Homebrew
if command -v brew &>/dev/null; then
  echo "Installing whisper-cpp via Homebrew..."
  brew install whisper-cpp

  for candidate in \
    "$(brew --prefix)/bin/whisper-cli" \
    "$(brew --prefix)/bin/whisper-cpp"; do
    if [[ -x "$candidate" ]]; then
      copy_binary "$candidate"
    fi
  done
fi

# 4. Build from source using cmake
echo "Building whisper.cpp from source (requires Xcode Command Line Tools + cmake)..."
echo "This will take 2-5 minutes..."

if ! command -v cmake &>/dev/null; then
  if command -v brew &>/dev/null; then
    echo "Installing cmake via Homebrew..."
    brew install cmake
  else
    echo "cmake not found. Install it with: brew install cmake"
    exit 1
  fi
fi

TMPDIR_BUILD="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BUILD"' EXIT

git clone --depth 1 https://github.com/ggerganov/whisper.cpp "$TMPDIR_BUILD"
cd "$TMPDIR_BUILD"

cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j "$(sysctl -n hw.physicalcpu)"

# The built binary is named 'whisper-cli' in new versions, 'main' in old versions
if [[ -x build/bin/whisper-cli ]]; then
  cp build/bin/whisper-cli "$BIN_PATH"
elif [[ -x build/main ]]; then
  cp build/main "$BIN_PATH"
elif [[ -x main ]]; then
  cp main "$BIN_PATH"
else
  echo "Build succeeded but could not locate whisper binary. Check build/bin/ manually."
  ls build/bin/ 2>/dev/null || true
  exit 1
fi

chmod +x "$BIN_PATH"
echo "Built and installed at bin/whisper-cpp"
