// Kita tidak memerlukan Firebase Admin SDK di sini, 
// karena kita hanya memverifikasi kredensial terhadap ENV Vercel.

export default async function handler(req, res) {
    // Pastikan hanya request POST yang diterima
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan password dibutuhkan.' });
    }

    // --- LOGIKA UTAMA: VERIFIKASI TERHADAP ENVIRONMENT VARIABLES ---
    
    const expectedEmail = process.env.ADMIN_EMAIL;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    // Cek apakah Environment Variables sudah diatur
    if (!expectedEmail || !expectedPassword) {
        console.error("ADMIN_EMAIL atau ADMIN_PASSWORD belum diatur di ENV Vercel.");
        return res.status(500).json({ message: 'Server Error: Konfigurasi admin belum lengkap.' });
    }
    
    // Bandingkan input user dengan nilai di ENV Vercel
    if (email === expectedEmail && password === expectedPassword) {
        
        // Login SUKSES
        return res.status(200).json({ 
            message: 'Login berhasil', 
            email: email
        });

    } else {
        // Gagal karena email/password tidak cocok dengan ENV
        return res.status(401).json({ message: 'Akses Ditolak: Kredensial Salah.' });
    }
}
