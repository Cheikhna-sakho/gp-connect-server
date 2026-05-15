import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { jwtConstants } from 'src/auth/constants';
import { JwtPayload } from 'src/auth/types/jwt.type';
import { DatabaseService } from 'src/database/database.service';
import { MessagesService } from 'src/messages/messages.service';
import { CreateMessageDto } from 'src/messages/dtos/message.dto';

export type AuthenticatedSocket = Socket & { data: { userId: string } };

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
    private readonly messagesService: MessagesService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      // Priorité : cookie httpOnly `at`, sinon Bearer header (mobile)
      const cookieHeader = client.handshake.headers?.cookie ?? '';
      const cookieToken = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('at='))
        ?.slice(3);

      const raw =
        cookieToken ??
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization ?? '';
      const token = raw.replace(/^Bearer\s+/i, '');

      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: jwtConstants.ACCESS_TOKEN_PUBLIC,
        algorithms: ['RS256'],
      });

      (client as AuthenticatedSocket).data.userId = payload.id;
      // Personal room — allows targeting a specific user directly
      client.join(`user:${payload.id}`);
      this.logger.log(`Client connected: ${client.id} (user ${payload.id})`);
    } catch {
      this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Room management ──────────────────────────────────────────────────────

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    const userId = client.data.userId;
    const allowed = await this.db.conversation.count({
      where: {
        id: conversationId,
        OR: [{ shipperId: userId }, { carrierId: userId }],
      },
    });

    if (!allowed) {
      client.emit('error', { message: 'Not a participant of this conversation' });
      return;
    }

    await client.join(conversationId);
    this.logger.log(`User ${userId} joined room ${conversationId}`);
    return { event: 'joined', data: { conversationId } };
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    await client.leave(conversationId);
    return { event: 'left', data: { conversationId } };
  }

  // ─── Send message via WebSocket ───────────────────────────────────────────

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: CreateMessageDto,
  ) {
    const userId = client.data.userId;

    // Verify participant before saving
    const inRoom = client.rooms.has(data.conversationId);
    if (!inRoom) {
      client.emit('error', { message: 'Join the conversation first' });
      return;
    }

    const message = await this.messagesService.create({
      ...data,
      authorId: userId as any,
    });

    // Broadcast to the room (handled by @OnEvent listener below,
    // but we also return ACK to the sender immediately)
    return { event: 'message:sent', data: message };
  }

  // ─── Typing indicators ────────────────────────────────────────────────────

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    client.to(conversationId).emit('typing', {
      userId: client.data.userId,
      conversationId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    client.to(conversationId).emit('typing', {
      userId: client.data.userId,
      conversationId,
      isTyping: false,
    });
  }

  // ─── EventEmitter listeners — bridge from REST ────────────────────────────

  @OnEvent('message.created')
  broadcastNewMessage(payload: { message: any; conversationId: string }) {
    this.server
      .to(payload.conversationId)
      .emit('message:new', payload.message);
  }

  @OnEvent('offer.updated')
  broadcastOfferUpdate(payload: { offer: any; conversationId: string }) {
    this.server.to(payload.conversationId).emit('offer:updated', payload.offer);
  }

  @OnEvent('mission.status-changed')
  broadcastMissionStatusChanged(payload: {
    missionId: string;
    status: string;
    conversationIds: string[];
  }) {
    for (const conversationId of payload.conversationIds) {
      this.server.to(conversationId).emit('mission:status-changed', {
        missionId: payload.missionId,
        status: payload.status,
      });
    }
  }

  @OnEvent('proof.verified')
  broadcastProofVerified(payload: {
    missionId: string;
    type: string;
    conversationIds: string[];
  }) {
    for (const conversationId of payload.conversationIds) {
      this.server.to(conversationId).emit('proof:verified', {
        missionId: payload.missionId,
        type: payload.type,
      });
    }
  }

  @OnEvent('stats.updated')
  broadcastStatsUpdated(payload: { userIds: string[] }) {
    for (const userId of payload.userIds) {
      this.server.to(`user:${userId}`).emit('stats:updated', {});
    }
  }

  // Called externally by other services that need to push to a room
  emit(event: string, conversationId: string, data: unknown) {
    this.server.to(conversationId).emit(event, data);
  }
}
