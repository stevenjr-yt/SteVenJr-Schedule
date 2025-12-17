// File: app.js

// 1. SETUP
let adminPassword = null; 
let adminEmail = null;
let currentCategory = 'daily'; 
let globalSettings = { show_uts: false, show_uas: false }; 

// STATE: DB Connected diambil dari Server, bukan LocalStorage
let isDbConnected = true; 
let isMaintenanceMode = false; 
let completedTaskIds = []; // Variabel untuk sinkronisasi checklist

document.addEventListener('DOMContentLoaded', () => {
    // Cek Login Local
    const savedEmail = localStorage.getItem('admin_email');
    const savedPass = localStorage.getItem('admin_password');
    if (savedEmail && savedPass) {
        adminEmail = savedEmail;
        adminPassword = savedPass;
        if (document.getElementById('admin-panel')) showAdminPanel();
    }

    updateClock();
    setInterval(updateClock, 1000);

    // Initial Fetch Status System
    checkSystemStatus().then(() => {
        // Load Data Setelah Tahu Status DB
        if (document.getElementById('admin-panel')) initAdminFeatures();
        else if (document.getElementById('main-dashboard')) initDashboardFeatures();

        fetchSettings().then(() => {
            if(window.updateDashboardMenu) updateDashboardMenu();
            if(window.initAdminToggles) initAdminToggles();
            if(document.getElementById('main-dashboard')) loadTodaySchedule();
        });
    });
});

// --- CORE: CEK STATUS DATABASE KE SERVER ---
async function checkSystemStatus() {
    try {
        // 1. Cek DB Status
        const resDb = await fetch('/api/status');
        const dataDb = await resDb.json();
        isDbConnected = dataDb.is_active;
        updateDbStatusUI();

        // 2. Cek Maintenance Status
        const resMt = await fetch('/api/maintenance');
        const dataMt = await resMt.json();
        isMaintenanceMode = dataMt.is_maintenance;
        updateMaintenanceUI();

        // LOGIKA REDIRECT:
        if (isMaintenanceMode && !document.getElementById('admin-panel')) {
            window.location.href = 'maintenance.html';
        }

    } catch (e) {
        console.error("Gagal cek status sistem");
        isDbConnected = true; 
    }
}

// --- API WRAPPER (Cek Status Dulu Sebelum Fetch) ---
async function fetchSchedule(params) {
    if (!isDbConnected) return null; 
    try {
        const res = await fetch(`/api/schedule${params}`);
        if(res.ok) return await res.json();
    } catch(e) { return []; }
    return [];
}

// --- DB TOGGLE FUNCTION (ADMIN) ---
window.toggleDatabaseConnection = async function() {
    const newState = !isDbConnected;
    isDbConnected = newState;
    updateDbStatusUI();
    try {
        await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newState })
        });
        loadAdminData(currentCategory);
        loadDailyChecklist();
        if(document.getElementById('main-dashboard')) loadTodaySchedule();
    } catch (e) {
        alert("Gagal mengubah status database di server!");
        isDbConnected = !newState;
        updateDbStatusUI();
    }
}

function updateDbStatusUI() {
    const btn = document.getElementById('btn-db-toggle');
    const txt = document.getElementById('db-status-text');
    if(!btn) return;
    
    if (isDbConnected) {
        btn.className = "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2";
        txt.innerText = "DB ON";
    } else {
        btn.className = "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 animate-pulse";
        txt.innerText = "DB OFF";
    }
}

// --- MAINTENANCE TOGGLE FUNCTION ---
window.toggleMaintenance = async function() {
    const newState = !isMaintenanceMode;
    isMaintenanceMode = newState;
    updateMaintenanceUI(); 
    try {
        await fetch('/api/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_maintenance: newState })
        });
        if(newState) alert("Mode Maintenance Aktif");
    } catch (e) {
        alert("Gagal update maintenance mode!");
        isMaintenanceMode = !newState; 
        updateMaintenanceUI();
    }
}

