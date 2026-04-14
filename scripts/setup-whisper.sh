#!/usr/bin/env bash
# setup-whisper.sh — Installs whisper-cpp and llama-server binaries + required shared libraries.
#
# Produces self-contained binaries in bin/ that work inside the Electron
# app bundle without depending on external library paths on the host machine.
#
# For whisper-cpp, strategy (in order):
#   1. If bin/whisper-cpp exists AND actually runs → skip
#   2. If whisper-cli / whisper-cpp on PATH → copy + bundle dylibs
#   3. If Homebrew available → brew install whisper-cpp, then copy + bundle
#   4. Build from source using cmake + a C++ compiler (no Homebrew needed)
#
# For llama-server: bundles dylibs alongside bin/llama-server using @loader_path.
#
# Usage:
#   pnpm setup
#   bash scripts/setup-whisper.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$REPO_ROOT/bin"
BIN_PATH="$BIN_DIR/whisper-cpp"

# ── Helpers ──────────────────────────────────────────────────────────────

# Check if the binary at $BIN_PATH actually runs (not just exists).
# Returns 0 if it works, 1 if it's missing or broken.
binary_works() {
  [[ -x "$BIN_PATH" ]] || return 1
  # whisper.cpp doesn't have --version. Running with --help prints usage
  # and exits 0 if the binary is healthy (dylibs resolve, etc.).
  # Use perl for a portable timeout (macOS has no `timeout` command).
  local output
  output="$(perl -e 'alarm 5; exec @ARGV' "$BIN_PATH" --help 2>&1)" \
    && echo "$output" | grep -qi "usage" \
    && return 0
  return 1
}

