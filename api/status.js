// File: api/status.js
import admin from 'firebase-admin';

// Init Firebase (Standard Check)
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
  // GET: Cek Status Saat Ini
  if (req.method === 'GET') {
    try {
      // Kita simpan di koleksi 'config', dokumen 'system_status'
      const doc = await db.collection('config').doc('system_status').get();
      if (!doc.exists) {
        // Default True jika belum ada settingan
        return res.status(200).json({ is_active: true });
      }
      return res.status(200).json(doc.data());
    } catch (error) {
      return res.status(500).json({ is_active: true }); // Fallback on error
    }
  }

  // POST: Admin Mengubah Status (ON/OFF)
  if (req.method === 'POST') {
    try {
      const { is_active } = req.body;
      await db.collection('config').doc('system_status').set({
        is_active: Boolean(is_active)
      }, { merge: true });
      return res.status(200).json({ message: 'Status Saved', status: is_active });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to save status' });
    }
  }
}
