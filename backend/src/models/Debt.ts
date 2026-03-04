import { getSupabase } from '../config/db.js';

export const Debt = {
  async create(input: any) {
    const sb = getSupabase();
    const { data, error } = await sb.from('debts').insert({
      id: input.id || crypto.randomUUID(),
      user_id: input.userId,
      name: input.creditor || input.name,
      type: input.type || 'other',
      total_amount: input.amount || input.totalAmount || 0,
      remaining_amount: input.remainingAmount || input.amount || 0,
      interest_rate: input.interestRate || 0,
      monthly_emi: input.monthlyEMI || 0,
      due_date: input.dueDate ? 1 : 1,
      is_paused: input.isPaused || false,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async find(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('debts').select('*');
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.order('created_at', { ascending: false });
    return { sort: () => data || [], data: data || [] };
  },

  async findOneAndDelete(filter: { _id?: string; userId?: string }) {
    const sb = getSupabase();
    let query = sb.from('debts').delete();
    if (filter._id) query = query.eq('id', filter._id);
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { data } = await query.select().single();
    return data;
  },
};
