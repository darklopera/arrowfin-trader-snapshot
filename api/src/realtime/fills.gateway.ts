import { Inject, Logger } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/token.service';
import { SNAPSHOT_REPOSITORY, SnapshotPublisherPort, SnapshotRepositoryPort, SnapshotUpdateEvent } from '../snapshot/application/ports';
import { BrokerId } from '../shared/tenant';

export const roomOf = (brokerId: string, accountId: string) => `acct:${brokerId}:${accountId}`;

/**
 * Real-time channel. Security model (the part that matters):
 *
 *  1. AUTH AT CONNECTION TIME. The handshake middleware verifies the JWT
 *     before the socket is ever "connected". No valid token, no socket. After
 *     that, individual messages are never re-authenticated because there are
 *     no inbound messages to authenticate (see 3).
 *  2. TENANT-SCOPED BY THE SERVER. The server decides which rooms the socket
 *     joins: the accounts that the token's trader owns inside the token's broker,
 *     read through the same RLS-protected repository as the REST API. The
 *     room name embeds the broker id too.
 *  3. NO CLIENT-CONTROLLED SUBSCRIPTION. There is no @SubscribeMessage handler
 *     at all, so there is nothing a client can send to join another trader's or
 *     another broker's room. "Can a client subscribe to someone else's stream?"
 *     is answered by the absence of an API, not by a check that could be forgotten.
 *  4. TOKEN LIFETIME BOUNDS THE SOCKET. A socket outlives the JWT only until
 *     `exp`; then the server disconnects it and the client must reconnect with
 *     a fresh token (which also re-checks who still owns what).
 *  5. MINIMAL PAYLOAD. Events carry the same snapshot the REST API returns
 *     (no balance, no names, masked account number) plus the last fill.
 */
@WebSocketGateway()
export class FillsGateway implements OnGatewayInit, SnapshotPublisherPort {
  private readonly logger = new Logger('ws');
  @WebSocketServer() private server!: Server;

  constructor(
    private readonly tokens: TokenService,
    @Inject(SNAPSHOT_REPOSITORY) private readonly repo: SnapshotRepositoryPort,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      try {
        // Token only from the handshake `auth` payload: never the URL, which ends up in proxy and access logs.
        const token = socket.handshake.auth?.token;
        if (typeof token !== 'string') throw new Error('no token');
        const { scope, expiresAt } = this.tokens.verify(token);

        const accounts = await this.repo.listAccounts(scope);
        for (const a of accounts) await socket.join(roomOf(scope.brokerId, a.id));

        const ttlMs = expiresAt * 1000 - Date.now();
        const timer = setTimeout(() => socket.disconnect(true), Math.max(ttlMs, 0));
        timer.unref();
        socket.on('disconnect', () => clearTimeout(timer));

        this.logger.log(`connected trader=${scope.traderId} broker=${scope.brokerId} rooms=${accounts.length}`);
        next();
      } catch {
        // Generic on purpose: the client learns nothing about why.
        next(new Error('unauthorized'));
      }
    });
  }

  publish(brokerId: BrokerId, event: SnapshotUpdateEvent): void {
    this.server.to(roomOf(brokerId, event.accountId)).emit('snapshot:update', event);
  }
}
