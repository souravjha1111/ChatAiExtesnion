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



const queryInput = getElementAndCheck("query-input") as HTMLTextAreaElement;

// Add auto-resize functionality to textarea
function autoResizeTextarea() {
  queryInput.style.height = 'auto';
  queryInput.style.height = Math.min(queryInput.scrollHeight, 120) + 'px'; // Max height 120px
}

// Add event listener for auto-resize
queryInput.addEventListener('input', autoResizeTextarea);
queryInput.addEventListener('keydown', (e) => {
  // Allow Enter key without Ctrl for line breaks
  if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
    // Add a small delay to allow the newline to be processed
    setTimeout(autoResizeTextarea, 0);
  }
});
const submitButton = getElementAndCheck("submit-button") as HTMLButtonElement;
const modelName = getElementAndCheck("model-name");
const themeToggle = getElementAndCheck("theme-toggle")!;
const helpBtn = getElementAndCheck("help-btn")!;
const helpModal = getElementAndCheck("help-modal")!;
const closeHelpBtn = getElementAndCheck("close-help")!;
const hamburgerBtn = getElementAndCheck("hamburger-btn")!;
const hamburgerDropdown = getElementAndCheck("hamburger-dropdown")!;
const floatingMenuToggle = getElementAndCheck("floating-menu-toggle")!;
const floatingMenuCheckbox = getElementAndCheck("floating-menu-checkbox") as HTMLInputElement;

// Theme management
let currentTheme = localStorage.getItem('theme') || 'light';

// Function to set theme
function setTheme(theme: string) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Update theme toggle button icon with smooth transition
  const icon = themeToggle.querySelector('i');
  if (icon) {
    icon.style.transition = 'transform 0.3s ease';
    icon.style.transform = 'rotate(180deg)';
    
    setTimeout(() => {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      icon.style.transform = 'rotate(0deg)';
    }, 150);
  }
  
  // Update theme toggle button title
  themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  
  // Add a subtle animation to the container
  const container = document.querySelector('.container') as HTMLElement;
  if (container) {
    container.style.transition = 'all 0.3s ease';
  }
}

// Function to toggle theme
function toggleTheme() {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

// Initialize theme
setTheme(currentTheme);

// Ensure help modal is hidden on page load
helpModal.style.display = "none";

// Floating menu toggle functionality
let floatingMenuEnabled = false;

// Load floating menu state from storage
chrome.storage.sync.get(['floatingMenuEnabled'], (result) => {
  // Set floatingMenuEnabled to true by default (matching content.js default)
  floatingMenuEnabled = result.floatingMenuEnabled !== false;
  floatingMenuCheckbox.checked = floatingMenuEnabled;
  
  // Save the state to ensure consistency
  chrome.storage.sync.set({ floatingMenuEnabled });
  
  // Broadcast the initial state to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'floating-menu-state-changed',
          enabled: floatingMenuEnabled
        }).catch(() => {
          // Ignore errors for tabs that don't have the content script running
        });
      }
    });
  });
});

// Handle toggle change
floatingMenuCheckbox.addEventListener('change', () => {
  floatingMenuEnabled = floatingMenuCheckbox.checked;
  
  // Save state to storage
  chrome.storage.sync.set({ floatingMenuEnabled });
  
  // Broadcast the state change to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'floating-menu-state-changed',
          enabled: floatingMenuEnabled
        }).catch(() => {
          // Ignore errors for tabs that don't have the content script running
        });
      }
    });
  });
});

// Initialize the extension

// Disable submit button during loading
(<HTMLButtonElement>submitButton).disabled = true;
console.log('[DEBUG] Submit button disabled during loading');

// Add loading-disabled class to all interactive elements
const interactiveElements = document.querySelectorAll('button, select, input');
interactiveElements.forEach(element => {
  element.classList.add('loading-disabled');
});
console.log('[DEBUG] Loading disabled classes added to', interactiveElements.length, 'elements');

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
console.log('[DEBUG] isLoadingParams set to true');

