import admin from 'firebase-admin';

// Inisialisasi Firebase (Cek agar tidak double init)
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
  const docRef = db.collection('health_status').doc('current_status');

  // GET: Ambil Status Kesehatan Terakhir
  if (method === 'GET') {
    res.setHeader('Cache-Control', 'no-store'); // Jangan di-cache agar realtime
    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        // Return default jika belum ada data
        return res.status(200).json({ 
            bb: 50, tb: 180, 
            sleep_start: null, wake_time: null, 
            water: 0, eat_1: false, eat_2: false, eat_3: false 
        });
      }
      return res.status(200).json(doc.data());
    } catch (error) {
      return res.status(500).json({ error: 'Database Error' });
    }
  }

  // POST: Update Status (Merge data)
  if (method === 'POST') {
    try {
      const body = req.body;
      // Gunakan set({ ... }, { merge: true }) untuk update parsial
      await docRef.set(body, { merge: true });
      return res.status(200).json({ message: 'Health Updated' });
    } catch (error) {
      return res.status(500).json({ error: 'Update Failed' });
    }
  }
}
