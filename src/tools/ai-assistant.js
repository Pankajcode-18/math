'use strict';

// ══════════════════════════════════════════════════════════════════════════
// PIYUSHDHARA AI ASSISTANT — Next-Gen Smart Teaching Copilot
// ══════════════════════════════════════════════════════════════════════════

const AIAssistant = (() => {

  const STORAGE_KEY = 'eduverse_gemini_api_key';
  const DEFAULT_KEY = 'AIzaSyCvDNXRe68dq7xYxbLnLm4nkQ5qW46tKao';
  const FAST_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest'
  ];
  let isLoading = false;
  let activeMode = 'all'; // 'all', 'math', 'concept', 'quiz'
  let chatHistory = [];
  let recognition = null;
  let isListening = false;

  function getApiKey() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim() && saved.trim().length > 15) return saved.trim();
    } catch (e) {}
    return DEFAULT_KEY;
  }

  function setApiKey(key) {
    try {
      localStorage.setItem(STORAGE_KEY, (key || '').trim());
    } catch (e) {}
  }

  // ─────────────────────────────────────────────
  // GEMINI API CALL WITH ROBUST FALLBACK
  // ─────────────────────────────────────────────
  async function callGemini(promptText, mode = 'all') {
    const key = getApiKey();
    if (!key) {
      throw new Error('Gemini API Key is missing. Click the ⚙️ Settings icon to enter your key.');
    }

    let modeInstruction = '';
    if (mode === 'math') {
      modeInstruction = 'Focus on rigorous, clean step-by-step mathematical or scientific solutions with final answer clearly highlighted.';
    } else if (mode === 'concept') {
      modeInstruction = 'Explain the concept simply and intuitively, using an everyday example or analogy, followed by key properties.';
    } else if (mode === 'quiz') {
      modeInstruction = 'Create 3-4 interactive classroom practice questions (varying difficulty) with detailed answers and hints below.';
    }

    const systemInstruction = `You are PiyushDhara AI, an elite, friendly, and crystal-clear smartboard teaching assistant.
${modeInstruction}

CRITICAL FORMATTING RULES:
1. NEVER use dollar signs ($ or $$) anywhere in your response.
2. NEVER use raw LaTeX syntax (e.g. do not use \\frac, \\times, \\pm, \\sqrt).
3. Write clean, natural math in plain text using Unicode characters:
   - Powers: write x², x³, x⁴, y² (not x^2)
   - Fractions: write (a) / (b) or a / b (not \\frac{a}{b})
   - Roots: write √(x) or √(b² - 4ac)
   - Symbols: use ±, ×, ÷, ·, ≤, ≥, ≠, ≈, π, θ, °, →, Δ
   - Variables: write a = 2, b = 5, c = -3
4. Structure your response with clear headings (## or ###), bullet points, and numbered steps.
5. Provide the full complete solution all the way to the final answer. Keep it crisp, readable, and ready to paste on a classroom board.`;

    const payload = {
      contents: [
        {
          parts: [
            { text: `${systemInstruction}\n\nQuestion / Request:\n${promptText}` }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.25
      }
    };

    let lastError = null;
    for (const model of FAST_MODELS) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 28000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.error?.message || `HTTP ${response.status}`;
          lastError = new Error(`Model ${model}: ${msg}`);
          continue;
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];
        if (candidate?.content?.parts?.length) {
          return candidate.content.parts.map(p => p.text || '').join('\n').trim();
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('No response was generated. Please check your internet connection.');
  }

  // ─────────────────────────────────────────────
  // UI MOUNTING — Modern Floating Smart AI Panel
  // ─────────────────────────────────────────────
  function ensureDrawerMounted() {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_KEY);
      }
    } catch (e) {}

    if (document.getElementById('ai-drawer')) return;

    const drawer = document.createElement('div');
    drawer.id = 'ai-drawer';
    drawer.className = 'ai-drawer hidden';
    drawer.innerHTML = `
      <!-- Top Glow & Mesh Effect -->
      <div class="ai-ambient-glow"></div>

      <!-- Modern Glass Header -->
      <div class="ai-drawer-header">
        <div class="ai-header-left">
          <div class="ai-avatar-badge">
            <div class="ai-avatar-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="4"></rect>
                <circle cx="12" cy="5" r="2"></circle>
                <path d="M12 7v4"></path>
                <line x1="8" y1="16" x2="8.01" y2="16"></line>
                <line x1="16" y1="16" x2="16.01" y2="16"></line>
              </svg>
            </div>
            <span class="ai-status-beacon" title="AI Ready & Connected"></span>
          </div>
          <div class="ai-title-group">
            <div class="ai-brand-headline">
              <span class="ai-brand-text">PiyushDhara AI</span>
              <span class="ai-model-pill">⚡ 2.5 Flash</span>
            </div>
            <span class="ai-sub-status">Smart Teaching Assistant · Instant Steps</span>
          </div>
        </div>

        <div class="ai-header-right">
          <button class="ai-nav-btn" onclick="AIAssistant.clearChatHistory()" title="Clear conversation" aria-label="Clear Chat">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          <button class="ai-nav-btn" id="ai-btn-settings-toggle" onclick="AIAssistant.toggleSettings()" title="Gemini API Key Settings" aria-label="Settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="ai-nav-btn close" onclick="AIAssistant.closePanel()" title="Close Assistant (Esc)" aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Settings Flyout Sheet -->
      <div id="ai-settings-panel" class="ai-settings-panel hidden">
        <div class="ai-settings-inner">
          <div class="ai-settings-row-head">
            <span class="ai-settings-title">⚙️ API Settings</span>
            <span class="ai-badge-live">● Direct Active</span>
          </div>
          <p class="ai-settings-hint">Google Gemini API is directly built-in for instant answers. You can optionally supply your own custom key.</p>
          <div class="ai-key-input-row">
            <input type="password" id="ai-settings-key" class="ai-key-field" placeholder="Enter custom Gemini Key..." autocomplete="off">
            <button class="ai-key-eye-btn" onclick="AIAssistant.toggleKeyVisibility()" title="Show/Hide Key">👁️</button>
            <button class="ai-key-save-btn" onclick="AIAssistant.saveSettings()">Save</button>
          </div>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="ai-tabs-strip">
        <button class="ai-tab-chip active" data-mode="all" onclick="AIAssistant.setMode('all')">
          <span>✨</span> All Topics
        </button>
        <button class="ai-tab-chip" data-mode="math" onclick="AIAssistant.setMode('math')">
          <span>📐</span> Math & Physics
        </button>
        <button class="ai-tab-chip" data-mode="concept" onclick="AIAssistant.setMode('concept')">
          <span>💡</span> Concepts
        </button>
        <button class="ai-tab-chip" data-mode="quiz" onclick="AIAssistant.setMode('quiz')">
          <span>📝</span> Practice Quiz
        </button>
      </div>

      <!-- Chat / Conversation Stream Area -->
      <div class="ai-stream-container" id="ai-stream-container">

        <!-- Welcome Banner & Quick Prompts (visible when empty) -->
        <div id="ai-empty-state" class="ai-empty-state">
          <div class="ai-hero-illustration">
            <div class="ai-hero-circle">
              <span class="ai-hero-icon">🤖</span>
            </div>
          </div>
          <h3 class="ai-hero-title">How can I assist your class today?</h3>
          <p class="ai-hero-sub">Ask any math problem, physics formula, scientific concept, or ask for quick classroom quizzes.</p>

          <div class="ai-quick-suggestions">
            <div class="ai-sug-title">Suggested Quick Questions:</div>
            <div class="ai-sug-grid">
              <button class="ai-sug-card" onclick="AIAssistant.setPrompt('Solve step-by-step: 2x² + 5x - 3 = 0')">
                <span class="ai-sug-icon">📐</span>
                <span class="ai-sug-text">Solve 2x² + 5x − 3 = 0</span>
              </button>
              <button class="ai-sug-card" onclick="AIAssistant.setPrompt('State and prove Pythagoras theorem with clear steps and diagram formula')">
                <span class="ai-sug-icon">📏</span>
                <span class="ai-sug-text">Pythagoras Theorem Proof</span>
              </button>
              <button class="ai-sug-card" onclick="AIAssistant.setPrompt('Explain Newton\\'s 3 laws of motion with real-life examples and formulas')">
                <span class="ai-sug-icon">🔭</span>
                <span class="ai-sug-text">Newton\\'s Laws of Motion</span>
              </button>
              <button class="ai-sug-card" onclick="AIAssistant.setPrompt('Give 3 practice questions with answers on Trigonometry heights and distances')">
                <span class="ai-sug-icon">📝</span>
                <span class="ai-sug-text">Trigonometry Quiz (3 Qs)</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic Message Stream -->
        <div id="ai-chat-feed" class="ai-chat-feed"></div>

        <!-- Live Loading Indicator -->
        <div id="ai-loading-card" class="ai-loading-card hidden">
          <div class="ai-thinking-orb">
            <div class="ai-orb-ring"></div>
            <div class="ai-orb-core">✨</div>
          </div>
          <div class="ai-thinking-text-wrap">
            <div class="ai-thinking-title" id="ai-loading-title">PiyushDhara AI is generating steps...</div>
            <div class="ai-thinking-sub">Formulating clean whiteboard-ready solution</div>
          </div>
        </div>

      </div>

      <!-- Bottom Interactive Input Capsule -->
      <div class="ai-bottom-dock">
        <div class="ai-input-capsule">
          <textarea 
            id="ai-solve-input" 
            class="ai-smart-textarea" 
            rows="1" 
            placeholder="Type your question or math problem here..."
            aria-label="Ask AI Assistant"></textarea>

          <div class="ai-capsule-actions">
            <!-- Voice Input Button -->
            <button id="ai-mic-btn" class="ai-action-icon-btn" onclick="AIAssistant.toggleVoiceInput()" title="Voice Dictation (Speech to text)">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>

            <!-- Send Action Button -->
            <button id="btn-ai-solve-run" class="ai-send-btn" onclick="AIAssistant.askQuestion()" title="Send question (Enter)">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>

        <div class="ai-dock-hints">
          <span>💡 <b>Enter</b> to send · <b>Shift + Enter</b> for new line</span>
          <span class="ai-brand-tag">PiyushDhara SmartBoard Copilot</span>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);

    // Auto-adjust textarea height on input
    const textarea = document.getElementById('ai-solve-input');
    if (textarea) {
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          askQuestion();
        }
      });
    }

    // Initialize Web Speech Recognition if available
    initSpeechRecognition();

    // Populate API key if available
    const keyInput = document.getElementById('ai-settings-key');
    if (keyInput) keyInput.value = getApiKey();
  }

  // ─────────────────────────────────────────────
  // VOICE SPEECH RECOGNITION
  // ─────────────────────────────────────────────
  function initSpeechRecognition() {
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechAPI) return;

    try {
      recognition = new SpeechAPI();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListening = true;
        const micBtn = document.getElementById('ai-mic-btn');
        if (micBtn) micBtn.classList.add('recording');
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('🎙️ Listening... Speak your question now');
        }
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const input = document.getElementById('ai-solve-input');
        if (input && transcript) {
          input.value = (input.value ? input.value + ' ' : '') + transcript;
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 120) + 'px';
          input.focus();
        }
      };

      recognition.onerror = () => {
        isListening = false;
        const micBtn = document.getElementById('ai-mic-btn');
        if (micBtn) micBtn.classList.remove('recording');
      };

      recognition.onend = () => {
        isListening = false;
        const micBtn = document.getElementById('ai-mic-btn');
        if (micBtn) micBtn.classList.remove('recording');
      };
    } catch (e) {
      recognition = null;
    }
  }

  function toggleVoiceInput() {
    if (!recognition) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Voice input is not supported in this browser environment.');
      }
      return;
    }
    if (isListening) {
      try { recognition.stop(); } catch (e) {}
    } else {
      try { recognition.start(); } catch (e) {}
    }
  }

  // ─────────────────────────────────────────────
  // ACTIONS: ASK QUESTION
  // ─────────────────────────────────────────────
  async function askQuestion() {
    const input = document.getElementById('ai-solve-input');
    const prompt = (input?.value || '').trim();
    if (!prompt) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Please type or speak your question first.');
      }
      input?.focus();
      return;
    }

    // Hide empty state
    const emptyState = document.getElementById('ai-empty-state');
    if (emptyState) emptyState.style.display = 'none';

    // Append user message
    const msgId = 'msg-' + Date.now();
    appendUserBubble(prompt);

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Show loading
    setLoading(true);
    scrollStreamToBottom();

    try {
      const response = await callGemini(prompt, activeMode);
      appendAssistantBubble(response, msgId);
      chatHistory.push({ question: prompt, answer: response });
    } catch (err) {
      appendErrorBubble(err.message || 'Error occurred while contacting Gemini AI.');
    } finally {
      setLoading(false);
      scrollStreamToBottom();
    }
  }

  // ─────────────────────────────────────────────
  // CHAT STREAM RENDERING
  // ─────────────────────────────────────────────
  function appendUserBubble(text) {
    const feed = document.getElementById('ai-chat-feed');
    if (!feed) return;

    const row = document.createElement('div');
    row.className = 'ai-msg-row user';
    row.innerHTML = `
      <div class="ai-msg-bubble user">
        <div class="ai-msg-text">${escapeHtml(text)}</div>
      </div>
    `;
    feed.appendChild(row);
  }

  function appendAssistantBubble(text, msgId) {
    const feed = document.getElementById('ai-chat-feed');
    if (!feed) return;

    const row = document.createElement('div');
    row.className = 'ai-msg-row assistant';
    row.id = msgId;

    const renderedHtml = formatMarkdownForPreview(text);

    row.innerHTML = `
      <div class="ai-assistant-avatar">
        <div class="ai-avatar-mini">🤖</div>
      </div>
      <div class="ai-msg-card">
        <div class="ai-card-header">
          <span class="ai-card-title">PiyushDhara AI · Solution</span>
          <span class="ai-card-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="ai-card-content" id="content-${msgId}">
          ${renderedHtml}
        </div>
        <div class="ai-card-toolbar">
          <button class="ai-tool-pill" onclick="AIAssistant.copyCardText('${msgId}')" title="Copy solution to clipboard">
            <span>📋</span> Copy
          </button>
          <button class="ai-tool-pill primary" onclick="AIAssistant.insertCardToBoard('${msgId}')" title="Insert directly on Whiteboard">
            <span>✨</span> Paste on Board
          </button>
          <button class="ai-tool-pill" onclick="AIAssistant.speakCardText('${msgId}')" title="Read solution aloud">
            <span>🔊</span> Speak
          </button>
        </div>
      </div>
    `;
    feed.appendChild(row);
  }

  function appendErrorBubble(errorMsg) {
    const feed = document.getElementById('ai-chat-feed');
    if (!feed) return;

    const row = document.createElement('div');
    row.className = 'ai-msg-row assistant';
    row.innerHTML = `
      <div class="ai-assistant-avatar error">
        <div class="ai-avatar-mini">⚠️</div>
      </div>
      <div class="ai-msg-card error-card">
        <div class="ai-card-header">
          <span class="ai-card-title error-text">Notice</span>
        </div>
        <div class="ai-card-content error-desc">
          ${escapeHtml(errorMsg)}
        </div>
      </div>
    `;
    feed.appendChild(row);
  }

  function clearChatHistory() {
    chatHistory = [];
    const feed = document.getElementById('ai-chat-feed');
    if (feed) feed.innerHTML = '';
    const emptyState = document.getElementById('ai-empty-state');
    if (emptyState) emptyState.style.display = 'flex';
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Chat history cleared');
    }
  }

  function scrollStreamToBottom() {
    const container = document.getElementById('ai-stream-container');
    if (container) {
      setTimeout(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }

  // ─────────────────────────────────────────────
  // CARD ACTIONS: COPY, PASTE, SPEECH
  // ─────────────────────────────────────────────
  function copyCardText(msgId) {
    const row = document.getElementById(msgId);
    if (!row) return;

    // Find the stored answer or extract clean text
    const contentEl = document.getElementById(`content-${msgId}`);
    const textToCopy = contentEl ? contentEl.innerText : '';
    const cleanText = cleanTextForBoard(textToCopy);

    const onDone = () => {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('✓ Solution copied to clipboard');
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanText).then(onDone).catch(() => fallbackCopy(cleanText, onDone));
    } else {
      fallbackCopy(cleanText, onDone);
    }
  }

  function insertCardToBoard(msgId) {
    const contentEl = document.getElementById(`content-${msgId}`);
    if (!contentEl) return;

    const textToPaste = cleanTextForBoard(contentEl.innerText);

    const size = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: 1200, H: 800 };
    const posX = Math.max(60, Math.round(size.W * 0.1));
    const posY = Math.max(60, Math.round(size.H * 0.12));

    let textColor = '#ffffff';
    try {
      const boardColor = (typeof Canvas !== 'undefined' && Canvas.getBoardColor) ? Canvas.getBoardColor() : null;
      if (boardColor && (boardColor.id === 'white' || boardColor.id === 'light')) {
        textColor = '#0f172a';
      }
    } catch(e) {}

    if (typeof Canvas !== 'undefined' && Canvas.addTextShape) {
      Canvas.addTextShape(posX, posY, textToPaste, textColor, 18);
    }

    if (typeof App !== 'undefined') {
      if (App.setTool) App.setTool('select');
      if (App.showToast) App.showToast('✓ Solution pasted on whiteboard');
    }

    closePanel();
  }

  function speakCardText(msgId) {
    const contentEl = document.getElementById(`content-${msgId}`);
    if (!contentEl || !window.speechSynthesis) return;

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    }

    const text = cleanTextForBoard(contentEl.innerText);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('🔊 Speaking solution... (Click again to stop)');
    }
  }

  function fallbackCopy(text, callback) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (callback) callback();
    } catch(e) {}
  }

  // ─────────────────────────────────────────────
  // TEXT & MATH FORMATTING UTILITIES
  // ─────────────────────────────────────────────
  function cleanMathText(text) {
    if (!text) return '';
    let t = text;

    t = t.replace(/\^\{?0\}?/g, '⁰');
    t = t.replace(/\^\{?1\}?/g, '¹');
    t = t.replace(/\^\{?2\}?/g, '²');
    t = t.replace(/\^\{?3\}?/g, '³');
    t = t.replace(/\^\{?4\}?/g, '⁴');
    t = t.replace(/\^\{?5\}?/g, '⁵');
    t = t.replace(/\^\{?n\}?/g, 'ⁿ');

    t = t.replace(/_\{?0\}?/g, '₀');
    t = t.replace(/_\{?1\}?/g, '₁');
    t = t.replace(/_\{?2\}?/g, '₂');

    t = t.replace(/\\times/g, '×');
    t = t.replace(/\\div/g, '÷');
    t = t.replace(/\\cdot/g, '·');
    t = t.replace(/\\pm/g, '±');
    t = t.replace(/\\mp/g, '∓');
    t = t.replace(/\\approx/g, '≈');
    t = t.replace(/\\neq/g, '≠');
    t = t.replace(/\\le(q)?/g, '≤');
    t = t.replace(/\\ge(q)?/g, '≥');
    t = t.replace(/\\rightarrow/g, '→');
    t = t.replace(/\\Rightarrow/g, '→');
    t = t.replace(/\\leftarrow/g, '←');
    t = t.replace(/\\Leftarrow/g, '←');
    t = t.replace(/\\degree/g, '°');
    t = t.replace(/\^\\\circ/g, '°');
    t = t.replace(/\\infty/g, '∞');
    t = t.replace(/\\pi/g, 'π');
    t = t.replace(/\\theta/g, 'θ');
    t = t.replace(/\\alpha/g, 'α');
    t = t.replace(/\\beta/g, 'β');
    t = t.replace(/\\delta/g, 'δ');
    t = t.replace(/\\Delta/g, 'Δ');
    t = t.replace(/\\angle/g, '∠');

    t = t.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
    t = t.replace(/\\sqrt([a-zA-Z0-9]+)/g, '√$1');

    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)');
    t = t.replace(/\\text\{([^}]+)\}/g, '$1');
    t = t.replace(/\\quad/g, '  ');
    t = t.replace(/\\[;,]/g, ' ');

    t = t.replace(/\$\$(.*?)\$\$/g, '$1');
    t = t.replace(/\$(.*?)\$/g, '$1');
    t = t.replace(/\$/g, '');

    return t;
  }

  function formatMarkdownForPreview(text) {
    if (!text) return '';
    const cleaned = cleanMathText(text);
    let html = escapeHtml(cleaned);

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="ai-strong">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^### (.*$)/gim, '<h4 class="ai-step-title">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="ai-section-title">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="ai-main-title-md">$1</h2>');

    // Numbered step badges: e.g. Step 1: or 1.
    html = html.replace(/(Step \d+:?)/gi, '<span class="ai-step-badge">$1</span>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function cleanTextForBoard(text) {
    if (!text) return '';
    let t = cleanMathText(text);

    t = t.replace(/\*\*(.*?)\*\*/g, '$1');
    t = t.replace(/\*(.*?)\*/g, '$1');
    t = t.replace(/^###+ /gm, '');
    t = t.replace(/^## /gm, '');
    t = t.replace(/^# /gm, '');
    t = t.replace(/`([^`]+)`/g, '$1');
    t = t.replace(/\n{3,}/g, '\n\n');
    return t.trim();
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                      .replace(/'/g, '&#039;');
  }

  function setLoading(loading, title = 'PiyushDhara AI is generating steps...') {
    isLoading = loading;
    const card = document.getElementById('ai-loading-card');
    const titleEl = document.getElementById('ai-loading-title');
    const btn = document.getElementById('btn-ai-solve-run');

    if (titleEl) titleEl.textContent = title;
    if (card) card.classList.toggle('hidden', !loading);
    if (btn) btn.disabled = loading;
  }

  function setMode(mode) {
    activeMode = mode;
    document.querySelectorAll('.ai-tab-chip').forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-mode') === mode);
    });
  }

  function setPrompt(text) {
    const input = document.getElementById('ai-solve-input');
    if (input) {
      input.value = text;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      input.focus();
    }
  }

  function clearInput() {
    const input = document.getElementById('ai-solve-input');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
      input.focus();
    }
  }

  // ─────────────────────────────────────────────
  // PANEL NAVIGATION
  // ─────────────────────────────────────────────
  function openPanel() {
    ensureDrawerMounted();
    const d = document.getElementById('ai-drawer');
    if (d) {
      d.classList.remove('hidden');
      const input = document.getElementById('ai-solve-input');
      setTimeout(() => input?.focus(), 120);
    }
  }

  function closePanel() {
    const d = document.getElementById('ai-drawer');
    if (d) d.classList.add('hidden');
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  }

  function togglePanel() {
    ensureDrawerMounted();
    const d = document.getElementById('ai-drawer');
    if (d && d.classList.contains('hidden')) {
      openPanel();
    } else {
      closePanel();
    }
  }

  function toggleSettings() {
    const panel = document.getElementById('ai-settings-panel');
    if (panel) {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        const input = document.getElementById('ai-settings-key');
        if (input && !input.value) input.value = getApiKey();
      }
    }
  }

  function toggleKeyVisibility() {
    const input = document.getElementById('ai-settings-key');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }

  function saveSettings() {
    const input = document.getElementById('ai-settings-key');
    if (input) {
      setApiKey(input.value);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('✓ Gemini API Key saved');
      }
      const panel = document.getElementById('ai-settings-panel');
      if (panel) panel.classList.add('hidden');
    }
  }

  // Aliases & backwards-compatibility
  function runSolve() { askQuestion(); }
  function runChapterQuiz() { askQuestion(); }
  function runVisionSolve() { askQuestion(); }
  function switchTab(mode) { setMode(mode); }
  function copyResult() {
    if (chatHistory.length > 0) {
      const last = chatHistory[chatHistory.length - 1].answer;
      navigator.clipboard.writeText(cleanTextForBoard(last));
    }
  }
  function insertOntoBoard() {
    if (chatHistory.length > 0) {
      const last = chatHistory[chatHistory.length - 1].answer;
      const size = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: 1200, H: 800 };
      if (typeof Canvas !== 'undefined' && Canvas.addTextShape) {
        Canvas.addTextShape(100, 100, cleanTextForBoard(last), '#ffffff', 18);
      }
      closePanel();
    }
  }
  function clearResult() { clearChatHistory(); }

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureDrawerMounted);
  } else {
    setTimeout(ensureDrawerMounted, 80);
  }

  // Global key listener for Escape to close AI panel
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const d = document.getElementById('ai-drawer');
      if (d && !d.classList.contains('hidden')) {
        closePanel();
      }
    }
  });

  return {
    openPanel,
    closePanel,
    togglePanel,
    askQuestion,
    runSolve,
    runChapterQuiz,
    runVisionSolve,
    switchTab,
    setMode,
    copyCardText,
    insertCardToBoard,
    speakCardText,
    insertOntoBoard,
    copyResult,
    clearResult,
    clearInput,
    setPrompt,
    clearChatHistory,
    toggleVoiceInput,
    toggleSettings,
    toggleKeyVisibility,
    saveSettings
  };
})();

// Attach to window
window.AIAssistant = AIAssistant;

