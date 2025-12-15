// File: api/settings.js
const { db } = require('../firebase'); // Sesuaikan path ini dengan config firebase kamu

module.exports = async (req, res) => {
    // 1. AMBIL STATUS (GET)
    if (req.method === 'GET') {
        try {
            const doc = await db.collection('config').doc('display_mode').get();
            if (!doc.exists) {
                // Default Mati jika belum ada di database
                return res.status(200).json({ show_uts: false, show_uas: false });
            }
            return res.status(200).json(doc.data());
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // 2. SIMPAN STATUS (POST)
    if (req.method === 'POST') {
        try {
            const { show_uts, show_uas } = req.body;
            // Simpan ke Firebase (Merge agar field lain aman)
            await db.collection('config').doc('display_mode').set({
                show_uts: Boolean(show_uts),
                show_uas: Boolean(show_uas)
            }, { merge: true });
            
            return res.status(200).json({ message: 'Saved', show_uts, show_uas });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
};
