import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import { chatSocketClient, type ChatRealtimeEnvelope, type RealtimeConnectionState } from '@shared/ws/chatSocket';

type ChatRealtimeContextValue = {
  client: typeof chatSocketClient;
  connectionState: RealtimeConnectionState;
  onEvent: (listener: (event: ChatRealtimeEnvelope) => void) => () => void;
};

const ChatRealtimeContext = createContext<ChatRealtimeContextValue | undefined>(undefined);

export const ChatRealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(chatSocketClient.getState());

  useEffect(() => {
    const unsubscribe = chatSocketClient.onStateChange(setConnectionState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (session?.token) {
      chatSocketClient.connect(session.token);
      return;
    }
    chatSocketClient.disconnect();
  }, [session?.token]);

  const value = useMemo<ChatRealtimeContextValue>(
    () => ({
      client: chatSocketClient,
      connectionState,
      onEvent: (listener: (event: ChatRealtimeEnvelope) => void) => chatSocketClient.onEvent(listener)
    }),
    [connectionState]
  );

  return <ChatRealtimeContext.Provider value={value}>{children}</ChatRealtimeContext.Provider>;
};

export const useChatRealtime = () => {
  const context = useContext(ChatRealtimeContext);
  if (!context) {
    throw new Error('useChatRealtime must be used within ChatRealtimeProvider');
  }
  return context;
};
