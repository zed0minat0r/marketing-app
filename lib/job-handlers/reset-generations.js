'use strict';

/**
 * POST /api/jobs/reset-generations
 *
 * QStash monthly cron job (1st of each month, midnight UTC).
 * Calls the Supabase reset_monthly_generations() RPC to zero out
 * all users' generations_used counter for the new billing period.
 */

const { getClient } = require('../supabase');
const { requireCronAuth } = require('../cron-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireCronAuth(req, res)) return;

  try {
    // Call the stored procedure that resets all users' monthly counters
    const { error } = await getClient().rpc('reset_monthly_generations');

    if (error) {
      // Fallback: manual UPDATE if stored proc doesn't exist yet
      if (error.code === 'PGRST202' || error.message?.includes('not found')) {
        console.warn('reset_monthly_generations() RPC not found — falling back to direct UPDATE');
        const { error: updateError } = await getClient()
          .from('users')
          .update({ generations_used: 0, updated_at: new Date().toISOString() })
          .not('id', 'is', null); // matches all rows

        if (updateError) throw updateError;
        console.log('Monthly generation reset completed via fallback UPDATE');
      } else {
        throw error;
      }
    } else {
      console.log('Monthly generation reset completed via RPC');
    }

    return res.status(200).json({
      success: true,
      message: 'Monthly generation counters reset',
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Reset generations job error:', err);
    return res.status(500).json({ error: err.message });
  }
};
