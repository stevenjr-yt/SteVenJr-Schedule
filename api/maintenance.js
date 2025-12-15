import admin from 'firebase-admin';

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
  // GET: Cek Status Maintenance
  if (req.method === 'GET') {
    try {
      const doc = await db.collection('config').doc('maintenance_mode').get();
      if (!doc.exists) return res.status(200).json({ is_maintenance: false });
      return res.status(200).json(doc.data());
    } catch (error) {
      return res.status(500).json({ is_maintenance: false });
    }
  }

  // POST: Toggle Status
  if (req.method === 'POST') {
    try {
      const { is_maintenance } = req.body;
      await db.collection('config').doc('maintenance_mode').set({
        is_maintenance: Boolean(is_maintenance)
      }, { merge: true });
      return res.status(200).json({ message: 'Saved', status: is_maintenance });
    } catch (error) {
      return res.status(500).json({ error: 'Failed' });
    }
  }
}
