import React, { useState, useRef, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import { Send } from "lucide-react";

interface ChatProps {
  isMobileView?: boolean;
}

const SendIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
  >
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
);

export const Chat: React.FC<ChatProps> = ({ isMobileView = false }) => {
  const {
    messages,
    sendMessage,
    playerId,
    gameState,
    hasUnreadMessages,
    clearUnreadMessages,
  } = useGame();
  const [newMessage, setNewMessage] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isGameActive = !!gameState.roomCode;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (hasUnreadMessages) clearUnreadMessages();
  }, [hasUnreadMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage.trim());
      setNewMessage("");
    }
  };

  if (!isMobileView && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 w-24 h-12 font-eaglelake bg-yellow-600/80 hover:bg-yellow-500/90 backdrop-blur-md border border-yellow-500/50 rounded-lg shadow-2xl shadow-yellow-500/20 flex items-center justify-center text-white z-50"
      >
        Chat
      </button>
    );
  }

  const mobileClasses =
    "w-full h-full bg-slate-900/50 flex flex-col font-eaglelake";
  const desktopClasses =
    "fixed bottom-4 right-4 w-full max-w-xs h-[450px] bg-black/50 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl flex flex-col font-eaglelake animate-fadeIn z-50";

  return (
    <div className={isMobileView ? mobileClasses : desktopClasses}>
      <div className="flex justify-between items-center p-3 border-b border-slate-700/50">
        <h3 className="font-eaglelake text-lg text-yellow-500">Game Chat</h3>
        {!isMobileView && (
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        )}
      </div>
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col ${
              msg.senderId === playerId ? "items-end" : "items-start"
            }`}
          >
            <span
              className={`text-xs px-2 ${
                msg.senderId === playerId ? "text-yellow-400" : "text-slate-400"
              }`}
            >
              {msg.senderId === playerId ? "You" : msg.senderName}
            </span>
            <div
              className={`max-w-[85%] p-2 rounded-lg text-sm ${
                msg.senderId === playerId
                  ? "bg-yellow-800/50 text-white"
                  : "bg-slate-800/70 text-slate-200"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="p-2 border-t border-slate-700/50 flex items-center gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Say something..."
          className="flex-grow bg-slate-900/80 border border-slate-600 rounded-md p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          className="bg-yellow-600 p-2 rounded-md text-white hover:bg-yellow-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
          disabled={!isGameActive || !newMessage.trim()}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
