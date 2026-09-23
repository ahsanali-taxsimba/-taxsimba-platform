import { listAccountancyFirms } from "../supabase/insertDomain.js";

export async function getAccountantsHandler(req, res) {
  try {
    const location = req.query.location || undefined;
    const limit = Number(req.query.limit || 500);
    const firms = await listAccountancyFirms({ limit, location });
    res.json({ count: firms.length, accountants: firms });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
