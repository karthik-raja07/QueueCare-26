import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Patient, QueueStats } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  patients: Patient[];
  stats: QueueStats | null;
  predictions: { [patientId: string]: { tokensAhead: number; estWaitMinutes: number } };
  reconnectCount: number;
  triggerRefresh: () => Promise<void>;
  // Toast notifications for WebSocket events
  lastEvent: { name: string; timestamp: number; payload: any } | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [predictions, setPredictions] = useState<{ [patientId: string]: { tokensAhead: number; estWaitMinutes: number } }>({});
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<{ name: string; timestamp: number; payload: any } | null>(null);

  // Fallback to fetch initial state via API with robust retries
  const fetchStateDirectly = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const patientsRes = await fetch('/api/patients');
        if (!patientsRes.ok) throw new Error(`Patients status ${patientsRes.status}`);
        const patientsData = await patientsRes.json();
        setPatients(patientsData);

        const statsRes = await fetch('/api/queue/stats');
        if (!statsRes.ok) throw new Error(`Stats status ${statsRes.status}`);
        const statsData = await statsRes.json();
        setStats(statsData);

        const predRes = await fetch('/api/queue/predictions');
        if (!predRes.ok) throw new Error(`Predictions status ${predRes.status}`);
        const predData = await predRes.json();
        setPredictions(predData);

        return; // Success, exit retry loop
      } catch (err) {
        console.warn(`Attempt ${i + 1} to load REST fallback sync failed:`, err);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    console.error('Failed to load REST fallback sync after maximum retries');
  };

  useEffect(() => {
    // Init Socket client connected to server on same host/port
    const socketUrl = window.location.origin;
    const socketInstance = io(socketUrl, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      autoConnect: true,
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setReconnectCount(0);
      console.log('Socket.IO connected inside App');
      // Request clean sync
      fetchStateDirectly();
    });

    socketInstance.on('connect_error', () => {
      setIsConnected(false);
      setIsConnecting(true);
      setReconnectCount((prev) => prev + 1);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      setIsConnecting(false);
    });

    // Custom Mass Sync state event
    socketInstance.on('syncState', (data: { patients: Patient[]; stats: QueueStats; predictions: any }) => {
      if (data.patients) setPatients(data.patients);
      if (data.stats) setStats(data.stats);
      if (data.predictions) setPredictions(data.predictions);
    });

    // Live sync individual update events
    socketInstance.on('queueUpdated', (data: { patients: Patient[]; predictions: any }) => {
      if (data.patients) setPatients(data.patients);
      if (data.predictions) setPredictions(data.predictions);
    });

    socketInstance.on('analyticsUpdated', (statsData: QueueStats) => {
      setStats(statsData);
    });

    // Handle incoming transaction toasts
    const registerEvent = (name: string, payload: any) => {
      setLastEvent({ name, timestamp: Date.now(), payload });
    };

    socketInstance.on('patientAdded', (p) => registerEvent('Patient Registered', p));
    socketInstance.on('tokenCalled', (details) => registerEvent('Token Called', details));
    socketInstance.on('tokenSkipped', (p) => registerEvent('Token Skipped', p));
    socketInstance.on('tokenRecalled', (details) => registerEvent('Token Recalled', details));
    socketInstance.on('consultationStarted', (p) => registerEvent('Consultation Started', p));
    socketInstance.on('consultationCompleted', (p) => registerEvent('Consultation Completed', p));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const triggerRefresh = async () => {
    await fetchStateDirectly();
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isConnecting,
        patients,
        stats,
        predictions,
        reconnectCount,
        triggerRefresh,
        lastEvent,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