let initProgressCallback = (report: InitProgressReport) => {
  console.log('[DEBUG] Progress report:', report);
  setLabel("init-label", report.text);
  
  progressBar.animate(report.progress, {
    duration: 50,
  });
  if (report.progress == 1.0) {
    console.log('[DEBUG] Model loading complete, enabling inputs');
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

// initially selected model - use the smallest model for faster loading
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

// Display initial model info
displayModelInfo(selectedModel);
const initialModelInfo = extractModelInfo(selectedModel);

// Update model name display with truncated version and full name on hover
if (modelName) {
  const truncatedName = selectedModel.length > 8 ? selectedModel.substring(0, 8) + '...' : selectedModel;
  modelName.textContent = truncatedName;
  modelName.title = selectedModel; // Full name on hover
}

modelName.innerText = "Loading initial model, features are paused until loading is complete";

let engine: MLCEngineInterface;
try {
  console.log('[DEBUG] Creating Alfred engine for model:', selectedModel);
  engine = await CreateMLCEngine(selectedModel, {
    initProgressCallback: initProgressCallback,
  });
  console.log('[DEBUG] Alfred engine created successfully');
} catch (error) {
  console.error('[DEBUG] Error creating Alfred engine:', error);
  // Enable inputs even if engine creation fails
  enableInputs();
  throw error;
}

// Add a fallback timer to enable inputs if progress callback fails
setTimeout(() => {
  if (isLoadingParams) {
    console.log('[DEBUG] Fallback: Enabling inputs after timeout');
    enableInputs();
  }
}, 10000); // 10 second fallback

// Add a debug function to manually enable inputs
(window as any).debugEnableInputs = () => {
  console.log('[DEBUG] Manually enabling inputs');
  enableInputs();
};

modelName.innerText = "Now chatting with " + initialModelInfo.family;

let chatHistory: ChatCompletionMessageParam[] = [];

// Add interface for enhanced message structure
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  id: string;
}

// Add interface for message mapping
interface MessageMapping {
  [key: string]: string; // messageId -> currentContent
}

let enhancedChatHistory: ChatMessage[] = [];
let messageMapping: MessageMapping = {}; // Store current content for each message



// Function to get current content of a message (either original or edited)
function getCurrentMessageContent(messageId: string): string {
  return messageMapping[messageId] || enhancedChatHistory.find(msg => msg.id === messageId)?.content || '';
}

// Function to update message content in the mapping
function updateMessageContent(messageId: string, newContent: string) {
  messageMapping[messageId] = newContent;
}

// Function to reset message content to original
function resetMessageContent(messageId: string) {
  delete messageMapping[messageId];
}





function enableInputs() {
  console.log('[DEBUG] enableInputs called');
  
  if (isLoadingParams) {
    setTimeout(() => {
      isLoadingParams = false;
    }, 500);
  }

  const initLabel = document.getElementById("init-label");
  initLabel?.remove();
  const loadingBarContainer = document.getElementById("loadingContainer")!;
  loadingBarContainer?.remove();
  
  // Remove loading-disabled class from all interactive elements
  const interactiveElements = document.querySelectorAll('button, select, input');
  interactiveElements.forEach(element => {
    element.classList.remove('loading-disabled');
  });
  
  // Enable submit button if input is not empty
  (<HTMLButtonElement>submitButton).disabled = (<HTMLTextAreaElement>queryInput).value === "";
  
  console.log('[DEBUG] Submit button disabled state:', (<HTMLButtonElement>submitButton).disabled);
  console.log('[DEBUG] Loading disabled classes removed');
  
  queryInput.focus();
}

let requestInProgress = false;

// Disable submit button if input field is empty
queryInput.addEventListener("keyup", () => {
  // Only disable based on empty input or request in progress, not loading state
  (<HTMLButtonElement>submitButton).disabled = 
    (<HTMLTextAreaElement>queryInput).value === "" || 
    requestInProgress;
});

// If user presses Ctrl+Enter or Shift+Enter, click submit button
queryInput.addEventListener("keydown", (event) => {
  if (event.code === "Enter" && (event.ctrlKey || event.shiftKey)) {
    event.preventDefault();
    submitButton.click();
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (event) => {
  // Escape to clear input
  if (event.key === "Escape") {
    event.preventDefault();
    if ((queryInput as HTMLTextAreaElement).value.trim()) {
      (queryInput as HTMLTextAreaElement).value = "";
      queryInput.focus();
      autoResizeTextarea(); // Reset height after clearing
    }
  }
  
  // Ctrl+/ to focus input
  if (event.ctrlKey && event.key === "/") {
    event.preventDefault();
    queryInput.focus();
    (queryInput as HTMLTextAreaElement).select();
  }
  
  // Ctrl+K to clear chat
  if (event.ctrlKey && event.key === "k") {
    event.preventDefault();
    if (!requestInProgress) {
      clearChat();
    }
  }
});

// Theme toggle event listener
themeToggle.addEventListener("click", (event) => {
  event.stopPropagation(); // Prevent the click from being detected by the document click handler
  toggleTheme();
  hamburgerDropdown.classList.add("hidden"); // Close the dropdown after clicking a menu item
});

// Help modal functions
function showHelpModal() {
  helpModal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function hideHelpModal() {
  helpModal.style.display = "none";
  document.body.style.overflow = "auto";
}

// Help modal event listeners
helpBtn.addEventListener("click", (event) => {
  event.stopPropagation(); // Prevent the click from being detected by the document click handler
  showHelpModal();
  hamburgerDropdown.classList.add("hidden"); // Close the dropdown after clicking a menu item
});
closeHelpBtn.addEventListener("click", hideHelpModal);

// Close help modal when clicking outside
helpModal.addEventListener("click", (event) => {
  if (event.target === helpModal) {
    hideHelpModal();
  }
});

// Hamburger menu functions
function toggleHamburgerMenu() {
  hamburgerDropdown.classList.toggle("hidden");
}

// Hamburger menu event listeners
hamburgerBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleHamburgerMenu();
});

// Close hamburger dropdown when clicking outside
document.addEventListener("click", (event) => {
  if (!hamburgerDropdown.classList.contains("hidden") && 
      !hamburgerDropdown.contains(event.target as Node) && 
      event.target !== hamburgerBtn) {
    hamburgerDropdown.classList.add("hidden");
  }
});

// Close hamburger dropdown with Escape key
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !hamburgerDropdown.classList.contains("hidden")) {
    hamburgerDropdown.classList.add("hidden");
  }
});

