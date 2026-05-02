/**
 * BlackChat AI - Premium Chat Application
 * Pure JavaScript implementation with OpenRouter API integration
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
    OPENROUTER_API_KEY: 'YOUR_API_KEY', // Replace with your actual API key
    MODEL: 'google/gemma-4-26b-a4b-it:free',
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    APP_NAME: 'BlackChat AI',
    MAX_MESSAGES: 50,
    STORAGE_KEY: 'blackchat_history'
};

// ============================================
// State Management
// ============================================

const state = {
    messages: [],
    isLoading: false,
    currentModel: CONFIG.MODEL
};

// ============================================
// DOM Elements
// ============================================

const elements = {
    messagesContainer: null,
    messageInput: null,
    sendBtn: null,
    typingIndicator: null,
    charCounter: null,
    modelSelect: null,
    newChatBtn: null,
    clearChatBtn: null,
    toast: null,
    particles: null
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize the application
 */
function init() {
    cacheElements();
    createParticles();
    loadChatHistory();
    setupEventListeners();
    updateCharCounter();
    scrollToBottom();
}

/**
 * Cache DOM elements for better performance
 */
function cacheElements() {
    elements.messagesContainer = document.getElementById('messagesContainer');
    elements.messageInput = document.getElementById('messageInput');
    elements.sendBtn = document.getElementById('sendBtn');
    elements.typingIndicator = document.getElementById('typingIndicator');
    elements.charCounter = document.getElementById('charCounter');
    elements.modelSelect = document.getElementById('modelSelect');
    elements.newChatBtn = document.getElementById('newChatBtn');
    elements.clearChatBtn = document.getElementById('clearChatBtn');
    elements.toast = document.getElementById('toast');
    elements.particles = document.getElementById('particles');
}

// ============================================
// Event Listeners
// ============================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Send button click
    elements.sendBtn.addEventListener('click', handleSendMessage);
    
    // Input keyboard events
    elements.messageInput.addEventListener('keydown', handleKeyDown);
    elements.messageInput.addEventListener('input', handleInputChange);
    
    // Model selection
    elements.modelSelect.addEventListener('change', handleModelChange);
    
    // New chat button
    elements.newChatBtn.addEventListener('click', startNewChat);
    
    // Clear chat button
    elements.clearChatBtn.addEventListener('click', clearChatHistory);
    
    // Auto-resize textarea
    elements.messageInput.addEventListener('input', autoResizeTextarea);
}

/**
 * Handle send button click
 */
function handleSendMessage() {
    if (state.isLoading) return;
    
    const message = elements.messageInput.value.trim();
    if (!message) return;
    
    sendMessage(message);
}

/**
 * Handle keyboard events in input
 */
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
}

/**
 * Handle input changes
 */
function handleInputChange() {
    updateCharCounter();
    updateSendButton();
}

/**
 * Handle model selection change
 */
function handleModelChange() {
    state.currentModel = elements.modelSelect.value;
    showToast('Model changed to ' + elements.modelSelect.options[elements.modelSelect.selectedIndex].text, 'success');
}

// ============================================
// Message Handling
// ============================================

/**
 * Send a message to the AI
 */
async function sendMessage(message) {
    if (state.isLoading) return;
    
    // Add user message to UI and state
    addUserMessage(message);
    
    // Clear input
    elements.messageInput.value = '';
    updateCharCounter();
    updateSendButton();
    autoResizeTextarea();
    
    // Show typing indicator
    showTypingIndicator();
    
    // Set loading state
    state.isLoading = true;
    updateSendButton();
    
    try {
        // Get AI response
        const aiResponse = await fetchAIResponse(message);
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add AI message to UI
        addAIMessage(aiResponse);
        
        // Save to history
        saveChatHistory();
        
    } catch (error) {
        hideTypingIndicator();
        handleError(error);
    } finally {
        state.isLoading = false;
        updateSendButton();
    }
}

/**
 * Fetch AI response from OpenRouter API
 */