function updateMaintenanceUI() {
    const btn = document.getElementById('btn-mt-toggle');
    const txt = document.getElementById('mt-status-text');
    if(!btn) return;

    if (isMaintenanceMode) {
        btn.className = "bg-orange-500 text-white hover:bg-orange-600 border border-orange-600 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 animate-pulse";
        txt.innerText = "MT ON";
    } else {
        btn.className = "bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2";
        txt.innerText = "MT OFF";
    }
}

// --- HELPER BENTROK ---
function isTimeConflict(time1, time2) {
    try {
        const parse = t => {
            const [s, e] = t.split('-').map(x => {
                const [h, m] = x.trim().split(/[:.]/).map(Number);
                return h * 60 + m;
            });
            return { s, e };
        };
        const t1 = parse(time1);
        const t2 = parse(time2);
        return (t1.s < t2.e && t1.e > t2.s);
    } catch (e) { return false; }
}

// --- API SETTINGS ---
async function fetchSettings() {
    if(!isDbConnected) return; 
    try { const res = await fetch('/api/settings'); if (res.ok) globalSettings = await res.json(); } catch (e) {}
}

async function saveSettings(changes) {
    if(!isDbConnected) { alert("Database sedang dimatikan!"); return; }
    const newSettings = { ...globalSettings, ...changes };
    globalSettings = newSettings; 
    await fetch('/api/settings', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(newSettings) 
    });
}

function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if(document.getElementById('digital-clock')) document.getElementById('digital-clock').innerText = `${h}.${m}.${s}`;
    if(document.getElementById('current-date')) document.getElementById('current-date').innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if(document.getElementById('admin-realtime-clock')) document.getElementById('admin-realtime-clock').innerText = `${h}:${m}:${s}`;
}

// 2. DASHBOARD & MENU
function initDashboardFeatures() { 
    updateDashboardMenu(); 
    setInterval(() => { 
        checkSystemStatus().then(() => {
            fetchSettings().then(() => { updateDashboardMenu(); loadTodaySchedule(); });
        });
    }, 300000); 
}

function updateDashboardMenu() {
    const utsBtn = document.getElementById('btn-menu-uts');
    const uasBtn = document.getElementById('btn-menu-uas');
    const container = document.getElementById('exam-buttons-container');
    if(!container) return;
    if (globalSettings.show_uts || globalSettings.show_uas) {
        container.classList.remove('hidden'); container.classList.add('flex');
        if(utsBtn) utsBtn.classList.toggle('hidden', !globalSettings.show_uts);
        if(uasBtn) uasBtn.classList.toggle('hidden', !globalSettings.show_uas);
        if(globalSettings.show_uts) utsBtn.classList.add('flex');
        if(globalSettings.show_uas) uasBtn.classList.add('flex');
    } else { container.classList.add('hidden'); container.classList.remove('flex'); }
}

window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400 text-xs">Memuat data...</td></tr>';
    if(titleElement) titleElement.innerText = category.toUpperCase();

    if(!isDbConnected) {
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400 text-xs font-bold text-red-400">Database Disconnected by Admin</td></tr>`; 
        return;
    }

    try {
        const data = await fetchSchedule(`?category=${category}`);
        if(!tableBody) return;
        tableBody.innerHTML = '';
        if (!data || data.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400 text-xs">Data Kosong</td></tr>`; return; }

        if (category === 'daily') {
            const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
            data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || (a.waktu || "").localeCompare(b.waktu || ""));
        } else {
            data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || (a.waktu || "").localeCompare(b.waktu || ""));
        }

        data.forEach(item => {
            const badgeColor = item.tipe === 'Praktek' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-50 text-indigo-700';
            const detail = category === 'personal' ? (item.keterangan || '-') : `${item.ruangan || '-'} • ${item.dosen || '-'}`;
            const title = item.matkul || item.nama_kegiatan || item.nama || "Kegiatan";

            tableBody.innerHTML += `
            <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition text-sm schedule-row" data-waktu="${item.waktu}" data-hari="${item.hari || item.tanggal}">
                <td class="p-4 align-top w-24">
                    <div class="font-bold text-gray-800 text-xs">${item.hari || item.tanggal}</div>
                    <div class="text-[10px] text-gray-500 mt-1 bg-gray-100 px-2 py-0.5 rounded w-fit">${item.waktu}</div>
                </td>
                <td class="p-4 align-top">
                    <div class="font-bold text-gray-800 text-sm">${title}</div>
                    <div class="text-xs text-gray-500 mt-1"><i class="fas fa-map-marker-alt text-[10px] mr-1"></i> ${detail}</div>
                </td>
                <td class="p-4 align-top text-right">
                    <span class="text-[10px] font-bold ${badgeColor} px-2 py-1 rounded-lg">${item.tipe || 'Info'}</span>
                </td>
            </tr>`;
        });
    } catch (error) { if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 text-xs">Error Koneksi</td></tr>'; }
}

