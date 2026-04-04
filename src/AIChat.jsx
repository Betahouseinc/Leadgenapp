import { useState, useRef, useEffect } from "react";

const SUPABASE_URL = "https://xcjakihewzegzyumnyuw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjamFraWhld3plZ3p5dW1ueXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2NTEyNjAsImV4cCI6MjA1OTIyNzI2MH0.kzABVB-DSMjhDhVlAMuqEqm9rPpSHiMJSFPUZiLfbI8";

const STARTER_PROMPTS = [
  { icon: "💰", label: "How do I handle a late payment?" },
  { icon: "✉️", label: "Draft a rent reminder message" },
  { icon: "🚪", label: "My tenant wants to leave early — what are my rights?" },
  { icon: "📋", label: "How much notice do I need to give before eviction?" },
];

export default function AIChat({ ownerId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || isStreaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setIsStreaming(true);

    // Placeholder for the assistant reply that we'll stream into
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ message: userText, owner_id: ownerId }),
        }
      );

      if (!response.ok) throw new Error("Edge function error");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + chunk,
                };
              }
              return updated;
            });
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      // Remove streaming flag from last message
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming) {
          updated[updated.length - 1] = { ...last, streaming: false };
        }
        return updated;
      });
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>🏠</span>
          <div>
            <div style={styles.headerTitle}>RentAI Assistant</div>
            <div style={styles.headerSub}>Powered by Gemini · Indian property law</div>
          </div>
        </div>
        <div style={styles.statusDot} title="Online" />
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {isEmpty && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIconWrap}>
              <span style={styles.emptyIcon}>🏡</span>
            </div>
            <p style={styles.emptyTitle}>Namaste! How can I help?</p>
            <p style={styles.emptySubtitle}>
              Ask me anything about rent, tenants, or Indian property law.
            </p>

            {/* ── Starter prompt chips ── */}
            <div style={styles.chipsGrid}>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  style={styles.chip}
                  onClick={() => sendMessage(prompt.label)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#E8821A";
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.borderColor = "#E8821A";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(232,130,26,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#FAFAF7";
                    e.currentTarget.style.color = "#2C2416";
                    e.currentTarget.style.borderColor = "#e0ddd6";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <span style={styles.chipIcon}>{prompt.icon}</span>
                  <span style={styles.chipLabel}>{prompt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.messageBubble,
              ...(msg.role === "user" ? styles.userBubble : styles.aiBubble),
            }}
          >
            {msg.role === "assistant" && (
              <span style={styles.aiBadge}>AI</span>
            )}
            <span style={styles.messageText}>
              {msg.content}
              {msg.streaming && <span style={styles.cursor}>▍</span>}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={styles.inputBar}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about rent, tenants, agreements…"
          rows={1}
          style={styles.textarea}
          disabled={isStreaming}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || isStreaming}
          style={{
            ...styles.sendBtn,
            opacity: !input.trim() || isStreaming ? 0.4 : 1,
            cursor: !input.trim() || isStreaming ? "not-allowed" : "pointer",
          }}
        >
          {isStreaming ? "…" : "→"}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: "'Nunito', sans-serif",
    background: "#FAFAF7",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 2px 20px rgba(44,36,22,0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    background: "#fff",
    borderBottom: "1px solid #f0ece4",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  headerIcon: {
    fontSize: "22px",
  },
  headerTitle: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "15px",
    color: "#2C2416",
  },
  headerSub: {
    fontSize: "11px",
    color: "#9e8f7a",
    marginTop: "1px",
  },
  statusDot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: "#1A8A72",
    boxShadow: "0 0 0 2px rgba(26,138,114,0.2)",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "20px 0 10px",
    gap: "8px",
  },
  emptyIconWrap: {
    width: "56px",
    height: "56px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #fff8f0, #ffeedd)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    marginBottom: "4px",
    boxShadow: "0 2px 8px rgba(232,130,26,0.15)",
  },
  emptyIcon: {
    lineHeight: 1,
  },
  emptyTitle: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "16px",
    color: "#2C2416",
    margin: 0,
  },
  emptySubtitle: {
    fontSize: "13px",
    color: "#9e8f7a",
    margin: "0 0 8px",
    maxWidth: "280px",
    lineHeight: 1.5,
  },

  // ── Chips ──
  chipsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    width: "100%",
    maxWidth: "380px",
    marginTop: "4px",
  },
  chip: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "10px 12px",
    background: "#FAFAF7",
    border: "1.5px solid #e0ddd6",
    borderRadius: "10px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.18s ease",
    fontFamily: "'Nunito', sans-serif",
    fontSize: "12.5px",
    color: "#2C2416",
    lineHeight: 1.35,
  },
  chipIcon: {
    fontSize: "15px",
    flexShrink: 0,
    marginTop: "1px",
  },
  chipLabel: {
    fontWeight: 600,
  },

  // ── Messages ──
  messageBubble: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    maxWidth: "85%",
    lineHeight: 1.55,
    fontSize: "14px",
    padding: "10px 14px",
    borderRadius: "12px",
    wordBreak: "break-word",
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#E8821A",
    color: "#fff",
    borderBottomRightRadius: "4px",
    flexDirection: "row-reverse",
  },
  aiBubble: {
    alignSelf: "flex-start",
    background: "#fff",
    color: "#2C2416",
    border: "1px solid #f0ece4",
    borderBottomLeftRadius: "4px",
    boxShadow: "0 1px 4px rgba(44,36,22,0.06)",
  },
  aiBadge: {
    flexShrink: 0,
    fontSize: "10px",
    fontWeight: 800,
    fontFamily: "'Montserrat', sans-serif",
    color: "#1A8A72",
    background: "rgba(26,138,114,0.1)",
    padding: "2px 5px",
    borderRadius: "4px",
    marginTop: "2px",
  },
  messageText: {
    whiteSpace: "pre-wrap",
  },
  cursor: {
    display: "inline-block",
    animation: "blink 1s step-start infinite",
    color: "#E8821A",
  },

  // ── Input bar ──
  inputBar: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    padding: "12px 14px",
    background: "#fff",
    borderTop: "1px solid #f0ece4",
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: "1.5px solid #e0ddd6",
    borderRadius: "10px",
    padding: "10px 13px",
    fontFamily: "'Nunito', sans-serif",
    fontSize: "14px",
    color: "#2C2416",
    background: "#FAFAF7",
    outline: "none",
    lineHeight: 1.5,
    transition: "border-color 0.15s",
  },
  sendBtn: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    border: "none",
    background: "#E8821A",
    color: "#fff",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.15s, transform 0.1s",
    flexShrink: 0,
  },
};
