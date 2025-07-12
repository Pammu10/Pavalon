

import React, { useState, useRef, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import { Send, X } from "lucide-react";
import { motion } from "framer-motion";

interface ChatProps {
  isMobileView?: boolean;
  onHeaderClose?: () => void; // Prop to handle close from a parent modal
}

export const Chat: React.FC<ChatProps> = ({ isMobileView = false, onHeaderClose }) => {
  const { messages, sendMessage, user, gameState } = useGame();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isGameActive = !!gameState.roomCode;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // A small timeout allows the view to render before scrolling
    const timer = setTimeout(() => scrollToBottom(), 50);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && isGameActive) {
      sendMessage(newMessage.trim());
      setNewMessage("");
    }
  };

  const containerClasses = isMobileView
    ? "w-full h-full flex flex-col bg-slate-900 overflow-hidden"
    : "w-full h-full max-h-[calc(100vh-220px)] flex flex-col font-sans bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden";
  
  return (
    <div className={containerClasses}>
      {/* Header */}
      <header className="flex-shrink-0 flex justify-between items-center p-3 border-b border-slate-700/50 pt-safe-top">
        <h3 className="font-eaglelake text-lg text-yellow-500">Game Chat</h3>
        {onHeaderClose && (
          <button
            onClick={onHeaderClose}
            className="text-slate-400 hover:text-white rounded-full p-1 transition-colors"
            aria-label="Close chat"
          >
            <X size={20} />
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-grow p-4 overflow-y-auto scroll-hide space-y-4">
        {messages.map((msg, index) => {
          const isSelf = msg.senderUserId === user?.id;
          return (
            <div
              key={index}
              className={`flex items-end gap-2 ${
                isSelf ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex flex-col space-y-1 w-full max-w-[85%] ${
                  isSelf ? "items-end" : "items-start"
                }`}
              >
                <span className="text-xs text-slate-400 px-1">
                  {isSelf ? "You" : msg.senderName}
                </span>
                <motion.div
                  className={`px-3 py-2 rounded-xl text-sm break-words ${
                    isSelf
                      ? "bg-yellow-700 text-white rounded-br-none"
                      : "bg-slate-700 text-slate-200 rounded-bl-none"
                  }`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {msg.text}
                </motion.div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Form */}
      <footer className="flex-shrink-0 bg-slate-800/80">
        <form onSubmit={handleSend} className="p-3 border-t border-slate-700/50 flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isGameActive ? "Type a message..." : "Chat disabled"}
            className="flex-grow bg-slate-800 border-2 border-slate-700 rounded-full py-2 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-transparent transition-all disabled:opacity-50"
            disabled={!isGameActive}
          />
          <button
            type="submit"
            className="bg-yellow-600 p-3 rounded-full text-white hover:bg-yellow-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed flex-shrink-0"
            disabled={!isGameActive || !newMessage.trim()}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      </footer>
    </div>
  );
};