// Close help modal with Escape key
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && helpModal.style.display === "flex") {
    hideHelpModal();
  }
});

// Model stats button functionality
const modelStatsBtn = getElementAndCheck("model-stats-btn")!;
const modelStatsPanel = getElementAndCheck("model-stats-panel")!;

// Toggle model stats panel visibility
function toggleModelStats() {
  if (modelStatsPanel.classList.contains("hidden")) {
    modelStatsPanel.classList.remove("hidden");
    modelStatsBtn.classList.add("active");
  } else {
    modelStatsPanel.classList.add("hidden");
    modelStatsBtn.classList.remove("active");
  }
}

// Add event listener to model stats button
modelStatsBtn.addEventListener("click", (event) => {
  event.stopPropagation(); // Prevent the click from being detected by the document click handler
  toggleModelStats();
  hamburgerDropdown.classList.add("hidden"); // Close the dropdown after clicking a menu item
});

// Close model stats panel when clicking outside
document.addEventListener("click", (event) => {
  if (!modelStatsPanel.classList.contains("hidden") && 
      !modelStatsBtn.contains(event.target as Node) && 
      !modelStatsPanel.contains(event.target as Node)) {
    modelStatsPanel.classList.add("hidden");
    modelStatsBtn.classList.remove("active");
  }
});

// Variables to track current request context
let currentTabId: number | null = null;
let currentRequestType: string | null = null;

// Listen for clicks on submit button
async function handleClick() {
  console.log('[DEBUG] handleClick called');
  console.log('[DEBUG] requestInProgress:', requestInProgress);
  console.log('[DEBUG] submitButton disabled:', (<HTMLButtonElement>submitButton).disabled);
  
  if (requestInProgress) {
    engine.interruptGenerate();
    requestInProgress = false;
    (<HTMLButtonElement>submitButton).disabled = false;
    return;
  }

  requestInProgress = true;
  (<HTMLButtonElement>submitButton).disabled = true;

  const message = (<HTMLTextAreaElement>queryInput).value;
  if (message.trim() === "") return;

  // Add user message with timestamp
  const userMessage: ChatMessage = {
    role: "user",
    content: message,
    timestamp: new Date(),
    id: generateMessageId()
  };
  
  chatHistory.push({ role: "user", content: message });
  enhancedChatHistory.push(userMessage);
  updateMessageContent(userMessage.id, userMessage.content); // Update mapping
  
  // Clear the input field after sending
  (<HTMLTextAreaElement>queryInput).value = "";
  autoResizeTextarea(); // Reset height after clearing
  
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

  try {
    let curMessage = "";
    const completion = await engine.chat.completions.create({
      stream: true,
      messages: chatHistory,
    });
    
    // Get the chat message element for the current assistant message
    updateChatHistory(); // Initial render of empty message
    const chatHistoryDiv = document.getElementById("chat-history");
    const assistantMessageElement = chatHistoryDiv?.querySelector(`.chat-message:last-child .message-content`);
    
    if (assistantMessageElement) {
      // Create a span for the content that will be updated
      const contentSpan = assistantMessageElement.querySelector('.dynamic-content') || document.createElement('span');
      contentSpan.className = 'dynamic-content';
      if (!assistantMessageElement.querySelector('.dynamic-content')) {
        // Only append if not already there
        assistantMessageElement.appendChild(contentSpan);
      }
      
      for await (const chunk of completion) {
        const curDelta = chunk.choices[0].delta.content;
        if (curDelta) {
          curMessage += curDelta;
          // Update the assistant message content in memory
          assistantMessage.content = curMessage;
          updateMessageContent(assistantMessage.id, assistantMessage.content);
          
          // Update only the content span instead of re-rendering everything
          contentSpan.textContent = curMessage;
        }
      }
    } else {
      // Fallback to full re-render if element not found
      for await (const chunk of completion) {
        const curDelta = chunk.choices[0].delta.content;
        if (curDelta) {
          curMessage += curDelta;
          assistantMessage.content = curMessage;
          updateMessageContent(assistantMessage.id, assistantMessage.content);
          updateChatHistory();
        }
      }
    }
    
    const response = await engine.getMessage();
    
    // Update final response
    assistantMessage.content = response;
    updateMessageContent(assistantMessage.id, assistantMessage.content); // Update mapping
    chatHistory.push({ role: "assistant", content: response });
    updateChatHistory();
  } catch (error) {
    console.error("Error generating response:", error);
    assistantMessage.content = "Error generating response. Please try again.";
    updateMessageContent(assistantMessage.id, assistantMessage.content);
    updateChatHistory();
  } finally {
    requestInProgress = false;
    (<HTMLButtonElement>submitButton).disabled = false;
  }
}
submitButton.addEventListener("click", handleClick);





