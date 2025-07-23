
export type View = 'chat' | 'voice' | 'video';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'peer';
  timestamp: string;
}

export type SignalingMessage =
  | { type: 'offer'; sdp: string; from: string }
  | { type: 'answer'; sdp: string; from: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; from: string };
