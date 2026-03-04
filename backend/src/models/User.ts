// Supabase "users" table helper
// Table: users (id UUID PK, username, email, password, display_name, is_admin, is_approved, is_active, credit_scores JSONB, created_at)

import { getSupabase } from '../config/db.js';

export const User = {
  async findOne(filter: Record<string, any>) {
    const sb = getSupabase();
    let query = sb.from('users').select('*');
    for (const [key, value] of Object.entries(filter)) {
      if (key === '$or') {
        // Handle $or by returning first match
        for (const cond of value as any[]) {
          for (const [k, v] of Object.entries(cond)) {
            const col = k === 'displayName' ? 'display_name' : k === 'isAdmin' ? 'is_admin' : k === 'isApproved' ? 'is_approved' : k === 'isActive' ? 'is_active' : k;
            const { data } = await sb.from('users').select('*').eq(col, v).single();
            if (data) return mapUser(data);
          }
        }
        return null;
      }
      const col = mapCol(key);
      query = query.eq(col, value);
    }
    const { data } = await query.single();
    return data ? mapUser(data) : null;
  },

  async findById(id: string) {
    const sb = getSupabase();
    const { data } = await sb.from('users').select('*').eq('id', id).single();
    return data ? mapUser(data) : null;
  },

  async findByIdAndUpdate(id: string, updates: Record<string, any>) {
    const sb = getSupabase();
    const mapped: any = {};
    for (const [k, v] of Object.entries(updates)) mapped[mapCol(k)] = v;
    const { data } = await sb.from('users').update(mapped).eq('id', id).select().single();
    return data ? mapUser(data) : null;
  },

  async create(input: any) {
    const sb = getSupabase();
    const { data, error } = await sb.from('users').insert({
      username: input.username,
      email: input.email,
      password: input.password, // caller must hash before calling
      display_name: input.displayName || 'User',
      is_admin: input.isAdmin ?? false,
      is_approved: input.isApproved ?? false,
      is_active: input.isActive ?? true,
      credit_scores: input.creditScores || {},
    }).select().single();
    if (error) throw error;
    return mapUser(data);
  },
};

function mapCol(key: string): string {
  const map: Record<string, string> = {
    displayName: 'display_name', isAdmin: 'is_admin',
    isApproved: 'is_approved', isActive: 'is_active',
    creditScores: 'credit_scores', createdAt: 'created_at',
  };
  return map[key] || key;
}

function mapUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password: row.password,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    isApproved: row.is_approved,
    isActive: row.is_active,
    creditScores: row.credit_scores,
    createdAt: row.created_at,
  };
}
