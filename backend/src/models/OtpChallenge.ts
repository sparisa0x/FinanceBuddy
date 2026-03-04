import { getSupabase } from '../config/db.js';

export const OtpChallenge = {
  async findOne(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('otp_challenges').select('*');
    if (filter.userId) query = query.eq('user_id', filter.userId);
    if (filter.email) query = query.eq('email', filter.email);
    if (filter.purpose) query = query.eq('purpose', filter.purpose);
    const { data } = await query.single();
    if (!data) return null;
    return {
      ...data,
      id: data.email, // PK
      userId: data.user_id,
      codeHash: data.code_hash,
      expiresAt: new Date(data.expires_at),
      attempts: data.attempts || 0,
      async save() {
        await sb.from('otp_challenges').update({ attempts: this.attempts }).eq('email', data.email);
      },
    };
  },

  async create(input: any) {
    const sb = getSupabase();
    const { data, error } = await sb.from('otp_challenges').upsert({
      email: input.email,
      user_id: input.userId || null,
      purpose: input.purpose,
      code_hash: input.codeHash,
      expires_at: input.expiresAt instanceof Date ? input.expiresAt.toISOString() : input.expiresAt,
      attempts: 0,
    }, { onConflict: 'email' }).select().single();
    if (error) throw error;
    return data;
  },

  async deleteOne(filter: { _id?: string; email?: string }) {
    const sb = getSupabase();
    const key = filter._id || filter.email;
    if (key) await sb.from('otp_challenges').delete().eq('email', key);
  },

  async deleteMany(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('otp_challenges').delete();
    if (filter.email) query = query.eq('email', filter.email);
    if (filter.userId) query = query.eq('user_id', filter.userId);
    if (filter.purpose) query = query.eq('purpose', filter.purpose);
    await query;
  },
};
