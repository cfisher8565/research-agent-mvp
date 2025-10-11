/**
 * Redis Session Manager for Persistent Session Storage
 *
 * Replaces in-memory session storage with Redis for:
 * - Session persistence across agent restarts
 * - Multi-instance agent deployments
 * - 24-hour session TTL with automatic cleanup
 * - Conversation history (last 20 messages)
 */

import Redis from 'ioredis';

interface Session {
  id: string;
  history: Array<{ role: 'user' | 'assistant'; content: any }>;
  context: Record<string, any>;
  createdAt: number;
  lastAccessedAt: number;
  metadata?: {
    turnCount: number;
    toolsUsed: string[];
    totalTokens: number;
    cachedTokens: number;
  };
}

export class RedisSessionManager {
  private redis: Redis;
  private ttl: number = 86400; // 24 hours in seconds
  private readonly maxHistorySize = 20; // Keep last 20 messages

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

    this.redis = new Redis(url, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`[Redis] Retry attempt ${times}, waiting ${delay}ms...`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    this.redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    this.redis.on('ready', () => {
      console.log('[Redis] Ready for operations');
    });

    this.redis.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });
  }

  /**
   * Get existing session or create new one
   */
  async getOrCreate(sessionId: string): Promise<Session> {
    try {
      const cached = await this.redis.get(`session:${sessionId}`);

      if (cached) {
        const session = JSON.parse(cached) as Session;
        session.lastAccessedAt = Date.now();

        // Update last accessed time
        await this.redis.setex(
          `session:${sessionId}`,
          this.ttl,
          JSON.stringify(session)
        );

        console.log(`[Session] Loaded from Redis: ${sessionId} (${session.history.length} messages)`);
        return session;
      }

      // Create new session
      const newSession: Session = {
        id: sessionId,
        history: [],
        context: {},
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        metadata: {
          turnCount: 0,
          toolsUsed: [],
          totalTokens: 0,
          cachedTokens: 0,
        },
      };

      await this.redis.setex(
        `session:${sessionId}`,
        this.ttl,
        JSON.stringify(newSession)
      );

      console.log(`[Session] Created in Redis: ${sessionId}`);
      return newSession;

    } catch (error: any) {
      console.error('[Session] Redis error, using in-memory fallback:', error.message);

      // Fallback to in-memory session on Redis error
      return {
        id: sessionId,
        history: [],
        context: {},
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        metadata: {
          turnCount: 0,
          toolsUsed: [],
          totalTokens: 0,
          cachedTokens: 0,
        },
      };
    }
  }

  /**
   * Update session with partial data
   */
  async update(sessionId: string, updates: Partial<Session>): Promise<void> {
    try {
      const session = await this.getOrCreate(sessionId);

      Object.assign(session, updates, {
        lastAccessedAt: Date.now(),
      });

      // Prune old messages (keep last N)
      if (session.history.length > this.maxHistorySize) {
        session.history = session.history.slice(-this.maxHistorySize);
        console.log(`[Session] Pruned history to ${this.maxHistorySize} messages`);
      }

      await this.redis.setex(
        `session:${sessionId}`,
        this.ttl,
        JSON.stringify(session)
      );

      console.log(`[Session] Updated in Redis: ${sessionId}`);

    } catch (error: any) {
      console.error('[Session] Error updating session:', error.message);
    }
  }

  /**
   * Update session context (from Claude Code)
   */
  async updateContext(sessionId: string, context: Record<string, any>): Promise<void> {
    const session = await this.getOrCreate(sessionId);
    session.context = { ...session.context, ...context };
    await this.update(sessionId, session);
  }

  /**
   * Add message to conversation history
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: any
  ): Promise<void> {
    const session = await this.getOrCreate(sessionId);

    session.history.push({ role, content });

    // Update metadata
    if (session.metadata) {
      session.metadata.turnCount++;

      // Track tool usage
      if (Array.isArray(content)) {
        const toolUses = content.filter((c: any) => c.type === 'tool_use');
        toolUses.forEach((t: any) => {
          if (!session.metadata?.toolsUsed.includes(t.name)) {
            session.metadata?.toolsUsed.push(t.name);
          }
        });
      }
    }

    await this.update(sessionId, session);
  }

  /**
   * Get conversation history
   */
  async getHistory(sessionId: string): Promise<Array<{ role: 'user' | 'assistant'; content: any }>> {
    const session = await this.getOrCreate(sessionId);
    return session.history;
  }

  /**
   * Get session context
   */
  async getContext(sessionId: string): Promise<Record<string, any>> {
    const session = await this.getOrCreate(sessionId);
    return session.context;
  }

  /**
   * Update session metadata (tokens, tools used, etc.)
   */
  async updateMetadata(
    sessionId: string,
    metadata: Partial<Session['metadata']>
  ): Promise<void> {
    const session = await this.getOrCreate(sessionId);

    session.metadata = {
      ...session.metadata,
      ...metadata,
    } as Session['metadata'];

    await this.update(sessionId, session);
  }

  /**
   * Delete session from Redis
   */
  async clear(sessionId: string): Promise<void> {
    try {
      await this.redis.del(`session:${sessionId}`);
      console.log(`[Session] Deleted from Redis: ${sessionId}`);
    } catch (error: any) {
      console.error('[Session] Error deleting session:', error.message);
    }
  }

  /**
   * List all active session IDs
   */
  async list(): Promise<string[]> {
    try {
      const keys = await this.redis.keys('session:*');
      return keys.map(k => k.replace('session:', ''));
    } catch (error: any) {
      console.error('[Session] Error listing sessions:', error.message);
      return [];
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanup(maxAgeMs: number = 86400000): Promise<number> {
    const sessions = await this.list();
    let cleaned = 0;

    for (const sessionId of sessions) {
      try {
        const session = await this.getOrCreate(sessionId);
        const age = Date.now() - session.lastAccessedAt;

        if (age > maxAgeMs) {
          await this.clear(sessionId);
          cleaned++;
        }
      } catch (error: any) {
        console.error(`[Session] Error cleaning ${sessionId}:`, error.message);
      }
    }

    if (cleaned > 0) {
      console.log(`[Session] Cleaned ${cleaned} expired sessions`);
    }

    return cleaned;
  }

  /**
   * Get session statistics
   */
  async stats(): Promise<{
    activeSessions: number;
    sessions: Array<{
      id: string;
      messageCount: number;
      ageMinutes: number;
      turnCount: number;
      toolsUsed: number;
    }>;
    oldestSession?: number;
    newestSession?: number;
    totalMessages: number;
  }> {
    const sessions = await this.list();

    let oldestSession = Date.now();
    let newestSession = 0;
    let totalMessages = 0;

    const sessionDetails = [];

    for (const sessionId of sessions) {
      try {
        const session = await this.getOrCreate(sessionId);

        if (session.createdAt < oldestSession) {
          oldestSession = session.createdAt;
        }
        if (session.createdAt > newestSession) {
          newestSession = session.createdAt;
        }

        totalMessages += session.history.length;

        sessionDetails.push({
          id: sessionId,
          messageCount: session.history.length,
          ageMinutes: Math.floor((Date.now() - session.createdAt) / 60000),
          turnCount: session.metadata?.turnCount || 0,
          toolsUsed: session.metadata?.toolsUsed.length || 0,
        });
      } catch (error: any) {
        console.error(`[Session] Error getting stats for ${sessionId}:`, error.message);
      }
    }

    return {
      activeSessions: sessions.length,
      sessions: sessionDetails,
      oldestSession: sessions.length > 0 ? oldestSession : undefined,
      newestSession: sessions.length > 0 ? newestSession : undefined,
      totalMessages,
    };
  }

  /**
   * Get Redis connection info
   */
  getConnectionInfo(): { status: string; url: string } {
    return {
      status: this.redis.status,
      url: this.redis.options.host + ':' + this.redis.options.port,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    console.log('[Redis] Connection closed');
  }
}

// Export singleton instance
export const sessionManager = new RedisSessionManager();
