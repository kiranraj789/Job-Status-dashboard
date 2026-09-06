import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { EVENTS } from '../socketEvents';
import { SEVERITY } from '../constants';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit(EVENTS.SUBSCRIBE_ALL);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on(EVENTS.ALERT_NEW, (alert) => {
      toast.error(`🚨 ${alert.type}: ${alert.jobName || 'System Alert'}`, {
        duration: 5000,
        style: {
          background: alert.severity === 'critical' ? SEVERITY.critical.color : SEVERITY.warning.color,
          color: '#fff'
        }
      });
    });

    newSocket.on(EVENTS.JOB_STATUS_CHANGE, (data) => {
      console.log('Job status changed:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
