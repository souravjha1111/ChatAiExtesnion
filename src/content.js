// Content script for MLCBot extension - Improved Smart Comment Feature

let commentGenerator = null;
let isMinimized = false;

// Create the improved comment generator UI
function createCommentGenerator() {
  if (commentGenerator) {
    document.body.removeChild(commentGenerator);
  }
  
  // Create the main container
  commentGenerator = document.createElement('div');
  commentGenerator.className = 'mlc-comment-generator';
  commentGenerator.id = 'mlc-comment-generator';
  
  // Create the HTML structure
  commentGenerator.innerHTML = `
    <div class="comment-header">
      <h3 class="comment-title">
        <i class="fa-solid fa-comments"></i>
        Smart Comment
      </h3>
      <div class="header-controls">
        <button class="control-btn minimize-btn" id="minimize-btn" title="Minimize">
          <i class="fa-solid fa-minus"></i>
        </button>
        <button class="control-btn expand-btn" id="expand-btn" title="Expand" style="display: none;">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button class="control-btn" id="close-btn" title="Close">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    </div>
    
    <div class="comment-content">
      <div class="comment-status" id="comment-status">
        <i class="fa-solid fa-lightbulb"></i>
        <span>Ready</span>
      </div>
      
      <div class="comment-text" id="comment-text" style="display: none;">
        <div id="comment-content-text"></div>
      </div>
      
      <div class="comment-actions" id="comment-actions" style="display: none;">
        <button class="action-btn success" id="copy-btn">
          <i class="fa-solid fa-copy"></i>
          Copy
        </button>
      </div>
    </div>
  `;
  
  // Add Font Awesome for icons
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(fontAwesome);
  }
  
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

// Close the comment generator
function closeCommentGenerator() {
  if (commentGenerator) {
    commentGenerator.style.display = 'none';
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
        console.log('[MLCBot] Comment copied to clipboard:', textToCopy);
      }).catch(err => {
        console.error('[MLCBot] Failed to copy comment:', err);
        // Fallback copy method
        fallbackCopy(textToCopy);
      });
    } else {
      // Fallback for older browsers or non-secure contexts
      fallbackCopy(textToCopy);
    }
  } else {
    console.warn('[MLCBot] No comment content to copy');
    showCopyError('No content to copy');
  }
}

// Show copy success feedback
function showCopySuccess() {
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    const originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>Copied!';
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
    copyBtn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i>Error';
    copyBtn.classList.add('error');
    
    setTimeout(() => {
      copyBtn.innerHTML = originalHTML;
      copyBtn.classList.remove('error');
    }, 2000);
  }
  
  // Also show error in status
  const status = document.getElementById('comment-status');
  if (status) {
    status.innerHTML = `<i class="fa-solid fa-exclamation-triangle"></i><span>${message}</span>`;
    status.className = 'comment-status error';
    
         setTimeout(() => {
       if (status.className.includes('error')) {
         status.innerHTML = '<i class="fa-solid fa-comment"></i><span>Comment</span>';
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
      console.log('[MLCBot] Comment copied using fallback method:', text);
    } else {
      showCopyError('Copy failed');
      console.error('[MLCBot] Fallback copy failed');
    }
  } catch (err) {
    showCopyError('Copy failed');
    console.error('[MLCBot] Fallback copy error:', err);
  }
  
  document.body.removeChild(textArea);
}

// Listen for comment results from background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'smart-comment-result-popup' && msg.comment) {
    showCommentGenerator();
    updateCommentContent(msg.comment, msg.isComplete);
  }
});

// Show the comment generator
function showCommentGenerator() {
  if (!commentGenerator) {
    createCommentGenerator();
  }
  
  commentGenerator.style.display = 'block';
  
  // If minimized, expand it to show the new comment
  if (isMinimized) {
    expandCommentGenerator();
  }
  
  // Show initial status
  const status = document.getElementById('comment-status');
  if (status) {
    status.innerHTML = '<i class="fa-solid fa-lightbulb"></i><span>Ready</span>';
    status.className = 'comment-status';
  }
}

// Update comment content
function updateCommentContent(comment, isComplete = false) {
  const status = document.getElementById('comment-status');
  const text = document.getElementById('comment-text');
  const actions = document.getElementById('comment-actions');
  const contentText = document.getElementById('comment-content-text');
  
  if (comment === 'Generating...') {
    // Show generating state with simple message
    status.innerHTML = '<div class="loading-spinner"></div><span>Generating...</span>';
    status.className = 'comment-status generating';
    text.style.display = 'none';
    actions.style.display = 'none';
    
  } else if (comment.includes('Error')) {
    // Show error state
    status.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i><span>Error</span>';
    status.className = 'comment-status error';
    text.style.display = 'none';
    actions.style.display = 'none';
    
  } else {
    // Show comment content with simple status
    status.innerHTML = '<i class="fa-solid fa-comment"></i><span>Comment</span>';
    status.className = 'comment-status success';
    
    contentText.textContent = comment;
    text.style.display = 'block';
    text.classList.add('new-comment');
    
    if (isComplete) {
      actions.style.display = 'flex';
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
  console.log('[MLCBot] Comment generator extension loaded. Select text and right-click to generate comments.');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
