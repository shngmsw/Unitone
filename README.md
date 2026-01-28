<p align="center">
  <img src="assets/icons/128x128.png" alt="Unitone Logo" width="128" height="128">
</p>

<h1 align="center">Unitone</h1>

<p align="center">
  <strong>All your chat apps in one place</strong>
</p>

<p align="center">
  <a href="https://github.com/shngmsw/Unitone/releases/latest">
    <img src="https://img.shields.io/github/v/release/shngmsw/Unitone?style=flat-square" alt="GitHub Release">
  </a>
  <a href="https://github.com/shngmsw/Unitone/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/shngmsw/Unitone?style=flat-square" alt="License">
  </a>
  <a href="https://github.com/shngmsw/Unitone/releases">
    <img src="https://img.shields.io/github/downloads/shngmsw/Unitone/total?style=flat-square" alt="Downloads">
  </a>
</p>

<p align="center">
  <a href="README_ja.md">🇯🇵 日本語</a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#supported-services">Supported Services</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## About

Unitone is a desktop application that lets you manage multiple chat services like Slack, Google Chat, Microsoft Teams, and Chatwork in a single window. No more switching between apps or browser tabs - stay focused and organized.

<!--
Screenshot placeholder - Add your screenshot here
<p align="center">
  <img src="docs/screenshot.png" alt="Unitone Screenshot" width="800">
</p>
-->

## Features

- **Multi-Service Support** - Access Slack, Google Chat, Teams, Chatwork and more from one window
- **Custom Services** - Add any web-based chat service with a custom URL
- **Drag & Drop Reordering** - Organize your services in any order you prefer
- **AI Companion** - Built-in AI assistant panel (Gemini, Claude, ChatGPT, etc.)
- **Notification Badges** - See unread counts for each service at a glance
- **System Tray** - Runs in background, always accessible
- **Auto Updates** - Automatically checks for and installs updates
- **Cross-Platform** - Works on macOS, Windows, and Linux

## Supported Services

| Service | URL |
|---------|-----|
| Slack | https://app.slack.com |
| Google Chat | https://chat.google.com |
| Microsoft Teams | https://teams.microsoft.com |
| Chatwork | https://www.chatwork.com |
| Discord | https://discord.com/app |
| *Any web-based chat* | Custom URL |

## Installation

### Download

Download the latest version for your platform from [GitHub Releases](https://github.com/shngmsw/Unitone/releases/latest):

| Platform | Download |
|----------|----------|
| **Windows** | `Unitone-Setup-x.x.x.exe` (installer) or `Unitone-x.x.x-portable.exe` |
| **macOS (Intel)** | `Unitone-x.x.x-x64.dmg` |
| **macOS (Apple Silicon)** | `Unitone-x.x.x-arm64.dmg` |
| **Linux** | `Unitone-x.x.x.AppImage`, `.deb`, or `.rpm` |

### Important Note on Code Signing

> **Note**: Unitone is distributed without code signing certificates. This means:
>
> - **Windows**: You may see a "Windows protected your PC" warning from SmartScreen. Click "More info" → "Run anyway" to proceed.
> - **macOS**: You may see a "cannot be opened because the developer cannot be verified" warning. Right-click the app → "Open" → "Open" to allow it, or go to System Preferences → Security & Privacy → "Open Anyway".
> - **Linux**: No additional steps required.
>
> This is a cost-saving measure for a free, open-source project. The source code is fully available for review.

## Usage

### Basic Operations

1. **Launch Unitone** - Open the app from your Applications folder or Start Menu
2. **Add a Service** - Click the `+` button in the sidebar to add a new chat service
3. **Switch Services** - Click on service icons in the sidebar to switch between them
4. **Reorder Services** - Drag and drop service icons to reorder them
5. **AI Companion** - Click the "AI" button to toggle the AI assistant panel
6. **Settings** - Click the gear icon to manage your services

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Toggle AI Panel | `Ctrl/Cmd + Shift + A` |
| Reload Current Service | `Ctrl/Cmd + R` |
| Quit | `Ctrl/Cmd + Q` |

## Development

### Prerequisites

- Node.js 18 or higher
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/shngmsw/Unitone.git
cd Unitone

# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Build

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux

# Build for all platforms
npm run build:all
```

### Project Structure

```
Unitone/
├── assets/           # Icons and resources
│   ├── icons/        # App icons (various sizes)
│   └── mac/          # macOS entitlements
├── scripts/          # Build scripts
├── src/
│   ├── main/         # Electron main process
│   ├── preload/      # Preload scripts (IPC bridge)
│   └── renderer/     # Renderer process (UI)
├── docs/             # Documentation
└── package.json
```

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Guidelines

- Follow the existing code style
- Write clear commit messages
- Test your changes on your platform before submitting
- Update documentation if needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Auto-update powered by [electron-updater](https://www.electron.build/auto-update)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/shngmsw">shngmsw</a>
</p>
