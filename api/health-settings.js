// File: api/health-settings.js
// Logika backend sementara untuk menyimpan status kesehatan
// Nanti bisa diconnect ke Firebase

let healthData = {
    bb: 50, 
    tb: 180,
    eat_1: false, 
    eat_2: false, 
    eat_3: false,
    water: 0,
    sleep_start: null,
    wake_time: null
};

module.exports = {
    // Ambil data saat ini
    get: () => {
        return healthData;
    },
    // Update data (merge)
    update: (newData) => {
        healthData = { ...healthData, ...newData };
        return healthData;
    }
};
