import admin from 'firebase-admin';

// 1. Inisialisasi Firebase Admin (Harus Sama dengan /api/schedule.js)
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

export default async function handler(req, res) {
    // Pastikan hanya request POST yang diterima
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan password dibutuhkan.' });
    }

    // --- 1. VALIDASI DENGAN ENVIRONMENT VARIABLES ---

    const expectedEmail = process.env.ADMIN_EMAIL;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    // Periksa apakah Environment Variables sudah diset
    if (!expectedEmail || !expectedPassword) {
        return res.status(500).json({ message: 'Server Error: ADMIN_EMAIL atau ADMIN_PASSWORD belum diatur di ENV Vercel.' });
    }
    
    // Perbandingan Case-Sensitive
    if (email === expectedEmail && password === expectedPassword) {
        
        // --- 2. (OPSIONAL TAPI DIANJURKAN) VERIFIKASI KEHADIRAN USER DI FIREBASE AUTH ---
        // Meskipun password sudah cocok dengan ENV, kita cek UID-nya agar konsisten.
        try {
            await admin.auth().getUserByEmail(email);
            
            // Login SUKSES
            return res.status(200).json({ 
                message: 'Login berhasil', 
                email: email
            });

        } catch(e) {
            // User tidak ditemukan (Walaupun password ENV benar, user Auth sudah terhapus)
            console.error("User tidak ditemukan di Firebase Auth:", e.message);
            return res.status(401).json({ message: 'Akses Ditolak: User tidak terdaftar di Firebase Auth.' });
        }
        
    } else {
        // Gagal karena email/password tidak cocok dengan ENV
        return res.status(401).json({ message: 'Akses Ditolak: Kredensial Salah.' });
    }
}
