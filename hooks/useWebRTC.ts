
import { useState, useRef, useCallback, useEffect } from 'react';
import { Message, SignalingMessage } from '../types';

// Assuming Ably is loaded from CDN
declare const Ably: any;
type RealtimePromise = any;
type RealtimeChannelPromise = any;


const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (ably: RealtimePromise | null) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const ablyChannelRef = useRef<RealtimeChannelPromise | null>(null);
  
  const setupPeerConnection = useCallback((myClientId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && ablyChannelRef.current) {
        const message: SignalingMessage = { 
            type: 'ice-candidate', 
            candidate: event.candidate.toJSON(),
            from: myClientId 
        };
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
        if (pc.connectionState === 'connected') {
            setIsConnected(true);
            console.log('Peer connection established');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            setIsConnected(false);
            console.log('Peer connection lost');
            hangUp();
        }
    };
    
    peerConnectionRef.current = pc;
  }, []);

  const setupDataChannel = (dc: RTCDataChannel) => {
    dc.onopen = () => console.log('Data channel is open');
    dc.onmessage = (event) => {
      const receivedMessage = JSON.parse(event.data);
      setMessages((prev) => [...prev, { ...receivedMessage, sender: 'peer' }]);
    };
    dc.onclose = () => console.log('Data channel is closed');
  };

  const startLocalStream = useCallback(async (video: boolean, audio: boolean) => {
    try {
      if (!peerConnectionRef.current) return null;
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      setLocalStream(stream);
      setIsVideoEnabled(video);
      stream.getTracks().forEach(track => peerConnectionRef.current?.addTrack(track, stream));
      return stream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      throw error;
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
  }, []);

  const handleReceivedOffer = useCallback(async (offerSdp: string, myClientId: string) => {
    if (!peerConnectionRef.current || !ablyChannelRef.current) return;
    await startLocalStream(true, true);
    await peerConnectionRef.current.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    const message: SignalingMessage = { type: 'answer', sdp: answer.sdp!, from: myClientId };
    await ablyChannelRef.current.publish('webrtc-signal', message);
  }, [startLocalStream]);

  const handleReceivedAnswer = useCallback(async (answerSdp: string) => {
    if (!peerConnectionRef.current) return;
    await peerConnectionRef.current.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;
    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const joinRoom = useCallback(async (roomName: string) => {
    if (!ably) return;
    setIsJoining(true);

    const myClientId = ably.auth.clientId;
    setupPeerConnection(myClientId);

    const channel = ably.channels.get(`p2p-chat:${roomName}`);
    ablyChannelRef.current = channel;

    await channel.subscribe('webrtc-signal', (message: { data: SignalingMessage }) => {
      const data = message.data;
      if (data.from === myClientId) return;

      switch(data.type) {
        case 'offer':
          handleReceivedOffer(data.sdp, myClientId);
          break;
        case 'answer':
          handleReceivedAnswer(data.sdp);
          break;
        case 'ice-candidate':
          addIceCandidate(data.candidate);
          break;
      }
    });

    await channel.presence.enter();
    const members = await channel.presence.get();
    
    if (members.length === 2) {
        console.log("I'm the second to join, creating offer.");
        await startLocalStream(true, true);
        await createOffer(myClientId);
    }
    setIsJoining(false);
  }, [ably, setupPeerConnection, startLocalStream, createOffer, handleReceivedOffer, handleReceivedAnswer, addIceCandidate]);

  const sendMessage = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState === 'open') {
      const message: Omit<Message, 'sender'> = {
        id: Date.now().toString(),
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      dataChannelRef.current.send(JSON.stringify(message));
      setMessages((prev) => [...prev, { ...message, sender: 'me' }]);
    }
  }, []);

  const hangUp = useCallback(() => {
    ablyChannelRef.current?.presence.leave();
    ablyChannelRef.current?.unsubscribe();
    ablyChannelRef.current = null;
    peerConnectionRef.current?.close();
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setIsJoining(false);
    setMessages([]);
    console.log('Call ended and resources cleaned up.');
  }, [localStream, remoteStream]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoEnabled = !isVideoEnabled;
      localStream.getVideoTracks().forEach(track => {
        track.enabled = videoEnabled;
      });
      setIsVideoEnabled(videoEnabled);
    }
  }, [localStream, isVideoEnabled]);
  
  useEffect(() => {
    return () => hangUp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    localStream, remoteStream, messages, isConnected, isMuted, isVideoEnabled, isJoining,
    joinRoom, sendMessage, hangUp, toggleMute, toggleVideo,
  };
};
