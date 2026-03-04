import { getSupabase } from '../config/db.js';

export const Wishlist = {
  async create(input: any) {
    const sb = getSupabase();
    const { data, error } = await sb.from('wishlist').insert({
      id: input.id || crypto.randomUUID(),
      user_id: input.userId,
      name: input.itemName || input.name,
      category: input.category || 'want',
      estimated_cost: input.targetAmount || input.estimatedCost || 0,
      priority: input.priority || 'medium',
      status: input.status || 'added',
      view_count: input.viewCount || 0,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async find(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('wishlist').select('*');
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.order('created_at', { ascending: false });
    return { sort: () => data || [], data: data || [] };
  },

  async findOneAndDelete(filter: { _id?: string; userId?: string }) {
    const sb = getSupabase();
    let query = sb.from('wishlist').delete();
    if (filter._id) query = query.eq('id', filter._id);
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.select().single();
    return data;
  },
};
