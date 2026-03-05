// AI Chat panel — talks to the Cloudflare Worker which uses Llama 3.3

const chatToggle  = document.getElementById("chat-toggle");
const chatPanel   = document.getElementById("chat-panel");
const chatInput   = document.getElementById("chat-input");
const chatSend    = document.getElementById("chat-send");
const chatMsgs    = document.getElementById("chat-messages");

chatToggle.addEventListener("click", () => chatPanel.classList.toggle("open"));

async function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  chatInput.value = "";

  // Show user bubble
  addBubble(msg, "user");

  // Loading indicator
  const loadingEl = addBubble("Thinking…", "assistant loading");

  try {
    const res  = await fetch(`${WORKER_URL}/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message: msg }),
    });
    const data = await res.json();
    loadingEl.remove();
    addBubble(data.reply || "Sorry, no response.", "assistant");
  } catch (e) {
    loadingEl.remove();
    addBubble("Error contacting AI. Check your worker URL in globe.js.", "assistant");
  }
}

function addBubble(text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.textContent = text;
  chatMsgs.appendChild(div);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
  return div;
}

chatSend.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });
