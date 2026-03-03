import { Router } from 'express';
import supabase from '../lib/supabase.js';
import authenticate from '../middleware/authenticate.js';
import { saveNetWorthSnapshot } from '../lib/calculations.js';

const router = Router();

// GET /api/transactions – all transactions, sorted by date desc
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/transactions
router.post('/', authenticate, async (req, res) => {
  const { amount, type, category, description, date } = req.body;

  if (!amount || !type || !category) {
    return res.status(400).json({ error: 'amount, type, and category are required' });
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({ user_id: req.userId, amount: Number(amount), type, category, description, date: date || new Date().toISOString().split('T')[0] })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Fire-and-forget snapshot update
  saveNetWorthSnapshot(req.userId, supabase).catch(err =>
    console.error('Snapshot update failed:', err.message)
  );

  res.status(201).json(data);
});

// PUT /api/transactions/:id
router.put('/:id', authenticate, async (req, res) => {
  // Verify ownership
  const { data: existing, error: findErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (findErr || !existing) return res.status(404).json({ error: 'Transaction not found' });

  const { amount, type, category, description, date } = req.body;
  const updates = {};
  if (amount      !== undefined) updates.amount      = Number(amount);
  if (type        !== undefined) updates.type        = type;
  if (category    !== undefined) updates.category    = category;
  if (description !== undefined) updates.description = description;
  if (date        !== undefined) updates.date        = date;

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/transactions/:id
router.delete('/:id', authenticate, async (req, res) => {
  const { data: existing, error: findErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (findErr || !existing) return res.status(404).json({ error: 'Transaction not found' });

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
