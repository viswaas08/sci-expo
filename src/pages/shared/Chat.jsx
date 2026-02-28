import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaPaperPlane } from "react-icons/fa";

// Simplified: parent messages teacher. Room = parentId_teacherId
export default function Chat() {
  const { currentUser, userData, userRole } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(true);

  // Determine room
  const roomId = userData?.linkedStudentId
    ? `parent_${currentUser?.uid}`
    : currentUser?.uid;

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "chat"),
      where("roomId", "==", roomId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return unsub;
  }, [currentUser, roomId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(collection(db, "chat"), {
      roomId,
      text: text.trim(),
      senderId: currentUser.uid,
      senderName: userData?.name || "Unknown",
      senderRole: userRole,
      createdAt: new Date().toISOString(),
    });
    setText("");
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>💬 Chat</h1>
          <p>Communicate with your child's teacher</p>
        </div>

        <div className="glass-card" style={{ maxWidth: 700, display: "flex", flexDirection: "column", height: "60vh" }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
            {loading ? <div className="loading-center"><div className="spinner" /></div>
            : messages.length === 0 ? <p style={{ textAlign:"center", color:"var(--text-muted)", marginTop: 40 }}>No messages yet. Start the conversation!</p>
            : messages.map(m => {
              const isMine = m.senderId === currentUser?.uid;
              return (
                <div key={m.id} style={{ display:"flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 12 }}>
                  <div style={{
                    maxWidth: "70%", padding: "10px 14px", borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isMine ? "var(--grad-blue)" : "var(--bg-card-hover)",
                    border: "1px solid var(--border)", fontSize: 14,
                  }}>
                    {!isMine && <div style={{ fontSize: 11, color:"var(--accent-blue)", fontWeight:600, marginBottom:4 }}>{m.senderName} ({m.senderRole})</div>}
                    <div>{m.text}</div>
                    <div style={{ fontSize: 10, color: isMine ? "rgba(255,255,255,0.6)" : "var(--text-muted)", marginTop: 4, textAlign:"right" }}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ borderTop:"1px solid var(--border)", paddingTop: 16, display:"flex", gap: 10 }}>
            <input
              className="form-control"
              placeholder="Type a message..."
              value={text}
              onChange={e => setText(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit" style={{ padding:"12px 20px" }}>
              <FaPaperPlane />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
