

import { useState, useRef, useCallback, useEffect } from 'react';
import Ably from 'ably';
import { Message, SignalingMessage, DataChannelData, DrawData, ClearData, TextData, CanvasEventData } from '../types';
const API_HOST = import.meta.env.VITE_API_HOST || '';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  ],
};

export const useWebRTC = (ably: Ably.Realtime | null, username: string, roomName: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [lastCanvasEvent, setLastCanvasEvent] = useState<CanvasEventData | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const ablyChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const earlyIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const fetchHistory = useCallback(async () => {
    if (!username) return;
    try {
      const response = await fetch(`/api/data?limit=50&page=1`);
      if (!response.ok) {
        throw new Error(`Failed to fetch message history: ${response.status}`);
      }
      const historyData = await response.json();
      if (!historyData || !Array.isArray(historyData.items)) {
        console.warn('Fetched history does not contain an items array.');
        return;
      }

      const fetchedMessages: Message[] = historyData.items.map((item: any): Message => ({
        type: 'chat',
        id: String(item.id || `history-${Math.random()}`),
        text: item.message || '',
        sender: item.username === username ? 'me' : 'peer',
        timestamp: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      })).reverse();

      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = fetchedMessages.filter(m => !existingIds.has(m.id));
        return [...newMessages, ...prev];
      });
    } catch (error) {
      console.error('Error fetching message history:', error);
    }
  }, [username]);

  const resetPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    remoteStream?.getTracks().forEach(track => track.stop());
    setRemoteStream(null);
    setIsConnected(false);
    earlyIceCandidatesRef.current = [];
  }, [remoteStream]);


  const hangUp = useCallback(() => {
    ablyChannelRef.current?.presence.leave();
    ablyChannelRef.current?.unsubscribe();
    ablyChannelRef.current = null;

    resetPeerConnection();

    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setHasJoinedRoom(false);
    setIsJoining(false);
    setMessages([]);
    setMediaError(null);
    console.log('Call ended and resources cleaned up.');
  }, [localStream, resetPeerConnection]);

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dc.onopen = () => console.log('Data channel is open');
    dc.onmessage = (event) => {
      const data: DataChannelData = JSON.parse(event.data);
      if (data.type === 'chat') {
        setMessages((prev) => [...prev, { ...data, sender: 'peer' }]);
      } else if (data.type === 'draw' || data.type === 'clear' || data.type === 'text') {
        setLastCanvasEvent(data);
      }
    };
    dc.onclose = () => console.log('Data channel is closed');
  }, []);

  const setupPeerConnection = useCallback((stream: MediaStream | null) => {
    // Reset any existing connection before creating a new one.
    resetPeerConnection();

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && ablyChannelRef.current && ably) {
        const message: SignalingMessage = { type: 'ice-candidate', candidate: event.candidate.toJSON(), from: ably.auth.clientId };
        ablyChannelRef.current.publish('webrtc-signal', message);
      }
    };

    pc.ontrack = (event) => {
      console.log('Remote track received');
      setRemoteStream(event.streams[0]);
    };

    pc.ondatachannel = (event) => {
      console.log('Data channel received');
      dataChannelRef.current = event.channel;
      setupDataChannel(event.channel);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`Connection state changed to: ${state}`);
      if (state === 'connected') {
        setIsJoining(false);
        setIsConnected(true);
      } else if (state === 'failed' || state === 'closed') {
        console.log(`Peer connection is ${state}. Resetting.`);
        resetPeerConnection();
      }
    };

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    peerConnectionRef.current = pc;

  }, [resetPeerConnection, setupDataChannel, ably]);

  const startLocalStream = useCallback(async (video: boolean, audio: boolean) => {
    // If stream already exists, do nothing.
    if (localStream) return localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      setLocalStream(stream);
      setIsVideoEnabled(video);
      setMediaError(null);
      return stream;
    } catch (error: any) {
      console.error("Error accessing media devices.", error);
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setMediaError('No camera or microphone found. Voice and video calls are disabled.');
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMediaError('Permission for camera and microphone was denied. Voice and video calls are disabled.');
      } else {
        setMediaError('Could not access camera or microphone.');
      }
      setLocalStream(null);
      return null;
    }
  }, [localStream]);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;
    if (peerConnectionRef.current.remoteDescription) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding received ICE candidate", e);
      }
    } else {
      earlyIceCandidatesRef.current.push(candidate);
    }
  }, []);

  const createOffer = useCallback(async (myClientId: string) => {
    if (!peerConnectionRef.current || !ablyChannelRef.current) return;
    dataChannelRef.current = peerConnectionRef.current.createDataChannel('chat');
    setupDataChannel(dataChannelRef.current);
    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    const message: SignalingMessage = { type: 'offer', sdp: offer.sdp!, from: myClientId };
    await ablyChannelRef.current.publish('webrtc-signal', message);
  }, [setupDataChannel]);

  const handleReceivedOffer = useCallback(async (offerSdp: string, myClientId: string) => {
    if (!peerConnectionRef.current || !ablyChannelRef.current) return;
    await peerConnectionRef.current.setRemoteDescription({ type: 'offer', sdp: offerSdp });

    for (const candidate of earlyIceCandidatesRef.current) {
      await addIceCandidate(candidate);
    }
    earlyIceCandidatesRef.current = [];

    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    const message: SignalingMessage = { type: 'answer', sdp: answer.sdp!, from: myClientId };
    await ablyChannelRef.current.publish('webrtc-signal', message);
  }, [addIceCandidate]);

  const handleReceivedAnswer = useCallback(async (answerSdp: string) => {
    if (!peerConnectionRef.current) return;
    if (peerConnectionRef.current.signalingState !== 'have-local-offer') {
      console.warn('Received answer in invalid state:', peerConnectionRef.current.signalingState);
      return;
    }
    await peerConnectionRef.current.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    for (const candidate of earlyIceCandidatesRef.current) {
      await addIceCandidate(candidate);
    }
    earlyIceCandidatesRef.current = [];
  }, [addIceCandidate]);

  const joinRoom = useCallback(() => {
    if (!ably || hasJoinedRoom) return;
    setHasJoinedRoom(true);
    fetchHistory();
  }, [ably, hasJoinedRoom, fetchHistory]);

  const initiateCall = useCallback(async () => {
    if (!ably || peerConnectionRef.current) return;

    console.log('Initiating call...');
    setIsJoining(true);

    const stream = await startLocalStream(true, true);
    setupPeerConnection(stream);

    if (peerConnectionRef.current) {
      await createOffer(ably.auth.clientId);
    }
  }, [ably, startLocalStream, setupPeerConnection, createOffer]);

  const answerCall = useCallback(async (offerSdp: string) => {
    if (!ably || peerConnectionRef.current) return;

    console.log('Received offer, preparing to answer...');
    setIsJoining(true);

    const stream = await startLocalStream(true, true);
    setupPeerConnection(stream);

    if (peerConnectionRef.current) {
      await handleReceivedOffer(offerSdp, ably.auth.clientId);
    }

  }, [ably, startLocalStream, setupPeerConnection, handleReceivedOffer]);


  useEffect(() => {
    if (!hasJoinedRoom || !ably || !roomName) return;

    const myClientId = ably.auth.clientId;
    const channel = ably.channels.get(`p2p-chat:${roomName}`);
    ablyChannelRef.current = channel;

    const signalSubscriber = (message: Ably.Message) => {
      const data = message.data as SignalingMessage;
      if (!data || data.from === myClientId) return;

      switch (data.type) {
        case 'offer': answerCall(data.sdp); break;
        case 'answer': handleReceivedAnswer(data.sdp); break;
        case 'ice-candidate': addIceCandidate(data.candidate); break;
      }
    };
    channel.subscribe('webrtc-signal', signalSubscriber);

    const initiateCallIfMyTurn = (peerClientId: string) => {
      if (myClientId > peerClientId) {
        console.log(`My ID (${myClientId}) is greater than peer's (${peerClientId}). Initiating call.`);
        initiateCall();
      } else {
        console.log(`My ID (${myClientId}) is not greater than peer's (${peerClientId}). Waiting for offer.`);
      }
    };

    const presenceEnterSubscriber = (member: Ably.PresenceMessage) => {
      if (member.clientId === myClientId) return;
      initiateCallIfMyTurn(member.clientId);
    };
    channel.presence.subscribe('enter', presenceEnterSubscriber);

    const leaveSubscriber = (member: Ably.PresenceMessage) => {
      if (member.clientId !== myClientId) {
        console.log('Peer left, resetting connection.');
        resetPeerConnection();
      }
    };
    channel.presence.subscribe('leave', leaveSubscriber);

    // Check for members already in the room when we join
    channel.presence.get().then((presentMembers) => {
      const peer = presentMembers.find(member => member.clientId !== myClientId);
      if (peer) {
        initiateCallIfMyTurn(peer.clientId);
      }
    });

    // Announce our arrival via presence.
    channel.presence.enter();

    return () => {
      channel.unsubscribe('webrtc-signal', signalSubscriber);
      channel.presence.unsubscribe('enter', presenceEnterSubscriber);
      channel.presence.unsubscribe('leave', leaveSubscriber);
      channel.presence.leave();
    }
  }, [hasJoinedRoom, ably, roomName, initiateCall, answerCall, handleReceivedAnswer, addIceCandidate, resetPeerConnection]);


  const sendMessage = useCallback((text: string) => {
    if (!username) return;

    const message: Message = {
      type: 'chat',
      id: Date.now().toString(),
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sender: 'me',
    };

    setMessages((prev) => [...prev, message]);

    if (dataChannelRef.current?.readyState === 'open') {
      const peerMessage: Message = { ...message, sender: 'peer' }
      dataChannelRef.current.send(JSON.stringify(peerMessage));
    }

    const saveData = async () => {
      try {
        const payload = { username, imageUrl: null, replyingTo: null, message: text };
        await fetch(`${API_HOST}/api/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error('Failed to save message to server:', error);
      }
    };
    saveData();
  }, [username]);

  const sendDrawData = useCallback((data: DrawData) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendTextData = useCallback((data: TextData) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendClearCanvas = useCallback(() => {
    if (dataChannelRef.current?.readyState === 'open') {
      const data: ClearData = { type: 'clear' };
      dataChannelRef.current.send(JSON.stringify(data));
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  useEffect(() => {
    return () => hangUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    localStream, remoteStream, messages, hasJoinedRoom, isConnected, isMuted, isVideoEnabled, isJoining, mediaError, lastCanvasEvent,
    joinRoom, sendMessage, hangUp, toggleMute, toggleVideo, sendDrawData, sendClearCanvas, sendTextData
  };
};