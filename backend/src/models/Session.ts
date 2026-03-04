import { getSupabase } from '../config/db.js';

export const Session = {
  async create(input: any) {
    const sb = getSupabase();
    const { data, error } = await sb.from('sessions').insert({
      session_id: input.sessionId,
      user_id: input.userId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt instanceof Date ? input.expiresAt.toISOString() : input.expiresAt,
      ip: input.ip || '',
      user_agent: input.userAgent || '',
    }).select().single();
    if (error) throw error;
    return data;
  },

  async findOne(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('sessions').select('*');
    if (filter.sessionId) query = query.eq('session_id', filter.sessionId);
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.single();
    if (!data) return null;
    return {
      ...data,
      id: data.session_id,
      sessionId: data.session_id,
      userId: data.user_id,
      tokenHash: data.token_hash,
      expiresAt: new Date(data.expires_at),
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
      revokedAt: data.revoked_at ? new Date(data.revoked_at) : null,
      async save() {
        await sb.from('sessions').update({
          token_hash: this.tokenHash,
          last_used_at: new Date().toISOString(),
        }).eq('session_id', data.session_id);
      },
    };
  },

  async findOneAndDelete(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('sessions').delete();
    if (filter.sessionId) query = query.eq('session_id', filter.sessionId);
    if (filter.userId) query = query.eq('user_id', filter.userId);
    await query;
  },

  async deleteOne(filter: { _id?: string; session_id?: string }) {
    const sb = getSupabase();
    const key = filter._id || filter.session_id;
    if (key) await sb.from('sessions').delete().eq('session_id', key);
  },
};
