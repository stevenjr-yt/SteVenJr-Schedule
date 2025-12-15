// File: app.js

// 1. SETUP
let adminPassword = null; 
let adminEmail = null;
let currentCategory = 'daily'; 
let globalSettings = { show_uts: false, show_uas: false }; 

// STATE: DB Connected diambil dari Server, bukan LocalStorage
let isDbConnected = true; 
let isMaintenanceMode = false; // VARIABLE BARU

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

        // 2. Cek Maintenance Status (BARU)
        const resMt = await fetch('/api/maintenance');
        const dataMt = await resMt.json();
        isMaintenanceMode = dataMt.is_maintenance;
        updateMaintenanceUI();

        // LOGIKA REDIRECT:
        // Jika Maintenance ON, DAN halaman ini BUKAN Admin Panel -> Lempar ke maintenance.html
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
    // Cek status terbaru dulu sebelum request data
    if (!isDbConnected) return null; 
    try {
        const res = await fetch(`/api/schedule${params}`);
        if(res.ok) return await res.json();
    } catch(e) { return []; }
    return [];
}

// --- DB TOGGLE FUNCTION (ADMIN) ---
window.toggleDatabaseConnection = async function() {
    // Toggle nilai kebalikan
    const newState = !isDbConnected;
    
    // Update UI Sementara (Optimistic UI)
    isDbConnected = newState;
    updateDbStatusUI();

    // Kirim ke Server
    try {
        await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newState })
        });
        
        // Refresh Tampilan Data
        loadAdminData(currentCategory);
        loadDailyChecklist();
        if(document.getElementById('main-dashboard')) loadTodaySchedule();
        
    } catch (e) {
        alert("Gagal mengubah status database di server!");
        isDbConnected = !newState; // Revert jika gagal
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
    updateMaintenanceUI(); // Update UI langsung biar cepat

    try {
        await fetch('/api/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_maintenance: newState })
        });
        // Reload biar logika redirect jalan (opsional, tapi bagus buat admin)
        if(newState) alert("Mode Maintenance Aktif");
    } catch (e) {
        alert("Gagal update maintenance mode!");
        isMaintenanceMode = !newState; // Balikin kalau gagal
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
    // Polling Status setiap 5 detik agar user lain update realtime
    setInterval(() => { 
        checkSystemStatus().then(() => {
            fetchSettings().then(() => { updateDashboardMenu(); loadTodaySchedule(); });
        });
    }, 5000); 
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

    // DB Check
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
    
    // DB Check
    if(!isDbConnected) {
        container.innerHTML = `<div class="text-center py-8 text-red-300"><i class="fas fa-database text-2xl mb-2"></i><p class="text-xs">Database Off</p></div>`;
        return;
    }

    const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0'); const tglIni = `${year}-${month}-${day}`; const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; const hariIni = days[now.getDay()];
    try {
        const [daily, uts, uas, personal] = await Promise.all([
            fetchSchedule('?category=daily'), fetchSchedule('?category=uts'), fetchSchedule('?category=uas'), fetchSchedule('?category=personal')
        ]);
        
        const safeList = (arr) => Array.isArray(arr) ? arr : [];
        const isToday = (item) => { if (item.tanggal && item.tanggal === tglIni) return true; if (!item.tanggal && (item.hari || "").toLowerCase() === hariIni.toLowerCase()) return true; return false; };
        
        const list = [
            ...safeList(uts).filter(u => u.tanggal === tglIni && globalSettings.show_uts).map(i => ({...i, c: 'orange', label:'UTS'})), 
            ...safeList(uas).filter(u => u.tanggal === tglIni && globalSettings.show_uas).map(i => ({...i, c: 'purple', label:'UAS'})), 
            ...safeList(daily).filter(isToday).map(i => ({...i, c: 'blue', label:'KULIAH'})), 
            ...safeList(personal).filter(isToday).map(i => ({...i, c: 'green', label:'AGENDA'}))
        ];
        list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || "")); calculateSimpleBusyness(list);

        if (list.length === 0) { container.innerHTML = `<div class="text-center py-8 text-gray-300"><i class="fas fa-mug-hot text-2xl mb-2"></i><p class="text-xs">Hari ini kosong. Santai!</p></div>`; return; }
        container.innerHTML = list.map(item => { if(window.rowWidget) return window.rowWidget(item, item.c); return `<div>${item.matkul}</div>`; }).join('');
    } catch (e) { container.innerHTML = '<p class="text-red-400 text-center text-xs">Gagal memuat jadwal.</p>'; }
}

