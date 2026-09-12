import { Server } from 'socket.io';

class PresenceManager {
  // Map of userId -> Set of active socketIds (supports multiple tabs per user)
  private userSockets: Map<string, Set<string>> = new Map();
  // Map of socketId -> userId
  private socketToUser: Map<string, string> = new Map();

  public handleUserConnected(io: Server, userId: string, socketId: string) {
    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(socketId);
    this.socketToUser.set(socketId, userId);

    this.broadcastPresence(io);
  }

  public handleUserDisconnected(io: Server, socketId: string) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;

    this.socketToUser.delete(socketId);
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.broadcastPresence(io);
  }

  public getOnlineCount(): number {
    return this.userSockets.size;
  }

  public getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  private broadcastPresence(io: Server) {
    const payload = {
      onlineCount: this.getOnlineCount(),
      onlineUserIds: this.getOnlineUserIds(),
      timestamp: new Date().toISOString(),
    };

    // Presence count is broadcast to Admins (and any authenticated dashboards)
    io.to('admin:global').emit('presence:update', payload);
  }
}

export const presenceManager = new PresenceManager();
