// Content script for Alfred extension - Improved Smart Comment Feature

let commentGenerator = null;
let isMinimized = false;
let floatingMenu = null;
let floatingMenuEnabled = false;

// Initialize immediately
// Load floating menu state from storage and enable by default
chrome.storage.sync.get(['floatingMenuEnabled'], (result) => {
  // Set floatingMenuEnabled to true by default
  floatingMenuEnabled = result.floatingMenuEnabled !== false;
  
  // Create the floating menu
  createFloatingActionMenu();
  
  // Add selection event listeners to ensure popup appears immediately on text selection
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('selectionchange', handleTextSelection);
  
  // Add additional event for double-click which often selects words
  document.addEventListener('dblclick', handleTextSelection);
  
  // Save the enabled state to storage
  chrome.storage.sync.set({ floatingMenuEnabled: true });
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'floating-menu-state-changed') {
    floatingMenuEnabled = message.enabled;
    
    if (floatingMenuEnabled) {
      // Add selection event listeners
      document.addEventListener('mouseup', handleTextSelection);
      document.addEventListener('selectionchange', handleTextSelection);
      document.addEventListener('dblclick', handleTextSelection);
    } else {
      // Remove selection event listeners
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('selectionchange', handleTextSelection);
      document.removeEventListener('dblclick', handleTextSelection);
      // Hide the floating menu if it's visible
      hideFloatingMenu();
    }
  }
});

// Create floating action menu
function createFloatingActionMenu() {
  if (floatingMenu) {
    document.body.removeChild(floatingMenu);
  }
  
  // Create the main container
  floatingMenu = document.createElement('div');
  floatingMenu.className = 'alfred-floating-menu';
  floatingMenu.id = 'alfred-floating-menu';
  floatingMenu.style.display = 'none';
  
  // Create the HTML structure with Unicode fallback icons
  floatingMenu.innerHTML = `
    <div class="floating-menu-actions">
      <button class="floating-action-btn" id="floating-comment-btn">
        <span class="floating-icon">💬</span>
        <span class="floating-tooltip">Generate Smart Comment</span>
      </button>
      <button class="floating-action-btn" id="floating-rewrite-btn">
        <span class="floating-icon">✏️</span>
        <span class="floating-tooltip">Rewrite Text</span>
      </button>
      <button class="floating-action-btn" id="floating-explain-btn">
        <span class="floating-icon">💡</span>
        <span class="floating-tooltip">Explain This</span>
      </button>
    </div>
  `;
  
  // Unicode icons are used, no need for Font Awesome
  
  // Add our custom CSS
  if (!document.querySelector('link[href*="comment-generator"]')) {
    const commentCSS = document.createElement('link');
    commentCSS.rel = 'stylesheet';
    commentCSS.href = chrome.runtime.getURL('comment-generator.css');
    document.head.appendChild(commentCSS);
  }
  
  document.body.appendChild(floatingMenu);
  
  // Add event listeners
  setupFloatingMenuEventListeners();
}

// Setup event listeners for the floating menu
function setupFloatingMenuEventListeners() {
  document.getElementById('floating-comment-btn').addEventListener('click', () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      // Send message directly to background script
      chrome.runtime.sendMessage({
        type: 'generate-smart-comment',
        text: selectedText
      });
      hideFloatingMenu();
    }
  });
  
  document.getElementById('floating-rewrite-btn').addEventListener('click', () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      // Send message directly to background script
      chrome.runtime.sendMessage({
        type: 'rewrite-text',
        text: selectedText
      });
      hideFloatingMenu();
    }
  });
  
  document.getElementById('floating-explain-btn').addEventListener('click', () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      // Send message directly to background script
      chrome.runtime.sendMessage({
        type: 'explain-text',
        text: selectedText
      });
      hideFloatingMenu();
    }
  });
  
  // Hide menu when clicking outside
  document.addEventListener('click', (event) => {
    if (floatingMenu && !floatingMenu.contains(event.target)) {
      hideFloatingMenu();
    }
  });
}

// Show floating menu at the specified position
function showFloatingMenu(x, y) {
  if (!floatingMenuEnabled || !floatingMenu) return;
  
  // Ensure the menu is visible and positioned correctly
  floatingMenu.style.left = `${x}px`;
  floatingMenu.style.top = `${y}px`;
  floatingMenu.style.display = 'block';
  floatingMenu.style.zIndex = '10000'; // Ensure it's on top
  
  // Force a repaint to ensure the menu appears immediately
  floatingMenu.getBoundingClientRect();
}

// Hide floating menu
function hideFloatingMenu() {
  if (floatingMenu) {
    floatingMenu.style.display = 'none';
  }
}

