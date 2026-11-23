import { handler, isAdmin, checkPassword, startSession, endSession } from './_lib.js';

export default handler({
  // Is this browser signed in?
  GET: { admin: false, fn: (req, res) => res.json({ admin: isAdmin(req) }) },

  // Sign in with the admin password
  POST: {
    admin: false,
    fn: async (req, res) => {
      if (!(await checkPassword(req.body?.password))) {
        await new Promise(r => setTimeout(r, 800)); // slow down guessing
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      startSession(res);
      res.json({ admin: true });
    }
  },

  // Sign out
  DELETE: { admin: false, fn: (req, res) => { endSession(res); res.json({ admin: false }); } }
});
