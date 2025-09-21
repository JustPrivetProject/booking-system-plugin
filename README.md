# Chrome Booking System Plugin Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue.svg)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-2.1.10-green.svg)](package.json)

## Overview

The **Chrome Booking System Plugin** is a browser extension designed to automate time slot bookings on authorized shipping port websites. It simplifies the booking process and enhances user experience.

## Features

- 🚢 **Automated Booking**: Automates booking processes for shipping ports
- 💾 **Local Storage**: Saves user preferences locally in your browser
- 🔄 **Smart Retry**: Automatically retries failed bookings with intelligent timing
- 🛡️ **Privacy First**: Does **not** collect personal or sensitive user information
- 📊 **Real-time Status**: Shows booking status and progress in real-time

## Installation

### Option 1: Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store](#) (link to be added when published)
2. Click **"Add to Chrome"**
3. Confirm the installation in the popup dialog

### Option 2: Manual Installation (Developer Mode)

1. Download the latest release from [GitHub Releases](https://github.com/JustPrivetProject/booking-system-plugin/releases)
2. Extract the ZIP file to a folder
3. Open `chrome://extensions/` in your browser
4. Enable **Developer mode** (toggle in top-right corner)
5. Click **"Load unpacked"** and select the extracted folder
6. The extension icon should appear in your browser toolbar

## Usage

1. **Start Booking**: Click the extension icon to start the automation process
2. **Configure Preferences**: Set your booking preferences as needed
3. **Monitor Progress**: Watch the real-time status of your bookings
4. **Automatic Processing**: The extension handles time slot bookings automatically

## Privacy & Security

- 🔒 **No Data Collection**: We do not store or share any personal data
- 🏠 **Local Storage**: All data is stored locally in your browser
- 🔐 **Secure**: No external data transmission of sensitive information

## Compatibility

- **Chrome Browser**: Version 88 or higher
- **Operating Systems**: Windows, macOS, Linux
- **Permissions**: Active tab, storage, background script

## FAQ

### ❓ How does the extension work?

The extension automates the booking process by monitoring available time slots and automatically submitting booking requests when slots become available.

### ❓ Is my personal data safe?

Yes! The extension only stores preferences locally in your browser. No personal or sensitive information is transmitted to external servers.

### ❓ Which websites are supported?

The extension is designed for authorized shipping port booking websites. Specific site compatibility is configured automatically.

### ❓ Can I use this on multiple computers?

The extension settings are stored locally per browser installation. You'll need to configure preferences on each device separately.

## Troubleshooting

### 🔧 Extension not working?

1. Ensure you're on a supported booking website
2. Check that the extension is enabled in Chrome settings
3. Try refreshing the page and restarting the extension

### 🔧 Booking attempts failing?

1. Verify your login credentials on the booking website
2. Check your internet connection
3. Ensure the website hasn't changed its booking process

### 🔧 Extension icon not visible?

1. Click the puzzle piece icon in Chrome toolbar
2. Pin the extension to make it always visible
3. Check if the extension is enabled in `chrome://extensions/`

## Support

If you have any questions or need support, contact us at:  
📧 **Info.korespondencja@gmail.com**

## For Developers

👨‍💻 **Technical Documentation**: See [DEVELOPMENT.md](DEVELOPMENT.md) for:

- Development setup and build instructions
- Testing framework and coverage requirements
- CI/CD pipeline and automated workflows
- Code quality standards and tools
- Architecture documentation and refactoring guides

📚 **Additional Resources**:

- [API Documentation](docs/) - Detailed technical specifications
- [Contributing Guidelines](docs/) - How to contribute to the project
- [Architecture Overview](docs/architecture/) - System design and patterns

## Privacy Policy

We respect user privacy and do not store or share personal data.  
📖 [Read our Privacy Policy](PRIVACY_POLICY.md)
