import admin from 'firebase-admin';

// 1. Inisialisasi Firebase Admin (SAMA PERSIS DENGAN SCHEDULE.JS)
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

  // --- GET: Ambil Status Toggle (Dipakai app.js saat loading) ---
  if (method === 'GET') {
    try {
      const doc = await db.collection('config').doc('display_mode').get();
      
      if (!doc.exists) {
        // Default Mati semua jika belum pernah disetting
        return res.status(200).json({ show_uts: false, show_uas: false });
      }
      
      return res.status(200).json(doc.data());
    } catch (error) {
      return res.status(500).json({ error: 'Gagal mengambil settings' });
    }
  }

  // --- POST: Update Status Toggle (Dipakai Admin Panel) ---
  if (method === 'POST') {
    try {
      const { show_uts, show_uas } = req.body;

      // Simpan ke collection 'config', dokumen 'display_mode'
      await db.collection('config').doc('display_mode').set({
        show_uts: Boolean(show_uts),
        show_uas: Boolean(show_uas)
      }, { merge: true });

      return res.status(200).json({ message: 'Settings saved', show_uts, show_uas });
    } catch (error) {
      return res.status(500).json({ error: 'Gagal menyimpan settings' });
    }
  }

  // Method lain reject
  return res.status(405).json({ error: 'Method not allowed' });
}