// listen for changes in modelSelector
async function handleSelectChange() {
  // Remove the early return to allow model changes during loading
  
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
  // Disable submit button during loading
  (<HTMLButtonElement>submitButton).disabled = true;
  
  // Add loading-disabled class to all interactive elements
  const interactiveElements = document.querySelectorAll('button, select, input');
  interactiveElements.forEach(element => {
    element.classList.add('loading-disabled');
  });

  if (requestInProgress) {
    engine.interruptGenerate();
  }
  engine.resetChat();
  chatHistory = [];
  enhancedChatHistory = [];
  messageMapping = {}; // Reset message mapping
  updateChatHistory();
  

  

  await engine.unload();

  selectedModel = modelSelector.value;
  
  // Display model info for the newly selected model
  displayModelInfo(selectedModel);
  
  // Update model name display with truncated version and full name on hover
  if (modelName) {
    const truncatedName = selectedModel.length > 8 ? selectedModel.substring(0, 8) + '...' : selectedModel;
    modelName.textContent = truncatedName;
    modelName.title = selectedModel; // Full name on hover
  }
  


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
  const modelInfo = extractModelInfo(selectedModel);
  modelName.innerText = "Now chatting with " + modelInfo.family;
}
modelSelector.addEventListener("change", handleSelectChange);

