// Handle extension icon click to toggle side panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Create context menu on extension installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "generate-smart-comment",
    title: "Generate Smart Comment",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generate-smart-comment" && info.selectionText) {
    console.log('[BG] Context menu clicked with text:', info.selectionText);
    
    // Forward the request to the popup to use the AI engine
    chrome.runtime.sendMessage({
      type: 'generate-smart-comment-popup',
      text: info.selectionText,
      tabId: tab.id
    });
  }
});

// Listen for smart comment generation requests from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'generate-smart-comment' && msg.text) {
    console.log('[BG] Received smart comment request:', msg.text);
    
    // Forward the request to the popup to use the AI engine
    chrome.runtime.sendMessage({
      type: 'generate-smart-comment-popup',
      text: msg.text,
      tabId: sender.tab.id
    });
    
    // Send immediate response to content script
    sendResponse({ status: 'processing' });
  } else if (msg.type === 'smart-comment-result-popup' && msg.comment && msg.tabId) {
    // Forward the comment result from popup to the correct tab/content script
    console.log('[BG] Forwarding comment result to content script:', msg.comment);
    chrome.tabs.sendMessage(msg.tabId, {
      type: 'smart-comment-result',
      comment: msg.comment,
      isComplete: msg.isComplete
    });
  }
});
 