async function fetchAIResponse(userMessage) {
    // Build conversation history for context
    const conversationHistory = state.messages.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
    
    const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': CONFIG.APP_NAME
        },
        body: JSON.stringify({
            model: state.currentModel,
            messages: conversationHistory,
            max_tokens: 2048,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
    }
    
    return data.choices[0].message.content;
}

// ============================================
// UI Updates
// ============================================

/**
 * Add user message to the UI
 */
function addUserMessage(content) {
    const timestamp = getCurrentTimestamp();
    
    const messageObj = {
        role: 'user',
        content: content,
        timestamp: timestamp
    };
    
    state.messages.push(messageObj);
    
    const messageHTML = createMessageHTML(messageObj, 'user');
    elements.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    
    scrollToBottom();
}

/**
 * Add AI message to the UI
 */
function addAIMessage(content) {
    const timestamp = getCurrentTimestamp();
    
    const messageObj = {
        role: 'assistant',
        content: content,
        timestamp: timestamp
    };
    
    state.messages.push(messageObj);
    
    // Limit message history
    if (state.messages.length > CONFIG.MAX_MESSAGES) {
        state.messages = state.messages.slice(-CONFIG.MAX_MESSAGES);
    }
    
    const messageHTML = createMessageHTML(messageObj, 'assistant');
    elements.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    
    // Add copy functionality to code blocks
    setTimeout(() => {
        setupCodeBlockCopyButtons();
    }, 100);
    
    scrollToBottom();
}

/**
 * Create message HTML structure
 */
function createMessageHTML(messageObj, type) {
    const isUser = type === 'user';
    const avatar = isUser ? 'You' : 'AI';
    const messageClass = isUser ? 'user-message' : 'ai-message';
    const processedContent = isUser ? escapeHTML(messageObj.content) : parseMarkdown(messageObj.content);
    
    return `
        <div class="message ${messageClass}">
            <div class="message-content">
                <div class="message-header">
                    <span class="avatar">${avatar}</span>
                    <span class="timestamp">${messageObj.timestamp}</span>
                </div>
                <div class="message-body markdown-body">
                    ${processedContent}
                </div>
                ${!isUser ? `
                <div class="message-actions">
                    <button class="action-btn copy-btn" title="Copy message" onclick="copyMessage(this)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    elements.typingIndicator.classList.add('active');
    scrollToBottom();
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    elements.typingIndicator.classList.remove('active');
}

/**
 * Update character counter
 */
function updateCharCounter() {
    const currentLength = elements.messageInput.value.length;
    const maxLength = parseInt(elements.messageInput.maxLength);
    elements.charCounter.textContent = `${currentLength} / ${maxLength}`;
    
    // Change color when approaching limit
    if (currentLength > maxLength * 0.9) {
        elements.charCounter.style.color = 'var(--error)';
    } else {
        elements.charCounter.style.color = 'var(--text-muted)';
    }
}

/**
 * Update send button state
 */
function updateSendButton() {
    const hasContent = elements.messageInput.value.trim().length > 0;
    elements.sendBtn.disabled = !hasContent || state.isLoading;
}

/**
 * Auto-resize textarea based on content
 */
