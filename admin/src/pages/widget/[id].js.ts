import type { APIRoute } from 'astro';

export const prerender = false; // Required for dynamic SSR

export const GET: APIRoute = async ({ params }) => {
  const tenantId = params.id;
  
  // Replace this with your actual production API URL
  const API_BASE = "https://api.jammetry.com";

  const jsCode = `
    (function() {
      // Ensure we don't initialize twice
      if (window.AI_WIDGET_INITIALIZED) return;
      window.AI_WIDGET_INITIALIZED = true;

      const TENANT_ID = "${tenantId}";
      const API_URL = "${API_BASE}";

      // 1. Inject Styles
      const style = document.createElement('style');
      style.textContent = \`
        #ai-chat-bubble { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; background: #007bff; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 24px; z-index: 999999; transition: transform 0.3s; }
        #ai-chat-bubble:hover { transform: scale(1.1); }
        #ai-chat-window { position: fixed; bottom: 90px; right: 20px; width: 350px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); display: none; flex-direction: column; overflow: hidden; z-index: 999999; border: 1px solid #eee; font-family: sans-serif; }
        #ai-chat-header { background: #007bff; color: white; padding: 15px; font-weight: bold; display: flex; justify-content: space-between; }
        #ai-chat-msgs { flex: 1; padding: 15px; overflow-y: auto; font-size: 14px; line-height: 1.5; }
        #ai-chat-input-area { display: flex; padding: 10px; border-top: 1px solid #eee; }
        #ai-chat-input { flex: 1; border: 1px solid #ddd; padding: 10px; border-radius: 4px; outline: none; }
        .ai-msg-container { margin-bottom: 12px; }
        .user-label { color: #007bff; font-weight: bold; margin-right: 5px; }
        .bot-label { color: #333; font-weight: bold; margin-right: 5px; }
      \`;
      document.head.appendChild(style);

      // 2. Create UI Elements
      const container = document.createElement('div');
      container.id = 'ai-widget-container';
      container.innerHTML = \`
        <div id="ai-chat-bubble">💬</div>
        <div id="ai-chat-window">
          <div id="ai-chat-header">
            <span>AI Assistant</span>
            <span id="ai-close" style="cursor:pointer">✕</span>
          </div>
          <div id="ai-chat-msgs"></div>
          <div id="ai-chat-input-area">
            <input type="text" id="ai-chat-input" placeholder="Ask a question..." autocomplete="off">
          </div>
        </div>
      \`;
      document.body.appendChild(container);

      // 3. Logic & Event Listeners
      const chatBubble = document.getElementById('ai-chat-bubble');
      const chatWindow = document.getElementById('ai-chat-window');
      const chatInput = document.getElementById('ai-chat-input');
      const chatMsgs = document.getElementById('ai-chat-msgs');
      const closeBtn = document.getElementById('ai-close');

      const toggleChat = () => {
        const isHidden = chatWindow.style.display === 'none' || !chatWindow.style.display;
        chatWindow.style.display = isHidden ? 'flex' : 'none';
      };

      chatBubble.onclick = toggleChat;
      closeBtn.onclick = toggleChat;

      chatInput.onkeypress = async (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
          const query = chatInput.value.trim();
          chatInput.value = '';
          
          // Render User Message
          chatMsgs.innerHTML += \`<div class="ai-msg-container"><span class="user-label">You:</span> \${query}</div>\`;
          chatMsgs.scrollTop = chatMsgs.scrollHeight;

          try {
            const response = await fetch(\`\${API_URL}/chat/\${TENANT_ID}\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: query })
            });

            if (!response.ok) throw new Error('API Error');

            // Handle Streaming
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let botMsgDiv = document.createElement('div');
            botMsgDiv.className = 'ai-msg-container';
            botMsgDiv.innerHTML = '<span class="bot-label">AI:</span> <span class="ai-content"></span>';
            chatMsgs.appendChild(botMsgDiv);
            const contentSpan = botMsgDiv.querySelector('.ai-content');

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value);
              const lines = chunk.split('\\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.replace('data: ', ''));
                    if (data.choices && data.choices[0].delta.content) {
                      contentSpan.innerHTML += data.choices[0].delta.content;
                      chatMsgs.scrollTop = chatMsgs.scrollHeight;
                    }
                  } catch(err) { /* Partial JSON or keep-alive */ }
                }
              }
            }
          } catch (err) {
            chatMsgs.innerHTML += \`<div style="color:red; font-size:12px;">Error: Could not connect to assistant.</div>\`;
          }
        }
      };
    })();
  `;

  return new Response(jsCode, {
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600" // Cache for 1 hour to reduce server load
    }
  });
};