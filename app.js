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

// TAMBAHAN BARU (GLOBAL VAR):
let globalSleepStart = null;
let globalWakeTime = null;

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
    
    // SAYA KOMENTARI (NONAKTIFKAN) initHealthTracker DI SINI
    // Alasannya: Agar logic bar 'Daily Load' tidak tertimpa oleh logic 'Energi Tubuh'.
    // initHealthTracker(); 
    
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

        // --- START: LOGIKA DAILY LOAD (INDIKATOR FINAL) ---
        let totalMinutes = 0;
        
        list.forEach(item => {
            if (item.waktu && item.waktu.includes('-')) {
                try {
                    const parts = item.waktu.split('-').map(t => t.trim());
                    const toMinutes = (t) => {
                        const [h, m] = t.split(/[:.]/).map(Number);
                        return h * 60 + m;
                    };
                    const start = toMinutes(parts[0]);
                    const end = toMinutes(parts[1]);
                    if (end > start) totalMinutes += (end - start);
                } catch (e) {}
            }
        });

        // Target 8 Jam = 480 Menit
        const targetMinutes = 480; 
        const totalHours = (totalMinutes / 60).toFixed(1); 
        let loadPercent = Math.round((totalMinutes / targetMinutes) * 100);

        // Max Mentok 100%
        if (loadPercent > 100) loadPercent = 100;

        // UI Update
        const bar = document.getElementById('energy-bar');
        const txtLvl = document.getElementById('energy-level');
        const txtDrain = document.getElementById('task-drain-text');
        const txtForecast = document.getElementById('energy-forecast-text');

        if(bar) {
            bar.style.width = `${loadPercent}%`;
            
            // RESET CLASS AWAL
            bar.className = "h-full transition-all duration-1000";

            // LOGIKA WARNA & ANIMASI
            if (loadPercent <= 15) {
                // 0-15% : Sangat Santai (Hijau Muda)
                bar.classList.add('bg-green-400', 'shadow-[0_0_10px_rgba(74,222,128,0.5)]');
            } else if (loadPercent <= 25) {
                // 16-25% : Santai (Hijau Normal)
                bar.classList.add('bg-green-500', 'shadow-[0_0_10px_rgba(34,197,94,0.5)]');
            } else if (loadPercent <= 50) {
                // 26-50% : Produktif (Indigo)
                bar.classList.add('bg-indigo-500', 'shadow-[0_0_10px_rgba(99,102,241,0.5)]');
            } else if (loadPercent <= 80) {
                // 51-80% : Sibuk (Orange - BAR KEDAP KEDIP)
                bar.classList.add('bg-orange-500', 'shadow-[0_0_10px_rgba(249,115,22,0.5)]', 'animate-pulse');
            } else {
                // 81-100% : Sangat Sibuk (Merah)
                bar.classList.add('bg-red-600', 'shadow-[0_0_10px_rgba(220,38,38,0.5)]');
            }
        }

        if(txtLvl) txtLvl.innerText = `${loadPercent}%`;
        if(txtDrain) txtDrain.innerText = `Total: ${totalHours} Jam Kegiatan`;

        // LOGIKA TEKS MOTIVASI
        if(txtForecast) {
            if (totalMinutes === 0) {
                txtForecast.innerHTML = "<span class='text-gray-400 font-bold'>Hari Kosong.</span>";
            } else if (loadPercent <= 15) {
                txtForecast.innerHTML = "<span class='text-green-400 font-bold'>Sangat Santai.</span>";
            } else if (loadPercent <= 25) {
                txtForecast.innerHTML = "<span class='text-green-600 font-bold'>Santai.</span>";
            } else if (loadPercent <= 50) {
                txtForecast.innerHTML = "<span class='text-indigo-500 font-bold'>Produktif.</span>";
            } else if (loadPercent <= 80) {
                txtForecast.innerHTML = "<span class='text-orange-500 font-bold'>Sibuk.</span>";
            } else {
                // 81-100% : Sangat Sibuk - TEKS KEDAP KEDIP
                txtForecast.innerHTML = "<span class='text-red-600 font-bold animate-pulse'>SANGAT SIBUK!</span>";
            }
        }
        // --- END LOGIKA DAILY LOAD ---

        // Cek Konflik
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
        console.error(e);
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
    try {
        // 1. Fetch Data dari Server
        const res = await fetch('/api/health');
        const data = await res.json();
        
        // Load Checklist & Data Fisik Standard
        completedTaskIds = data.completed_tasks || [];
        document.getElementById('input-bb').value = data.bb || 50;
        document.getElementById('input-tb').value = data.tb || 180;
        document.getElementById('water-count').innerText = data.water || 0;
        document.getElementById('eat-1').checked = data.eat_1 || false;
        document.getElementById('eat-2').checked = data.eat_2 || false;
        document.getElementById('eat-3').checked = data.eat_3 || false;
        
        calculateBMI();

        // 2. LOGIKA UTAMA (MODAL vs DB REAL)
        
        // Skenario A: Database KOSONG (Belum ada data tidur hari ini)
        if (!data.sleep_start) {
            console.log("Database kosong. Menyuntikkan modal awal (00:00 - 05:00)...");

            const now = new Date();
            // Set Bangun: Jam 05:00 Pagi Ini
            const modalWake = new Date();
            modalWake.setHours(5, 0, 0, 0); 
            // Set Tidur: Jam 00:00 (Tengah Malam Tadi)
            const modalSleep = new Date(modalWake);
            modalSleep.setHours(0, 0, 0, 0); 

            // Simpan ke Global Variable
            globalSleepStart = modalSleep;
            globalWakeTime = modalWake;

            // PENTING: SIMPAN KE DATABASE SERVER (Biar pas refresh gak hilang)
            await fetch('/api/health', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    sleep_start: modalSleep.getTime(), 
                    wake_time: modalWake.getTime() 
                })
            });
            
            // Update UI
            updateSleepUI(false, globalSleepStart, globalWakeTime);

        } else {
            // Skenario B: Database ADA ISINYA (Entah modal tadi, atau data tidur baru)
            const dbSleep = new Date(data.sleep_start);
            const dbWake = data.wake_time ? new Date(data.wake_time) : null;

            globalSleepStart = dbSleep;
            globalWakeTime = dbWake;

            if (dbSleep && !dbWake) {
                // Sedang Tidur (Lagi nge-charge)
                updateSleepUI(true, globalSleepStart); 
            } else {
                // Sudah Bangun
                updateSleepUI(false, globalSleepStart, globalWakeTime); 
            }
        }

        // Jalankan interval update energi per menit
        setInterval(() => {
            syncEnergyWithServer();
        }, 60000); 

    } catch (e) {
        console.error("Gagal load health data", e);
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
        // --- TOMBOL TIDUR DITEKAN ---
        // Ini akan menimpa data modal (00:00-05:00) dengan waktu tidur BARU
        try {
            await fetch('/api/health', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ sleep_start: now.getTime(), wake_time: null })
            });
            
            // Update memori lokal
            globalSleepStart = now;
            globalWakeTime = null;
            
            updateSleepUI(true, now); 
        } catch(e) { alert("Gagal update status tidur"); }

    } else { 
        // --- TOMBOL BANGUN DITEKAN ---
        if (!globalSleepStart) {
            // Safety: Ambil dari DB kalau variable global kosong
            const r = await fetch('/api/health');
            const d = await r.json();
            if(d.sleep_start) globalSleepStart = new Date(d.sleep_start);
            else return alert("Data error: Belum mulai tidur.");
        }

        try {
            await fetch('/api/health', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ wake_time: now.getTime() })
            });
            
            // Update memori lokal
            globalWakeTime = now;
            
            updateSleepUI(false, globalSleepStart, globalWakeTime); 
        } catch(e) { alert("Gagal update status bangun"); }
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

