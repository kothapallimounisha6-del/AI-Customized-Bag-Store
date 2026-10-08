# Atelier Form — Custom Bag Designer

A responsive bag customization studio with a live preview, itemized estimate, budget-aware style matching, and a local Qwen 2.5 design guide. The guide receives your current bag selections, price estimate, and budget with each question.

## Run locally

Requirements: Windows PowerShell, Ollama, and the `qwen2.5:3b` model.

1. Start Ollama and install the model if needed: `ollama pull qwen2.5:3b`.
2. From this project folder, run `powershell -ExecutionPolicy Bypass -File .\server.ps1`.
3. Open `http://127.0.0.1:8000`.

The local server serves the site and proxies chat requests only to Ollama at `127.0.0.1:11434`. No cloud AI API is used. Keep the server running while chatting; press Ctrl+C in its terminal to stop it. Opening `index.html` directly still works for bag design, but the chatbot requires the local server.

## Features

- Three bag silhouettes, six colors, three sizes, four materials, and four patterns
- Live illustrated preview with material-specific texture
- Four style profiles and budget-aware design matching
- Itemized estimated price with within/over-budget feedback
- Save designs locally in the browser
- Local design-guide chat with current bag and budget context
- Responsive layout and accessible controls
