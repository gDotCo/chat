
import React, { useState } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

interface RoomConnectorProps {
  onJoin: (roomName: string) => void;
  isJoining: boolean;
}

export const RoomConnector: React.FC<RoomConnectorProps> = ({ onJoin, isJoining }) => {
  const [roomName, setRoomName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim() && !isJoining) {
      onJoin(roomName.trim());
    }
  };

  return (
    <div className="p-6 bg-dark-surface rounded-lg shadow-lg max-w-md mx-auto text-center">
      <Icon path={ICON_PATHS.logo} className="w-16 h-16 text-blue-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-dark-text-primary mb-2">Connect with a Peer</h2>
      <p className="text-dark-text-secondary mb-6">
        Enter a unique room name to start or join a call. Share the same room name with your friend.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Enter room name..."
          className="w-full bg-gray-900 border border-dark-border rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-dark-text-primary transition"
          aria-label="Room name"
        />
        <button
          type="submit"
          disabled={isJoining || !roomName.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isJoining ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Joining...
            </>
          ) : (
            'Join Room'
          )}
        </button>
      </form>
    </div>
  );
};
