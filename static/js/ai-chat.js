/**
 * ai-chat.js
 * ---------------------------------------------------------------------------
 * "AI Assistant" chat modal for the builder. Sends the recent conversation
 * plus the live resume to POST /api/ai/chat (see api/routers/ai_router.py)
 * and renders the back-and-forth as chat bubbles. The backend grounds answers
 * in the actual resume, so the assistant talks about the user's real content.
 *
 * Expected backend request:
 *   { "resume": <ResumeState>, "messages": [{ "role": "user"|"assistant", "content": "..." }] }
 * Expected response:
 *   { "reply": "..." }
 * ---------------------------------------------------------------------------
 */

const AIChat = (() => {
  async function send(messages, resume) {
    const fetcher = (typeof Auth !== 'undefined' && Auth.apiFetch) ? Auth.apiFetch : fetch;
    const res = await fetcher('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume, messages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'AI chat request failed');
    return data; // { reply }
  }
  return { send };
})();

// ---- Wire the chat modal UI (runs when this file is loaded on the builder) --
(() => {
  const modal = document.getElementById('ai-chat-modal');
  if (!modal) return;
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const chipsEl = document.getElementById('chat-quick-chips');
  // Support both the modal and the floating trigger button
  const openBtn = document.getElementById('floating-ai-writer-btn');
  const closeBtn = document.getElementById('close-ai-chat-modal');

  let history = [];

  function open() { modal.classList.remove('d-none'); }
  function close() { modal.classList.add('d-none'); }
  if (openBtn) openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function addBubble(role, html) {
    const div = document.createElement('div');
    div.className = role === 'user' ? 'chat-msg chat-msg-user' : 'chat-msg chat-msg-ai';
    div.innerHTML = html;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addTyping() {
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-ai';
    div.setAttribute('data-typing', '1');
    div.innerHTML = '<span class="spinner"></span> Thinking…';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function ask(text) {
    text = (text || '').trim();
    if (!text || typeof ResumeState === 'undefined') return;
    addBubble('user', escapeHtml(text));
    history.push({ role: 'user', content: text });
    addTyping();
    try {
      const { reply } = await AIChat.send(history, ResumeState.get());
      history.push({ role: 'assistant', content: reply });
      // Remove the (last) typing bubble, then append the reply.
      const typing = messagesEl.querySelector('[data-typing]');
      if (typing) typing.remove();
      addBubble('ai', escapeHtml(reply).replace(/\n/g, '<br>'));
    } catch (err) {
      console.error(err);
      const typing = messagesEl.querySelector('[data-typing]');
      if (typing) typing.remove();
      const msg = (err && err.message) ? escapeHtml(err.message) : "Sorry — I couldn't answer right now. Please try again.";
      addBubble('ai', `<span style="color:var(--warn)">${msg}</span>`);
    }
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const value = inputEl.value;
      inputEl.value = '';
      ask(value);
    });
  }
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const value = inputEl.value;
        inputEl.value = '';
        ask(value);
      }
    });
  }
  if (chipsEl) {
    chipsEl.querySelectorAll('button').forEach((chip) => {
      chip.addEventListener('click', () => ask(chip.textContent));
    });
  }
})();