async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;
    
    if(!isDbConnected) {
        container.innerHTML = `<div class="text-center py-8 text-red-300"><i class="fas fa-database text-2xl mb-2"></i><p class="text-xs">Database Off</p></div>`;
        return;
    }

    const now = new Date(); 
    const year = now.getFullYear(); 
    const month = String(now.getMonth() + 1).padStart(2, '0'); 
    const day = String(now.getDate()).padStart(2, '0'); 
    const tglIni = `${year}-${month}-${day}`; 
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; 
    const hariIni = days[now.getDay()];

    try {
        const [daily, uts, uas, personal] = await Promise.all([
            fetchSchedule('?category=daily'), 
            fetchSchedule('?category=uts'), 
            fetchSchedule('?category=uas'), 
            fetchSchedule('?category=personal')
        ]);
        
        const safeList = (arr) => Array.isArray(arr) ? arr : [];
        const isToday = (item) => { 
            if (item.tanggal && item.tanggal === tglIni) return true; 
            if (!item.tanggal && (item.hari || "").toLowerCase() === hariIni.toLowerCase()) return true; 
            return false; 
        };
        
        let list = [
            ...safeList(uts).filter(u => u.tanggal === tglIni && globalSettings.show_uts).map(i => ({...i, c: 'orange', label:'UTS'})), 
            ...safeList(uas).filter(u => u.tanggal === tglIni && globalSettings.show_uas).map(i => ({...i, c: 'purple', label:'UAS'})), 
            ...safeList(daily).filter(isToday).map(i => ({...i, c: 'blue', label:'KULIAH'})), 
            ...safeList(personal).filter(isToday).map(i => ({...i, c: 'green', label:'AGENDA'}))
        ];

        list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || "")); 

        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const itemA = list[i];
                const itemB = list[j];
                if (itemA.waktu && itemA.waktu.includes('-') && itemB.waktu && itemB.waktu.includes('-')) {
                    if (isTimeConflict(itemA.waktu, itemB.waktu)) {
                        itemA.isConflict = true; 
                        itemB.isConflict = true; 
                    }
                }
            }
        }

        if (list.length === 0) { 
            container.innerHTML = `<div class="text-center py-8 text-gray-300"><i class="fas fa-mug-hot text-2xl mb-2"></i><p class="text-xs">Hari ini kosong. Santai!</p></div>`; 
            return; 
        }

        container.innerHTML = list.map(item => { 
            if(window.rowWidget) return window.rowWidget(item, item.c); 
            return `<div>${item.matkul}</div>`; 
        }).join('');

    } catch (e) { 
        container.innerHTML = '<p class="text-red-400 text-center text-xs">Gagal memuat jadwal.</p>'; 
    }
}

// 3. ADMIN PANEL
function showAdminPanel() { 
    document.getElementById('login-form').style.display = 'none'; 
    document.getElementById('admin-panel').style.display = 'block'; 
    updateDbStatusUI();
}

function initAdminFeatures() { 
    checkSystemStatus(); 
    updateDbStatusUI();
    loadAdminData('daily'); 
    loadDailyChecklist(); 
    
    // START: Health Tracker Baru
    initHealthTracker(); 
    initAdminToggles(); 
}

