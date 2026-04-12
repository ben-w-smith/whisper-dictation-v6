#!/usr/bin/env bash
# setup-llama.sh — Copies the llama-server binary + required dylibs into bin/.
#
# The binary is dynamically linked against llama.cpp's own dylibs. This script
# copies everything needed so the app bundle is self-contained.
#
# Strategy (in order):
#   1. bin/llama-server already exists → skip
#   2. llama-server is on PATH (e.g. via Homebrew) → copy binary + dylibs, fix rpath
#   3. Install via Homebrew, then copy
#
# Usage:
#   bash scripts/setup-llama.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$REPO_ROOT/bin"
BIN_PATH="$BIN_DIR/llama-server"

echo "Checking for llama-server binary..."

if [[ -x "$BIN_PATH" ]]; then
  echo "llama-server already present at bin/llama-server"
  exit 0
fi

mkdir -p "$BIN_DIR"

copy_binary() {
  local src="$1"
  echo "Found llama-server at $src — copying to bin/"

  cp "$src" "$BIN_PATH"
  chmod +x "$BIN_PATH"

  # Locate the Cellar lib dir for this binary's dylib dependencies
  local src_dir
  src_dir="$(dirname "$(realpath "$src")")"
  local lib_dir
  lib_dir="$(realpath "$src_dir/../lib" 2>/dev/null || echo "")"

  if [[ -d "$lib_dir" ]]; then
    echo "Copying dylibs from $lib_dir"
    for dylib in \
      libggml.0.dylib \
      libggml-base.0.dylib \
      libggml-blas.0.dylib \
      libggml-cpu.0.dylib \
      libggml-metal.0.dylib \
      libllama.0.dylib \
      libmtmd.0.dylib; do
      if [[ -f "$lib_dir/$dylib" ]]; then
        cp "$lib_dir/$dylib" "$BIN_DIR/"
        chmod 644 "$BIN_DIR/$dylib"
      fi
    done
  fi

  # Copy openssl dylibs (required by llama-server for HTTPS)
  for openssl_root in \
    /opt/homebrew/opt/openssl@3/lib \
    /usr/local/opt/openssl@3/lib; do
    if [[ -d "$openssl_root" ]]; then
      for dylib in libssl.3.dylib libcrypto.3.dylib; do
        if [[ -f "$openssl_root/$dylib" ]]; then
          cp "$openssl_root/$dylib" "$BIN_DIR/"
          chmod 644 "$BIN_DIR/$dylib"
        fi
      done
      break
    fi
  done

  # Fix rpath: binary looks for dylibs at @loader_path/../lib by default.
  # Change it to @loader_path so it finds the dylibs in the same bin/ directory.
  local old_rpath="@loader_path/../lib"
  install_name_tool -rpath "$old_rpath" "@loader_path" "$BIN_PATH" 2>/dev/null || \
    install_name_tool -add_rpath "@loader_path" "$BIN_PATH" 2>/dev/null || true

  # Re-sign with ad-hoc signature (required after install_name_tool modification)
  if command -v codesign &>/dev/null; then
    codesign --force --sign - "$BIN_PATH" 2>/dev/null || true
  fi

  echo "Done! llama-server and dylibs installed in bin/"
  echo "Binary: bin/llama-server"
  ls -lh "$BIN_DIR"/*.dylib 2>/dev/null | awk '{print "  " $NF, $5}' || true
  exit 0
}

# Check common locations
for candidate in \
  "$(command -v llama-server 2>/dev/null || echo "")" \
  /opt/homebrew/bin/llama-server \
  /usr/local/bin/llama-server; do
  if [[ -x "$candidate" ]]; then
    copy_binary "$candidate"
  fi
done

# Install via Homebrew
if command -v brew &>/dev/null; then
  echo "Installing llama.cpp via Homebrew..."
  brew install llama.cpp

  for candidate in \
    "$(brew --prefix)/bin/llama-server"; do
    if [[ -x "$candidate" ]]; then
      copy_binary "$candidate"
    fi
  done
fi

echo "ERROR: Could not find or install llama-server."
echo "Install manually with: brew install llama.cpp"
echo "Then re-run: bash scripts/setup-llama.sh"
exit 1
