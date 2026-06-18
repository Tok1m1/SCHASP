import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import api from "../api/client";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  const loadConversations = async () => setConversations((await api.get("/messages/conversations")).data);
  const loadMessages = async (uid) => setMessages((await api.get(`/messages/${uid}`)).data);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeUserId) loadMessages(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!activeUserId || !text.trim()) return;
    try {
      await api.post("/messages", { recipientId: activeUserId, topic: topic || "Сообщение", text });
      setText("");
      await loadMessages(activeUserId);
      await loadConversations();
    } catch {
      toast.error("Не удалось отправить сообщение");
    }
  };

  return (
    <SectionCard title="Сообщения">
      <div className="grid md:grid-cols-3 gap-6 h-[600px] max-h-[75vh]">
        <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scroll border-r border-slate-700/50">
          <h3 className="text-sm font-semibold tracking-wide text-slate-400 mb-2 uppercase px-2">Диалоги</h3>
          {conversations.length === 0 && <div className="text-sm text-slate-500 px-2">Нет активных диалогов</div>}
          {conversations.map((c) => (
            <button
              key={c.userId}
              onClick={() => setActiveUserId(c.userId)}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 ${
                activeUserId === c.userId
                  ? "bg-gradient-to-br from-sky-500/20 to-sky-600/10 border-sky-400/50 shadow-[0_8px_24px_rgba(56,189,248,0.15)]"
                  : "bg-slate-900/40 border-slate-700/60 hover:bg-slate-800/60 hover:border-slate-600"
              }`}
            >
              <div className="font-semibold text-slate-100 text-[15px] truncate">{c.fullName}</div>
              <div className="text-xs text-slate-400 truncate mt-1">{c.lastMessage?.text || "Нет сообщений"}</div>
            </button>
          ))}
        </div>
        
        <div className="md:col-span-2 flex flex-col h-full bg-slate-900/30 border border-slate-700/50 rounded-2xl overflow-hidden shadow-inner">
          {activeUserId ? (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.length === 0 && <div className="text-center text-slate-500 mt-10 text-sm">История сообщений пуста</div>}
                {messages.map((m) => {
                  const isMe = m.senderId === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[85%] p-3.5 rounded-2xl ${
                        isMe
                          ? "bg-sky-500/20 border border-sky-400/30 ml-auto rounded-tr-sm text-sky-50"
                          : "bg-slate-800/60 border border-slate-700/80 mr-auto rounded-tl-sm text-slate-200"
                      }`}
                    >
                      <div className={`text-[10px] uppercase font-semibold tracking-wider mb-1 ${isMe ? "text-sky-300" : "text-slate-400"}`}>
                        {m.topic}
                      </div>
                      <div className="text-[14px] leading-relaxed break-words">{m.text}</div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 bg-slate-900/80 border-t border-slate-700/60">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    className="w-full sm:w-1/3 rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 shadow-inner" 
                    placeholder="Тема" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)} 
                  />
                  <input 
                    className="w-full sm:w-2/3 rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 shadow-inner" 
                    placeholder="Напишите сообщение..." 
                    value={text} 
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                  />
                  <button 
                    className="shrink-0 rounded-xl px-5 py-2 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_4px_14px_rgba(56,189,248,0.25)] hover:shadow-[0_6px_20px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all" 
                    onClick={send}
                  >
                    Отправить
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                <span className="text-2xl">💬</span>
              </div>
              <p>Выберите диалог слева<br/>или начните новую беседу</p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