function initAdminToggles() { 
    const tUts = document.getElementById('toggle-uts'); 
    const tUas = document.getElementById('toggle-uas'); 

    if (tUts) { 
        tUts.checked = globalSettings.show_uts; 
        tUts.addEventListener('change', (e) => { 
            saveSettings({ 
                show_uts: e.target.checked, 
                show_uas: tUas ? tUas.checked : globalSettings.show_uas 
            }); 
        }); 
    } 

    if (tUas) { 
        tUas.checked = globalSettings.show_uas; 
        tUas.addEventListener('change', (e) => { 
            saveSettings({ 
                show_uas: e.target.checked, 
                show_uts: tUts ? tUts.checked : globalSettings.show_uts 
            }); 
        }); 
    } 
}

window.switchTab = function(targetId, btn) { document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); document.getElementById(targetId).classList.add('active'); document.querySelectorAll('.tab-btn').forEach(b => { b.className = "tab-btn px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded flex-shrink-0 transition"; }); btn.className = "tab-btn active px-3 py-1.5 text-[10px] font-bold bg-indigo-50 border border-indigo-100 shadow-sm rounded-lg text-indigo-700 flex-shrink-0 transition"; currentCategory = targetId.replace('list-', ''); loadAdminData(currentCategory); }

async function loadAdminData(category) { 
    const container = document.getElementById(`list-${category}`); 
    if(!container) return; 
    
    if(!isDbConnected) {
        container.innerHTML = '<div class="text-[10px] text-red-400 text-center font-bold mt-4">DATABASE OFFLINE</div>'; 
        return;
    }

    container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Loading...</div>'; 
    if (!adminPassword) return; 
    
    try { 
        const data = await fetchSchedule(`?category=${category}`); 
        container.innerHTML = ''; 
        if (!data || data.length === 0) { container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Data Kosong</div>'; return; } 
        data.forEach(item => { 
            const title = item.matkul || item.nama_kegiatan || item.nama || "Item"; 
            container.innerHTML += `<div class="bg-gray-50 p-2 rounded-lg border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition"><div class="overflow-hidden w-full pr-2"><div class="font-bold text-[11px] text-gray-700 truncate">${title}</div><div class="text-[9px] text-gray-400">${item.hari || item.tanggal} • <span class="text-indigo-500">${item.waktu}</span></div></div><button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded transition"><i class="fas fa-trash-alt text-[10px]"></i></button></div>`; 
        }); 
    } catch(e) { container.innerHTML = '<div class="text-[10px] text-red-400 text-center">Error</div>'; } 
}

const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault(); if (!adminPassword) { alert("Login dulu!"); return; }
        if(!isDbConnected) { alert("Hidupkan Database!"); return; }

        const rawData = { kategori: document.getElementById('kategori').value, matkul: document.getElementById('matkul').value, hari: document.getElementById('hari').value, tanggal: document.getElementById('tanggal').value, waktu: document.getElementById('waktu').value, ruangan: document.getElementById('ruangan').value, kode: document.getElementById('kode').value, dosen: document.getElementById('dosen').value, kelas: document.getElementById('kelas').value, tipe: document.getElementById('tipe').value, keterangan: document.getElementById('keterangan').value };
        if(document.getElementById('hari').classList.contains('hidden')) rawData.hari = ""; if(document.getElementById('tanggal').classList.contains('hidden')) rawData.tanggal = "";
        
        try {
            const existingData = await fetchSchedule(`?category=${rawData.kategori}`);
            let conflict = null;
            if(existingData) {
                for (const item of existingData) { const sameDay = (item.hari && item.hari === rawData.hari) || (item.tanggal && item.tanggal === rawData.tanggal); if (sameDay && isTimeConflict(item.waktu, rawData.waktu)) { conflict = item; break; } }
            }
            if (conflict) { alert(`GAGAL! BENTROK DENGAN:\n"${conflict.matkul||conflict.nama_kegiatan}"\nJam: ${conflict.waktu}`); return; }
            const res = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify(rawData) });
            if (res.ok) { alert("Tersimpan!"); addForm.reset(); if(window.toggleFormFields) window.toggleFormFields(); loadAdminData(rawData.kategori); loadDailyChecklist(); } else { alert("Gagal simpan."); }
        } catch (err) { alert("Error sistem."); }
    });
}
window.deleteSchedule = async function(id, category) { 
    if(!isDbConnected) { alert("Hidupkan Database!"); return; }
    if(!confirm("Hapus?")) return; 
    try { const res = await fetch(`/api/schedule?id=${id}&category=${category}`, { method: 'DELETE', headers: { 'x-admin-password': adminPassword } }); if(res.ok) { loadAdminData(category); loadDailyChecklist(); } } catch(e) { alert("Error koneksi."); } 
}

