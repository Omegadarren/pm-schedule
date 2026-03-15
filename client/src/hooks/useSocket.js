import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export function useSocket(projectId, { onTaskUpdated, onTaskAdded, onTaskDeleted } = {}) {
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef({ onTaskUpdated, onTaskAdded, onTaskDeleted });

  useEffect(() => {
    callbacksRef.current = { onTaskUpdated, onTaskAdded, onTaskDeleted };
  });

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io('/', { transports: ['websocket'], autoConnect: true });
    }
    const socket = socketInstance;

    const onConnect = () => {
      setConnected(true);
      if (projectId) socket.emit('join:project', projectId);
    };
    const onDisconnect = () => setConnected(false);
    const onUpdated = (task) => callbacksRef.current.onTaskUpdated?.(task);
    const onAdded   = (task) => callbacksRef.current.onTaskAdded?.(task);
    const onDeleted = (id)   => callbacksRef.current.onTaskDeleted?.(id);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('task:updated', onUpdated);
    socket.on('task:added', onAdded);
    socket.on('task:deleted', onDeleted);

    if (socket.connected) {
      setConnected(true);
      if (projectId) socket.emit('join:project', projectId);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('task:updated', onUpdated);
      socket.off('task:added', onAdded);
      socket.off('task:deleted', onDeleted);
      if (projectId) socket.emit('leave:project', projectId);
    };
  }, [projectId]);

  const emitTaskUpdate = (task) => {
    if (socketInstance && projectId) {
      socketInstance.emit('task:update', { projectId, task });
    }
  };

  const emitTaskAdd = (task) => {
    if (socketInstance && projectId) {
      socketInstance.emit('task:add', { projectId, task });
    }
  };

  const emitTaskDelete = (taskId) => {
    if (socketInstance && projectId) {
      socketInstance.emit('task:delete', { projectId, taskId });
    }
  };

  return { connected, emitTaskUpdate, emitTaskAdd, emitTaskDelete };
}

/** Return the current socket ID (used to suppress echo on REST calls) */
export function getSocketId() {
  return socketInstance?.id || null;
}