// Listen for smart comment generation requests from background script
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'generate-smart-comment-popup' && msg.text && msg.tabId) {
    console.log('[POPUP] Received smart comment request from background:', msg);
    
    // Store the tab ID and request type for potential interruption
    currentTabId = msg.tabId;
    currentRequestType = 'smart-comment';
    
    // Show "I'm generating comment now..." in the input field
    queryInput.value = "I'm generating comment now...";
    queryInput.disabled = true;
    submitButton.disabled = true;
    autoResizeTextarea(); // Resize to fit the status message
    
    // First, send an initial message to show the comment div with "Generating..." text
    chrome.runtime.sendMessage({
      type: 'smart-comment-result-popup',
      comment: 'Generating...',
      tabId: msg.tabId
    });
    
    // Prepare the prompt for strict comment generation
    const prompt = `Generate a smart, engaging comment for the following text. The comment should be thoughtful, relevant, and add value to the conversation. Return ONLY the comment text and nothing else. Do not include any explanations, quotes, or additional text.

Text: "${msg.text}"`;
    
    try {
      // Use the main chat engine to generate comments
      let curMessage = "";
      const completion = await engine.chat.completions.create({
        stream: true,
        messages: [
          { role: "user", content: prompt }
        ]
      });
      
      let comment = "";
      
      // Process the stream chunks
      for await (const chunk of completion) {
        const curDelta = chunk.choices[0].delta.content;
        if (curDelta) {
          comment += curDelta;
          
          // Send each update to the background script
          chrome.runtime.sendMessage({
            type: 'smart-comment-result-popup',
            comment: comment,
            tabId: msg.tabId,
            isComplete: false
          });
        }
      }
      
      // Send the final complete message
      chrome.runtime.sendMessage({
        type: 'smart-comment-result-popup',
        comment: comment,
        tabId: msg.tabId,
        isComplete: true
      });
      
      console.log('[POPUP] Sent comment result to background:', comment);
    } catch (e) {
      chrome.runtime.sendMessage({
        type: 'smart-comment-result-popup',
        comment: 'Error generating comment. Please try again.',
        tabId: msg.tabId,
        isComplete: true
      });
      console.error('[POPUP] Error generating comment:', e);
    } finally {
      // Reset input field and re-enable it
      queryInput.value = "";
      queryInput.disabled = false;
      submitButton.disabled = false;
      queryInput.focus();
      autoResizeTextarea(); // Reset height after clearing
      currentTabId = null;
      currentRequestType = null;
    }
  } else if (msg.type === 'rewrite-text-popup' && msg.text && msg.tabId) {
    console.log('[POPUP] Received rewrite text request from background:', msg);
    
    // Show "I'm rewriting text now..." in the input field
    queryInput.value = "I'm rewriting text now...";
    queryInput.disabled = true;
    submitButton.disabled = true;
    autoResizeTextarea(); // Resize to fit the status message
    
    // First, send an initial message to show the rewrite div with "Rewriting..." text
    chrome.runtime.sendMessage({
      type: 'rewrite-text-result-popup',
      comment: 'Rewriting...',
      tabId: msg.tabId
    });
    
    // Prepare the prompt for text rewriting
    const prompt = `Rewrite the following text with better grammar and in better English. Maintain the original meaning but improve clarity, flow, and correctness:

"${msg.text}"`;
    
    try {
      // Use the main chat engine to rewrite text
      let curMessage = "";
      const completion = await engine.chat.completions.create({
        stream: true,
        messages: [
          { role: "user", content: prompt }
        ]
      });
      
      let rewrittenText = "";
      
      // Process the stream chunks
      for await (const chunk of completion) {
        const curDelta = chunk.choices[0].delta.content;
        if (curDelta) {
          rewrittenText += curDelta;
          
          // Send each update to the background script
          chrome.runtime.sendMessage({
            type: 'rewrite-text-result-popup',
            comment: rewrittenText,
            tabId: msg.tabId,
            isComplete: false
          });
        }
      }
      
      // Send the final complete message
      chrome.runtime.sendMessage({
        type: 'rewrite-text-result-popup',
        comment: rewrittenText,
        tabId: msg.tabId,
        isComplete: true
      });
      
      console.log('[POPUP] Sent rewritten text to background:', rewrittenText);
    } catch (e) {
      chrome.runtime.sendMessage({
        type: 'rewrite-text-result-popup',
        comment: 'Error rewriting text. Please try again.',
        tabId: msg.tabId,
        isComplete: true
      });
      console.error('[POPUP] Error rewriting text:', e);
    } finally {
      // Reset input field and re-enable it
      queryInput.value = "";
      queryInput.disabled = false;
      submitButton.disabled = false;
      queryInput.focus();
      autoResizeTextarea(); // Reset height after clearing
    }
  } else if (msg.type === 'explain-text-popup' && msg.text && msg.tabId) {
    console.log('[POPUP] Received explain text request from background:', msg);
    
    // Store the tab ID and request type for potential interruption
    currentTabId = msg.tabId;
    currentRequestType = 'explain-text';
    
    // Show "I'm explaining text now..." in the input field
    queryInput.value = "I'm explaining text now...";
    queryInput.disabled = true;
    submitButton.disabled = true;
    autoResizeTextarea(); // Resize to fit the status message
    
    // First, send an initial message to show the explain div with "Explaining..." text
    chrome.runtime.sendMessage({
      type: 'explain-text-result-popup',
      comment: 'Explaining...',
      tabId: msg.tabId
    });
    
    // Prepare the prompt for text explanation
    const prompt = `Explain the following text or concept in a clear, concise, and educational manner. Break down complex ideas into simple terms and provide relevant context:

"${msg.text}"`;
    
    try {
      // Use the main chat engine to explain text
      let curMessage = "";
      const completion = await engine.chat.completions.create({
        stream: true,
        messages: [
          { role: "user", content: prompt }
        ]
      });
      
      let explanation = "";
      
      // Process the stream chunks
      for await (const chunk of completion) {
        const curDelta = chunk.choices[0].delta.content;
        if (curDelta) {
          explanation += curDelta;
          
          // Send each update to the background script
          chrome.runtime.sendMessage({
            type: 'explain-text-result-popup',
            comment: explanation,
            tabId: msg.tabId,
            isComplete: false
          });
        }
      }
      
      // Send the final complete message
      chrome.runtime.sendMessage({
        type: 'explain-text-result-popup',
        comment: explanation,
        tabId: msg.tabId,
        isComplete: true
      });
      
      console.log('[POPUP] Sent explanation result to background:', explanation);
    } catch (e) {
      chrome.runtime.sendMessage({
        type: 'explain-text-result-popup',
        comment: 'Error explaining text. Please try again.',
        tabId: msg.tabId,
        isComplete: true
      });
      console.error('[POPUP] Error explaining text:', e);
    } finally {
      // Reset input field and re-enable it
      queryInput.value = "";
      queryInput.disabled = false;
      submitButton.disabled = false;
      queryInput.focus();
      autoResizeTextarea(); // Reset height after clearing
      currentTabId = null;
      currentRequestType = null;
    }
  } else if (msg.type === 'stop-generation-popup') {
    console.log('[POPUP] Received stop generation request');
    
    // Stop any ongoing generation
    if (requestInProgress) {
      engine.interruptGenerate();
      requestInProgress = false;
      (<HTMLButtonElement>submitButton).disabled = false;
      
      // Send a message back to the content script that generation was stopped
      if (currentTabId) {
        chrome.runtime.sendMessage({
          type: `${currentRequestType}-result-popup`,
          comment: 'Generation stopped by user.',
          tabId: currentTabId,
          isComplete: true
        });
        
        // Reset tracking variables
        currentTabId = null;
        currentRequestType = null;
      }
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
  messageMapping = {}; // Reset message mapping
  updateChatHistory();
  
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
      const messageContent = getCurrentMessageContent(msg.id);
      
      let actionButtons = "";
      // Show action buttons for both user and assistant messages
      actionButtons = `
        <div class="message-actions">
          <button class="message-action-btn copy-btn" data-message-id="${msg.id}" title="Copy message">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button class="message-action-btn edit-btn" data-message-id="${msg.id}" title="Edit message">
            <i class="fa-solid fa-edit"></i>
          </button>
        </div>
      `;
      
      return `
        <div class='chat-message ${msg.role}'>
          <div class="message-content">
            <b>${isUser ? 'You' : 'Bot'}:</b> ${isUser ? messageContent : ''}
            ${!isUser ? '<span class="dynamic-content">' + messageContent + '</span>' : ''}
          </div>
          <span class="message-timestamp">${timestamp}</span>
          ${actionButtons}
        </div>
      `;
    })
    .join("");
  
  // Add event listeners to the newly created buttons
  addMessageActionListeners();
}