async function initHealthTracker() { 
    // 1. HARDCODE SETTINGAN WAKTU (Agar kalkulasi Konsisten Hari Ini)
    // Tidur 7.2 Jam, Bangun jam 06:00 Pagi Hari Ini
    const now = new Date();
    const wakeTimeObj = new Date();
    wakeTimeObj.setHours(6, 0, 0, 0); // Set jam 06:00 hari ini

    const sleepStartObj = new Date(wakeTimeObj);
    sleepStartObj.setHours(wakeTimeObj.getHours() - 7);
    sleepStartObj.setMinutes(wakeTimeObj.getMinutes() - 12);

    const w = wakeTimeObj.getTime();
    const s = sleepStartObj.getTime();

    // 2. Fetch Data Sinkronisasi dari Server
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        
        // Simpan list checklist yg sudah selesai ke variabel global
        completedTaskIds = data.completed_tasks || [];

        // Isi UI Basic dari Database
        document.getElementById('input-bb').value = data.bb || 50;
        document.getElementById('input-tb').value = data.tb || 180;
        document.getElementById('water-count').innerText = data.water || 0;
        document.getElementById('eat-1').checked = data.eat_1 || false;
        document.getElementById('eat-2').checked = data.eat_2 || false;
        document.getElementById('eat-3').checked = data.eat_3 || false;
        
        calculateBMI();

        // 3. JALANKAN LOGIKA ENERGI 
        // Paksa UI update seolah-olah data ini datang dari DB dengan waktu Hardcode
        updateSleepUI(false, new Date(s), new Date(w));
        
        // Jalankan interval pengurangan energi realtime
        setInterval(() => {
            syncEnergyWithServer();
        }, 60000); 

    } catch (e) {
        console.error("Gagal load health data", e);
    }
}
// UPDATE LOGIKA ENERGI
function calculateComplexEnergy(sDate, wDate) {
    const now = new Date();
    
    // 1. HITUNG MODAL TIDUR (Target 8 Jam = 100%)
    const sleepMs = wDate - sDate;
    const sleepHours = sleepMs / (1000 * 60 * 60); // Konversi ke Jam
    let energyModal = (sleepHours / 8) * 100; 
    if(energyModal > 100) energyModal = 100;

    // UPDATE UI ALERT TIDUR (Di Admin HTML)
    const sleepAlert = document.getElementById('sleep-quality-alert');
    if(sleepAlert) {
        sleepAlert.classList.remove('hidden');
        if(sleepHours < 6) {
            sleepAlert.className = "mt-2 text-[10px] font-bold px-2 py-1 rounded text-center bg-red-100 text-red-600 border border-red-200 animate-pulse";
            sleepAlert.innerText = `KURANG TIDUR: ${sleepHours.toFixed(1)} JAM`;
        } else {
            sleepAlert.className = "mt-2 text-[10px] font-bold px-2 py-1 rounded text-center bg-green-100 text-green-600 border border-green-200";
            sleepAlert.innerText = `TIDUR CUKUP: ${sleepHours.toFixed(1)} JAM`;
        }
    }

    // 2. HITUNG PENGURANGAN ENERGI (DECAY) BERDASARKAN WAKTU
    // Energi berkurang 5% setiap 1 jam setelah bangun
    const hoursAwake = (now - wDate) / (1000 * 60 * 60);
    const timeDecay = hoursAwake * 5; 

    // 3. HITUNG ASUPAN (FUEL)
    let fuel = 0;
    if(document.getElementById('eat-1').checked) fuel += 15; // Makan nambah 15%
    if(document.getElementById('eat-2').checked) fuel += 15;
    if(document.getElementById('eat-3').checked) fuel += 15;
    
    const waterLevel = parseInt(document.getElementById('water-count').innerText) || 0;
    fuel += (waterLevel * 2); // Air nambah 2% per unit

    // 4. HITUNG BEBAN AKTIVITAS (Checklist)
    const tasksDone = document.querySelectorAll('.check-anim:checked').length; // Yang sudah dicentang
    const tasksTotal = document.querySelectorAll('.check-anim').length; // Total tugas
    const taskDrain = tasksDone * 3; // Setiap tugas mengurangi 3%

    // ... (kode atasnya biarkan sama) ...

    // 5. TOTAL AKHIR
    let currentEnergy = energyModal - timeDecay + fuel - taskDrain;
    
    // Normalisasi
    if(currentEnergy > 100) currentEnergy = 100;
    if(currentEnergy < 0) currentEnergy = 0;

    const finalEnergy = Math.round(currentEnergy);

    // Update UI Lokal
    updateEnergyUI(finalEnergy);
    updateProductivityForecast(finalEnergy, tasksTotal, tasksDone);

    // --- SYNC PERSENTASE KE SERVER ---
    // Cek agar tidak mengirim data duplikat terus menerus
    if (window.lastSentEnergy !== finalEnergy) {
        window.lastSentEnergy = finalEnergy;
        fetch('/api/health', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ last_energy_level: finalEnergy }) 
        }).catch(e => console.log("Silent sync error"));
    }
}

