
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Ably from 'ably';
import { useWebRTC } from './hooks/useWebRTC';
import { View } from './types';
import { RoomConnector } from './components/ConnectionManager';
import { ChatView } from './components/ChatView';
import { VideoCallView } from './components/VideoCallView';
import { VoiceCallView } from './components/VoiceCallView';
import { CanvasView } from './components/CanvasView';
import { IncomingCallView } from './components/IncomingCallView';
import { OutgoingCallView } from './components/OutgoingCallView';
import Icon from './components/Icon';
import { ICON_PATHS } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('chat');
  const [ably, setAbly] = useState<Ably.Realtime | null>(null);
  const [ablyError, setAblyError] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');

  const handleCallAccepted = useCallback((callType: View) => {
    setCurrentView(callType);
  }, []);
  
  const handleCallEnded = useCallback(() => {
    setCurrentView('chat');
  }, []);

  useEffect(() => {
    const ABLY_API_KEY = import.meta.env.VITE_ABLY_KEY;

    if (!ABLY_API_KEY) {
      setAblyError("Ably API Key not found. Ensure VITE_ABLY_KEY is set in your environment or GitHub Secrets.");
      return;
    }
    
    const ablyClient = new Ably.Realtime({
      key: ABLY_API_KEY,
      clientId: `user-${Math.random().toString(36).substring(2, 9)}`
    });

    ablyClient.connection.on('connected', () => {
      setAbly(ablyClient);
      setAblyError(null);
    });
    
    ablyClient.connection.on('failed', (stateChange: Ably.ConnectionStateChange) => {
        setAblyError(`Ably connection failed: ${stateChange.reason?.message ?? 'Unknown error'}`);
    });

    return () => {
      ablyClient.close();
    };
  }, []);

  const {
    localStream, remoteStream, messages, hasJoinedRoom, isConnected, isMuted, isVideoEnabled, mediaError, lastCanvasEvent,
    isPeerPresent, callState, incomingCallInfo, isFetchingHistory, hasMoreMessages,
    startCall, sendMessage, hangUp, toggleMute, toggleVideo, sendDrawData, sendClearCanvas, sendTextData,
    acceptCall, rejectCall, cancelCall, sendReaction, loadMoreMessages
  } = useWebRTC(ably, username, roomName, handleCallAccepted, handleCallEnded);

  const handleHangUp = useCallback(() => {
    hangUp();
    setRoomName('');
    setUsername('');
    setCurrentView('chat');
  }, [hangUp]);
  
  const handleJoinRoom = useCallback((newRoomName: string, newUsername: string) => {
      if(ably) {
          setUsername(newUsername);
          setRoomName(newRoomName);
      }
  }, [ably]);

  const ActiveView = useMemo(() => {
    if (ablyError) {
      return <div className="p-8 text-center text-red-400">{ablyError}</div>;
    }
    
    if (!ably || !hasJoinedRoom) {
      return (
        <div className="p-4 md:p-8 flex items-center justify-center h-full">
            <RoomConnector onJoin={handleJoinRoom} isJoining={callState !== 'idle'} />
        </div>
      );
    }
    
    if (callState === 'incoming' && incomingCallInfo) {
      return <IncomingCallView callInfo={incomingCallInfo} onAccept={acceptCall} onReject={rejectCall} />;
    }

    if (callState === 'outgoing') {
      return <OutgoingCallView onCancel={cancelCall} />;
    }

    switch (currentView) {
      case 'video':
        return (
          <VideoCallView localStream={localStream} remoteStream={remoteStream} isMuted={isMuted} isVideoEnabled={isVideoEnabled} onToggleMute={toggleMute} onToggleVideo={toggleVideo} onHangUp={handleHangUp} />
        );
      case 'voice':
        return (
          <VoiceCallView remoteStream={remoteStream} isMuted={isMuted} onToggleMute={toggleMute} onHangUp={handleHangUp} />
        );
      case 'canvas':
        return (
            <CanvasView
                sendDrawData={sendDrawData}
                sendTextData={sendTextData}
                sendClearCanvas={sendClearCanvas}
                lastCanvasEvent={lastCanvasEvent}
            />
        );
      case 'chat':
      default:
        return <ChatView messages={messages} sendMessage={sendMessage} sendReaction={sendReaction} currentUsername={username} loadMoreMessages={loadMoreMessages} hasMoreMessages={hasMoreMessages} isFetchingHistory={isFetchingHistory} />;
    }
  }, [ably, ablyError, hasJoinedRoom, callState, currentView, localStream, remoteStream, isMuted, isVideoEnabled, toggleMute, toggleVideo, handleHangUp, messages, sendMessage, handleJoinRoom, mediaError, lastCanvasEvent, sendDrawData, sendClearCanvas, sendTextData, incomingCallInfo, acceptCall, rejectCall, cancelCall, sendReaction, username, loadMoreMessages, hasMoreMessages, isFetchingHistory]);

  const { statusText, statusColor } = useMemo(() => {
    if (callState === 'outgoing') {
        return { statusText: 'Calling...', statusColor: 'bg-yellow-500' };
    }
    if (callState === 'incoming') {
      return { statusText: 'Incoming call...', statusColor: 'bg-yellow-500' };
    }
    if (isConnected) {
        return { statusText: 'Connected', statusColor: 'bg-green-500' };
    }
    if (hasJoinedRoom) {
        if (isPeerPresent) {
            return { statusText: 'Peer is present', statusColor: 'bg-blue-500' };
        }
        return { statusText: 'Waiting for Peer', statusColor: 'bg-orange-500' };
    }
    return { statusText: 'Disconnected', statusColor: 'bg-red-500' };
  }, [callState, isConnected, hasJoinedRoom, isPeerPresent]);
  
  const handleInteractionClick = useCallback((view: View) => {
    if (isPeerPresent && !isConnected && callState === 'idle') {
      startCall(view);
    }
    if (isConnected) {
      setCurrentView(view);
    }
  }, [isPeerPresent, isConnected, callState, startCall]);

  return (
    <div className="antialiased min-h-screen flex flex-col items-center justify-center p-4 bg-dark-bg">
      <div className="w-full max-w-4xl h-[90vh] flex flex-col bg-dark-surface rounded-lg shadow-2xl border border-dark-border">
        <header className="flex items-center justify-between p-4 border-b border-dark-border">
          {/* <div className="flex items-center gap-3">
            <Icon path={ICON_PATHS.logo} className="w-8 h-8 text-blue-400"/>
            <h1 className="text-xl font-bold text-dark-text-primary">P2P Connect</h1>
          </div> */}
          { hasJoinedRoom && (
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-xs font-medium text-white ${statusColor}`}>
                  {statusText}
              </div>
              {/* <button onClick={handleHangUp} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm">
                  Hang Up
              </button> */}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto relative">
          <div className="h-full">
            {mediaError && hasJoinedRoom && (
              <div className="absolute top-0 left-0 right-0 p-2 bg-yellow-600 text-white text-center text-sm z-10 animate-pulse">
                  <p>{mediaError}</p>
              </div>
            )}
            {ActiveView}
          </div>
        </main>
         {hasJoinedRoom && (
          <footer className="flex items-center justify-center p-2 border-t border-dark-border">
            <nav className="flex items-center gap-2">
                <button onClick={() => setCurrentView('chat')} disabled={callState !== 'idle' && !isConnected} className={`p-2 rounded-full transition-colors ${currentView === 'chat' && isConnected ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <Icon path={ICON_PATHS.chat} />
                </button>
                <button 
                onClick={() => handleInteractionClick('voice')} 
                disabled={!isPeerPresent || !!mediaError || callState !== 'idle'} 
                title={mediaError ?? (isPeerPresent ? (callState === 'idle' ? 'Start voice call' : 'Call in progress') : 'Waiting for a peer to join')}
                className={`p-2 rounded-full transition-colors ${currentView === 'voice' && isConnected ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                <Icon path={ICON_PATHS.phone} />
                </button>
                <button 
                onClick={() => handleInteractionClick('video')} 
                disabled={!isPeerPresent || !!mediaError || callState !== 'idle'}
                title={mediaError ?? (isPeerPresent ? (callState === 'idle' ? 'Start video call' : 'Call in progress') : 'Waiting for a peer to join')}
                className={`p-2 rounded-full transition-colors ${currentView === 'video' && isConnected ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                <Icon path={ICON_PATHS.video} />
                </button>
                <button 
                onClick={() => handleInteractionClick('canvas')} 
                disabled={!isPeerPresent || callState !== 'idle'} 
                title={isPeerPresent ? (callState === 'idle' ? 'Start collaborative canvas' : 'Call in progress') : 'Waiting for a peer to join'}
                className={`p-2 rounded-full transition-colors ${currentView === 'canvas' && isConnected ? 'bg-blue-600' : 'hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <Icon path={ICON_PATHS.pen} />
                </button>
            </nav>
          </footer>
         )}
      </div>
    </div>
  );
};

export default App;