// Function to add event listeners to message action buttons
function addMessageActionListeners() {
  // Add copy button listeners
  const copyButtons = document.querySelectorAll('.copy-btn');
  copyButtons.forEach(button => {
    button.addEventListener('click', handleCopyMessage);
  });
  
  // Add edit button listeners
  const editButtons = document.querySelectorAll('.edit-btn');
  editButtons.forEach(button => {
    button.addEventListener('click', handleEditMessage);
  });
}

// Handle copy message functionality
function handleCopyMessage(event: Event) {
  const button = event.currentTarget as HTMLElement;
  const messageId = button.getAttribute('data-message-id');
  
  if (!messageId) return;
  
  const message = enhancedChatHistory.find(msg => msg.id === messageId);
  if (message) {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(message.content).then(() => {
        console.log('Copied message:', message.content);
        showCopySuccess(button);
      }).catch(err => {
        console.error('Failed to copy message:', err);
        fallbackCopy(message.content, button);
      });
    } else {
      // Fallback for older browsers or non-secure contexts
      fallbackCopy(message.content, button);
    }
  }
}

// Fallback copy method
function fallbackCopy(text: string, button: HTMLElement) {
  try {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // Try to copy using execCommand (legacy support)
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      console.log('Copied message using fallback method:', text);
      showCopySuccess(button);
    } else {
      console.error('Fallback copy failed');
      showCopyError(button);
    }
  } catch (err) {
    console.error('Fallback copy error:', err);
    showCopyError(button);
  }
}

// Show copy success feedback
function showCopySuccess(button: HTMLElement) {
  const originalIcon = button.innerHTML;
  button.innerHTML = '<i class="fa-solid fa-check"></i>';
  button.style.color = '#28a745';
  button.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
  button.style.borderColor = 'rgba(40, 167, 69, 0.3)';
  
  setTimeout(() => {
    button.innerHTML = originalIcon;
    button.style.color = '';
    button.style.backgroundColor = '';
    button.style.borderColor = '';
  }, 2000);
}

