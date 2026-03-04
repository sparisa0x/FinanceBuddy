import { getSupabase } from '../config/db.js';

export const Investment = {
  async create(input: any) {
    const sb = getSupabase();
    const { data, error } = await sb.from('investments').insert({
      id: input.id || crypto.randomUUID(),
      user_id: input.userId,
      name: input.name || '',
      type: input.type,
      invested_amount: input.investedAmount,
      current_value: input.currentValue,
      last_updated: new Date().toISOString().split('T')[0],
    }).select().single();
    if (error) throw error;
    return data;
  },

  async find(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('investments').select('*');
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.order('created_at', { ascending: false });
    return { sort: () => data || [], data: data || [] };
  },

  async findOneAndDelete(filter: { _id?: string; userId?: string }) {
    const sb = getSupabase();
    let query = sb.from('investments').delete();
    if (filter._id) query = query.eq('id', filter._id);
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.select().single();
    return data;
  },
};
