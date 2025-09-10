# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Alfred is a Chrome extension that provides AI-powered text assistance features (Smart Comments, Rewriting, and Explanations) that run locally in the browser. The extension uses MLC AI's Web LLM to provide completely private, client-side AI inference without sending data to external servers.

## Core Architecture

### Browser Extension Structure
- **Background Script (`background.js`)**: Service worker handling context menus, message routing between popup and content scripts
- **Content Script (`content.js`)**: Injected into web pages, handles text selection, floating menu UI, and AI result display
- **Popup (`popup.html/ts`)**: Side panel interface with chat functionality and model management
- **Manifest (`manifest.json`)**: Chrome Extension Manifest V3 configuration

### AI Integration
- **Local LLM Processing**: Uses `@mlc-ai/web-llm` library for in-browser AI inference
- **Model Management**: Supports multiple quantized models (Qwen2, Llama-2, Mistral) with dynamic loading
- **Progressive Loading**: Models are downloaded and cached with progress bars during first use

### Message Flow Architecture
1. **Text Selection**: Content script detects user text selection and shows floating menu
2. **Action Trigger**: User clicks Smart Comment/Rewrite/Explain in floating menu or context menu
3. **Background Routing**: Background script receives request and forwards to popup for AI processing
4. **AI Processing**: Popup uses loaded LLM to generate response
5. **Result Display**: Background script forwards AI result back to content script for display

## Development Commands

### Build and Development
```bash
# Build the extension for production
npm run build

# Development workflow (no hot reload - manual refresh required)
# 1. Make changes to source files
# 2. Run build command
# 3. Go to chrome://extensions/, click reload on Alfred extension
# 4. Test changes
```

### Testing
```bash
# No automated test suite currently exists
# Testing is done manually by:
# 1. Loading unpacked extension in Chrome
# 2. Testing on various websites with text selection
# 3. Verifying AI responses and UI interactions
```

## Key Technical Considerations

### Extension Loading Process
The extension has a complex initialization sequence:
1. **Model Loading**: First-time use requires downloading and initializing the selected LLM model (can take several minutes)
2. **State Management**: Uses Chrome storage API to persist theme preferences and floating menu settings
3. **Multi-tab Coordination**: Background script manages communication across multiple browser tabs

### Content Security Policy
The extension requires specific CSP permissions for:
- WASM execution (`'wasm-unsafe-eval'`) for running the LLM models
- Connections to Hugging Face CDN for model downloads
- Font Awesome CDN for icons

### Model Architecture
- **Default Model**: `Qwen2-0.5B-Instruct-q4f16_1-MLC` (smallest/fastest)
- **Model Selection**: Users can switch between different sized models based on performance needs
- **Quantization**: All models use quantized versions (q4f16_1 or q4f32_1) for browser compatibility

## File Structure Context

### Source Directory (`src/`)
- `manifest.json` - Extension configuration with permissions and CSP
- `popup.html/ts/css` - Main chat interface with model management
- `background.js` - Service worker for message routing and context menus  
- `content.js` - Web page injection for text selection and floating UI
- `comment-generator.css` - Styles for injected content script UI
- `popup-loading.css` - Loading animation styles for model initialization

### Website Directory (`alfreadWebsite/`)
Contains landing page for the extension with feature descriptions and download links.

## Extension Features Implementation

### Smart Comment Generation
- **Trigger**: Right-click context menu or floating menu on selected text
- **Processing**: Sends selected text to LLM with prompt engineering for comment generation
- **UI**: Results displayed in draggable, minimizable overlay with copy functionality

### Text Rewriting
- **Purpose**: Improve clarity, tone, or professionalism of selected text
- **Implementation**: Uses specialized prompts to rewrite while preserving meaning

### Text Explanation  
- **Purpose**: Simplify complex text, jargon, or technical concepts
- **Implementation**: Generates easy-to-understand explanations of selected content

### Floating Menu System
- **Activation**: Appears 400ms after text selection (with 750ms total delay)
- **Position**: Dynamically positioned above selected text
- **Toggle**: Can be enabled/disabled via popup settings

## Chrome Extension Specific Notes

### Manifest V3 Compliance
- Uses service worker instead of background page
- Implements proper message passing between contexts
- Handles extension lifecycle events properly

### Storage and Persistence
- Theme preferences stored in Chrome sync storage
- Floating menu state persisted across browser sessions
- Chat history maintained in popup context only (not persisted)

### Cross-tab Communication
The extension coordinates state across browser tabs through the background script message routing system.

## Development Workflow Tips

### Loading Unpacked Extension
1. Build the extension: `npm run build`
2. Navigate to `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" and select the `dist` folder

### Debugging
- **Popup**: Right-click extension icon → Inspect popup
- **Background**: chrome://extensions/ → Alfred → service worker → inspect
- **Content Script**: F12 on any webpage → Console (filter by extension ID)

### Model Testing
First launch will trigger model download (several minutes). Test with small text selections initially to verify functionality before testing with larger content.