// Helper untuk Forecast
function updateProductivityForecast(energy, totalTask, doneTask) {
    const alertBox = document.getElementById('productivity-alert');
    const drainText = document.getElementById('task-drain-text');
    const forecastText = document.getElementById('energy-forecast-text');
    
    if(alertBox) {
        alertBox.classList.remove('hidden');
        // Estimasi sisa tugas
        const remainingTasks = totalTask - doneTask;
        const estimatedDrain = remainingTasks * 3; 
        drainText.innerText = `-${estimatedDrain}% (Sisa ${remainingTasks} Tugas)`;

        if(energy < 40) {
            forecastText.innerHTML = "<span class='text-red-500 font-bold'>KRITIS! BUTUH MAKAN!</span>";
            // Trigger Alert Merah di bar baterai juga
            const batTxt = document.getElementById('energy-level');
            if(batTxt) batTxt.classList.add('animate-bounce', 'text-red-600');
        } else if (energy < estimatedDrain) {
             forecastText.innerHTML = "<span class='text-orange-500 font-bold'>Tidak Cukup. Hemat Tenaga.</span>";
        } else {
             forecastText.innerHTML = "<span class='text-green-600 font-bold'>Cukup untuk hari ini.</span>";
        }
    }
}

window.updateEnergyFromFood = async function() { 
    // Ambil data dari UI
    const data = {
        eat_1: document.getElementById('eat-1').checked,
        eat_2: document.getElementById('eat-2').checked,
        eat_3: document.getElementById('eat-3').checked
    };
    
    // KIRIM KE SERVER (Sync HP)
    await fetch('/api/health', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(data) 
    });

    // Hitung Ulang Energi Lokal
    syncEnergyWithServer(); 
}

// LOGIKA CALCULATE BMI // 

window.calculateBMI = async function() { 
    const w = parseFloat(document.getElementById('input-bb').value)||50; 
    const h_cm = parseFloat(document.getElementById('input-tb').value)||180;
    
    // KIRIM BB/TB KE SERVER
    try {
        await fetch('/api/health', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ bb: w, tb: h_cm }) 
        });
    } catch(e) {}

    const h=h_cm/100; const bmi=(w/(h*h)).toFixed(1); 
    document.getElementById('bmi-result').innerText=`BMI: ${bmi}`; 
    let st="",cl=""; if(bmi<18.5){st="Kurus";cl="text-yellow-500";}else if(bmi<=24.9){st="Ideal";cl="text-green-500";}else{st="Gemuk";cl="text-red-500";}
    const el=document.getElementById('bmi-status'); if(el){el.innerText=st; el.className=`text-[10px] font-bold mt-1 ${cl}`;}
}

