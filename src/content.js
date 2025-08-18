// Content script for MLCBot extension - Smart Comment Feature

let commentDiv = null;

// Create comment display div
function createCommentDiv() {
  if (commentDiv) {
    document.body.removeChild(commentDiv);
  }
  
  commentDiv = document.createElement('div');
  commentDiv.id = 'mlcbot-comment-div';
  commentDiv.innerHTML = `
    <div class="mlcbot-comment-header">
      <span class="mlcbot-comment-title">Smart Comment</span>
      <button class="mlcbot-close-btn" id="close-comment">×</button>
    </div>
    <div class="mlcbot-comment-content" id="comment-content">
      Generating comment...
    </div>
    <div class="mlcbot-comment-actions">
      <button class="mlcbot-copy-btn" id="copy-comment">Copy</button>
    </div>
  `;
  
  // Add styles
  commentDiv.style.cssText = `
    position: fixed;
    background: rgb(118, 73, 254);
    color: #ffffff;
    border: 1px solid #b8860b;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(210, 105, 30, 0.3);
    padding: 12px;
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 300px;
    min-width: 250px;
    display: none;
  `;
  
  document.body.appendChild(commentDiv);
  
  // Add event listeners
  document.getElementById('close-comment').addEventListener('click', closeCommentDiv);
  document.getElementById('copy-comment').addEventListener('click', copyComment);
}

// Listen for comment results from background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'smart-comment-result' && msg.comment) {
    showCommentDiv();
    
    // If it's the initial "Generating..." message or a streaming update
    if (msg.comment === 'Generating...' || !msg.isComplete) {
      // For the initial message, just show it
      if (msg.comment === 'Generating...') {
        document.getElementById('comment-content').innerHTML = msg.comment;
      } else {
        // For streaming updates, update the content directly without animation
        document.getElementById('comment-content').innerHTML = msg.comment;
      }
    } else {
      // For the final complete message, use the word-by-word animation
      updateCommentContent(msg.comment);
    }
  }
});

// Show comment div
function showCommentDiv() {
  if (!commentDiv) {
    createCommentDiv();
  }
  
  // Position near the current selection
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    commentDiv.style.left = (rect.left + window.scrollX) + 'px';
    commentDiv.style.top = (rect.bottom + window.scrollY + 10) + 'px';
  } else {
    // Fallback position - center of viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    commentDiv.style.left = (viewportWidth / 2 - 150) + 'px';
    commentDiv.style.top = (viewportHeight / 2 - 100) + 'px';
  }
  
  commentDiv.style.display = 'block';
  document.getElementById('comment-content').innerHTML = 'Generating comment...';
}

// Update comment content with word-by-word animation
function updateCommentContent(comment) {
  const contentDiv = document.getElementById('comment-content');
  if (contentDiv) {
    // For the final complete message, we don't need animation since we've been
    // streaming the updates already
    contentDiv.innerHTML = comment;
  }
}

// Close comment div
function closeCommentDiv() {
  if (commentDiv) {
    commentDiv.style.display = 'none';
  }
}

// Copy comment to clipboard
function copyComment() {
  const contentDiv = document.getElementById('comment-content');
  if (contentDiv) {
    const comment = contentDiv.innerText;
    navigator.clipboard.writeText(comment).then(() => {
      // Show brief feedback
      const copyBtn = document.getElementById('copy-comment');
      const originalText = copyBtn.innerText;
      copyBtn.innerText = 'Copied!';
      setTimeout(() => {
        copyBtn.innerText = originalText;
      }, 1000);
    });
  }
}

// Initialize
function init() {
  createCommentDiv();
  
  // Add escape key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (commentDiv) commentDiv.style.display = 'none';
    }
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
