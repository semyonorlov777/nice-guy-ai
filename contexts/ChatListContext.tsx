"use client";

import { createContext, useCallback, useContext, useRef } from "react";

interface ChatListContextType {
  refreshChatList: () => void;
  onRefresh: (callback: () => void) => () => void;
}

const ChatListContext = createContext<ChatListContextType>({
  refreshChatList: () => {},
  onRefresh: () => () => {},
});

export function ChatListProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<() => void>>(new Set());

  const refreshChatList = useCallback(() => {
    listenersRef.current.forEach((cb) => cb());
  }, []);

  const onRefresh = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  return (
    <ChatListContext.Provider value={{ refreshChatList, onRefresh }}>
      {children}
    </ChatListContext.Provider>
  );
}

export const useChatListRefresh = () => useContext(ChatListContext);
