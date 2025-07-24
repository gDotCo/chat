

import { useState, useRef, useCallback, useEffect } from 'react';
import Ably from 'ably';
import { Message, SignalingMessage, DataChannelData, CanvasEventData, View, DrawData, TextData, ClearData } from '../types';

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

type CallState = 'idle' | 'outgoing' | 'incoming';
export type IncomingCallInfo = { callType: View, from: string };

export const useWebRTC = (
  ably: Ably.Realtime | null,
  username: string,
  roomName: string,
  onCallAccepted: (callType: View) => void
) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [isPeerPresent, setIsPeerPresent] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [lastCanvasEvent, setLastCanvasEvent] = useState<CanvasEventData | null>(null);

  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingCallInfo, setIncomingCallInfo] = useState<IncomingCallInfo | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const ablyChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const earlyIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const offerSdpRef = useRef<string | null>(null);
  const activeCallTypeRef = useRef<View | null>(null);

  const callStateRef = useRef(callState);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const fetchHistory = useCallback(async () => {
    if (!username) return;
    try {
      const response = await fetch(`/api/data?limit=50&page=1`);
      if (!response.ok) throw new Error(`Failed to fetch message history: ${response.status}`);
      const historyData = await response.json();
      if (!historyData || !Array.isArray(historyData.items)) return;

      const fetchedMessages: Message[] = historyData.items.map((item: any): Message => ({
        type: 'chat',
        id: String(item.id || `history-${Math.random()}`),
        text: item.message || '',
        username: item.username,
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

  const resetLocalState = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.ondatachannel = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setIsConnected(false);
    setCallState('idle');
    setIncomingCallInfo(null);
    offerSdpRef.current = null;
    earlyIceCandidatesRef.current = [];
    activeCallTypeRef.current = null;
  }, []);

  const hangUp = useCallback(() => {
    ablyChannelRef.current?.presence.leave();
    ablyChannelRef.current?.unsubscribe();
    ablyChannelRef.current = null;

    resetLocalState();

    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setHasJoinedRoom(false);
    setIsPeerPresent(false);
    setMessages([]);
    setMediaError(null);
  }, [localStream, resetLocalState]);

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
    resetLocalState();
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && ablyChannelRef.current && ably) {
        const message: SignalingMessage = { type: 'ice-candidate', candidate: event.candidate.toJSON(), from: ably.auth.clientId };
        ablyChannelRef.current.publish('webrtc-signal', message);
      }
    };

    pc.ontrack = (event) => setRemoteStream(event.streams[0]);
    pc.ondatachannel = (event) => {
      dataChannelRef.current = event.channel;
      setupDataChannel(event.channel);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setIsConnected(true);
        if (callStateRef.current === 'outgoing' && activeCallTypeRef.current) {
          onCallAccepted(activeCallTypeRef.current);
          activeCallTypeRef.current = null;
        }
        setCallState('idle');
      }
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        resetLocalState();
      }
    };

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }
    peerConnectionRef.current = pc;
    return pc;
  }, [resetLocalState, setupDataChannel, ably, onCallAccepted]);

  const startLocalStream = useCallback(async (video: boolean, audio: boolean) => {
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
      } catch (e) { console.error("Error adding received ICE candidate", e); }
    } else {
      earlyIceCandidatesRef.current.push(candidate);
    }
  }, []);

  const handleReceivedAnswer = useCallback(async (answerSdp: string) => {
    const pc = peerConnectionRef.current;
    if (!pc || pc.signalingState !== 'have-local-offer') return;
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    for (const candidate of earlyIceCandidatesRef.current) await addIceCandidate(candidate);
    earlyIceCandidatesRef.current = [];
  }, [addIceCandidate]);

  const startCall = useCallback(async (callType: View) => {
    if (!ably || callStateRef.current !== 'idle') return;
    setCallState('outgoing');
    activeCallTypeRef.current = callType;
    const stream = await startLocalStream(true, true);
    const pc = setupPeerConnection(stream);
    dataChannelRef.current = pc.createDataChannel('chat');
    setupDataChannel(dataChannelRef.current);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const message: SignalingMessage = { type: 'offer', sdp: offer.sdp!, from: ably.auth.clientId, callType };
    await ablyChannelRef.current!.publish('webrtc-signal', message);
  }, [ably, startLocalStream, setupPeerConnection, setupDataChannel]);

  const acceptCall = useCallback(async () => {
    if (!ably || callStateRef.current !== 'incoming' || !incomingCallInfo || !offerSdpRef.current) return;

    const offerSdp = offerSdpRef.current;
    const callType = incomingCallInfo.callType;

    const stream = await startLocalStream(true, true);
    const pc = setupPeerConnection(stream);

    await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    for (const candidate of earlyIceCandidatesRef.current) await addIceCandidate(candidate);
    earlyIceCandidatesRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const message: SignalingMessage = { type: 'answer', sdp: answer.sdp!, from: ably.auth.clientId };
    await ablyChannelRef.current!.publish('webrtc-signal', message);

    onCallAccepted(callType);
  }, [ably, incomingCallInfo, startLocalStream, setupPeerConnection, addIceCandidate, onCallAccepted]);

  const rejectCall = useCallback(async () => {
    if (!ably || !incomingCallInfo) return;
    const message: SignalingMessage = { type: 'reject', from: ably.auth.clientId };
    await ablyChannelRef.current?.publish('webrtc-signal', message);
    setCallState('idle');
    setIncomingCallInfo(null);
    offerSdpRef.current = null;
  }, [ably, incomingCallInfo]);

  const cancelCall = useCallback(async () => {
    if (!ably) return;
    const message: SignalingMessage = { type: 'cancel', from: ably.auth.clientId };
    await ablyChannelRef.current?.publish('webrtc-signal', message);
    resetLocalState();
  }, [ably, resetLocalState]);

  useEffect(() => {
    if (ably && username && roomName && !hasJoinedRoom) {
      setHasJoinedRoom(true);
      fetchHistory();
    }
  }, [ably, username, roomName, hasJoinedRoom, fetchHistory]);

  useEffect(() => {
    if (!hasJoinedRoom || !ably || !roomName) return;

    const myClientId = ably.auth.clientId;
    const channel = ably.channels.get(`p2p-chat:${roomName}`);
    ablyChannelRef.current = channel;

    const signalSubscriber = (message: Ably.Message) => {
      const data = message.data as SignalingMessage;
      if (!data || data.from === myClientId) return;

      switch (data.type) {
        case 'offer':
          if (callStateRef.current !== 'idle') return;
          offerSdpRef.current = data.sdp;
          setIncomingCallInfo({ callType: data.callType, from: data.from });
          setCallState('incoming');
          break;
        case 'answer': handleReceivedAnswer(data.sdp); break;
        case 'ice-candidate': addIceCandidate(data.candidate); break;
        case 'reject':
        case 'cancel':
          resetLocalState();
          break;
      }
    };
    channel.subscribe('webrtc-signal', signalSubscriber);

    const presenceSubscriber = (member: Ably.PresenceMessage) => {
      if (member.clientId === myClientId) return;
      if (member.action === 'enter' || member.action === 'present') {
        setIsPeerPresent(true);
      } else if (member.action === 'leave') {
        setIsPeerPresent(false);
        // If we have an incoming call from the peer who just left, reset our state.
        if (callStateRef.current === 'incoming' && incomingCallInfo?.from === member.clientId) {
          console.log('Caller left before call was accepted. Resetting.');
          resetLocalState();
          return;
        }

        // Only reset the connection if it was fully established.
        // This prevents a presence flicker during the 'outgoing' state from
        // tearing down the connection attempt.
        if (peerConnectionRef.current && peerConnectionRef.current.connectionState === 'connected') {
          console.log('Connected peer left. Resetting connection.');
          resetLocalState();
        }
      }
    };
    channel.presence.subscribe(presenceSubscriber);

    channel.presence.get().then((presentMembers) => {
      setIsPeerPresent(presentMembers.some(member => member.clientId !== myClientId));
    });

    channel.presence.enter();

    return () => {
      channel.unsubscribe();
      channel.presence.unsubscribe();
      channel.presence.leave();
    }
  }, [hasJoinedRoom, ably, roomName, handleReceivedAnswer, addIceCandidate, resetLocalState, incomingCallInfo]);

  const sendMessage = useCallback((text: string) => {
    if (!username) return;
    const message: Message = { type: 'chat', id: Date.now().toString(), text, username, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages((prev) => [...prev, message]);
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ ...message, username: username === 'uuu' ? 'g11h' : 'uuu' })); // Adjust sender based on username
    }
    fetch(`${import.meta.env.VITE_API_HOST || ''}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, imageUrl: null, replyingTo: null, message: text }),
    }).catch(error => console.error('Failed to save message to server:', error));
  }, [username]);

  const sendDrawData = useCallback((data: DrawData) => { if (dataChannelRef.current?.readyState === 'open') dataChannelRef.current.send(JSON.stringify(data)); }, []);
  const sendTextData = useCallback((data: TextData) => { if (dataChannelRef.current?.readyState === 'open') dataChannelRef.current.send(JSON.stringify(data)); }, []);
  const sendClearCanvas = useCallback(() => { if (dataChannelRef.current?.readyState === 'open') dataChannelRef.current.send(JSON.stringify({ type: 'clear' } as ClearData)); }, []);

  const toggleMute = useCallback(() => { if (localStream) { localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled; setIsMuted(!localStream.getAudioTracks()[0].enabled); } }, [localStream]);
  const toggleVideo = useCallback(() => { if (localStream) { localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled; setIsVideoEnabled(localStream.getVideoTracks()[0].enabled); } }, [localStream]);

  // useEffect(() => () => hangUp(), [hangUp]);

  return {
    localStream, remoteStream, messages, hasJoinedRoom, isConnected, isMuted, isVideoEnabled, mediaError, lastCanvasEvent,
    isPeerPresent, callState, incomingCallInfo,
    startCall, sendMessage, hangUp, toggleMute, toggleVideo, sendDrawData, sendClearCanvas, sendTextData,
    acceptCall, rejectCall, cancelCall
  };
};