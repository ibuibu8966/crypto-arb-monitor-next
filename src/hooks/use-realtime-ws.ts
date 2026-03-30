"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { RealtimeRow } from "@/types";

type WSMessage = {
  type: "spreads";
  timestamp: string;
  data: RealtimeRow[];
};

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 10000];

export function useRealtimeWS() {
  const [data, setData] = useState<RealtimeRow[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (!WS_URL || unmountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.type === "spreads") {
            setData(msg.data);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (unmountedRef.current) return;

        // 指数バックオフで再接続
        const delay =
          RECONNECT_DELAYS[
            Math.min(retryCountRef.current, RECONNECT_DELAYS.length - 1)
          ];
        retryCountRef.current++;
        retryTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // connect error → retry
      const delay =
        RECONNECT_DELAYS[
          Math.min(retryCountRef.current, RECONNECT_DELAYS.length - 1)
        ];
      retryCountRef.current++;
      retryTimerRef.current = setTimeout(connect, delay);
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { data, isConnected };
}
