import { Router } from 'express';
import supabase from '../lib/supabase.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

// GET /api/investments – all investments with gain/loss %
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const enriched = (data || []).map(inv => {
    const gain        = Number(inv.current_value) - Number(inv.invested_amount);
    const gainPercent = inv.invested_amount > 0
      ? parseFloat(((gain / Number(inv.invested_amount)) * 100).toFixed(2))
      : 0;
    return { ...inv, gain_loss: parseFloat(gain.toFixed(2)), gain_loss_pct: gainPercent };
  });

  res.json(enriched);
});

// POST /api/investments
router.post('/', authenticate, async (req, res) => {
  const { name, type, invested_amount, current_value, date, notes } = req.body;

  if (!name || !type || !invested_amount || current_value === undefined || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('investments')
    .insert({
      user_id: req.userId,
      name,
      type,
      invested_amount: Number(invested_amount),
      current_value:   Number(current_value),
      date,
      notes: notes || null
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const gain        = Number(data.current_value) - Number(data.invested_amount);
  const gainPercent = data.invested_amount > 0
    ? parseFloat(((gain / Number(data.invested_amount)) * 100).toFixed(2))
    : 0;

  res.status(201).json({ ...data, gain_loss: parseFloat(gain.toFixed(2)), gain_loss_pct: gainPercent });
});

// PUT /api/investments/:id – update current_value (or other fields)
router.put('/:id', authenticate, async (req, res) => {
  const { data: existing, error: findErr } = await supabase
    .from('investments')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (findErr || !existing) return res.status(404).json({ error: 'Investment not found' });

  const { name, type, invested_amount, current_value, date, notes } = req.body;
  const updates = {};
  if (name            !== undefined) updates.name            = name;
  if (type            !== undefined) updates.type            = type;
  if (invested_amount !== undefined) updates.invested_amount = Number(invested_amount);
  if (current_value   !== undefined) updates.current_value   = Number(current_value);
  if (date            !== undefined) updates.date            = date;
  if (notes           !== undefined) updates.notes           = notes;

  const { data, error } = await supabase
    .from('investments')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const gain        = Number(data.current_value) - Number(data.invested_amount);
  const gainPercent = data.invested_amount > 0
    ? parseFloat(((gain / Number(data.invested_amount)) * 100).toFixed(2))
    : 0;

  res.json({ ...data, gain_loss: parseFloat(gain.toFixed(2)), gain_loss_pct: gainPercent });
});

// DELETE /api/investments/:id
router.delete('/:id', authenticate, async (req, res) => {
  const { data: existing, error: findErr } = await supabase
    .from('investments')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (findErr || !existing) return res.status(404).json({ error: 'Investment not found' });

  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
