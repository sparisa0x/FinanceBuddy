import { Router } from 'express';
import supabase from '../lib/supabase.js';
import authenticate from '../middleware/authenticate.js';
import { calculateEMI } from '../lib/calculations.js';

const router = Router();

// GET /api/debts – all debts with calculated EMI per debt
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const debtsWithEMI = (data || []).map(debt => ({
    ...debt,
    monthly_emi: calculateEMI(
      Number(debt.outstanding_principal),
      Number(debt.annual_rate),
      Number(debt.tenure_months)
    )
  }));

  res.json(debtsWithEMI);
});

// POST /api/debts
router.post('/', authenticate, async (req, res) => {
  const { name, principal, outstanding_principal, annual_rate, tenure_months, start_date, lender } = req.body;

  if (!name || !principal || !outstanding_principal || !annual_rate || !tenure_months || !start_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: req.userId,
      name,
      principal: Number(principal),
      outstanding_principal: Number(outstanding_principal),
      annual_rate: Number(annual_rate),
      tenure_months: Number(tenure_months),
      start_date,
      lender: lender || null
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({
    ...data,
    monthly_emi: calculateEMI(
      Number(data.outstanding_principal),
      Number(data.annual_rate),
      Number(data.tenure_months)
    )
  });
});

// PUT /api/debts/:id
router.put('/:id', authenticate, async (req, res) => {
  const { data: existing, error: findErr } = await supabase
    .from('debts')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (findErr || !existing) return res.status(404).json({ error: 'Debt not found' });

  const { outstanding_principal, annual_rate, tenure_months, name, lender } = req.body;
  const updates = {};
  if (outstanding_principal !== undefined) updates.outstanding_principal = Number(outstanding_principal);
  if (annual_rate           !== undefined) updates.annual_rate           = Number(annual_rate);
  if (tenure_months         !== undefined) updates.tenure_months         = Number(tenure_months);
  if (name                  !== undefined) updates.name                  = name;
  if (lender                !== undefined) updates.lender                = lender;

  const { data, error } = await supabase
    .from('debts')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    ...data,
    monthly_emi: calculateEMI(
      Number(data.outstanding_principal),
      Number(data.annual_rate),
      Number(data.tenure_months)
    )
  });
});

// DELETE /api/debts/:id
router.delete('/:id', authenticate, async (req, res) => {
  const { data: existing, error: findErr } = await supabase
    .from('debts')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (findErr || !existing) return res.status(404).json({ error: 'Debt not found' });

  const { error } = await supabase
    .from('debts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
