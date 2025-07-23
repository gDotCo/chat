
export type View = 'chat' | 'voice' | 'video';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'peer';
  timestamp: string;
}