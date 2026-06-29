import { Router, Request, Response } from 'express';
import { emitSSE } from '../sse';

export const appliancesRouter = Router();

// POST /api/widgets/appliances/notify
// Called by Home Assistant automation when washer/dryer finishes (power < 5W for 5 min).
// Body: { appliance: "washer" | "dryer", secret: string }
appliancesRouter.post('/notify', (req: Request, res: Response) => {
  const secret = process.env.APPLIANCE_WEBHOOK_SECRET;
  if (secret && req.body?.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appliance = req.body?.appliance as string | undefined;
  if (appliance !== 'washer' && appliance !== 'dryer') {
    return res.status(400).json({ error: 'appliance must be "washer" or "dryer"' });
  }

  emitSSE({ type: 'appliance_done', data: { appliance } });
  return res.json({ ok: true });
});