// Show copy error feedback
function showCopyError(button: HTMLElement) {
  const originalIcon = button.innerHTML;
  button.innerHTML = '<i class="fa-solid fa-times"></i>';
  button.style.color = '#dc3545';
  button.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
  button.style.borderColor = 'rgba(220, 53, 69, 0.3)';
  
  setTimeout(() => {
    button.innerHTML = originalIcon;
    button.style.color = '';
    button.style.backgroundColor = '';
    button.style.borderColor = '';
  }, 2000);
}

// Handle edit message functionality
function handleEditMessage(event: Event) {
  const button = event.currentTarget as HTMLElement;
  const messageId = button.getAttribute('data-message-id');
  
  if (!messageId) return;
  
  const messageIndex = enhancedChatHistory.findIndex(msg => msg.id === messageId);
  if (messageIndex === -1) return;
  
  const message = enhancedChatHistory[messageIndex];
  
  // Create a custom edit dialog instead of using prompt()
  createEditDialog(message, messageIndex);
}

// Create a custom edit dialog
function createEditDialog(message: ChatMessage, messageIndex: number) {
  // Remove any existing edit dialog
  const existingDialog = document.querySelector('.edit-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }
  
  // Create dialog container
  const dialog = document.createElement('div');
  dialog.className = 'edit-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-labelledby', 'edit-dialog-title');
  dialog.setAttribute('aria-modal', 'true');
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  // Create dialog content
  const dialogContent = document.createElement('div');
  dialogContent.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 12px;
    min-width: 300px;
    max-width: 80%;
    max-height: 80%;
    overflow-y: auto;
  `;
  
  // Create dialog header
  const header = document.createElement('h3');
  header.id = 'edit-dialog-title';
  header.textContent = `Edit ${message.role === 'user' ? 'Your' : 'Bot'} Message`;
  header.style.cssText = 'margin: 0 0 15px 0; color: #333;';
  
  // Create textarea
  const textarea = document.createElement('textarea');
  textarea.value = getCurrentMessageContent(message.id);
  textarea.setAttribute('aria-label', 'Message content to edit');
  textarea.style.cssText = `
    width: 100%;
    min-height: 120px;
    padding: 12px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    margin-bottom: 20px;
  `;
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  `;
  
  // Create cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn';
  cancelBtn.style.cssText = 'background-color: #6c757d;';
  cancelBtn.addEventListener('click', () => dialog.remove());
  
  // Create save button with different behavior based on message type
  const saveBtn = document.createElement('button');
  if (message.role === 'user') {
    saveBtn.textContent = 'Update & Ask';
    saveBtn.style.cssText = 'background-color: #28a745;';
  } else {
    saveBtn.textContent = 'Save';
  }
  saveBtn.className = 'btn';
  
  // Assemble buttons
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(saveBtn);
  
  // Add save button functionality
  saveBtn.addEventListener('click', () => {
    const newContent = textarea.value.trim();
    if (newContent !== "" && newContent !== getCurrentMessageContent(message.id)) {
      if (message.role === 'user') {
        // For user messages: DON'T modify the original, just ask the updated question
        // The original question stays intact in the chat history
        
        updateChatHistory();
        console.log('Asking updated question:', newContent);
        
        // Close the dialog
        dialog.remove();
        
        // Paste the updated question into the input box
        const queryInput = document.getElementById('query-input') as HTMLTextAreaElement;
        if (queryInput) {
          queryInput.value = newContent;
          queryInput.focus();
          autoResizeTextarea(); // Resize textarea to fit content
          
          // Automatically submit the updated question
          setTimeout(() => {
            submitButton.click();
          }, 100);
        }
      } else {
        // For bot messages: update the mapping
        updateMessageContent(message.id, newContent);
        
        updateChatHistory();
        console.log('Edited bot message:', newContent);
        dialog.remove();
      }
    }
  });
  dialogContent.appendChild(header);
  dialogContent.appendChild(textarea);
  dialogContent.appendChild(buttonContainer);
  dialog.appendChild(dialogContent);
  
  // Add to body
  document.body.appendChild(dialog);
  
  // Focus textarea
  textarea.focus();
  textarea.select();
  
  // Handle keyboard navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dialog.remove();
      document.removeEventListener('keydown', handleKeydown);
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      saveBtn.click();
    }
  };
  document.addEventListener('keydown', handleKeydown);
  
  // Handle click outside to close
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });
  
  // Clean up event listeners when dialog is removed
  const cleanup = () => {
    document.removeEventListener('keydown', handleKeydown);
  };
  
  // Use MutationObserver to detect when dialog is removed
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.removedNodes.forEach((node) => {
          if (node === dialog) {
            cleanup();
            observer.disconnect();
          }
        });
      }
    });
  });
  
  observer.observe(document.body, { childList: true });
}

