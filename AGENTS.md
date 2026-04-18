# AGENTS.md

## Developer Commands

```bash
npm install            # Install dependencies
npm run compile        # Compile TypeScript to out/
npm run watch         # Watch mode for development
npx @vscode/vsce package --allow-missing-repository   # Build VSIX
```

- Press **F5** in VS Code to debug the extension in Extension Development Host

## Project Structure

- Entry point: `src/extension.ts`
- Output: `out/` (generated, never edit manually)
- Two tree views: `psgmrunner.presets`, `psgmrunner.targets`
- Services: `src/services/` (preset, target, mapping, workflow, config, output)
- UI providers: `src/ui/` (tree data providers)

## Key Details

- Activates when workspace contains `CMakePresets.json`
- Target discovery via CMake File API (reads `<binaryDir>/.cmake/api/v1/reply/`)
- Configure always writes `codemodel-v2` query file and `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`
- Requires successful configure before targets appear
- Uses VS Code Tasks API and Debug API for build/run/debug

## Extension Commands

| Command | Description |
|---------|-------------|
| `psgmrunner.refresh` | Refresh presets and targets |
| `psgmrunner.buildPreset` | Run preset configure |
| `psgmrunner.buildTarget` | Build target |
| `psgmrunner.runTarget` | Run target |
| `psgmrunner.debugTarget` | Debug target |

## Test Commands

```bash
npm test
```