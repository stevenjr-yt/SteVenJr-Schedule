import admin from 'firebase-admin';

// 1. Inisialisasi Firebase Admin (Hanya berjalan di Server Vercel)
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
  const { category, id } = req.query; // Mengambil parameter dari URL

  // --- GET: Untuk Menampilkan Data (Dipakai index.html & admin.html) ---
  if (method === 'GET') {
    try {
      if (!category) return res.status(400).json({ error: 'Kategori diperlukan' });
      
      const snapshot = await db.collection(category).get();
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Gagal mengambil data' });
    }
  }

  // --- POST: Untuk Tambah Data (Dipakai admin.html) ---
  if (method === 'POST') {
    try {
      // Cek Password Admin Sederhana (Disimpan di ENV Vercel)
      const authHeader = req.headers['x-admin-password'];
      if (authHeader !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Password Salah!' });
      }

      const body = req.body; // Data dari form
      const targetCollection = body.kategori || 'daily'; // Default ke daily
      
      // Hapus field kategori agar tidak masuk ke dalam dokumen data
      delete body.kategori; 

      await db.collection(targetCollection).add(body);
      return res.status(200).json({ message: 'Berhasil disimpan' });
    } catch (error) {
      return res.status(500).json({ error: 'Gagal menyimpan data' });
    }
  }

  // --- DELETE: Untuk Hapus Data (Dipakai admin.html) ---
  if (method === 'DELETE') {
    try {
      const authHeader = req.headers['x-admin-password'];
      if (authHeader !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!id || !category) return res.status(400).json({ error: 'ID & Kategori butuh' });

      await db.collection(category).doc(id).delete();
      return res.status(200).json({ message: 'Terhapus' });
    } catch (error) {
      return res.status(500).json({ error: 'Gagal menghapus' });
    }
  }
}
