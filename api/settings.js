// File: api/settings.js

const { db } = require('../firebase'); // Sesuaikan path ini dengan file config firebase kamu (misal: ./config atau ../firebase)

// Handler Utama (Support Vercel / Express)
module.exports = async (req, res) => {
    
    // 1. GET: Ambil Status Toggle saat ini
    if (req.method === 'GET') {
        try {
            const doc = await db.collection('config').doc('display_mode').get();
            
            if (!doc.exists) {
                // Jika belum ada settingan, default MATI semua
                return res.status(200).json({ show_uts: false, show_uas: false });
            }
            
            return res.status(200).json(doc.data());
        } catch (error) {
            return res.status(500).json({ error: 'Gagal ambil settings', detail: error.message });
        }
    }

    // 2. POST: Update Status Toggle (Dari Admin Panel)
    if (req.method === 'POST') {
        try {
            const { show_uts, show_uas } = req.body;

            // Simpan ke collection 'config', dokumen 'display_mode'
            // Gunakan merge: true agar field lain tidak hilang (jika ada)
            await db.collection('config').doc('display_mode').set({
                show_uts: Boolean(show_uts),
                show_uas: Boolean(show_uas)
            }, { merge: true });

            return res.status(200).json({ message: 'Settings berhasil disimpan', show_uts, show_uas });
        } catch (error) {
            return res.status(500).json({ error: 'Gagal simpan settings', detail: error.message });
        }
    }

    // Method lain
    return res.status(405).json({ error: 'Method not allowed' });
};