// --- TARUH INI DI ATAS function updateEnergyUI ---

function calculateComplexEnergy(sDate, wDate) {
    const now = new Date();
    
    // 1. HITUNG DURASI TIDUR (REAL)
    const sleepMs = wDate - sDate;
    const sleepHours = sleepMs / (1000 * 60 * 60); // Konversi ke Jam
    
    // Update Teks Durasi di UI (Jika ada elemennya)
    const durasiElem = document.getElementById('durasi-tidur-text'); // Pastikan ID ini sesuai HTML kamu
    if(durasiElem) {
       const jam = Math.floor(sleepHours);
       const menit = Math.floor((sleepHours - jam) * 60);
       durasiElem.innerText = `Durasi: ${jam} Jam ${menit} Menit`;
    }

    // 2. HITUNG MODAL ENERGI (Target 8 Jam = 100%)
    let energyModal = (sleepHours / 8) * 100; 
    if(energyModal > 100) energyModal = 100;

    // UI Alert Kualitas Tidur
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

    // 3. HITUNG PENGURANGAN ENERGI (DECAY)
    // Energi berkurang 5% per jam setelah bangun
    const hoursAwake = (now - wDate) / (1000 * 60 * 60);
    // Jika hoursAwake negatif (artinya baru diset bangun di masa depan/error), anggap 0
    const validAwake = hoursAwake > 0 ? hoursAwake : 0; 
    const timeDecay = validAwake * 5; 

    // 4. HITUNG ASUPAN (MAKAN/MINUM)
    let fuel = 0;
    if(document.getElementById('eat-1') && document.getElementById('eat-1').checked) fuel += 15;
    if(document.getElementById('eat-2') && document.getElementById('eat-2').checked) fuel += 15;
    if(document.getElementById('eat-3') && document.getElementById('eat-3').checked) fuel += 15;
    
    const waterElem = document.getElementById('water-count');
    if(waterElem) {
        const waterLevel = parseInt(waterElem.innerText) || 0;
        fuel += (waterLevel * 2); 
    }

    // 5. HITUNG BEBAN TUGAS (Checklist)
    const tasksDone = document.querySelectorAll('.check-anim:checked').length;
    const tasksTotal = document.querySelectorAll('.check-anim').length;
    const taskDrain = tasksDone * 3; 

    // 6. TOTAL AKHIR
    let currentEnergy = energyModal - timeDecay + fuel - taskDrain;
    
    // Normalisasi (0 - 100)
    if(currentEnergy > 100) currentEnergy = 100;
    if(currentEnergy < 0) currentEnergy = 0;

    const finalEnergy = Math.round(currentEnergy);

    // Update UI
    updateEnergyUI(finalEnergy);
    
    // Update Forecast Text
    if (typeof updateProductivityForecast === "function") {
        updateProductivityForecast(finalEnergy, tasksTotal, tasksDone);
    }

    // --- SYNC HASIL HITUNGAN KE SERVER (Opsional, agar tidak spam) ---
    if (window.lastSentEnergy !== finalEnergy) {
        window.lastSentEnergy = finalEnergy;
        // Silent sync
        fetch('/api/health', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ last_energy_level: finalEnergy }) 
        }).catch(e => {});
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
// Fungsi ini harus DILUAR
function syncEnergyWithServer() {
    // Kalau data belum siap, jangan hitung
    if (!globalSleepStart) return;

    // Jika sedang tidur (Wake Time belum ada), energi 100%
    if (globalSleepStart && !globalWakeTime) {
        updateEnergyUI(100);
        return;
    }

    // Jika sudah bangun, hitung mundur energi dari waktu bangun ASLI
    if (globalSleepStart && globalWakeTime) {
        if (typeof calculateComplexEnergy === "function") {
            calculateComplexEnergy(globalSleepStart, globalWakeTime); 
        }
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









