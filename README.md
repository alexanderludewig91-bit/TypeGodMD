# TypeGodMD

KI-gestütztes Wissensmanagement für Markdown-Notizen.

## Features

- **File Explorer**: Navigiere durch deine Markdown-Dateien
- **Markdown Editor**: Bearbeite Notizen mit Live-Vorschau und Syntax-Highlighting
- **KI-Chat**: Erstelle und bearbeite Notizen mit OpenAI-Integration
- **Graph View**: Visualisiere Verknüpfungen zwischen deinen Notizen
- **Suche**: Klassische und semantische Suche über alle Dateien

## Voraussetzungen

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [pnpm](https://pnpm.io/) oder npm

## Installation

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run tauri dev

# App für Produktion bauen
npm run tauri build
```

## Konfiguration

1. Starte die App
2. Öffne die Einstellungen (Zahnrad-Icon)
3. Füge deinen OpenAI API-Key hinzu
4. Wähle dein bevorzugtes Modell (GPT-4o empfohlen)

## Tastaturkürzel

| Aktion | Windows/Linux | macOS |
|--------|---------------|-------|
| Speichern | Ctrl+S | ⌘S |
| Suchen | Ctrl+P | ⌘P |
| Projekt öffnen | Ctrl+O | ⌘O |

## Technologie-Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri 2.0 (Rust)
- **Styling**: Tailwind CSS
- **Editor**: CodeMirror 6
- **KI**: OpenAI API

## Lizenz

MIT