// LOGIKA WATER //
window.updateWater = async function(n) { 
    let c = parseInt(document.getElementById('water-count').innerText) + n; 
    if(c < 0) c = 0; 
    
    document.getElementById('water-count').innerText = c; 
    
    // KIRIM KE SERVER (Sync HP)
    await fetch('/api/health', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ water: c }) 
    });
    
    // Hitung Ulang Energi Lokal
    syncEnergyWithServer(); 
}

// LOGIKA DAILY CEKLIST//

async function loadDailyChecklist() { 
    const c = document.getElementById('daily-checklist-container'); 
    if(!c) return; 
    
    if(!isDbConnected) {
        c.innerHTML = '<div class="text-[10px] text-red-400 text-center p-4">DB Disconnected</div>';
        return;
    }

    c.innerHTML='<div class="text-[10px] text-gray-400 text-center">Loading...</div>'; 
    const now = new Date(); 
    const tglIni = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const hariIni = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][now.getDay()];

    try { 
        // Ambil Data Jadwal DAN Data Health (Checklist) dari Server
        const [d, uts, uas, p, healthRes] = await Promise.all([
            fetchSchedule('?category=daily'), 
            fetchSchedule('?category=uts'), 
            fetchSchedule('?category=uas'), 
            fetchSchedule('?category=personal'),
            fetch('/api/health')
        ]); 

        // Update list checklist yang sudah selesai dari Database
        const healthData = await healthRes.json();
        completedTaskIds = healthData.completed_tasks || [];
        
        const safe = (a) => Array.isArray(a) ? a : [];
        const list = [...safe(d),...safe(uts),...safe(uas),...safe(p)].filter(i => (i.tanggal && i.tanggal===tglIni) || (!i.tanggal && (i.hari||"").toLowerCase()===hariIni)); 
        list.sort((a,b)=>(a.waktu||"").localeCompare(b.waktu||"")); 
        
        c.innerHTML=''; 
        if(list.length === 0) { c.innerHTML = '<div class="text-[10px] text-gray-400 text-center py-2">Kosong</div>'; return; }

        list.forEach((i,idx)=>{ 
            const uniqueId = `check_${tglIni}_${i.id || idx}`;
            // Cek status centang berdasarkan data server
            const isChecked = completedTaskIds.includes(uniqueId);
            
            c.innerHTML += `
            <div class="flex gap-2 items-start p-2 hover:bg-gray-50 rounded transition border-b border-gray-50 last:border-0">
                <input type="checkbox" id="${uniqueId}" class="check-anim mt-0.5" ${isChecked?'checked':''} onchange="toggleCheck('${uniqueId}',this)">
                <div class="text-[11px] leading-tight text-gray-700">
                    <span class="font-bold">${i.matkul||i.nama_kegiatan}</span>
                    <br><span class="text-[9px] text-gray-400">${i.waktu}</span>
                </div>
            </div>`; 
        }); 
        const dd=document.getElementById('date-today-display'); if(dd) dd.innerText=tglIni;
        
        // Recalculate Energy
        syncEnergyWithServer();

    } catch(e){ c.innerHTML='<div class="text-[10px] text-red-400">Error</div>'; } 
}

window.toggleCheck = async function(id, el) { 
    // Update Array Global Lokal
    if (el.checked) {
        if (!completedTaskIds.includes(id)) completedTaskIds.push(id);
    } else {
        completedTaskIds = completedTaskIds.filter(taskId => taskId !== id);
    }

    // KIRIM LIST CHECKLIST KE SERVER
    try {
        await fetch('/api/health', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ completed_tasks: completedTaskIds }) 
        });
        
        // Hitung ulang energi (akan berkurang 3%)
        syncEnergyWithServer(); 

    } catch (e) {
        el.checked = !el.checked; // Balikin jika gagal
    }
}


