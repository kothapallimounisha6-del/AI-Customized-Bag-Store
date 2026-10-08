const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = 'chat.css';
document.head.append(stylesheet);

const widget = document.createElement('aside');
widget.className = 'chat-widget';
widget.innerHTML = `
  <section class="chat-panel" id="chat-panel" aria-label="Bag design guide" hidden>
    <header class="chat-header">
      <span class="chat-avatar" aria-hidden="true">✦</span>
      <div>
        <strong>Design guide</strong>
        <span class="chat-connection" id="chat-connection"><i></i><span>Checking local model</span></span>
      </div>
      <button class="chat-close" id="chat-close" type="button" aria-label="Close design guide">×</button>
    </header>
    <div class="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
      <article class="chat-message assistant-message">
        <span class="message-avatar" aria-hidden="true">✦</span>
        <div class="message-content"><p>Hi, I can help you refine your bag design, compare materials, explore patterns, or keep a design within budget. What are you thinking?</p></div>
      </article>
    </div>
    <div class="chat-suggestions" id="chat-suggestions">
      <p>QUICK IDEAS</p>
      <div>
        <button type="button" data-prompt="Suggest a pattern that suits my current bag design.">Suggest a pattern</button>
        <button type="button" data-prompt="How can I keep this design under $100?">Stay under $100</button>
        <button type="button" data-prompt="Which material is best for everyday use?">Compare materials</button>
      </div>
    </div>
    <form class="chat-form" id="chat-form">
      <label class="sr-only" for="chat-input">Message the bag design guide</label>
      <textarea id="chat-input" rows="1" maxlength="1600" placeholder="Ask about your bag design…" required></textarea>
      <button id="chat-send" type="submit" aria-label="Send message" title="Send message">↑</button>
    </form>
    <p class="chat-footnote">Runs locally with Qwen 2.5 · Your design stays on this device</p>
  </section>
  <button class="chat-launcher" id="chat-launcher" type="button" aria-expanded="false" aria-controls="chat-panel">
    <span class="launcher-sparkle" aria-hidden="true">✦</span>
    <span>Ask the design guide</span>
    <span class="launcher-dot" id="launcher-dot" aria-hidden="true"></span>
  </button>`;
document.body.append(widget);

const launcher = widget.querySelector('#chat-launcher');
const panel = widget.querySelector('#chat-panel');
const closeButton = widget.querySelector('#chat-close');
const connection = widget.querySelector('#chat-connection');
const messagesElement = widget.querySelector('#chat-messages');
const form = widget.querySelector('#chat-form');
const input = widget.querySelector('#chat-input');
const sendButton = widget.querySelector('#chat-send');
const suggestions = widget.querySelector('#chat-suggestions');
const conversation = [];
let sending = false;

function setConnection(kind, message) {
  const indicator = connection.querySelector('i');
  indicator.classList.toggle('ready', kind === 'ready');
  indicator.classList.toggle('error', kind === 'error');
  connection.lastElementChild.textContent = message;
  widget.querySelector('#launcher-dot').style.background = kind === 'ready' ? '#78a06b' : kind === 'error' ? '#bc7257' : '#d0a166';
}

async function checkStatus() {
  if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname) || location.port !== '8000') {
    setConnection('error', 'Open the local app at 127.0.0.1:8000');
    return;
  }
  try {
    const response = await fetch('/api/status');
    const status = await response.json();
    if (!status.ollamaAvailable) setConnection('error', 'Start Ollama to chat');
    else if (!status.modelReady) setConnection('error', `Run ollama pull ${status.model}`);
    else setConnection('ready', `${status.model} · local`);
  } catch {
    setConnection('error', 'Start the local server to chat');
  }
}

function appendMessage(role, text) {
  const article = document.createElement('article');
  article.className = `chat-message ${role === 'assistant' ? 'assistant-message' : 'user-message'}`;
  if (role === 'assistant') {
    const avatar = document.createElement('span');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = '✦';
    article.append(avatar);
  }
  const content = document.createElement('div');
  content.className = 'message-content';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  content.append(paragraph);
  article.append(content);
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function addTypingIndicator() {
  const article = document.createElement('article');
  article.className = 'chat-message assistant-message';
  article.innerHTML = '<span class="message-avatar" aria-hidden="true">✦</span><div class="message-content"><p>Thinking<span class="typing-dots" aria-label="The design guide is responding"><i></i><i></i><i></i></span></p></div>';
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return article;
}

async function sendMessage(message = input.value) {
  const text = message.trim();
  if (!text || sending) return;

  sending = true;
  input.value = '';
  input.style.height = 'auto';
  sendButton.disabled = true;
  input.disabled = true;
  suggestions.hidden = true;
  appendMessage('user', text);
  const design = window.getBagDesignContext();
  conversation.push({ role: 'user', content: `Current bag design: ${JSON.stringify(design)}\nUser question: ${text}` });
  const typing = addTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversation.slice(-12) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The local model could not answer just now.');
    const answer = result.message?.content;
    if (!answer) throw new Error('The local model returned an empty reply.');
    conversation.push({ role: 'assistant', content: answer });
    appendMessage('assistant', answer);
  } catch (error) {
    conversation.pop();
    const messageText = error instanceof TypeError
      ? 'Could not reach the local designer. Open http://127.0.0.1:8000 and make sure Ollama is running.'
      : error.message;
    appendMessage('assistant', messageText);
  } finally {
    typing.remove();
    sending = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

launcher.addEventListener('click', () => {
  const opening = panel.hidden;
  panel.hidden = !opening;
  launcher.setAttribute('aria-expanded', String(opening));
  if (opening) {
    checkStatus();
    input.focus();
  }
});
closeButton.addEventListener('click', () => {
  panel.hidden = true;
  launcher.setAttribute('aria-expanded', 'false');
  launcher.focus();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  sendMessage();
});
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 88)}px`;
});
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
widget.querySelectorAll('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => sendMessage(button.dataset.prompt));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !panel.hidden) closeButton.click();
});

checkStatus();
