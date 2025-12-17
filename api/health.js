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
  const { method } = req;
  const docRef = db.collection('health_status').doc('current_status');

  // GET: Ambil Data Terbaru (Untuk HP/Laptop saat pertama buka)
  if (method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        // Data Default jika database kosong
        return res.status(200).json({ 
            bb: 50, tb: 180, 
            sleep_start: null, wake_time: null, 
            water: 0, 
            eat_1: false, eat_2: false, eat_3: false,
            completed_tasks: [], // Array ID Checklist yg selesai
            last_energy_level: 100 // Persentase Baterai Terakhir
        });
      }
      return res.status(200).json(doc.data());
    } catch (error) {
      return res.status(500).json({ error: 'Database Error' });
    }
  }

  // POST: Simpan Perubahan (Sync)
  if (method === 'POST') {
    try {
      const body = req.body;
      // { merge: true } memastikan data lain tidak terhapus saat update parsial
      await docRef.set(body, { merge: true });
      return res.status(200).json({ message: 'Synced' });
    } catch (error) {
      return res.status(500).json({ error: 'Sync Failed' });
    }
  }
}
