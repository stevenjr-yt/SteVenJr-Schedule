// Simpan file ini sebagai: api/health-settings.js
// Ini logic sementara sebelum connect ke Firebase asli
let healthData = {
    bb: 50, tb: 180,
    eat_1: false, eat_2: false, eat_3: false,
    water: 0,
    sleep_start: null,
    wake_time: null
};

module.exports = {
    get: () => healthData,
    update: (newData) => {
        healthData = { ...healthData, ...newData };
        return healthData;
    }
};
