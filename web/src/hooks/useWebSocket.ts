import { useEffect, useRef, useCallback } from 'react';
import { useTrafficStore } from '../stores/trafficStore';
import type { RequestSummary, TrafficStats } from '../types';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const addRequest = useTrafficStore((s) => s.addRequest);
  const updateRequest = useTrafficStore((s) => s.updateRequest);
  const updateStats = useTrafficStore((s) => s.updateStats);
  const setWsConnected = useTrafficStore((s) => s.setWsConnected);
  const isCapturing = useTrafficStore((s) => s.isCapturing);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isCapturing) return;
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'new_request':
              addRequest(msg.data as RequestSummary);
              break;
            case 'update_request':
              updateRequest(msg.data as RequestSummary);
              break;
            case 'stats_update':
              updateStats(msg.data as TrafficStats);
              break;
          }
        } catch {

        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    }
  }, [addRequest, updateRequest, updateStats, setWsConnected, isCapturing]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
