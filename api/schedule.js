import admin from 'firebase-admin';

// Inisialisasi Firebase (Standard Vercel)
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
  const { category, id } = req.query;

  // GET: Ambil Data Jadwal
  if (method === 'GET') {
    try {
      if (!category) return res.status(400).json({ error: 'Butuh kategori' });
      
      const snapshot = await db.collection(category).get();
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.status(200).json(data);
    } catch (error) {
      console.error("Firebase Error:", error);
      return res.status(500).json({ error: 'Database Error' });
    }
  }

  // POST: Tambah Jadwal
  if (method === 'POST') {
    try {
      const authHeader = req.headers['x-admin-password'];
      if (authHeader !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const body = req.body;
      const targetCollection = body.kategori || 'daily';
      delete body.kategori; 

      await db.collection(targetCollection).add(body);
      return res.status(200).json({ message: 'Saved' });
    } catch (error) {
      return res.status(500).json({ error: 'Save Failed' });
    }
  }

  // DELETE: Hapus Jadwal
  if (method === 'DELETE') {
    try {
      const authHeader = req.headers['x-admin-password'];
      if (authHeader !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!id || !category) return res.status(400).json({ error: 'Missing params' });

      await db.collection(category).doc(id).delete();
      return res.status(200).json({ message: 'Deleted' });
    } catch (error) {
      return res.status(500).json({ error: 'Delete Failed' });
    }
  }
}
