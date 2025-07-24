
import React, { useState } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

interface RoomConnectorProps {
  onJoin: (roomName: string, userName: string) => void;
  isJoining: boolean;
}

export const RoomConnector: React.FC<RoomConnectorProps> = ({ onJoin, isJoining }) => {
  const [roomName, setRoomName] = useState('Queenofmissuniverse');
  const [userName, setUserName] = useState('uuu');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim() && !isJoining) {
      onJoin(roomName.trim(), userName);
    }
  };

  return (
    <div className="p-6 bg-dark-surface rounded-lg shadow-lg max-w-md mx-auto text-center">
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
          onClick={() => setUserName('uuu')}
          className="w-50 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          uuu
        </button>
                <button
         type="submit"
          onClick={() => setUserName('g11h')}
          className="w-50 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          g11h
        </button>
        {/* <button
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
        </button> */}
      </form>
    </div>
  );
};
