import admin from 'firebase-admin';

// --- INI HARUS SAMA DENGAN INISIALISASI DI /api/schedule.js ---
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
// -----------------------------------------------------------------

// Asumsi: Anda sudah membuat user di Firebase Auth Console (admin@stevenjr.space)
// DAN Anda telah menyimpan password plain text user tersebut di ENV Vercel
// dengan nama 'ADMIN_PASSWORD' (yang digunakan di schedule.js).

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email, password } = req.body;
    
    // 1. Cek Kredensial terhadap ENV (Karena Admin SDK tidak bisa cek password)
    //    INI ADALAH HANYA SOLUSI SEMENTARA UNTUK BACKEND ANDA SAAT INI.
    //    Metode yang lebih aman adalah menggunakan Firebase REST API di sini.
    
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        
        // *Opsional:* Jika Anda ingin memverifikasi bahwa user ini ada di Auth Firebase
        try {
            await admin.auth().getUserByEmail(email);
            // Jika berhasil, user ada. Login sukses.
            return res.status(200).json({ message: 'Login berhasil', email: email });

        } catch(e) {
            // Jika user tidak ditemukan di Firebase Auth Console
            console.error("User tidak ditemukan di Firebase Auth:", e.message);
            return res.status(401).json({ message: 'Akses Ditolak: User tidak terdaftar.' });
        }
        
    } else {
        // Kredensial salah
        return res.status(401).json({ message: 'Akses Ditolak: Kredensial Salah.' });
    }
}
