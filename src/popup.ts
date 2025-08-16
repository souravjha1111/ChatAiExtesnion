/* eslint-disable @typescript-eslint/no-non-null-assertion */
"use strict";

// This code is partially adapted from the openai-chatgpt-chrome-extension repo:
// https://github.com/jessedi0n/openai-chatgpt-chrome-extension

import "./popup.css";

import {
  MLCEngineInterface,
  InitProgressReport,
  CreateMLCEngine,
  ChatCompletionMessageParam,
} from "@mlc-ai/web-llm";
import { ProgressBar, Line } from "progressbar.js";

// modified setLabel to not throw error
function setLabel(id: string, text: string) {
  const label = document.getElementById(id);
  if (label != null) {
    label.innerText = text;
  }
}

function getElementAndCheck(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element == null) {
    throw Error("Cannot find element " + id);
  }
  return element;
}



const queryInput = getElementAndCheck("query-input")!;
const submitButton = getElementAndCheck("submit-button")!;
const modelName = getElementAndCheck("model-name");

let modelDisplayName = "";

// Initialize the extension

(<HTMLButtonElement>submitButton).disabled = true;

let progressBar: ProgressBar = new Line("#loadingContainer", {
  strokeWidth: 4,
  easing: "easeInOut",
  duration: 1400,
  color: "#ffd166",
  trailColor: "#eee",
  trailWidth: 1,
  svgStyle: { width: "100%", height: "100%" },
});

let isLoadingParams = true;

let initProgressCallback = (report: InitProgressReport) => {
  setLabel("init-label", report.text);
  progressBar.animate(report.progress, {
    duration: 50,
  });
  if (report.progress == 1.0) {
    enableInputs();
  }
};

/* All available models in prebuiltAppConfig:
  - Qwen2-0.5B-Instruct-q4f16_1-MLC
  - Qwen2-1.5B-Instruct-q4f16_1-MLC
  - Qwen2-4B-Instruct-q4f16_1-MLC
  - Qwen2-7B-Instruct-q4f16_1-MLC
  - Llama-2-7b-chat-hf-q4f32_1-MLC
  - Llama-2-13b-chat-hf-q4f32_1-MLC
  - Llama-2-70b-chat-hf-q4f32_1-MLC
  - Mistral-7B-Instruct-v0.2-q4f32_1-MLC
  - Phi-2-q4f32_1-MLC
  - RedPajama-3B-v2-q4f32_1-MLC
*/

// Available models
const availableModels = [
  "Qwen2-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2-1.5B-Instruct-q4f16_1-MLC",  // Default model
  "Llama-2-13b-chat-hf-q4f32_1-MLC",
  "Llama-2-7b-chat-hf-q4f32_1-MLC",
  "Qwen2-7B-Instruct-q4f16_1-MLC",
  "Qwen2-4B-Instruct-q4f16_1-MLC"
];

// initially selected model
let selectedModel = "Qwen2-0.5B-Instruct-q4f16_1-MLC";

// populate model-selection
const modelSelector = getElementAndCheck(
  "model-selection",
) as HTMLSelectElement;

// Filter and add only the specified models
for (const modelId of availableModels) {
  const opt = document.createElement("option");
  opt.value = modelId;
  opt.innerHTML = modelId;
  opt.selected = modelId === selectedModel;
  modelSelector.appendChild(opt);
}

modelName.innerText = "Loading initial model...";
const engine: MLCEngineInterface = await CreateMLCEngine(selectedModel, {
  initProgressCallback: initProgressCallback,
});
modelName.innerText = "Now chatting with " + modelDisplayName;

let chatHistory: ChatCompletionMessageParam[] = [];

// Add interface for enhanced message structure
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  id: string;
}

let enhancedChatHistory: ChatMessage[] = [];

