'use strict';

// ══════════════════════════════════════════════════════════════════════════
// PIYUSHDHARA AI ASSISTANT — Premium SmartBoard AI
// Features:
// 1. Ask anything (math, science, questions, quizzes, definitions, steps)
// 2. Clear, step-by-step formatted response
// 3. 📋 Copy to Clipboard
// 4. ✨ Paste onto Whiteboard (places clean movable text directly on board)
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
  let currentModel = FAST_MODELS[0];
  let isLoading = false;
  let lastGeneratedText = '';

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
  // ULTRA-FAST API CALL TO GEMINI
  // ─────────────────────────────────────────────
  async function callGemini(promptText) {
    const key = getApiKey();
    if (!key) {
      throw new Error('Gemini API Key is missing. Click the ⚙️ gear icon to enter your API key.');
    }

    const systemInstruction = `You are an elite, fast, and clear teaching assistant for a classroom digital smartboard.
CRITICAL FORMATTING RULES:
1. NEVER use dollar signs ($ or $$) anywhere in your response.
2. NEVER use raw LaTeX syntax (such as \\frac, \\times, \\pm, \\sqrt).
3. Write clean, natural math in plain text using Unicode characters:
   - Powers: write x², x³, x⁴, y² (not x^2)
   - Fractions: write (a) / (b) or a / b (not \\frac{a}{b})
   - Roots: write √(x) or √(b² - 4ac) (not \\sqrt)
   - Symbols: use ±, ×, ÷, ·, ≤, ≥, ≠, ≈, π, θ, °, →
   - Variables: write a = 2, b = 5, c = -3 (NEVER $a = 2$)
4. Format steps clearly with numbers (Step 1, Step 2...) and short bullet points.
5. Keep explanations neat and concise so the teacher can directly paste it onto the whiteboard.
6. COMPLETENESS: Always provide the full complete solution all the way to the final answer. Never stop halfway or leave calculations unfinished.`;

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
        temperature: 0.2
      }
    };

    // Try models in order: gemini-3.5-flash-lite (1s ultra-fast) -> gemini-2.5-flash -> gemini-flash-latest
    let lastError = null;
    for (const model of FAST_MODELS) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

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
          continue; // try next model
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
  // UI MOUNTING — Premium PiyushDhara AI Panel
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
      <!-- Premium PiyushDhara AI Header -->
      <div class="ai-drawer-header">
        <div class="ai-header-glow"></div>

        <div class="ai-drawer-title">
          <!-- PiyushDhara Robot Logo -->
          <div class="ai-brand-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="pd-bodyGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#a855f7"/>
                  <stop offset="100%" stop-color="#6366f1"/>
                </linearGradient>
                <linearGradient id="pd-headGrad" x1="0" y1="0" x2="40" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#818cf8"/>
                  <stop offset="100%" stop-color="#6366f1"/>
                </linearGradient>
              </defs>
              <!-- Body -->
              <rect x="9" y="17" width="22" height="16" rx="4" fill="url(#pd-bodyGrad)"/>
              <!-- Head -->
              <rect x="12" y="7" width="16" height="12" rx="3" fill="url(#pd-headGrad)"/>
              <!-- Antenna base -->
              <rect x="19" y="4" width="2" height="4" rx="1" fill="#c084fc"/>
              <!-- Antenna tip glow dot -->
              <circle cx="20" cy="3" r="2" fill="#e879f9" opacity="0.9"/>
              <!-- Left eye -->
              <circle cx="16" cy="13" r="2.5" fill="#0ea5e9"/>
              <circle cx="16" cy="13" r="1.2" fill="white"/>
              <circle cx="16.5" cy="12.5" r="0.4" fill="#bfdbfe"/>
              <!-- Right eye -->
              <circle cx="24" cy="13" r="2.5" fill="#0ea5e9"/>
              <circle cx="24" cy="13" r="1.2" fill="white"/>
              <circle cx="24.5" cy="12.5" r="0.4" fill="#bfdbfe"/>
              <!-- Smile -->
              <rect x="14" y="22" width="12" height="4.5" rx="2.2" fill="rgba(255,255,255,0.18)"/>
              <rect x="15.5" y="23.2" width="2" height="1.2" rx="0.6" fill="#c084fc"/>
              <rect x="19" y="23.2" width="2" height="1.2" rx="0.6" fill="#c084fc"/>
              <rect x="22.5" y="23.2" width="2" height="1.2" rx="0.6" fill="#c084fc"/>
              <!-- Arms -->
              <rect x="2" y="20" width="7" height="3.5" rx="1.75" fill="#818cf8"/>
              <rect x="31" y="20" width="7" height="3.5" rx="1.75" fill="#818cf8"/>
              <!-- Chest indicator dot -->
              <circle cx="20" cy="29.5" r="2" fill="rgba(255,255,255,0.25)" stroke="rgba(192,132,252,0.5)" stroke-width="1"/>
              <circle cx="20" cy="29.5" r="0.8" fill="#c084fc"/>
            </svg>
            <div class="ai-logo-pulse"></div>
          </div>

          <div class="ai-title-wrap">
            <div class="ai-brand-name">
              <span class="ai-pd-text">PiyushDhara</span>
              <span class="ai-ai-badge">AI</span>
            </div>
            <span class="ai-sub-title">✦ Your intelligent classroom assistant</span>
          </div>
        </div>

        <div class="ai-header-actions">
          <button class="ai-icon-btn" id="ai-btn-settings-toggle" onclick="AIAssistant.toggleSettings()" title="API Key Settings">⚙️</button>
          <button class="ai-close-btn" onclick="AIAssistant.closePanel()" title="Close (Esc)">✕</button>
        </div>
      </div>

      <!-- Collapsible Settings Panel -->
      <div id="ai-settings-panel" class="ai-settings-panel hidden">
        <div class="ai-input-group">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <label class="ai-field-label" style="margin-bottom:0;">🔑 Gemini API Key</label>
            <span style="font-size:10.5px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.15);padding:2px 8px;border-radius:4px;border:1px solid rgba(16,185,129,0.3);">● Connected Directly</span>
          </div>
          <div class="ai-key-wrap">
            <input type="password" id="ai-settings-key" class="ai-text-input" placeholder="Gemini API Key active..." autocomplete="off">
            <button class="ai-toggle-key-btn" onclick="AIAssistant.toggleKeyVisibility()" title="Show/Hide Key">👁️</button>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:5px;">API Key is pre-configured directly inside the application. No manual setup needed.</div>
        </div>
        <div class="ai-settings-actions">
          <button class="ai-btn-save-key" onclick="AIAssistant.saveSettings()">Update Key</button>
        </div>
      </div>

      <!-- Main Body -->
      <div class="ai-drawer-body">

        <!-- Quick Suggestion Chips -->
        <div class="ai-chips-label">⚡ Quick Questions</div>
        <div class="ai-quick-chips">
          <button class="ai-chip" onclick="AIAssistant.setPrompt('Solve step-by-step: 2x² + 5x - 3 = 0')">📐 Solve 2x²+5x−3=0</button>
          <button class="ai-chip" onclick="AIAssistant.setPrompt('State and prove Pythagoras theorem with clean steps')">📏 Pythagoras Proof</button>
          <button class="ai-chip" onclick="AIAssistant.setPrompt('Explain Newton\'s 3 laws of motion with formulas')">🔭 Newton's Laws</button>
          <button class="ai-chip" onclick="AIAssistant.setPrompt('Give 3 practice questions with answers on Circle geometry')">📝 Practice Questions</button>
        </div>

        <!-- Input Box -->
        <div class="ai-input-group">
          <label class="ai-field-label">💬 Ask PiyushDhara AI anything</label>
          <div class="ai-textarea-wrap">
            <textarea id="ai-solve-input" class="ai-textarea" rows="3" placeholder="Type your question... (e.g. Solve 3x + 12 = 45, explain photosynthesis, quiz on triangles)"></textarea>
            <div class="ai-textarea-accent"></div>
          </div>
        </div>

        <!-- Action Row -->
        <div class="ai-action-row">
          <button class="ai-primary-btn" id="btn-ai-solve-run" onclick="AIAssistant.askQuestion()">
            <span class="ai-btn-icon">✨</span>
            <span>Ask PiyushDhara AI</span>
          </button>
          <button class="ai-secondary-btn" onclick="AIAssistant.clearInput()">Clear</button>
        </div>

        <!-- Loading State -->
        <div id="ai-loading" class="ai-loading-container hidden">
          <div class="ai-loading-orb">
            <div class="ai-spinner"></div>
          </div>
          <div class="ai-loading-content">
            <span class="ai-loading-text" id="ai-loading-text">PiyushDhara AI is thinking...</span>
            <span class="ai-loading-sub">Generating a precise answer for you</span>
          </div>
        </div>

        <!-- Output / Solution Card -->
        <div id="ai-result-section" class="ai-result-section hidden">
          <div class="ai-result-header">
            <div class="ai-result-badge">
              <span class="ai-badge-dot"></span>
              <span id="ai-result-tag">PiyushDhara AI Answer</span>
            </div>
            <div class="ai-result-actions">
              <button class="ai-btn-sm" id="btn-ai-copy-top" onclick="AIAssistant.copyResult()" title="Copy to clipboard">📋 Copy</button>
              <button class="ai-btn-sm danger" onclick="AIAssistant.clearResult()" title="Dismiss">✕</button>
            </div>
          </div>

          <!-- Answer Body -->
          <div class="ai-result-body" id="ai-result-body"></div>

          <!-- Action Buttons -->
          <div class="ai-dual-actions">
            <button class="ai-btn-copy-big" id="btn-ai-copy-big" onclick="AIAssistant.copyResult()">
              📋 Copy
            </button>
            <button class="ai-btn-paste-big" onclick="AIAssistant.insertOntoBoard()">
              ✨ Paste to Board
            </button>
          </div>
        </div>

        <!-- Powered-by Footer -->
        <div class="ai-powered-footer">
          <span class="ai-footer-robot">🤖</span>
          <span>Powered by <b>PiyushDhara</b> · Gemini AI</span>
        </div>

      </div>
    `;

    document.body.appendChild(drawer);

    // Inject premium CSS
    injectStyles();

    // Populate saved key
    const keyInput = document.getElementById('ai-settings-key');
    if (keyInput) keyInput.value = getApiKey();

    // Support Ctrl+Enter in textarea to submit
    const textarea = document.getElementById('ai-solve-input');
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          askQuestion();
        }
      });
    }
  }

  // ─────────────────────────────────────────────
  // INJECT PREMIUM STYLES
  // ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('piyushdhara-ai-styles')) return;
    const style = document.createElement('style');
    style.id = 'piyushdhara-ai-styles';
    style.textContent = `
      /* ─── PiyushDhara AI Panel Overrides ─── */

      .ai-header-glow {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 20% 50%, rgba(168, 85, 247, 0.18) 0%, transparent 70%),
                    radial-gradient(ellipse at 80% 50%, rgba(99, 102, 241, 0.14) 0%, transparent 70%);
        pointer-events: none;
      }

      .ai-brand-logo {
        position: relative;
        width: 46px;
        height: 46px;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(99, 102, 241, 0.15));
        border: 1.5px solid rgba(168, 85, 247, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 18px rgba(168, 85, 247, 0.35), inset 0 1px 0 rgba(255,255,255,0.1);
        flex-shrink: 0;
        transition: box-shadow 0.3s ease;
      }

      .ai-brand-logo:hover {
        box-shadow: 0 0 28px rgba(168, 85, 247, 0.55), inset 0 1px 0 rgba(255,255,255,0.15);
      }

      .ai-logo-pulse {
        position: absolute;
        inset: -4px;
        border-radius: 18px;
        border: 1.5px solid rgba(168, 85, 247, 0.3);
        animation: pulsering 2.4s ease-out infinite;
        pointer-events: none;
      }

      @keyframes pulsering {
        0% { opacity: 0.8; transform: scale(1); }
        70% { opacity: 0; transform: scale(1.25); }
        100% { opacity: 0; transform: scale(1.25); }
      }

      .ai-brand-name {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ai-pd-text {
        font-family: 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.01em;
        background: linear-gradient(135deg, #ffffff 20%, #c084fc 60%, #818cf8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .ai-ai-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 7px;
        background: linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(99, 102, 241, 0.3));
        border: 1px solid rgba(192, 132, 252, 0.5);
        border-radius: 6px;
        font-size: 10px;
        font-weight: 800;
        color: #e9d5ff;
        letter-spacing: 0.08em;
        box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
      }

      .ai-chips-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #94a3b8;
        margin-bottom: -6px;
      }

      .ai-textarea-wrap {
        position: relative;
      }

      .ai-textarea-accent {
        position: absolute;
        bottom: 0;
        left: 12px;
        right: 12px;
        height: 2px;
        background: linear-gradient(90deg, #a855f7, #6366f1);
        border-radius: 2px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .ai-textarea-wrap:focus-within .ai-textarea-accent {
        opacity: 1;
      }

      .ai-loading-orb {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(99, 102, 241, 0.15));
        border: 1.5px solid rgba(168, 85, 247, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 0 12px rgba(168, 85, 247, 0.25);
      }

      .ai-loading-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .ai-loading-sub {
        font-size: 10.5px;
        color: #64748b;
      }

      .ai-powered-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px;
        font-size: 10.5px;
        color: #475569;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        margin-top: 2px;
      }

      .ai-powered-footer b {
        color: #7c3aed;
      }

      .ai-footer-robot {
        font-size: 13px;
        filter: grayscale(0.3);
      }

      /* Animated typing dots on loading text */
      .ai-loading-text::after {
        content: '';
        animation: aiDots 1.4s infinite;
      }

      @keyframes aiDots {
        0%, 20% { content: ''; }
        40% { content: '.'; }
        60% { content: '..'; }
        80%, 100% { content: '...'; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────
  // ACTIONS: ASK QUESTION
  // ─────────────────────────────────────────────
  async function askQuestion() {
    const input = document.getElementById('ai-solve-input');
    const prompt = (input?.value || '').trim();
    if (!prompt) {
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Please type a question or problem to ask.');
      input?.focus();
      return;
    }

    setLoading(true, 'PiyushDhara AI is thinking');
    clearResult();

    try {
      const response = await callGemini(prompt);
      showResult('PiyushDhara AI Answer', response);
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────
  // ACTIONS: COPY & PASTE TO BOARD
  // ─────────────────────────────────────────────
  function copyResult() {
    if (!lastGeneratedText) return;
    const cleanText = cleanTextForBoard(lastGeneratedText);

    function onCopied() {
      ['btn-ai-copy-top', 'btn-ai-copy-big'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '✓ Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerHTML = orig;
            btn.classList.remove('copied');
          }, 2000);
        }
      });
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('✓ Copied to clipboard');
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanText).then(onCopied).catch(() => {
        fallbackCopy(cleanText, onCopied);
      });
    } else {
      fallbackCopy(cleanText, onCopied);
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

  function insertOntoBoard() {
    if (!lastGeneratedText) return;

    const cleanBoardText = cleanTextForBoard(lastGeneratedText);

    const size = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: 1200, H: 800 };
    const posX = Math.max(60, Math.round(size.W * 0.12));
    const posY = Math.max(60, Math.round(size.H * 0.12));

    let textColor = '#ffffff';
    try {
      const boardColor = (typeof Canvas !== 'undefined' && Canvas.getBoardColor) ? Canvas.getBoardColor() : null;
      if (boardColor && (boardColor.id === 'white' || boardColor.id === 'light')) {
        textColor = '#0f172a';
      }
    } catch(e) {}

    if (typeof Canvas !== 'undefined' && Canvas.addTextShape) {
      Canvas.addTextShape(posX, posY, cleanBoardText, textColor, 18);
    }

    if (typeof App !== 'undefined') {
      if (App.setTool) App.setTool('select');
      if (App.showToast) App.showToast('✓ Pasted onto whiteboard');
    }

    closePanel();
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

    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
    html = html.replace(/^### (.*$)/gim, '<h4 class="ai-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="ai-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="ai-h2">$1</h2>');
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
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  function showResult(tag, text) {
    lastGeneratedText = text;
    const sec = document.getElementById('ai-result-section');
    const tagEl = document.getElementById('ai-result-tag');
    const bodyEl = document.getElementById('ai-result-body');
    if (!sec || !bodyEl) return;

    if (tagEl) tagEl.textContent = tag || 'PiyushDhara AI Answer';
    bodyEl.innerHTML = formatMarkdownForPreview(text);

    sec.classList.remove('hidden');
    sec.scrollIntoView({ behavior: 'smooth' });
  }

  function showError(msg) {
    const sec = document.getElementById('ai-result-section');
    const tagEl = document.getElementById('ai-result-tag');
    const bodyEl = document.getElementById('ai-result-body');
    if (!sec || !bodyEl) return;

    if (tagEl) tagEl.textContent = 'Notice / Error';
    bodyEl.innerHTML = `<div class="ai-error-box">${escapeHtml(msg)}</div>`;
    sec.classList.remove('hidden');
  }

  function clearResult() {
    lastGeneratedText = '';
    const sec = document.getElementById('ai-result-section');
    if (sec) sec.classList.add('hidden');
  }

  function clearInput() {
    const input = document.getElementById('ai-solve-input');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  function setLoading(loading, text = 'PiyushDhara AI is thinking') {
    isLoading = loading;
    const el = document.getElementById('ai-loading');
    const txt = document.getElementById('ai-loading-text');
    if (txt) txt.textContent = text;
    if (el) el.classList.toggle('hidden', !loading);

    const btn = document.getElementById('btn-ai-solve-run');
    if (btn) btn.disabled = loading;
  }

  function setPrompt(text) {
    const input = document.getElementById('ai-solve-input');
    if (input) {
      input.value = text;
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
      setTimeout(() => input?.focus(), 150);
    }
  }

  function closePanel() {
    const d = document.getElementById('ai-drawer');
    if (d) d.classList.add('hidden');
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
      if (typeof App !== 'undefined' && App.showToast) App.showToast('✓ API Key saved');
      const panel = document.getElementById('ai-settings-panel');
      if (panel) panel.classList.add('hidden');
    }
  }

  // Aliases for compatibility
  function runSolve() { askQuestion(); }
  function runChapterQuiz() { askQuestion(); }
  function runVisionSolve() { askQuestion(); }
  function switchTab() {}

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureDrawerMounted);
  } else {
    setTimeout(ensureDrawerMounted, 100);
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
    insertOntoBoard,
    copyResult,
    clearResult,
    clearInput,
    setPrompt,
    toggleSettings,
    toggleKeyVisibility,
    saveSettings
  };
})();

// Attach to window
window.AIAssistant = AIAssistant;
