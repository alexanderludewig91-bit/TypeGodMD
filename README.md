# TypeGodMD

KI-gestütztes Wissensmanagement für Markdown-Notizen – wie Cursor AI, aber für dein persönliches Wissen.

![TypeGodMD](logo/typegod_logo.png)

## Features

### 📁 Datei-Management
- **File Explorer**: Navigiere durch deine Dateien und Ordner
- **Drag & Drop**: Verschiebe Dateien per Drag & Drop
- **Sortierung**: Nach Name, Datum oder Typ sortieren
- **Papierkorb**: Gelöschte Dateien werden sicher im Papierkorb aufbewahrt
- **Datei-Metadaten**: Größe, Erstellungsdatum, Änderungsdatum einsehen

### ✏️ Editor
- **WYSIWYG-Editor**: Bearbeite Markdown wie in Obsidian (Milkdown)
- **Source-Modus**: Wechsle zur Quellcode-Ansicht (CodeMirror)
- **Interne Links**: Klicke auf `[Link](datei.md)` um Dateien zu öffnen
- **Multi-Format**: Unterstützung für Bilder, PDFs, Office-Dateien (.docx, .xlsx)

### 🤖 KI-Integration
- **Chat-Interface**: Integrierter KI-Chat wie bei Cursor
- **Datei-Operationen**: KI kann Dateien erstellen, bearbeiten, umbenennen, verschieben, löschen
- **@ Mentions**: Erwähne Dateien mit `@dateiname` für präzise Referenzen
- **Streaming**: Antworten werden in Echtzeit angezeigt
- **Modellauswahl**: GPT-5.2, GPT-5.1, GPT-5, GPT-4o, GPT-4o-mini

### 🔀 Inline-Diff (wie Cursor)
- **Änderungen im Editor**: Sieh vorgeschlagene Änderungen direkt im Editor
- **Block-weise Entscheidung**: Nimm einzelne Änderungen an oder lehne sie ab
- **Live-Bearbeitung**: Bearbeite den Code während Änderungen ausstehen
- **Diff-Modus**: Optional alle Änderungen zur Überprüfung anzeigen
- **Direkt-Modus**: Änderungen sofort ohne Review übernehmen

### 🔍 Suche & Navigation
- **Volltextsuche**: Durchsuche alle Dateien nach Inhalt
- **Graph-Ansicht**: Visualisiere Verknüpfungen zwischen Notizen
- **Schnellnavigation**: Springe zwischen Änderungen mit Pfeiltasten

### ⚙️ Erweiterbarkeit
- **MCP-Server**: Verbinde externe Tools über Model Context Protocol
- **Lokale Speicherung**: Alle Daten bleiben auf deinem Gerät

## Voraussetzungen

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- npm oder pnpm

## Installation

```bash
# Repository klonen
git clone https://github.com/yourusername/TypeGodMD.git
cd TypeGodMD

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run tauri dev

# App für Produktion bauen
npm run tauri build
```

## Konfiguration

1. Starte die App
2. Öffne die Einstellungen (Zahnrad-Icon oben rechts)
3. Füge deinen **OpenAI API-Key** hinzu
4. Wähle dein bevorzugtes Modell (GPT-5.2 empfohlen)
5. Optional: Konfiguriere MCP-Server für zusätzliche Funktionen

## Tastaturkürzel

| Aktion | Windows/Linux | macOS |
|--------|---------------|-------|
| Speichern | Ctrl+S | ⌘S |
| Suchen | Ctrl+P | ⌘P |
| Projekt öffnen | Ctrl+O | ⌘O |

## Technologie-Stack

- **Framework**: [Tauri 2.0](https://tauri.app/) (Rust + WebView)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (Dark Mode)
- **State**: Zustand
- **WYSIWYG-Editor**: [Milkdown](https://milkdown.dev/)
- **Code-Editor**: CodeMirror 6
- **KI**: OpenAI API (GPT-4o, GPT-5.x)
- **Office-Dateien**: mammoth (Word), xlsx (Excel)

## Projektstruktur

```
TypeGodMD/
├── src/                    # React Frontend
│   ├── components/         # UI-Komponenten
│   │   ├── Chat/          # KI-Chat
│   │   ├── Editor/        # Editoren (WYSIWYG, Markdown, Diff)
│   │   ├── FileExplorer/  # Datei-Navigation
│   │   └── Settings/      # Einstellungen
│   ├── services/          # API-Services (OpenAI, MCP)
│   └── stores/            # Zustand State Management
├── src-tauri/             # Rust Backend
│   ├── src/
│   │   ├── commands/      # Tauri Commands
│   │   └── lib.rs         # App-Einstiegspunkt
│   └── capabilities/      # Tauri Berechtigungen
└── public/                # Statische Assets
```

## Lizenz

MIT

---

Made with ❤️ for knowledge workers
