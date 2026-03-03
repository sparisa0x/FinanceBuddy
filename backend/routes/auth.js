import { Router } from 'express';
import supabase from '../lib/supabase.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

// GET /api/profile
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.userId)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/profile
router.put('/', authenticate, async (req, res) => {
  const { name, monthly_income, monthly_savings_target, avatar_url } = req.body;

  const updates = {};
  if (name                  !== undefined) updates.name = name;
  if (monthly_income        !== undefined) updates.monthly_income = Number(monthly_income);
  if (monthly_savings_target !== undefined) updates.monthly_savings_target = Number(monthly_savings_target);
  if (avatar_url            !== undefined) updates.avatar_url = avatar_url;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
