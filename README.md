# MLCBot Chrome Extension

![Chrome Extension](https://github.com/mlc-ai/mlc-llm/assets/11940172/0d94cc73-eff1-4128-a6e4-70dc879f04e0)

## Features

- **AI-Powered Chatbot:**
  - Chat with local LLM models directly in your browser
  - Multiple model support (Qwen2, Llama-2, Mistral, Phi-2)
  - Side panel interface for seamless interaction
  - Copy responses to clipboard

- **Smart Comment Generation:**
  - Select text on any webpage and right-click
  - Choose "Generate Smart Comment" from context menu
  - AI generates thoughtful, contextual comments
  - Copy generated comments to clipboard
  - Works on any website for social media engagement

## Installation & Usage

To run the extension, do the following steps under this folder:

```bash
npm install
npm run build
```

This will create a new directory at `dist/`. To load the extension into Chrome:

1. Go to Extensions > Manage Extensions and select Load Unpacked.
2. Add the `dist/` directory.
3. Pin the extension to your toolbar.
4. Open the extension to start chatting with AI!

## Notes
- The extension provides a side panel interface for AI chat.
- All AI processing happens locally using WebLLM.
- Multiple models available for different performance needs.
- Smart comment feature works on any webpage for social media engagement.
- Simple and focused chatbot experience with contextual features.