// Add interface for model information
interface ModelInfo {
  name: string;
  displayName: string;
  parameterCount: string;
  quantization: string;
  family: string;
  estimatedMemory: string;
  estimatedSpeed: string;
}

// Function to extract model information from model ID
function extractModelInfo(modelId: string): ModelInfo {
  const parts = modelId.split("-");
  let family = parts[0];
  let parameterCount = "";
  let quantization = "";
  
  // Extract parameter count
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].includes("B") && !parts[i].includes("q")) {
      parameterCount = parts[i];
      break;
    }
  }
  
  // Extract quantization
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].startsWith("q")) {
      quantization = parts[i];
      break;
    }
  }
  
  // Build display name
  let displayName = family;
  for (let i = 1; i < parts.length; i++) {
    if (parts[i][0] !== "q" && !parts[i].includes("B")) {
      displayName += "-" + parts[i];
    }
  }
  
  // Estimate memory usage based on parameters and quantization
  let estimatedMemory = "";
  if (parameterCount) {
    const paramNum = parseFloat(parameterCount.replace("B", ""));
    if (quantization.includes("q4")) {
      estimatedMemory = `${(paramNum * 0.5).toFixed(1)}GB`;
    } else {
      estimatedMemory = `${(paramNum * 2.0).toFixed(1)}GB`;
    }
  }
  
  // Estimate speed based on parameters
  let estimatedSpeed = "";
  if (parameterCount) {
    const paramNum = parseFloat(parameterCount.replace("B", ""));
    if (paramNum <= 1.5) {
      estimatedSpeed = "Fast";
    } else if (paramNum <= 7) {
      estimatedSpeed = "Medium";
    } else {
      estimatedSpeed = "Slow";
    }
  }
  
  // Capabilities removed for compact display
  
  return {
    name: modelId,
    displayName,
    parameterCount,
    quantization,
    family,
    estimatedMemory,
    estimatedSpeed
  };
}



// Function to display model information
function displayModelInfo(modelId: string) {
  const modelInfo = extractModelInfo(modelId);
  
  // Update model stats panel content
  const modelSizeElem = document.getElementById("model-size");
  const modelParamsElem = document.getElementById("model-params");
  const modelTypeElem = document.getElementById("model-type");
  
  if (modelSizeElem) modelSizeElem.textContent = `Size: ${modelInfo.estimatedMemory}`;
  if (modelParamsElem) modelParamsElem.textContent = `Parameters: ${modelInfo.parameterCount}`;
  if (modelTypeElem) modelTypeElem.textContent = `Type: ${modelInfo.family} (${modelInfo.quantization})`;
}

// Function to get real-time performance metrics from Alfred engine
async function getEngineMetrics(): Promise<any> {
  try {
    // Get basic engine state information
    const engineState = {
      isLoaded: engine !== null,
      currentModel: selectedModel,
      
      chatHistoryLength: chatHistory.length,
      isGenerating: requestInProgress
    };
    
    return {
      engineState,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.log('Engine metrics not available:', error);
    return null;
  }
}

// Function to display real-time metrics
function displayEngineMetrics(metrics: any) {
  if (!metrics) return;
  
  let metricsDiv = document.getElementById("engine-metrics");
  if (!metricsDiv) {
    metricsDiv = document.createElement("div");
    metricsDiv.id = "engine-metrics";
    metricsDiv.className = "engine-metrics-compact";
    
    // Insert after model info
    const modelInfo = document.getElementById("model-info");
    if (modelInfo && modelInfo.parentNode) {
      modelInfo.parentNode.insertBefore(metricsDiv, modelInfo.nextSibling);
    }
  }
  
  // let metricsHTML = `
  //   <div class="compact-metrics">
  //     <span class="metric-item ${metrics.engineState.isLoaded ? 'loaded' : 'not-loaded'}">
  //       ${metrics.engineState.isLoaded ? '✓' : '✗'}
  //     </span>
  //     <span class="metric-item ${metrics.engineState.isGenerating ? 'generating' : 'idle'}">
  //       ${metrics.engineState.isGenerating ? 'Generating' : 'Idle'}
  //     </span>
  //     <span class="metric-item">${metrics.engineState.chatHistoryLength} msgs</span>
  //   </div>
  // `;
  
  // metricsDiv.innerHTML = metricsHTML;
}

// Update metrics periodically
setInterval(async () => {
  if (!isLoadingParams && engine) {
    const metrics = await getEngineMetrics();
    // displayEngineMetrics(metrics);
  }
}, 5000); // Update every 5 seconds


