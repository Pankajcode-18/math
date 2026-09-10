'use strict';

// ══════════════════════════════════════════════════════════════════════════
// SIMPLE & ELEGANT AI ASSISTANT — 100% TEACHER CONTROL
// Features:
// 1. Ask anything (math, science, questions, quizzes, definitions, steps)
// 2. Clear, step-by-step formatted response
// 3. 📋 Copy to Clipboard
// 4. ✨ Paste onto Whiteboard (places clean movable text directly on board)
// ══════════════════════════════════════════════════════════════════════════

const AIAssistant = (() => {

  const STORAGE_KEY = 'eduverse_gemini_api_key';
  const DEFAULT_KEY = '';
  const FAST_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];
  let currentModel = FAST_MODELS[0];
  let isLoading = false;
  let lastGeneratedText = '';

  function getApiKey() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim()) return saved.trim();
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
  // UI MOUNTING
  // ─────────────────────────────────────────────
  function ensureDrawerMounted() {
    if (document.getElementById('ai-drawer')) return;

    const drawer = document.createElement('div');
    drawer.id = 'ai-drawer';
    drawer.className = 'ai-drawer hidden';
    drawer.innerHTML = `
      <div class="ai-drawer-header">
        <div class="ai-drawer-title">
          <span class="ai-sparkle-icon">🤖</span>
          <div class="ai-title-wrap">
            <span class="ai-main-title">Ask AI</span>
            <span class="ai-sub-title">Ask anything · Copy or Paste to Board</span>
          </div>
        </div>
        <div class="ai-header-actions">
          <button class="ai-icon-btn" id="ai-btn-settings-toggle" onclick="AIAssistant.toggleSettings()" title="API Key Settings">⚙️</button>
          <button class="ai-close-btn" onclick="AIAssistant.closePanel()" title="Close AI (Esc)">✕</button>
        </div>
      </div>

      <!-- Collapsible Settings Panel -->
      <div id="ai-settings-panel" class="ai-settings-panel hidden">
        <div class="ai-input-group">
          <label class="ai-field-label">Gemini API Key</label>
          <div class="ai-key-wrap">
            <input type="password" id="ai-settings-key" class="ai-text-input" placeholder="Enter Gemini API Key..." autocomplete="off">
            <button class="ai-toggle-key-btn" onclick="AIAssistant.toggleKeyVisibility()" title="Show/Hide Key">👁️</button>
          </div>
        </div>
        <div class="ai-settings-actions">
          <button class="ai-btn-save-key" onclick="AIAssistant.saveSettings()">Save Key</button>
        </div>
      </div>

      <!-- Main Body -->
      <div class="ai-drawer-body">
        <!-- Quick Suggestions -->
        <div class="ai-quick-chips">
          <button class="ai-chip" onclick="AIAssistant.setPrompt('Solve step-by-step: 2x² + 5x - 3 = 0')">Solve 2x² + 5x - 3 = 0</button>
          <button class="ai-chip" onclick="AIAssistant.setPrompt('State and prove Pythagoras theorem with clean steps')">Pythagoras Proof</button>
          <button class="ai-chip" onclick="AIAssistant.setPrompt('Explain Newton\'s 3 laws of motion with formulas')">Newton's Laws</button>
          <button class="ai-chip" onclick="AIAssistant.setPrompt('Give 3 practice questions with answers on Circle geometry')">3 Practice Questions</button>
        </div>

        <!-- Input Box -->
        <div class="ai-input-group">
          <textarea id="ai-solve-input" class="ai-textarea" rows="3" placeholder="Ask anything... (e.g. Solve 3x + 12 = 45, explain photosynthesis, quiz on triangles)"></textarea>
        </div>

        <!-- Action Row -->
        <div class="ai-action-row">
          <button class="ai-primary-btn" id="btn-ai-solve-run" onclick="AIAssistant.askQuestion()">
            <span class="ai-btn-icon">✨</span> Ask AI
          </button>
          <button class="ai-secondary-btn" onclick="AIAssistant.clearInput()">Clear</button>
        </div>

        <!-- Loading State -->
        <div id="ai-loading" class="ai-loading-container hidden">
          <div class="ai-spinner"></div>
          <span class="ai-loading-text" id="ai-loading-text">AI is answering...</span>
        </div>

        <!-- Output / Solution Card -->
        <div id="ai-result-section" class="ai-result-section hidden">
          <div class="ai-result-header">
            <div class="ai-result-badge">
              <span class="ai-badge-dot"></span>
              <span id="ai-result-tag">AI Answer</span>
            </div>
            <div class="ai-result-actions">
              <button class="ai-btn-sm" id="btn-ai-copy-top" onclick="AIAssistant.copyResult()" title="Copy text to clipboard">📋 Copy</button>
              <button class="ai-btn-sm danger" onclick="AIAssistant.clearResult()" title="Dismiss">✕</button>
            </div>
          </div>

          <!-- Answer Body -->
          <div class="ai-result-body" id="ai-result-body"></div>

          <!-- Prominent Action Buttons: Copy & Paste to Board -->
          <div class="ai-dual-actions">
            <button class="ai-btn-copy-big" id="btn-ai-copy-big" onclick="AIAssistant.copyResult()">
              📋 Copy
            </button>
            <button class="ai-btn-paste-big" onclick="AIAssistant.insertOntoBoard()">
              ✨ Paste to Board
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);

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

    setLoading(true, 'AI is answering...');
    clearResult();

    try {
      const response = await callGemini(prompt);
      showResult('AI Answer', response);
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

    // Convert raw markdown response into clean, neat board text
    const cleanBoardText = cleanTextForBoard(lastGeneratedText);

    // Determine optimal position on active canvas
    const size = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: 1200, H: 800 };
    const posX = Math.max(60, Math.round(size.W * 0.12));
    const posY = Math.max(60, Math.round(size.H * 0.12));

    // Choose readable text color based on active board background
    let textColor = '#ffffff';
    try {
      const boardColor = (typeof Canvas !== 'undefined' && Canvas.getBoardColor) ? Canvas.getBoardColor() : null;
      if (boardColor && (boardColor.id === 'white' || boardColor.id === 'light')) {
        textColor = '#0f172a';
      }
    } catch(e) {}

    // Place as vector text-block onto canvas
    if (typeof Canvas !== 'undefined' && Canvas.addTextShape) {
      Canvas.addTextShape(posX, posY, cleanBoardText, textColor, 18);
    }

    // Switch to select tool so teacher can immediately move or resize
    if (typeof App !== 'undefined') {
      if (App.setTool) App.setTool('select');
      if (App.showToast) App.showToast('✓ Pasted onto whiteboard');
    }

    // Close panel so teacher can immediately see and use it on the board
    closePanel();
  }

  // ─────────────────────────────────────────────
  // TEXT & MATH FORMATTING UTILITIES
  // ─────────────────────────────────────────────
  function cleanMathText(text) {
    if (!text) return '';
    let t = text;

    // Convert superscripts: x^2 -> x², x^{2} -> x²
    t = t.replace(/\^\{?0\}?/g, '⁰');
    t = t.replace(/\^\{?1\}?/g, '¹');
    t = t.replace(/\^\{?2\}?/g, '²');
    t = t.replace(/\^\{?3\}?/g, '³');
    t = t.replace(/\^\{?4\}?/g, '⁴');
    t = t.replace(/\^\{?5\}?/g, '⁵');
    t = t.replace(/\^\{?n\}?/g, 'ⁿ');

    // Convert subscripts: x_1 -> x₁
    t = t.replace(/_\{?0\}?/g, '₀');
    t = t.replace(/_\{?1\}?/g, '₁');
    t = t.replace(/_\{?2\}?/g, '₂');

    // Convert common LaTeX symbols to Unicode
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
    t = t.replace(/\^\\circ/g, '°');
    t = t.replace(/\\infty/g, '∞');
    t = t.replace(/\\pi/g, 'π');
    t = t.replace(/\\theta/g, 'θ');
    t = t.replace(/\\alpha/g, 'α');
    t = t.replace(/\\beta/g, 'β');
    t = t.replace(/\\delta/g, 'δ');
    t = t.replace(/\\Delta/g, 'Δ');
    t = t.replace(/\\angle/g, '∠');

    // Square roots: \sqrt{...} -> √( ... )
    t = t.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
    t = t.replace(/\\sqrt([a-zA-Z0-9]+)/g, '√$1');

    // Fractions: \frac{a}{b} -> (a) / (b)
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)');

    // Text in LaTeX: \text{...} -> ...
    t = t.replace(/\\text\{([^}]+)\}/g, '$1');

    // LaTeX spacing: \quad, \;, \, -> space
    t = t.replace(/\\quad/g, '  ');
    t = t.replace(/\\[;,]/g, ' ');

    // Strip LaTeX math delimiters ($$ and $) completely!
    t = t.replace(/\$\$(.*?)\$\$/g, '$1');
    t = t.replace(/\$(.*?)\$/g, '$1');
    t = t.replace(/\$/g, '');

    return t;
  }

  function formatMarkdownForPreview(text) {
    if (!text) return '';
    // First clean all LaTeX math and dollar signs
    const cleaned = cleanMathText(text);
    let html = escapeHtml(cleaned);

    // Convert bold: **text** -> <b>text</b>
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // Convert italic: *text* -> <i>$1</i>
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');

    // Convert headers
    html = html.replace(/^### (.*$)/gim, '<h4 class="ai-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="ai-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="ai-h2">$1</h2>');

    // Convert line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function cleanTextForBoard(text) {
    if (!text) return '';
    // First clean all math symbols and dollar signs
    let t = cleanMathText(text);

    // Strip bold & italic markdown markers
    t = t.replace(/\*\*(.*?)\*\*/g, '$1');
    t = t.replace(/\*(.*?)\*/g, '$1');
    t = t.replace(/^###+ /gm, '');
    t = t.replace(/^## /gm, '');
    t = t.replace(/^# /gm, '');
    t = t.replace(/`([^`]+)`/g, '$1');

    // Clean excessive blank lines
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

    if (tagEl) tagEl.textContent = tag || 'AI Answer';
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

  function setLoading(loading, text = 'AI is answering...') {
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
    if (panel) panel.classList.toggle('hidden');
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
      if (typeof App !== 'undefined' && App.showToast) App.showToast('✓ Gemini API Key saved');
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
