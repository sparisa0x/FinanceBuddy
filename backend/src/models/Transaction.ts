import { getSupabase } from '../config/db.js';

export const Transaction = {
  async create(input: any) {
    const sb = getSupabase();
    const { data, error } = await sb.from('transactions').insert({
      id: input.id || crypto.randomUUID(),
      user_id: input.userId,
      type: input.type,
      category: input.category,
      amount: input.amount,
      description: input.note || input.description || '',
      date: input.date ? new Date(input.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    }).select().single();
    if (error) throw error;
    return data;
  },

  async find(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('transactions').select('*');
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.order('created_at', { ascending: false });
    return { sort: () => data || [], data: data || [] };
  },

  async findOneAndDelete(filter: { _id?: string; userId?: string }) {
    const sb = getSupabase();
    let query = sb.from('transactions').delete();
    if (filter._id) query = query.eq('id', filter._id);
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.select().single();
    return data;
  },
};