# Copy a whisper binary to bin/, bundle required dylibs alongside it,
# patch rpath, and re-sign. Works for both Homebrew and custom installs.
install_binary() {
  local src="$1"
  echo "Installing whisper binary from $src"

  mkdir -p "$BIN_DIR"
  # Remove any existing file first — Homebrew copies may be read-only
  rm -f "$BIN_PATH"
  cp "$src" "$BIN_PATH"
  chmod +x "$BIN_PATH"

  # ── Copy dylibs ──────────────────────────────────────────────────────
  # whisper-cpp depends on libwhisper, libggml, and libggml-base.
  # We look for them in several locations and copy everything we find.

  local resolved_dir
  resolved_dir="$(dirname "$(realpath "$src" 2>/dev/null || echo "$src")")"

  # Possible lib directories relative to the binary
  local cellar_lib
  cellar_lib="$(realpath "$resolved_dir/../lib" 2>/dev/null || true)"

  # Build search_dirs as a string to avoid empty-array issues with set -u
  local search_dirs=""
  # Homebrew Cellar layout: bin/ → ../lib/
  [[ -d "$cellar_lib" ]] && search_dirs="$cellar_lib"
  # Standard lib paths
  for d in \
    /opt/homebrew/opt/whisper-cpp/lib \
    /opt/homebrew/opt/ggml/lib \
    /opt/homebrew/lib \
    /usr/local/opt/whisper-cpp/lib \
    /usr/local/opt/ggml/lib \
    /usr/local/lib; do
    if [[ -d "$d" ]]; then
      search_dirs="$search_dirs $d"
    fi
  done

  local copied=""
  for dylib_name in \
    libwhisper.1.dylib \
    libwhisper.1.*.dylib \
    libggml.0.dylib \
    libggml.0.*.dylib \
    libggml-base.0.dylib \
    libggml-base.0.*.dylib; do
    for search_dir in $search_dirs; do
      for match in "$search_dir"/$dylib_name; do
        if [[ -f "$match" ]]; then
          local base
          base="$(basename "$match")"
          # Skip if already copied (prefer first match)
          if [[ " $copied " != *" $base "* ]]; then
            echo "  Copying $base"
            cp "$match" "$BIN_DIR/"
            chmod 644 "$BIN_DIR/$base"
            copied="$copied $base"
          fi
        fi
      done
    done
  done

  # ── Patch rpath ──────────────────────────────────────────────────────
  # Add @loader_path so the binary resolves dylibs from its own directory.
  # This is what makes it work inside the app bundle.
  install_name_tool -add_rpath "@loader_path" "$BIN_PATH" 2>/dev/null || true

  # Re-sign with ad-hoc signature (required after modifying the binary)
  if command -v codesign &>/dev/null; then
    codesign --force --sign - "$BIN_PATH" 2>/dev/null || true
  fi

  # ── Verify ───────────────────────────────────────────────────────────
  if binary_works; then
    echo "whisper-cpp installed and verified."
    echo "  Binary: $(du -h "$BIN_PATH" | cut -f1)"
    ls "$BIN_DIR"/*.dylib 2>/dev/null | while read -r f; do
      echo "  Dylib:  $(basename "$f") ($(du -h "$f" | cut -f1))"
    done
    return 0
  else
    echo "WARNING: Binary was copied but doesn't run. It may need additional dylibs."
    echo "Check with: otool -L $BIN_PATH"
    return 1
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────

echo "Checking for whisper-cpp..."

# 1. Already installed and working
if binary_works; then
  echo "whisper-cpp already present and working at bin/whisper-cpp"
  exit 0
fi

if [[ -e "$BIN_PATH" ]]; then
  echo "bin/whisper-cpp exists but doesn't run — replacing it."
fi

mkdir -p "$BIN_DIR"

# 2. Found on PATH
for name in whisper-cli whisper-cpp; do
  if command -v "$name" &>/dev/null; then
    if install_binary "$(command -v "$name")"; then
      exit 0
    fi
  fi
done

# 3. Install via Homebrew (if available)
if command -v brew &>/dev/null; then
  echo "Installing whisper-cpp via Homebrew..."
  brew install whisper-cpp

  for candidate in \
    "$(brew --prefix)/bin/whisper-cli" \
    "$(brew --prefix)/bin/whisper-cpp"; do
    if [[ -x "$candidate" ]]; then
      if install_binary "$candidate"; then
        exit 0
      fi
    fi
  done
fi

# 4. Build from source
#    Requires: git, cmake, a C++ compiler (clang++ via Xcode CLT or otherwise)
echo ""
echo "No prebuilt whisper-cpp found — building from source..."
echo "This requires: git, cmake, and a C++ compiler."
echo ""

# Check for cmake
if ! command -v cmake &>/dev/null; then
  echo "cmake not found."

  # Try pip (available without Homebrew)
  if command -v pip3 &>/dev/null; then
    echo "Installing cmake via pip3..."
    pip3 install --user cmake 2>/dev/null && export PATH="$PATH:$(python3 -m site --user-base)/bin"
  elif command -v pip &>/dev/null; then
    echo "Installing cmake via pip..."
    pip install --user cmake 2>/dev/null && export PATH="$PATH:$(python -m site --user-base)/bin"
  fi

  # Check again
  if ! command -v cmake &>/dev/null; then
    echo "ERROR: cmake is required for building from source."
    echo ""
    echo "Install one of:"
    echo "  brew install cmake          (Homebrew)"
    echo "  pip3 install cmake          (pip)"
    echo "  xcode-select --install      (Xcode CLT may include it)"
    echo ""
    echo "Then re-run: bash scripts/setup-whisper.sh"
    exit 1
  fi
fi

# Check for C++ compiler
if ! command -v c++ &>/dev/null && ! command -v clang++ &>/dev/null && ! command -v g++ &>/dev/null; then
  echo "No C++ compiler found. Install Xcode Command Line Tools:"
  echo "  xcode-select --install"
  echo ""
  echo "Then re-run: bash scripts/setup-whisper.sh"
  exit 1
fi

echo "Building whisper.cpp from source (this takes a few minutes)..."

TMPDIR_BUILD="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BUILD"' EXIT

git clone --depth 1 https://github.com/ggerganov/whisper.cpp "$TMPDIR_BUILD"
cd "$TMPDIR_BUILD"

cmake -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF

cmake --build build --config Release -j "$(sysctl -n hw.physicalcpu 2>/dev/null || echo 4)"

# Find the built binary
built_bin=""
for candidate in \
  build/bin/whisper-cli \
  build/bin/whisper-cpp \
  build/whisper-cli \
  build/main \
  main; do
  if [[ -x "$candidate" ]]; then
    built_bin="$candidate"
    break
  fi
done

if [[ -z "$built_bin" ]]; then
  echo "ERROR: Build completed but could not find the whisper binary."
  echo "Looked in: build/bin/, build/"
  ls -la build/bin/ 2>/dev/null || true
  ls -la build/ 2>/dev/null | head -20
  exit 1
fi

echo "Built binary at: $built_bin"

# Check if it's statically linked (no external dylibs beyond system ones)
if otool -L "$built_bin" 2>/dev/null | grep -qvE '(^\s*/usr/lib/|^\s*@rpath/libSystem|^\s*@rpath/libc\+\+|whisper-cpp:)'; then
  # Has external dylibs — copy them from the build directory
  echo "Binary has dynamic dependencies — bundling dylibs..."

  # Copy dylibs from the build output
  for build_lib_dir in build/bin build/lib build; do
    if [[ -d "$build_lib_dir" ]]; then
      for dylib in "$build_lib_dir"/lib*.dylib; do
        if [[ -f "$dylib" ]]; then
          echo "  Copying $(basename "$dylib")"
          cp "$dylib" "$BIN_DIR/"
          chmod 644 "$BIN_DIR/$(basename "$dylib")"
        fi
      done
    fi
  done
fi

# Install the binary (with dylib handling and verification)
if install_binary "$built_bin"; then
  exit 0
fi