function enableInputs() {
  if (isLoadingParams) {
    setTimeout(() => {
      isLoadingParams = false;
    }, 500);
  }

  const initLabel = document.getElementById("init-label");
  initLabel?.remove();
  const loadingBarContainer = document.getElementById("loadingContainer")!;
  loadingBarContainer?.remove();
  queryInput.focus();

  const modelNameArray = selectedModel.split("-");
  modelDisplayName = modelNameArray[0];
  let j = 1;
  while (j < modelNameArray.length && modelNameArray[j][0] != "q") {
    modelDisplayName = modelDisplayName + "-" + modelNameArray[j];
    j++;
  }
}

let requestInProgress = false;

// Disable submit button if input field is empty
queryInput.addEventListener("keyup", () => {
  (<HTMLButtonElement>submitButton).disabled = 
    (<HTMLInputElement>queryInput).value === "" || 
    requestInProgress || 
    isLoadingParams;
});

// If user presses enter, click submit button
queryInput.addEventListener("keyup", (event) => {
  if (event.code === "Enter") {
    event.preventDefault();
    submitButton.click();
  }
});

// Listen for clicks on submit button
async function handleClick() {
  requestInProgress = true;
  (<HTMLButtonElement>submitButton).disabled = true;

  const message = (<HTMLInputElement>queryInput).value;
  document.getElementById("loading-indicator")!.style.display = "block";

  // Add user message with timestamp
  const userMessage: ChatMessage = {
    role: "user",
    content: message,
    timestamp: new Date(),
    id: generateMessageId()
  };
  
  chatHistory.push({ role: "user", content: message });
  enhancedChatHistory.push(userMessage);
  
  // Clear the input field after sending
  (<HTMLInputElement>queryInput).value = "";
  
  updateChatHistory();

  // Create assistant message placeholder
  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: "",
    timestamp: new Date(),
    id: generateMessageId()
  };
  
  // Add empty assistant message to chat history
  enhancedChatHistory.push(assistantMessage);
  updateChatHistory();

  let curMessage = "";
  const completion = await engine.chat.completions.create({
    stream: true,
    messages: chatHistory,
  });
  
  for await (const chunk of completion) {
    const curDelta = chunk.choices[0].delta.content;
    if (curDelta) {
      curMessage += curDelta;
      // Update the assistant message content in real-time
      assistantMessage.content = curMessage;
      updateChatHistory();
    }
  }
  
  const response = await engine.getMessage();
  
  // Update final response
  assistantMessage.content = response;
  chatHistory.push({ role: "assistant", content: response });
  updateChatHistory();

  requestInProgress = false;
  (<HTMLButtonElement>submitButton).disabled = false;
}
submitButton.addEventListener("click", handleClick);





// listen for changes in modelSelector
async function handleSelectChange() {
  if (isLoadingParams) return;

  modelName.innerText = "";

  const initLabel = document.createElement("p");
  initLabel.id = "init-label";
  initLabel.innerText = "Initializing model...";
  const loadingContainer = document.createElement("div");
  loadingContainer.id = "loadingContainer";

  const loadingBox = getElementAndCheck("loadingBox");
  loadingBox.appendChild(initLabel);
  loadingBox.appendChild(loadingContainer);

  isLoadingParams = true;
  (<HTMLButtonElement>submitButton).disabled = true;

  if (requestInProgress) {
    engine.interruptGenerate();
  }
  engine.resetChat();
  chatHistory = [];
  enhancedChatHistory = [];
  updateChatHistory();
  

  await engine.unload();

  selectedModel = modelSelector.value;

  progressBar = new Line("#loadingContainer", {
    strokeWidth: 4,
    easing: "easeInOut",
    duration: 1400,
    color: "#ffd166",
    trailColor: "#eee",
    trailWidth: 1,
    svgStyle: { width: "100%", height: "100%" },
  });

  initProgressCallback = (report: InitProgressReport) => {
    setLabel("init-label", report.text);
    progressBar.animate(report.progress, {
      duration: 50,
    });
    if (report.progress == 1.0) {
      enableInputs();
    }
  };

  engine.setInitProgressCallback(initProgressCallback);

  requestInProgress = true;
  modelName.innerText = "Reloading with new model...";
  await engine.reload(selectedModel);
  requestInProgress = false;
  modelName.innerText = "Now chatting with " + modelDisplayName;
}
modelSelector.addEventListener("change", handleSelectChange);

