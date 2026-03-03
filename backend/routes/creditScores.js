import { Router } from 'express';
import supabase from '../lib/supabase.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

// GET /api/credit-scores
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('credit_scores')
    .select('*')
    .eq('user_id', req.userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || { cibil: null, experian: null });
});

// POST /api/credit-scores – upsert
router.post('/', authenticate, async (req, res) => {
  const { cibil, experian } = req.body;

  if (cibil === undefined && experian === undefined) {
    return res.status(400).json({ error: 'At least one score (cibil or experian) is required' });
  }

  const payload = {
    user_id: req.userId,
    updated_at: new Date().toISOString()
  };
  if (cibil    !== undefined) payload.cibil    = Number(cibil);
  if (experian !== undefined) payload.experian = Number(experian);

  const { data, error } = await supabase
    .from('credit_scores')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
