
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Message } from '../types';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

interface ChatViewProps {
  messages: Message[];
  sendMessage: (text: string, replyingToId?: string) => void;
  sendReaction: (messageId: string, emoji: string) => void;
  currentUsername: string;
  loadMoreMessages: () => void;
  hasMoreMessages: boolean;
  isFetchingHistory: boolean;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😢'];

export const ChatView: React.FC<ChatViewProps> = ({ messages, sendMessage, sendReaction, currentUsername, loadMoreMessages, hasMoreMessages, isFetchingHistory }) => {
  const [input, setInput] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    if (shouldAutoScroll && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, shouldAutoScroll]);
  
  useLayoutEffect(() => {
    const chatContainer = messagesContainerRef.current;
    if (chatContainer && isFetchingHistory) {
      const { scrollHeight, scrollTop } = chatContainer;
      const oldScrollHeight = scrollHeight - scrollTop;

      const observer = new MutationObserver(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight - oldScrollHeight;
        observer.disconnect();
      });

      observer.observe(chatContainer, { childList: true });
    }
  }, [isFetchingHistory]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const atBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
    setIsAtBottom(atBottom);
    setShouldAutoScroll(atBottom);

    if (container.scrollTop === 0 && hasMoreMessages && !isFetchingHistory) {
      loadMoreMessages();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim(), replyingTo?.id);
      setInput('');
      setReplyingTo(null);
      setShouldAutoScroll(true);
    }
  };

  const handleReactionClick = (messageId: string, emoji: string) => {
    sendReaction(messageId, emoji);
    setActiveMenuId(null);
  };
  
  const handleReplyClick = (message: Message) => {
    setReplyingTo(message);
    setActiveMenuId(null);
  };

  return (
    <div className="flex flex-col h-full bg-dark-surface rounded-b-lg">
      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 p-4 overflow-y-auto space-y-2">
        {isFetchingHistory && (
             <div className="flex justify-center my-4">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
             </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`group flex items-end gap-2 ${msg.username === currentUsername ? 'justify-end' : 'justify-start'}`}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(msg.id === activeMenuId ? null : msg.id);
              }}
              className={`relative max-w-xs lg:max-w-md px-4 py-2 rounded-2xl cursor-pointer ${
                msg.username === currentUsername
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-600 text-dark-text-primary rounded-bl-none'
              }`}
            >
              {msg.replyingTo && (
                <div className="mb-2 p-2 border-l-2 border-blue-300 bg-black/20 rounded-lg">
                  <p className="font-bold text-xs opacity-80">{msg.replyingTo.username}</p>
                  {/* <p>{currentUsername}</p> */}

                  <p className="text-sm opacity-80 truncate">{msg.replyingTo.text}</p>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              <p className="text-xs text-right mt-1 opacity-40">{msg.timestamp}</p>

              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                 <div className="absolute -bottom-3 right-2 flex gap-1">
                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                        users.length > 0 && (
                            <div key={emoji} className="bg-dark-surface border border-dark-border rounded-full px-2 py-0.5 text-xs flex items-center shadow">
                                <span>{emoji}</span>
                                <span className="ml-1 text-dark-text-secondary font-bold">{users.length}</span>
                            </div>
                        )
                    ))}
                 </div>
              )}
            </div>

            {activeMenuId === msg.id && (
                <div ref={menuRef} className="absolute z-10 -mt-8 bg-dark-surface border border-dark-border p-1 rounded-full shadow-lg flex items-center gap-1">
                    {REACTION_EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => handleReactionClick(msg.id, emoji)} className={`p-1.5 rounded-full hover:bg-gray-600 transition-colors text-xl leading-none ${msg.reactions?.[emoji]?.includes(currentUsername) ? 'bg-blue-800' : ''}`}>
                            {emoji}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-dark-border mx-1"></div>
                    <button onClick={() => handleReplyClick(msg)} className="p-1.5 rounded-full hover:bg-gray-600 transition-colors">
                        <Icon path={ICON_PATHS.reply} className="w-5 h-5" />
                    </button>
                </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-dark-border">
        {replyingTo && (
            <div className="mb-2 p-2 bg-gray-800 rounded-lg text-sm relative">
                <p className="font-bold text-dark-text-secondary">Replying to {replyingTo.username}</p>
                <p className="text-dark-text-primary truncate">{replyingTo.text}</p>
                <button onClick={() => setReplyingTo(null)} className="absolute top-1 right-1 p-1 rounded-full hover:bg-gray-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-dark-text-primary"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Icon path={ICON_PATHS.send} className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};