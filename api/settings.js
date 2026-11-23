import { handler, getSettings, saveSettings, setPassword } from './_lib.js';

export default handler({
  GET: async (req, res) => res.json({ settings: await getSettings() }),

  PUT: async (req, res) => {
    const body = req.body || {};
    const settings = await saveSettings({ ...(await getSettings()), ...body });
    if (body.newPassword !== undefined && body.newPassword !== '') {
      if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.', settings });
      }
      await setPassword(body.newPassword);
    }
    res.json({ settings });
  }
});