// Handle text selection
function handleTextSelection(event) {
  if (!floatingMenuEnabled) return;
  
  // Use a delayed approach for showing the menu (0.75 seconds)
  // First check immediately to prepare
  checkSelectionAndShowMenu(false);
  
  // Then show after 750ms delay as requested
  setTimeout(() => checkSelectionAndShowMenu(true), 400);
  
  // Helper function to check selection and show menu
  function checkSelectionAndShowMenu(shouldShow) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText && selection.rangeCount > 0) {
      // Get the bounding rectangle of the selection
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate position for the floating menu
      // Position it above the selection
      const x = rect.left + window.scrollX + (rect.width / 2) - 70; // Center horizontally
      const y = rect.top + window.scrollY - 60; // Position above
      
      // Only show the floating menu if shouldShow is true (after delay)
      if (shouldShow) {
        showFloatingMenu(x, y);
      }
      
      // Unicode icons are used, no need for Font Awesome loading
    }
  }
}

// Create the improved comment generator UI
function createCommentGenerator(type = 'comment') {
  if (commentGenerator) {
    document.body.removeChild(commentGenerator);
  }
  
  // Create the main container
  commentGenerator = document.createElement('div');
  commentGenerator.className = 'alfred-comment-generator';
  commentGenerator.id = 'alfred-comment-generator';
  
  // Create the HTML structure with Unicode icons
  commentGenerator.innerHTML = `
    <div class="comment-header">
      <h3 class="comment-title">
        <span class="icon">💬</span>
        Smart Comment
      </h3>
      <div class="header-controls">
        <button class="control-btn minimize-btn" id="minimize-btn" title="Minimize">
          <span class="icon">➖</span>
        </button>
        <button class="control-btn expand-btn" id="expand-btn" title="Expand">
          <span class="icon">➕</span>
        </button>
        <button class="control-btn" id="close-btn" title="Close">
          <span class="icon">✖️</span>
        </button>
      </div>
    </div>
    
    <div class="comment-content">
      <div class="comment-status" id="comment-status">
        <span class="icon">💡</span>
        <span>Ready</span>
      </div>
      
      <div class="comment-text hidden" id="comment-text">
        <div id="comment-content-text"></div>
      </div>
      
      <div class="comment-actions hidden" id="comment-actions">
        <button class="action-btn success" id="copy-btn">
          <span class="icon">📋</span>
          Copy
        </button>
      </div>
    </div>
  `;
  
  // Unicode icons are used, no need for Font Awesome
  
  // Add our custom CSS
  if (!document.querySelector('link[href*="comment-generator"]')) {
    const commentCSS = document.createElement('link');
    commentCSS.rel = 'stylesheet';
    commentCSS.href = chrome.runtime.getURL('comment-generator.css');
    document.head.appendChild(commentCSS);
  }
  
  document.body.appendChild(commentGenerator);
  
  // Add event listeners
  setupEventListeners();
}

// Setup event listeners for the comment generator
function setupEventListeners() {
  // Minimize button
  document.getElementById('minimize-btn').addEventListener('click', () => {
    minimizeCommentGenerator();
  });
  
  // Expand button
  document.getElementById('expand-btn').addEventListener('click', () => {
    expandCommentGenerator();
  });
  
  // Close button
  document.getElementById('close-btn').addEventListener('click', () => {
    closeCommentGenerator();
  });
  
  // Copy button
  document.getElementById('copy-btn').addEventListener('click', () => {
    copyComment();
  });
  

  
  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && commentGenerator) {
      closeCommentGenerator();
    }
  });
}

// Minimize the comment generator
function minimizeCommentGenerator() {
  if (commentGenerator) {
    commentGenerator.classList.add('minimized');
    isMinimized = true;
  }
}

// Expand the comment generator
function expandCommentGenerator() {
  if (commentGenerator) {
    commentGenerator.classList.remove('minimized');
    isMinimized = false;
  }
}

// Close the comment generator and stop any ongoing generation
function closeCommentGenerator() {
  if (commentGenerator) {
    // Hide the comment generator
    commentGenerator.classList.add('hidden');
    
    // Send message to background script to stop any ongoing generation
    chrome.runtime.sendMessage({
      type: 'stop-generation'
    });
    
    // Reset the UI state
    const statusElement = document.getElementById('comment-status');
    if (statusElement) {
      statusElement.innerHTML = '<span class="icon">💡</span><span>Ready</span>';
      statusElement.className = 'comment-status';
    }
    
    // Hide the comment text and actions
    const commentText = document.getElementById('comment-text');
    const commentActions = document.getElementById('comment-actions');
    if (commentText) commentText.classList.add('hidden');
    if (commentActions) commentActions.classList.add('hidden');
  }
}



// Copy comment to clipboard
function copyComment() {
  const contentText = document.getElementById('comment-content-text');
  if (contentText && contentText.textContent && contentText.textContent.trim()) {
    const textToCopy = contentText.textContent.trim();
    
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showCopySuccess();
        console.log('[Alfred] Comment copied to clipboard:', textToCopy);
      }).catch(err => {
        console.error('[Alfred] Failed to copy comment:', err);
        // Fallback copy method
        fallbackCopy(textToCopy);
      });
    } else {
      // Fallback for older browsers or non-secure contexts
      fallbackCopy(textToCopy);
    }
  } else {
    console.warn('[Alfred] No comment content to copy');
    showCopyError('No content to copy');
  }
}

// Show copy success feedback
function showCopySuccess() {
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    const originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span class="icon">✓</span>Copied!';
    copyBtn.classList.add('success');
    
    setTimeout(() => {
      copyBtn.innerHTML = originalHTML;
      copyBtn.classList.remove('success');
    }, 2000);
  }
}

