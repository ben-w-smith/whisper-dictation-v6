# Whisper Dictation v6

## Building the App Bundle

To build and open the app for manual testing (required for shortcuts, accessibility, auto-paste):

```bash
npm_config_python=/opt/homebrew/bin/python3.11 pnpm run app
```

- `pnpm dev` does NOT work for testing global shortcuts or accessibility permissions — it runs as a raw Electron process, not an app bundle
- The `npm_config_python` flag is needed because `node-gyp@9.4.1` requires Python's `distutils` which was removed in Python 3.12+
- The built app opens from `dist/mac-arm64/Whisper Dictation.app`