function calculateSimpleBusyness(items) {
    let totalMinutes = 0; items.forEach(item => { if(item.waktu && item.waktu.includes('-')) { const [start, end] = item.waktu.split('-'); try { const [sh, sm] = start.split(/[:.]/).map(Number); const [eh, em] = end.split(/[:.]/).map(Number); totalMinutes += ((eh*60+em) - (sh*60+sm)); } catch(e) { totalMinutes += 60; } } else { totalMinutes += 60; } });
    const bar = document.getElementById('energy-bar'); const text = document.getElementById('energy-level'); const advice = document.getElementById('busy-advice');
    if (bar && text && !document.getElementById('admin-panel')) { let percent = Math.round((totalMinutes / 480) * 100); if(percent > 100) percent = 100; text.innerText = `${percent}%`; bar.style.width = `${percent}%`; if (percent > 80) { bar.className = "h-full bg-red-500 transition-all duration-1000"; if(advice) advice.innerText = "Sangat Sibuk!"; } else if (percent > 40) { bar.className = "h-full bg-indigo-500 transition-all duration-1000"; if(advice) advice.innerText = "Produktif."; } else { bar.className = "h-full bg-green-500 transition-all duration-1000"; if(advice) advice.innerText = "Santai."; } }
}

// 3. ADMIN PANEL
function showAdminPanel() { 
    document.getElementById('login-form').style.display = 'none'; 
    document.getElementById('admin-panel').style.display = 'block'; 
    updateDbStatusUI();
}

function initAdminFeatures() { 
    checkSystemStatus(); // Cek status awal
    updateDbStatusUI();
    loadAdminData('daily'); 
    loadDailyChecklist(); 
    initHealthTracker(); 
    initAdminToggles(); 
    setInterval(() => { const s = localStorage.getItem('steven_sleep_start'); const w = localStorage.getItem('steven_wake_time'); if (s && !w) updateSleepDurationRealtime(new Date(parseInt(s))); }, 1000); 
}