// Listen for smart comment generation requests from background script
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'generate-smart-comment-popup' && msg.text && msg.tabId) {
    console.log('[POPUP] Received smart comment request from background:', msg);
    
    // Prepare the prompt for strict comment generation
    const prompt = `Generate a smart, engaging comment for the following text. The comment should be thoughtful, relevant, and add value to the conversation. Return ONLY the comment text and nothing else. Do not include any explanations, quotes, or additional text.

Text: "${msg.text}"`;
    
    try {
      const completion = await engine.chat.completions.create({
        stream: false,
        messages: [
          { role: "user", content: prompt }
        ]
      });
      
      let comment = "";
      if (completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content) {
        comment = completion.choices[0].message.content.trim();
      }
      
      // Send the comment back to the background script
      chrome.runtime.sendMessage({
        type: 'smart-comment-result-popup',
        comment: comment,
        tabId: msg.tabId
      });
      
      console.log('[POPUP] Sent comment result to background:', comment);
    } catch (e) {
      chrome.runtime.sendMessage({
        type: 'smart-comment-result-popup',
        comment: 'Error generating comment. Please try again.',
        tabId: msg.tabId
      });
      console.error('[POPUP] Error generating comment:', e);
    }
  }
});





// Clear chat functionality
const clearChatButton = getElementAndCheck("clear-chat") as HTMLButtonElement;

clearChatButton.addEventListener("click", () => {
  clearChat();
});

function clearChat() {
  chatHistory = [];
  enhancedChatHistory = [];
  updateChatHistory();
  document.getElementById("loading-indicator")!.style.display = "none";
  queryInput.focus();
}

// Generate unique message ID
function generateMessageId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format timestamp
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Add a function to render chat history with timestamps
function updateChatHistory() {
  const chatHistoryDiv = document.getElementById("chat-history");
  if (!chatHistoryDiv) return;
  
  chatHistoryDiv.innerHTML = enhancedChatHistory
    .map((msg) => {
      const timestamp = formatTimestamp(msg.timestamp);
      const isUser = msg.role === "user";
      
      let actionButtons = "";
      if (!isUser) {
        actionButtons = `
          <div class="message-actions">
            <button class="message-action-btn" onclick="copyMessage('${msg.id}')" title="Copy message">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
            <button class="message-action-btn" onclick="editMessage('${msg.id}')" title="Edit message">
              <i class="fa-solid fa-edit"></i> Edit
            </button>
          </div>
        `;
      }
      
      return `
        <div class='chat-message ${msg.role}'>
          <div class="message-content">
            <b>${isUser ? 'You' : 'Bot'}:</b> ${msg.content}
          </div>
          <span class="message-timestamp">${timestamp}</span>
          ${actionButtons}
        </div>
      `;
    })
    .join("");
}

// Add global functions for message actions
(window as any).copyMessage = function(messageId: string) {
  const message = enhancedChatHistory.find(msg => msg.id === messageId);
  if (message) {
    navigator.clipboard.writeText(message.content);
    console.log('Copied message:', message.content);
    
    // Show visual feedback
    const button = document.querySelector(`[onclick="copyMessage('${messageId}')"]`) as HTMLElement;
    if (button) {
      const originalText = button.innerHTML;
      button.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
      button.style.color = '#28a745';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.color = '';
      }, 2000);
    }
  }
};

(window as any).editMessage = function(messageId: string) {
  const messageIndex = enhancedChatHistory.findIndex(msg => msg.id === messageId);
  if (messageIndex === -1) return;
  
  const message = enhancedChatHistory[messageIndex];
  const newContent = prompt("Edit message:", message.content);
  
  if (newContent !== null && newContent.trim() !== "") {
    message.content = newContent.trim();
    // Update the corresponding chatHistory entry
    const chatIndex = Math.floor(messageIndex / 2); // Since chatHistory has user+assistant pairs
    if (chatHistory[chatIndex]) {
      chatHistory[chatIndex].content = newContent.trim();
    }
    updateChatHistory();
    console.log('Edited message:', newContent);
  }
};




