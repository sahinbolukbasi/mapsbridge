"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import { ws } from "./websocket";
import { useAuth } from "./auth-context";

interface WSState {
  send: (action: string, payload?: Record<string, unknown>) => void;
  on: (action: string, handler: (data: unknown) => void) => () => void;
  isConnected: boolean;
}

const WSContext = createContext<WSState>({
  send: () => {},
  on: () => () => {},
  isConnected: false,
});

export function WSProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user?.token) {
      if (!connectedRef.current) {
        ws.connect(user.token);
        connectedRef.current = true;
      }
    } else {
      if (connectedRef.current) {
        ws.disconnect();
        connectedRef.current = false;
      }
    }
  }, [isAuthenticated, user?.token]);

  useEffect(() => {
    return () => {
      ws.disconnect();
      connectedRef.current = false;
    };
  }, []);

  return (
    <WSContext.Provider
      value={{
        send: ws.send.bind(ws),
        on: ws.on.bind(ws),
        get isConnected() {
          return ws.isConnected;
        },
      }}
    >
      {children}
    </WSContext.Provider>
  );
}

export function useWS() {
  return useContext(WSContext);
}
