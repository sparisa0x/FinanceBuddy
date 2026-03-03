import { Router } from 'express';
import supabase from '../lib/supabase.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// GET /api/wishlist – sorted by priority
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('wishlist')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const sorted = (data || []).sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
  );

  res.json(sorted);
});

// POST /api/wishlist
router.post('/', authenticate, async (req, res) => {
  const { name, estimated_cost, priority, target_date } = req.body;

  if (!name || !estimated_cost) {
    return res.status(400).json({ error: 'name and estimated_cost are required' });
  }

  const { data, error } = await supabase
    .from('wishlist')
    .insert({
      user_id: req.userId,
      name,
      estimated_cost: Number(estimated_cost),
      priority: priority || 'medium',
      target_date: target_date || null,
      is_purchased: false
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/wishlist/:id – update, including mark as purchased
router.put('/:id', authenticate, async (req, res) => {
  const { data: existing, error: findErr } = await supabase
    .from('wishlist')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (findErr || !existing) return res.status(404).json({ error: 'Wishlist item not found' });

  const { name, estimated_cost, priority, target_date, is_purchased } = req.body;
  const updates = {};
  if (name           !== undefined) updates.name           = name;
  if (estimated_cost !== undefined) updates.estimated_cost = Number(estimated_cost);
  if (priority       !== undefined) updates.priority       = priority;
  if (target_date    !== undefined) updates.target_date    = target_date;
  if (is_purchased   !== undefined) updates.is_purchased   = is_purchased;

  const { data, error } = await supabase
    .from('wishlist')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/wishlist/:id
router.delete('/:id', authenticate, async (req, res) => {
  const { data: existing, error: findErr } = await supabase
    .from('wishlist')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (findErr || !existing) return res.status(404).json({ error: 'Wishlist item not found' });

  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
