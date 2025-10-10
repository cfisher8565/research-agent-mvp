interface Session {
  id: string;
  history: Array<{ role: 'user' | 'assistant'; content: any }>;
  context: Record<string, any>;
  createdAt: number;
  lastAccessedAt: number;
}

class SessionManager {
  private sessions = new Map<string, Session>();
  private readonly maxAge = 24 * 60 * 60 * 1000; // 24 hours

  getOrCreate(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        id: sessionId,
        history: [],
        context: {},
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      };
      this.sessions.set(sessionId, session);
    } else {
      session.lastAccessedAt = Date.now();
    }

    // Cleanup old sessions
    this.cleanup();

    return session;
  }

  updateContext(sessionId: string, context: Record<string, any>) {
    const session = this.getOrCreate(sessionId);
    session.context = { ...session.context, ...context };
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: any) {
    const session = this.getOrCreate(sessionId);
    session.history.push({ role, content });
    
    // Keep last 20 messages to prevent unbounded growth
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
  }

  getHistory(sessionId: string) {
    const session = this.getOrCreate(sessionId);
    return session.history;
  }

  getContext(sessionId: string) {
    const session = this.getOrCreate(sessionId);
    return session.context;
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt > this.maxAge) {
        this.sessions.delete(id);
      }
    }
  }

  stats() {
    return {
      activeSessions: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(s => ({
        id: s.id,
        messageCount: s.history.length,
        ageMinutes: Math.floor((Date.now() - s.createdAt) / 60000)
      }))
    };
  }
}

export const sessionManager = new SessionManager();