function autoResizeTextarea() {
    const textarea = elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

/**
 * Scroll to bottom of messages container
 */
function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// ============================================
// Markdown Parsing
// ============================================

/**
 * Parse markdown text to HTML
 */
function parseMarkdown(text) {
    let html = escapeHTML(text);
    
    // Code blocks (must be before other replacements)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<div class="code-block-wrapper">
            <pre><code class="language-${lang}">${code.trim()}</code></pre>
            <button class="copy-code-btn" onclick="copyCode(this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
            </button>
        </div>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Blockquotes
    html = html.replace(/^&gt; (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // Unordered lists
    html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
    html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
    html = html.replace(/<\/li>\n<li>/g, '</li><li>');
    html = html.replace(/<li>([\s\S]*?)<\/li>/g, (match, content) => {
        if (!match.includes('<ul>')) {
            return '<ul><li>' + content + '</li></ul>';
        }
        return match;
    });
    
    // Ordered lists
    html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // Mentions
    html = html.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    
    // Tables (basic support)
    html = html.replace(/\|(.+)\|\n\|([-:\s|]+)\|\n((?:\|.+\|\n?)+)/g, (match, header, separator, rows) => {
        const headers = header.split('|').map(h => `<th>${h.trim()}</th>`).join('');
        const rowItems = rows.trim().split('\n').map(row => {
            const cells = row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
            return '<tr>' + cells.map(cell => `<td>${cell.trim()}</td>`).join('') + '</tr>';
        }).join('');
        return `<table><thead><tr>${headers}</tr></thead><tbody>${rowItems}</tbody></table>`;
    });
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraph tags if not already wrapped
    if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>';
    }
    
    return html;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Copy Functionality
// ============================================

/**
 * Copy message content to clipboard
 */
function copyMessage(button) {
    const messageContent = button.closest('.message-content').querySelector('.message-body').textContent;
    copyToClipboard(messageContent);
    showToast('Message copied!', 'success');
}

/**
 * Copy code block to clipboard
 */
function copyCode(button) {
    const codeBlock = button.closest('.code-block-wrapper').querySelector('code');
    copyToClipboard(codeBlock.textContent);
    showToast('Code copied!', 'success');
    
    // Change button text temporarily
    const originalText = button.innerHTML;
    button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
    `;
    setTimeout(() => {
        button.innerHTML = originalText;
    }, 2000);
}

/**
 * Generic clipboard copy function
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

/**
 * Setup copy buttons for code blocks
 */
function setupCodeBlockCopyButtons() {
    // Already handled inline
}

// ============================================
// Local Storage
// ============================================

/**
 * Load chat history from localStorage
 */
function loadChatHistory() {
    try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (saved) {
            const history = JSON.parse(saved);
            state.messages = history;
            
            // Clear existing messages except welcome
            elements.messagesContainer.innerHTML = '';
            
            // Render saved messages
            history.forEach(msg => {
                const type = msg.role === 'user' ? 'user' : 'assistant';
                const messageHTML = createMessageHTML(msg, type);
                elements.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
            });
            
            if (history.length > 0) {
                setupCodeBlockCopyButtons();
            }
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

/**
 * Save chat history to localStorage
 */
function saveChatHistory() {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.messages));
    } catch (error) {
        console.error('Error saving chat history:', error);
        showToast('Failed to save chat history', 'error');
    }
}

/**
 * Clear chat history
 */
function clearChatHistory() {
    if (confirm('Are you sure you want to clear the chat history?')) {
        state.messages = [];
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        elements.messagesContainer.innerHTML = '';
        
        // Add welcome message
        const welcomeMessage = {
            role: 'assistant',
            content: 'Welcome to **BlackChat AI** 🖤\n\nI\'m your advanced AI assistant. How can I help you today?\n\n- Ask questions about any topic\n- Get help with coding\n- Write creative content\n- Analyze data and documents',
            timestamp: getCurrentTimestamp()
        };
        
        const welcomeHTML = createMessageHTML(welcomeMessage, 'assistant');
        elements.messagesContainer.insertAdjacentHTML('beforeend', welcomeHTML);
        
        showToast('Chat history cleared', 'success');
    }
}

/**
 * Start a new chat
 */
function startNewChat() {
    if (state.messages.length > 0) {
        clearChatHistory();
    } else {
        showToast('Already in a new chat', 'success');
    }
}

// ============================================
// Background Particles
// ============================================

/**
 * Create floating background particles
 */
function createParticles() {
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        elements.particles.appendChild(particle);
    }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get current timestamp in HH:MM format
 */
function getCurrentTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = elements.toast;
    const toastMessage = toast.querySelector('.toast-message');
    
    toastMessage.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Handle errors
 */
function handleError(error) {
    console.error('Error:', error);
    showToast(error.message || 'An error occurred', 'error');
    
    // Add error message to chat
    const errorMessage = {
        role: 'assistant',
        content: `⚠️ **Error**: ${error.message || 'Failed to get response from AI'}. Please try again.`,
        timestamp: getCurrentTimestamp()
    };
    
    const errorHTML = createMessageHTML(errorMessage, 'assistant');
    elements.messagesContainer.insertAdjacentHTML('beforeend', errorHTML);
}

// ============================================
// Initialize App
// ============================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
