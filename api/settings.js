import admin from 'firebase-admin';

// Inisialisasi Firebase (Sama persis dengan schedule.js agar tidak error path)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { method } = req;

  // GET: Ambil Status Toggle
  if (method === 'GET') {
    try {
      const doc = await db.collection('config').doc('display_mode').get();
      if (!doc.exists) return res.status(200).json({ show_uts: false, show_uas: false });
      return res.status(200).json(doc.data());
    } catch (error) {
      return res.status(500).json({ error: 'Gagal load settings' });
    }
  }

  // POST: Simpan Status Toggle
  if (method === 'POST') {
    try {
      const { show_uts, show_uas } = req.body;
      await db.collection('config').doc('display_mode').set({
        show_uts: Boolean(show_uts),
        show_uas: Boolean(show_uas)
      }, { merge: true });
      return res.status(200).json({ message: 'Settings saved' });
    } catch (error) {
      return res.status(500).json({ error: 'Gagal save settings' });
    }
  }
}
