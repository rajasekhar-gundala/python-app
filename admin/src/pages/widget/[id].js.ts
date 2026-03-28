import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const tenantId = params.id;
  
  // You can fetch tenant-specific branding (colors, names) from PocketBase here
  // const tenant = await pb.collection('tenants').getOne(tenantId);

  const jsCode = `
    (function() {
      const TENANT_ID = "${tenantId}";
      const API_BASE = "https://api.yourdomain.com";
      
      console.log("AI Chatbot initialized for tenant:", TENANT_ID);
      <script>
  (function() {
    const TENANT_ID = 'YOUR_TENANT_ID'; // Replace dynamically per customer
    const API_BASE = 'https://api.yourdomain.com';

    const style = document.createElement('style');
    style.innerHTML = `
      #ai-chat-bubble { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; background: #007bff; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 24px; z-index: 9999; }
      #ai-chat-window { position: fixed; bottom: 90px; right: 20px; width: 350px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); display: none; flex-direction: column; overflow: hidden; z-index: 9999; border: 1px solid #eee; }
      #ai-chat-header { background: #007bff; color: white; padding: 15px; font-weight: bold; }
      #ai-chat-msgs { flex: 1; padding: 15px; overflow-y: auto; font-family: sans-serif; font-size: 14px; }
      #ai-chat-input-area { display: flex; padding: 10px; border-top: 1px solid #eee; }
      #ai-chat-input { flex: 1; border: 1px solid #ddd; padding: 8px; border-radius: 4px; outline: none; }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.innerHTML = `
      <div id="ai-chat-bubble">💬</div>
      <div id="ai-chat-window">
        <div id="ai-chat-header">Assistant</div>
        <div id="ai-chat-msgs"></div>
        <div id="ai-chat-input-area">
          <input type="text" id="ai-chat-input" placeholder="Ask a question...">
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const bubble = document.getElementById('ai-chat-bubble');
    const window = document.getElementById('ai-chat-window');
    const input = document.getElementById('ai-chat-input');
    const msgs = document.getElementById('ai-chat-msgs');

    bubble.onclick = () => window.style.display = window.style.display === 'none' ? 'flex' : 'none';

    input.onkeypress = async (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        const query = input.value;
        input.value = '';
        msgs.innerHTML += `<div style="margin-bottom:10px;"><b>You:</b> ${query}</div>`;
        
        const response = await fetch(`${API_BASE}/chat/${TENANT_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query })
        });

        // Handle Streaming
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiMsgDiv = document.createElement('div');
        aiMsgDiv.innerHTML = `<b>AI:</b> `;
        msgs.appendChild(aiMsgDiv);

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          // Parsing Server-Sent Events (SSE) format from your FastAPI backend
          const lines = chunk.split('\n');
          for (const line of lines) {
             if (line.startsWith('data: ')) {
               try {
                 const data = JSON.parse(line.replace('data: ', ''));
                 const content = data.choices[0].delta.content || "";
                 aiMsgDiv.innerHTML += content;
                 msgs.scrollTop = msgs.scrollHeight;
               } catch(e) {}
             }
          }
        }
      }
    };
  })();
</script>
    })();
  `;

  return new Response(jsCode, {
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*" // Allow any website to load the widget
    }
  });
}