// Show copy error feedback
function showCopyError(message) {
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    const originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span class="icon">⚠️</span>Error';
    copyBtn.classList.add('error');
    
    setTimeout(() => {
      copyBtn.innerHTML = originalHTML;
      copyBtn.classList.remove('error');
    }, 2000);
  }
  
  // Also show error in status
  const status = document.getElementById('comment-status');
  if (status) {
    status.innerHTML = `<span class="icon">⚠️</span><span>${message}</span>`;
    status.className = 'comment-status error';
    
         setTimeout(() => {
       if (status.className.includes('error')) {
         status.innerHTML = '<span class="icon">💬</span><span>Comment</span>';
         status.className = 'comment-status success';
       }
     }, 3000);
  }
}

// Fallback copy method
function fallbackCopy(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showCopySuccess();
      console.log('[Alfred] Comment copied using fallback method:', text);
    } else {
      showCopyError('Copy failed');
      console.error('[Alfred] Fallback copy failed');
    }
  } catch (err) {
    showCopyError('Copy failed');
    console.error('[Alfred] Fallback copy error:', err);
  }
  
  document.body.removeChild(textArea);
}

// Listen for comment results from background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if ((msg.type === 'smart-comment-result-popup' || msg.type === 'rewrite-text-result-popup' || msg.type === 'explain-text-result-popup') && msg.comment) {
    let type = 'comment';
    if (msg.type === 'rewrite-text-result-popup') {
      type = 'rewrite';
    } else if (msg.type === 'explain-text-result-popup') {
      type = 'explain';
    }
    showCommentGenerator(type);
    updateCommentContent(msg.comment, msg.isComplete, type !== 'comment');
  }
});

// Show the comment generator
function showCommentGenerator(type = 'comment') {
  if (!commentGenerator) {
    createCommentGenerator(type);
  }
  
  commentGenerator.classList.remove('hidden');
  commentGenerator.setAttribute('data-type', type);
  
  // If minimized, expand it to show the new comment
  if (isMinimized) {
    expandCommentGenerator();
  }
  
  // Show initial status
  const status = document.getElementById('comment-status');
  if (status) {
    status.innerHTML = '<span class="icon">💡</span><span>Ready</span>';
    status.className = 'comment-status';
  }
  
  // Update title based on type
  const title = document.querySelector('.comment-title');
  if (title) {
    if (type === 'rewrite') {
      title.innerHTML = '<span class="icon">✏️</span> Rewritten Text';
    } else if (type === 'explain') {
      title.innerHTML = '<span class="icon">💡</span> Explanation';
    } else {
      title.innerHTML = '<span class="icon">💬</span> Smart Comment';
    }
  }
}

// Update comment content
function updateCommentContent(comment, isComplete = false, isRewrite = false) {
  const status = document.getElementById('comment-status');
  const text = document.getElementById('comment-text');
  const actions = document.getElementById('comment-actions');
  const contentText = document.getElementById('comment-content-text');
  
  // Get the current type from the data attribute
  const type = commentGenerator.getAttribute('data-type') || 'comment';
  
  if (comment === 'Generating...' || comment === 'Rewriting...' || comment === 'Explaining...') {
    // Show loading state with appropriate message
    let loadingText = 'Generating...';
    let loadingIcon = '💬';
    
    if (type === 'rewrite') {
      loadingText = 'Rewriting...';
      loadingIcon = '✏️';
    } else if (type === 'explain') {
      loadingText = 'Explaining...';
      loadingIcon = '💡';
    }
    
    status.innerHTML = `<span class="icon loading-spinner">🔄</span><span>${loadingText}</span>`;
    status.className = 'comment-status loading';
    text.classList.add('hidden');
    actions.classList.add('hidden');
    
  } else if (comment.includes('Error')) {
    // Show error state
    status.innerHTML = '<span class="icon">⚠️</span><span>Error</span>';
    status.className = 'comment-status error';
    text.classList.add('hidden');
    actions.classList.add('hidden');
    
  } else {
    // Show content with appropriate status
    let statusIcon = '💬';
    let statusText = 'Comment';
    
    if (type === 'rewrite') {
      statusIcon = '✏️';
      statusText = 'Rewritten';
    } else if (type === 'explain') {
      statusIcon = '💡';
      statusText = 'Explanation';
    }
    status.innerHTML = `<span class="icon">${statusIcon}</span><span>${statusText}</span>`;
    status.className = 'comment-status success';
    
    contentText.textContent = comment;
    text.classList.remove('hidden');
    text.classList.add('new-comment');
    
    if (isComplete) {
      actions.classList.remove('hidden');
      // Remove animation class after animation completes
      setTimeout(() => {
        text.classList.remove('new-comment');
      }, 300);
    }
  }
}

// Initialize the comment generator
function init() {
  // Don't create the comment generator immediately
  // It will be created when needed
  
  // Show a subtle indicator that the extension is loaded
  console.log('[Alfred] Comment generator extension loaded. Select text and right-click to generate comments.');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