// --- LOGIKA BEBAS (INDEPENDENT) ---
function initAdminToggles() { 
    const tUts = document.getElementById('toggle-uts'); 
    const tUas = document.getElementById('toggle-uas'); 

    // Handle Toggle UTS
    if (tUts) { 
        tUts.checked = globalSettings.show_uts; 
        tUts.addEventListener('change', (e) => { 
            // Kirim status UTS yang baru + status UAS yang sekarang (biar UAS gak kereset)
            saveSettings({ 
                show_uts: e.target.checked, 
                show_uas: tUas ? tUas.checked : globalSettings.show_uas 
            }); 
        }); 
    } 

    // Handle Toggle UAS
    if (tUas) { 
        tUas.checked = globalSettings.show_uas; 
        tUas.addEventListener('change', (e) => { 
            // Kirim status UAS yang baru + status UTS yang sekarang (biar UTS gak kereset)
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

// 4. HEALTH TRACKER
function initHealthTracker() { 
    document.getElementById('input-bb').value = localStorage.getItem('steven_berat') || 50;
    document.getElementById('input-tb').value = localStorage.getItem('steven_tinggi') || 180;
    calculateBMI(); 
    
    document.getElementById('eat-1').checked = localStorage.getItem('steven_eat_1') === 'true';
    document.getElementById('eat-2').checked = localStorage.getItem('steven_eat_2') === 'true';
    document.getElementById('eat-3').checked = localStorage.getItem('steven_eat_3') === 'true';

    const savedWater = localStorage.getItem('steven_water');
    if(savedWater) document.getElementById('water-count').innerText = savedWater;

    const s = localStorage.getItem('steven_sleep_start'); const w = localStorage.getItem('steven_wake_time'); 
    if (s && !w) updateSleepUI(true, new Date(parseInt(s))); 
    else if (s && w) updateSleepUI(false, new Date(parseInt(s)), new Date(parseInt(w))); 
    else updateEnergyUI(50); 
}

window.updateEnergyFromFood = function() { 
    localStorage.setItem('steven_eat_1', document.getElementById('eat-1').checked);
    localStorage.setItem('steven_eat_2', document.getElementById('eat-2').checked);
    localStorage.setItem('steven_eat_3', document.getElementById('eat-3').checked);
    
    const s = localStorage.getItem('steven_sleep_start'); const w = localStorage.getItem('steven_wake_time'); 
    if(s && w) calculateTotalEnergy(new Date(parseInt(s)), new Date(parseInt(w))); 
}

window.calculateBMI = function() { 
    const w = parseFloat(document.getElementById('input-bb').value)||50; 
    const h_cm=parseFloat(document.getElementById('input-tb').value)||180;
    localStorage.setItem('steven_berat', w);
    localStorage.setItem('steven_tinggi', h_cm);
    const h=h_cm/100; const bmi=(w/(h*h)).toFixed(1); 
    document.getElementById('bmi-result').innerText=`BMI: ${bmi}`; 
    let st="",cl=""; if(bmi<18.5){st="Kurus";cl="text-yellow-500";}else if(bmi<=24.9){st="Ideal";cl="text-green-500";}else{st="Gemuk";cl="text-red-500";}
    const el=document.getElementById('bmi-status'); if(el){el.innerText=st; el.className=`text-[10px] font-bold mt-1 ${cl}`;}
}

window.updateWater = function(n) { 
    let c = parseInt(document.getElementById('water-count').innerText)+n; if(c<0)c=0; 
    document.getElementById('water-count').innerText=c; 
    localStorage.setItem('steven_water',c); 
}

// 5. CHECKLIST SYSTEM
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
        const [d, uts, uas, p] = await Promise.all([fetchSchedule('?category=daily'), fetchSchedule('?category=uts'), fetchSchedule('?category=uas'), fetchSchedule('?category=personal')]); 
        
        const safe = (a) => Array.isArray(a) ? a : [];
        const list = [...safe(d),...safe(uts),...safe(uas),...safe(p)].filter(i => (i.tanggal && i.tanggal===tglIni) || (!i.tanggal && (i.hari||"").toLowerCase()===hariIni)); 
        list.sort((a,b)=>(a.waktu||"").localeCompare(b.waktu||"")); 
        
        c.innerHTML=''; 
        if(list.length === 0) { c.innerHTML = '<div class="text-[10px] text-gray-400 text-center py-2">Kosong</div>'; return; }

        list.forEach((i,idx)=>{ 
            const uniqueId = `check_${tglIni}_${i.id || idx}`;
            const isChecked = localStorage.getItem(uniqueId) === 'true';
            
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
    } catch(e){ c.innerHTML='<div class="text-[10px] text-red-400">Error</div>'; } 
}

window.toggleCheck = function(id, el) { 
    localStorage.setItem(id, el.checked); 
    updateEnergyFromFood(); 
}

// 6. UTILS
function toggleSleep(isS) { const now = new Date(); if (isS) { localStorage.setItem('steven_sleep_start', now.getTime()); localStorage.removeItem('steven_wake_time'); updateSleepUI(true, now); } else { const s = localStorage.getItem('steven_sleep_start'); if (!s) return alert("Belum tidur!"); localStorage.setItem('steven_wake_time', now.getTime()); updateSleepUI(false, new Date(parseInt(s)), now); } }
function updateSleepUI(isS, sDate, wDate=null) { const bS = document.getElementById('btn-sleep'); const bW = document.getElementById('btn-wake'); const st = document.getElementById('sleep-status-text'); const dS = document.getElementById('sleep-time-display'); const dW = document.getElementById('wake-time-display'); const fmt = d => `${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}`; if (isS) { bS.classList.add('opacity-50','cursor-not-allowed'); bS.onclick=null; bW.classList.remove('opacity-50','cursor-not-allowed'); bW.onclick=()=>toggleSleep(false); dS.innerText=fmt(sDate); dW.innerText="--.--"; st.innerText="Zzz..."; updateEnergyUI(0); } else { bS.classList.remove('opacity-50','cursor-not-allowed'); bS.onclick=()=>toggleSleep(true); bW.classList.add('opacity-50','cursor-not-allowed'); bW.onclick=null; dS.innerText=fmt(sDate); if(wDate) dW.innerText=fmt(wDate); st.innerText="Siap!"; if(wDate) calculateTotalEnergy(sDate, wDate); } }
function updateSleepDurationRealtime(sDate) { const now = new Date(); const diff = now - sDate; const h = Math.floor(diff/3600000); const m = Math.floor((diff%3600000)/60000); const s = Math.floor((diff%60000)/1000); document.getElementById('sleep-duration-text').innerText=`Tidur: ${h}j ${m}m ${s}d`; }
function calculateTotalEnergy(sDate, wDate) { const diff = wDate - sDate; let e = (diff/3600000/8)*100; if(document.getElementById('eat-1').checked) e+=15; if(document.getElementById('eat-2').checked) e+=15; if(document.getElementById('eat-3').checked) e+=15; const tasks = document.querySelectorAll('.check-anim:checked').length; e-=(tasks*5); if(e>100)e=100; if(e<0)e=0; const h = Math.floor(diff/3600000); const m = Math.floor((diff%3600000)/60000); document.getElementById('sleep-duration-text').innerText=`Total: ${h}j ${m}m`; updateEnergyUI(Math.round(e)); }
function updateEnergyUI(v) { const bar = document.getElementById('energy-bar'); const txt = document.getElementById('energy-level'); if (bar && txt) { bar.style.width=`${v}%`; txt.innerText=`${v}%`; bar.className=`h-full transition-all duration-500 ${v>50?'bg-green-500':'bg-red-500'}`; } }

// Login
const loginBtn = document.getElementById('btn-login'); if(loginBtn) loginBtn.addEventListener('click', async (e)=>{ e.preventDefault(); const email=document.getElementById('email').value; const pass=document.getElementById('password').value; try { const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})}); if(res.ok) { localStorage.setItem('admin_email',email); localStorage.setItem('admin_password',pass); showAdminPanel(); } else { const d=await res.json(); alert(d.message||"Salah"); } } catch(e){alert("Error");} });
const btnLogout = document.getElementById('btn-logout'); if(btnLogout) btnLogout.addEventListener('click', ()=>{ if(confirm("Logout?")) { localStorage.clear(); location.reload(); } });



