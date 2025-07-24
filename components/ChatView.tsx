
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

interface ChatViewProps {
  messages: Message[];
  sendMessage: (text: string) => void;
  username: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, sendMessage, username }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim());
      setInput('');
    }
  };
  console.log('username', username);

  return (
    <div className="flex flex-col h-full bg-dark-surface rounded-b-lg">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end gap-2 ${msg.sender === username ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                msg.sender === username
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-600 text-dark-text-primary rounded-bl-none'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              <p className="text-xs text-right mt-1 opacity-70">{msg.timestamp}</p>
            </div>
          </div>
        ))}
         <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-dark-border">
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