// 6. UTILS
window.toggleSleep = async function(isS) { 
    const now = new Date(); 
    if (isS) { 
        // STATUS: MAU TIDUR -> Kirim ke DB
        try {
            await fetch('/api/health', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ sleep_start: now.getTime(), wake_time: null })
            });
            updateSleepUI(true, now); 
        } catch(e) {}
    } else { 
        // STATUS: BANGUN -> Ambil waktu tidur dr DB -> Kirim Waktu Bangun
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            const s = data.sleep_start;
            
            if (!s) return alert("Data tidur tidak ditemukan di server!"); 

            await fetch('/api/health', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ wake_time: now.getTime() })
            });
            
            updateSleepUI(false, new Date(s), now); 
        } catch(e) {}
    } 
}

function updateSleepUI(isS, sDate, wDate=null) { 
    const bS = document.getElementById('btn-sleep'); 
    const bW = document.getElementById('btn-wake'); 
    const st = document.getElementById('sleep-status-text'); 
    const dS = document.getElementById('sleep-time-display'); 
    const dW = document.getElementById('wake-time-display'); 
    const fmt = d => `${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}`; 
    
    if (isS) { 
        bS.classList.add('opacity-50','cursor-not-allowed'); bS.onclick=null; 
        bW.classList.remove('opacity-50','cursor-not-allowed'); bW.onclick=()=>toggleSleep(false); 
        dS.innerText=fmt(sDate); dW.innerText="--.--"; 
        st.innerText="Zzz... Charging..."; 
        updateEnergyUI(100); 
        if(document.getElementById('sleep-quality-alert')) document.getElementById('sleep-quality-alert').classList.add('hidden');
    } else { 
        bS.classList.remove('opacity-50','cursor-not-allowed'); bS.onclick=()=>toggleSleep(true); 
        bW.classList.add('opacity-50','cursor-not-allowed'); bW.onclick=null; 
        dS.innerText=fmt(sDate); 
        if(wDate) dW.innerText=fmt(wDate); 
        st.innerText="Siap Beraktivitas!"; 
        if(wDate) calculateComplexEnergy(sDate, wDate); 
    } 
}

// --- BAGIAN INI ADA DI PALING BAWAH FILE APP.JS ---

function updateEnergyUI(v) { 
    const bar = document.getElementById('energy-bar'); 
    const txt = document.getElementById('energy-level'); 
    if (bar) bar.style.width=`${v}%`; 
    if (txt) {
        txt.innerText=`${v}%`; 
        txt.classList.remove('animate-bounce', 'text-red-600'); // Reset animation
    }
} // <--- Tutup kurung fungsi updateEnergyUI di sini

// Fungsi ini harus DILUAR, agar bisa dipanggil oleh checklist & makan/minum
function syncEnergyWithServer() {
    // Helper untuk memastikan hitungan selalu konsisten
    // Menggunakan patokan waktu Hardcode jam 06:00 pagi
    const w = new Date(); 
    w.setHours(6, 0, 0, 0); 
    
    const s = new Date(w); 
    s.setHours(w.getHours() - 7); 
    s.setMinutes(w.getMinutes() - 12); 
    
    // Pastikan fungsi calculateComplexEnergy sudah ada di atas
    if (typeof calculateComplexEnergy === "function") {
        calculateComplexEnergy(s, w); 
    }
}

// Login Logic
const loginBtn = document.getElementById('btn-login'); 
if(loginBtn) loginBtn.addEventListener('click', async (e)=>{ 
    e.preventDefault(); 
    const email=document.getElementById('email').value; 
    const pass=document.getElementById('password').value; 
    try { 
        const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})}); 
        if(res.ok) { 
            localStorage.setItem('admin_email',email); 
            localStorage.setItem('admin_password',pass); 
            showAdminPanel(); 
        } else { 
            const d=await res.json(); 
            alert(d.message||"Salah"); 
        } 
    } catch(e){alert("Error");} 
});

const btnLogout = document.getElementById('btn-logout'); 
if(btnLogout) btnLogout.addEventListener('click', ()=>{ 
    if(confirm("Logout?")) { 
        localStorage.clear(); 
        location.reload(); 
    } 
});





