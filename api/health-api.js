// File: /api/health-controller.js (Atau sesuaikan nama file backend Anda)

// Mock database connection (Ganti dengan koneksi Firebase real Anda)
// const db = require('./firebase-config'); 

let userHealthData = {
    bb: 50, tb: 180,
    eat_1: false, eat_2: false, eat_3: false,
    water: 0,
    sleep_start: null,
    wake_time: null
};

// GET: /api/health
exports.getHealthData = async (req, res) => {
    // Logika ambil dari Firebase:
    // const snapshot = await db.collection('settings').doc('health').get();
    // userHealthData = snapshot.data();
    
    res.json(userHealthData);
};

// POST: /api/health
exports.updateHealthData = async (req, res) => {
    const newData = req.body;
    
    // Merge data baru dengan yang lama
    userHealthData = { ...userHealthData, ...newData };
    
    // Logika simpan ke Firebase:
    // await db.collection('settings').doc('health').set(userHealthData, { merge: true });

    res.json({ status: 'success', data: userHealthData });
};
