import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
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
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Server, Socket } from 'socket.io';
import { jwtConstants } from 'src/auth/constants';
import { JwtPayload } from 'src/auth/types/jwt.type';
import { DatabaseService } from 'src/database/database.service';
import { MessageEntity } from 'src/messages/entities/message.entity';

export type AuthenticatedSocket = Socket & { data: { userId: string } };

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
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
        client.handshake.headers?.authorization ??
        '';
      const token = raw.replace(/^Bearer\s+/i, '');

      if (!token) throw new Error('No token');

      // CSWSH : une connexion authentifiée par le cookie (credential ambient)
      // depuis une origine tierce = hijacking. On refuse si l'auth vient du
      // cookie ET que l'Origin est présente mais étrangère. Les clients natifs
      // (sans Origin) ou Bearer (non-ambient) ne sont pas concernés.
      const origin = client.handshake.headers?.origin;
      const allowedOrigin = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      if (cookieToken && origin && origin !== allowedOrigin) {
        throw new Error('Cross-site WebSocket blocked');
      }

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
      client.emit('error', {
        message: 'Not a participant of this conversation',
      });
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

  // La persistance des messages passe exclusivement par REST (POST /messages),
  // seul point d'entrée qui applique toutes les gardes métier. Le gateway ne
  // sert qu'au temps réel (rooms, typing, broadcast).

  // ─── Typing indicators ────────────────────────────────────────────────────

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    // N'émettre que vers une room que l'on a effectivement rejointe (donc dont
    // on est participant, cf. handleJoin) : évite le spoof d'indicateur typing.
    if (!client.rooms.has(conversationId)) return;
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
    if (!client.rooms.has(conversationId)) return;
    client.to(conversationId).emit('typing', {
      userId: client.data.userId,
      conversationId,
      isTyping: false,
    });
  }

  // ─── EventEmitter listeners — bridge from REST ────────────────────────────

  @OnEvent('message.created')
  broadcastNewMessage(payload: { message: any; conversationId: string }) {
    // Même forme que le REST (@Serialize(MessageEntity) + interceptor
    // global) : sans ça, le socket émettait l'objet Prisma brut — medias en
    // [{ media: { url } }] au lieu de string[], et le front ne rendait pas
    // les messages MEDIA reçus en direct (seulement après reload).
    const message = instanceToPlain(
      plainToInstance(MessageEntity, payload.message, {
        excludeExtraneousValues: true,
        exposeUnsetFields: false,
      }),
    );
    this.server.to(payload.conversationId).emit('message:new', message);
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