echo ""
echo "ERROR: Failed to produce a working whisper-cpp binary."
echo "Please file an issue or install manually:"
echo "  brew install whisper-cpp && bash scripts/setup-whisper.sh"
exit 1

# ── llama-server dylib bundling ───────────────────────────────────────────
# If bin/llama-server exists, fix its dynamic library references to use
# @loader_path so all dylibs are resolved from the same directory.
# This must run AFTER whisper-cpp setup so the ggml dylibs may already be present.

echo ""
echo "Checking llama-server dylibs..."

LLAMA_BIN="$BIN_DIR/llama-server"

if [[ ! -x "$LLAMA_BIN" ]]; then
  echo "bin/llama-server not found — skipping dylib fix."
  exit 0
fi

# Check if llama-server already works
if "$LLAMA_BIN" --help 2>&1 | head -1 | grep -qi "usage\|llama\|server"; then
  echo "llama-server already works — no dylib fix needed."
  exit 0
fi

echo "llama-server has unresolved dylibs — bundling..."

# Required dylibs for llama-server
LLAMA_DYLIBS="libssl.3.dylib libcrypto.3.dylib libmtmd.0.dylib libllama.0.dylib libggml.0.dylib libggml-base.0.dylib"

# Search directories for dylibs
LLAMA_SEARCH_DIRS="/opt/homebrew/lib /opt/homebrew/opt/openssl@3/lib /opt/homebrew/opt/llama.cpp/lib /opt/homebrew/opt/ggml/lib /usr/local/lib"

for dylib_name in $LLAMA_DYLIBS; do
  # Skip if already in bin/
  if [[ -f "$BIN_DIR/$dylib_name" ]]; then
    continue
  fi

  # Search for the dylib
  for search_dir in $LLAMA_SEARCH_DIRS; do
    if [[ -f "$search_dir/$dylib_name" ]]; then
      echo "  Copying $dylib_name from $search_dir"
      cp "$search_dir/$dylib_name" "$BIN_DIR/"
      chmod 644 "$BIN_DIR/$dylib_name"
      break
    fi
  done
done

# Patch library paths in llama-server binary
echo "  Patching rpath in llama-server..."
install_name_tool -add_rpath "@loader_path" "$LLAMA_BIN" 2>/dev/null || true

# Change absolute Homebrew paths to @loader_path references
for old_path in \
  "/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib" \
  "/opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib" \
  "/opt/homebrew/opt/ggml/lib/libggml.0.dylib" \
  "/opt/homebrew/opt/ggml/lib/libggml-base.0.dylib" \
  "/opt/homebrew/opt/llama.cpp/lib/libllama.0.dylib" \
  "/opt/homebrew/opt/llama.cpp/lib/libmtmd.0.dylib"; do
  base="$(basename "$old_path")"
  install_name_tool -change "$old_path" "@loader_path/$base" "$LLAMA_BIN" 2>/dev/null || true
done

# Patch each dylib's own dependencies
for dylib in "$BIN_DIR"/lib*.dylib; do
  [[ -f "$dylib" ]] || continue
  base="$(basename "$dylib")"

  # Set the install name
  install_name_tool -id "@loader_path/$base" "$dylib" 2>/dev/null || true

  # Fix any absolute Homebrew references to @loader_path
  for old_path in \
    "/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib" \
    "/opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib" \
    "/opt/homebrew/Cellar/openssl@3/"*/lib/libcrypto.3.dylib \
    "/opt/homebrew/opt/ggml/lib/libggml.0.dylib" \
    "/opt/homebrew/opt/ggml/lib/libggml-base.0.dylib" \
    "/opt/homebrew/opt/llama.cpp/lib/libllama.0.dylib" \
    "/opt/homebrew/opt/llama.cpp/lib/libmtmd.0.dylib"; do
    dep_base="$(basename "$old_path")"
    install_name_tool -change "$old_path" "@loader_path/$dep_base" "$dylib" 2>/dev/null || true
  done

  # Fix @rpath references within dylibs to use @loader_path
  for rpath_lib in libllama.0.dylib libggml-base.0.dylib libmtmd.0.dylib; do
    install_name_tool -change "@rpath/$rpath_lib" "@loader_path/$rpath_lib" "$dylib" 2>/dev/null || true
  done
done

# Ad-hoc codesign everything
if command -v codesign &>/dev/null; then
  codesign --force --sign - "$LLAMA_BIN" 2>/dev/null || true
  for dylib in "$BIN_DIR"/lib*.dylib; do
    codesign --force --sign - "$dylib" 2>/dev/null || true
  done
fi

# Verify
if "$LLAMA_BIN" --help 2>&1 | head -1 | grep -qi "usage\|llama\|server"; then
  echo "llama-server dylibs fixed and verified."
else
  echo "WARNING: llama-server still doesn't run after dylib fix."
  echo "Check with: otool -L $LLAMA_BIN"
fi
