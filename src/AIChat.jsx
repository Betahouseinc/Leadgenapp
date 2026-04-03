import { useState, useRef, useEffect } from "react";

const SUPABASE_URL  = "https://xcjakihewzegzyumnyuw.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjamFraWhld3plZ3p5dW1ueXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODcyNDIsImV4cCI6MjA4OTI2MzI0Mn0.HLwaK6PDdMap8SQ5ODz5XNSCKbCNnHkilO3HeuSVdyc";
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/ai-chat`;

export default function AIChat({ owner, T }) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hi ${(owner?.name || "").split(" ")[0] || "there"}! 👋 I'm your RentAI assistant. Ask me anything about your properties, tenants, payments or expenses.` }
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);
  const inputRef              = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "apikey": SUPABASE_ANON,
        },
        body: JSON.stringify({ message: text, owner_id: owner.id }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // If it came back as JSON (error), surface it
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const err = await res.json();
        throw new Error(err.error || "Server error");
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   reply   = "";
      let   buffer  = "";

      setMessages(m => [...m, { role: "assistant", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);

            // Standard Anthropic streaming format
            if (json.type === "content_block_delta" && json.delta?.type === "text_delta" && json.delta?.text) {
              reply += json.delta.text;
            }
            // Fallback: delta.text directly
            else if (json.delta?.text) {
              reply += json.delta.text;
            }
            // Fallback: flat text field
            else if (typeof json.text === "string" && json.text) {
              reply += json.text;
            }
            // Fallback: OpenAI-compatible
            else if (json.choices?.[0]?.delta?.content) {
              reply += json.choices[0].delta.content;
            }

            if (reply) {
              setMessages(m => [
                ...m.slice(0, -1),
                { role: "assistant", text: reply },
              ]);
            }
          } catch {
            // Plain text chunk fallback
            if (data && data !== "[DONE]" && !data.startsWith("{")) {
              reply += data;
              if (reply) {
                setMessages(m => [
                  ...m.slice(0, -1),
                  { role: "assistant", text: reply },
                ]);
              }
            }
          }
        }
      }

      if (!reply) {
        setMessages(m => [
          ...m.slice(0, -1),
          { role: "assistant", text: "No response received. Please try again." },
        ]);
      }

    } catch (err) {
      console.error("AIChat error:", err);
      setMessages(m => [
        ...m.slice(0, -1),
        { role: "assistant", text: `Error: ${err.message}. Please try again.` },
      ]);
    }

    setLoading(false);
  };

  const suggestions = [
    "Which tenants have overdue rent?",
    "Which leases are expiring soon?",
    "What's my income this month?",
    "Any open maintenance requests?",
  ];

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 82, right: 18, zIndex: 200,
          width: 52, height: 52, borderRadius: "50%", border: "none",
          background: `linear-gradient(135deg,${T.saffron},${T.saffronB})`,
          color: "#fff", fontSize: 22, cursor: "pointer",
          boxShadow: `0 6px 20px ${T.saffron}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform .2s",
        }}
        title="Ask RentAI"
      >
        {open ? "✕" : "🤖"}
      </button>

      {open && (
        <div style={{
          position: "fixed", bottom: 144, right: 12, left: 12,
          maxWidth: 492, margin: "0 auto", zIndex: 199,
          background: T.surface, border: `1.5px solid ${T.border}`,
          borderRadius: 20, boxShadow: "0 16px 48px rgba(0,0,0,.18)",
          display: "flex", flexDirection: "column", maxHeight: "68vh",
          fontFamily: "'Nunito','Segoe UI',sans-serif",
        }}>

          <div style={{
            padding: "13px 16px", borderBottom: `1px solid ${T.border}`,
            background: `linear-gradient(135deg,${T.saffron},${T.saffronB})`,
            borderRadius: "18px 18px 0 0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "rgba(255,255,255,.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>🤖</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>RentAI Assistant</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.8)" }}>
                Knows your properties, tenants & payments
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}>
                <div style={{
                  maxWidth: "82%",
                  padding: "9px 13px",
                  borderRadius: m.role === "user"
                    ? "14px 14px 3px 14px"
                    : "14px 14px 14px 3px",
                  background: m.role === "user"
                    ? `linear-gradient(135deg,${T.saffron},${T.saffronB})`
                    : T.panel,
                  border: m.role === "user" ? "none" : `1px solid ${T.border}`,
                  color: m.role === "user" ? "#fff" : T.ink,
                  fontSize: 13, fontWeight: 600, lineHeight: 1.55,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.text}
                  {loading && i === messages.length - 1 && m.role === "assistant" && m.text === "" && (
                    <span style={{ display: "inline-flex", gap: 3, marginLeft: 2 }}>
                      {[0, 1, 2].map(d => (
                        <span key={d} style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: T.muted, display: "inline-block",
                          animation: `bounce .9s ${d * 0.2}s ease infinite`,
                        }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && (
            <div style={{
              padding: "0 12px 10px",
              display: "flex", gap: 6, flexWrap: "wrap",
            }}>
              {suggestions.map(s => (
                <button key={s}
                  onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                  style={{
                    padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: T.saffronL, border: `1px solid ${T.saffron}30`,
                    color: T.saffron, cursor: "pointer",
                  }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div style={{
            padding: "10px 12px", borderTop: `1px solid ${T.border}`,
            display: "flex", gap: 8, alignItems: "flex-end",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about rent, tenants, leases…"
              rows={1}
              style={{
                flex: 1, background: T.panel, border: `1.5px solid ${T.border2}`,
                borderRadius: 12, padding: "9px 12px", fontSize: 13, fontWeight: 600,
                color: T.ink, resize: "none", fontFamily: "inherit",
                maxHeight: 80, overflowY: "auto", outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                width: 38, height: 38, borderRadius: 11, border: "none",
                background: input.trim() && !loading
                  ? `linear-gradient(135deg,${T.saffron},${T.saffronB})`
                  : T.border,
                color: "#fff", fontSize: 16,
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background .2s",
              }}
            >
              {loading ? (
                <div style={{
                  width: 16, height: 16,
                  border: `2px solid rgba(255,255,255,.4)`,
                  borderTopColor: "#fff", borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }} />
              ) : "↑"}
            </button>
          </div>

          <style>{`
            @keyframes bounce {
              0%,80%,100% { transform: translateY(0) }
              40% { transform: translateY(-4px) }
            }
            @keyframes spin { to { transform: rotate(360deg) } }
          `}</style>
        </div>
      )}
    </>
  );
}
