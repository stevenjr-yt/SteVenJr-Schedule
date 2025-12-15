// File: app.js

// ==========================================
// 1. GLOBAL VARS
// ==========================================
let adminPassword = null; 
let adminEmail = null;
let currentCategory = 'daily'; 
let globalSettings = { show_uts: false, show_uas: false }; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Login Check
    const savedEmail = localStorage.getItem('admin_email');
    const savedPass = localStorage.getItem('admin_password');
    if (savedEmail && savedPass) {
        adminEmail = savedEmail;
        adminPassword = savedPass;
        if (document.getElementById('admin-panel')) showAdminPanel();
    }

    // 2. Jam Digital
    updateClock();
    setInterval(updateClock, 1000);

    // 3. LOAD DATA UTAMA (Langsung, jangan tunggu settings)
    if (document.getElementById('admin-panel')) {
        initAdminFeatures();
    } else if (document.getElementById('main-dashboard')) {
        initDashboardFeatures();
    }

    // 4. LOAD SETTINGS BACKGROUND
    fetchSettings().then(() => {
        if(window.updateDashboardMenu) updateDashboardMenu();
        if(window.initAdminToggles) initAdminToggles();
        // Reload jadwal index agar filter UTS/UAS terupdate (tanpa crash)
        if(document.getElementById('main-dashboard')) loadTodaySchedule();
    });
});

// --- API SETTINGS ---
async function fetchSettings() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) globalSettings = await res.json();
    } catch (e) { console.log("Settings info:", e); }
}

async function saveSettings(newStatus) {
    try {
        globalSettings = { ...globalSettings, ...newStatus }; 
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(globalSettings)
        });
    } catch (e) { alert("Gagal simpan toggle!"); }
}

function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    const adminClock = document.getElementById('admin-realtime-clock');

    if(clockEl) clockEl.innerText = `${h}.${m}.${s}`;
    if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if(adminClock) adminClock.innerText = `${h}:${m}:${s}`;
}

// ==========================================
// 2. LOGIC DASHBOARD (INDEX)
// ==========================================
function initDashboardFeatures() {
    updateDashboardMenu(); 
    loadTodaySchedule(); 
    
    setInterval(() => {
        fetchSettings().then(() => {
            updateDashboardMenu();
            // loadTodaySchedule(); // Opsional: disable auto reload jadwal berat jika perlu
        });
    }, 5000);
}

function updateDashboardMenu() {
    const utsBtn = document.getElementById('btn-menu-uts');
    const uasBtn = document.getElementById('btn-menu-uas');
    const container = document.getElementById('exam-buttons-container');

    if(!container) return;

    if(globalSettings.show_uts || globalSettings.show_uas) {
        container.classList.remove('hidden');
        container.classList.add('flex');
        utsBtn.classList.toggle('hidden', !globalSettings.show_uts);
        uasBtn.classList.toggle('hidden', !globalSettings.show_uas);
        
        if(globalSettings.show_uts) utsBtn.classList.add('flex');
        if(globalSettings.show_uas) uasBtn.classList.add('flex');
    } else {
        container.classList.add('hidden');
        container.classList.remove('flex');
    }
}

// --- SAFE FETCH HELPER (FIX CRASH) ---
async function safeFetch(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return []; // Jika 404/500, return array kosong
        const data = await res.json();
        return Array.isArray(data) ? data : []; // Pastikan Array
    } catch (e) {
        console.error("Fetch Error:", url, e);
        return [];
    }
}

// --- FUNGSI LOAD SCHEDULE DATA ---
window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400 text-xs">Memuat data...</td></tr>';
    if(titleElement) titleElement.innerText = category.toUpperCase();

    // GUNAKAN SAFE FETCH
    const data = await safeFetch(`/api/schedule?category=${category}`);
    
    if(!tableBody) return;
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400 text-xs">Data Kosong / Gagal Load</td></tr>`;
        return;
    }

    // Sorting
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
        <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition text-sm">
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
}

// --- LOAD JADWAL HARI INI (TIMELINE) ---
async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const tglIni = `${year}-${month}-${day}`;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = days[now.getDay()];

    // GUNAKAN SAFE FETCH AGAR TIDAK CRASH
    const [daily, uts, uas, personal] = await Promise.all([
        safeFetch('/api/schedule?category=daily'),
        safeFetch('/api/schedule?category=uts'),
        safeFetch('/api/schedule?category=uas'),
        safeFetch('/api/schedule?category=personal')
    ]);

    // Debugging (Opsional)
    // console.log("Data Loaded:", {daily, uts, uas, personal});

    const isToday = (item) => {
        if (item.tanggal && item.tanggal === tglIni) return true;
        if (!item.tanggal && (item.hari || "").toLowerCase() === hariIni.toLowerCase()) return true;
        return false;
    };

    const list = [
        ...uts.filter(u => u.tanggal === tglIni && globalSettings.show_uts).map(i => ({...i, c: 'orange', label:'UTS'})),
        ...uas.filter(u => u.tanggal === tglIni && globalSettings.show_uas).map(i => ({...i, c: 'purple', label:'UAS'})),
        ...daily.filter(isToday).map(i => ({...i, c: 'blue', label:'KULIAH'})),
        ...personal.filter(isToday).map(i => ({...i, c: 'green', label:'AGENDA'}))
    ];

    list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || ""));
    calculateSimpleBusyness(list);

    if (list.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-gray-300"><i class="fas fa-mug-hot text-2xl mb-2"></i><p class="text-xs">Hari ini kosong. Santai!</p></div>`;
        return;
    }

    container.innerHTML = list.map(item => {
         if(window.rowWidget) return window.rowWidget(item, item.c);
         return `<div class="p-3 bg-white mb-2 rounded shadow-sm text-xs border-l-4 border-blue-500">${item.matkul}</div>`;
    }).join('');
}

function calculateSimpleBusyness(items) {
    let totalMinutes = 0;
    items.forEach(item => {
        if(item.waktu && item.waktu.includes('-')) {
            const [start, end] = item.waktu.split('-');
            try {
                const [sh, sm] = start.split(/[:.]/).map(Number);
                const [eh, em] = end.split(/[:.]/).map(Number);
                totalMinutes += ((eh*60+em) - (sh*60+sm));
            } catch(e) { totalMinutes += 60; }
        } else { totalMinutes += 60; }
    });

    const bar = document.getElementById('energy-bar'); 
    const text = document.getElementById('energy-level');
    const advice = document.getElementById('busy-advice');
    
    if (bar && text && !document.getElementById('admin-panel')) {
        let percent = Math.round((totalMinutes / 480) * 100);
        if(percent > 100) percent = 100;
        
        text.innerText = `${percent}%`;
        bar.style.width = `${percent}%`;
        
        if (percent > 80) { bar.className = "h-full bg-red-500 transition-all duration-1000"; if(advice) advice.innerText = "Sangat Sibuk!"; } 
        else if (percent > 40) { bar.className = "h-full bg-indigo-500 transition-all duration-1000"; if(advice) advice.innerText = "Produktif."; } 
        else { bar.className = "h-full bg-green-500 transition-all duration-1000"; if(advice) advice.innerText = "Santai."; }
    }
}

// ==========================================
// 3. LOGIC ADMIN PANEL
// ==========================================
function showAdminPanel() {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');
    if(loginForm) loginForm.style.display = 'none';
    if(adminPanel) adminPanel.style.display = 'block';
}

function initAdminFeatures() {
    loadAdminData('daily'); 
    loadDailyChecklist(); 
    initHealthTracker();
    initAdminToggles(); 

    setInterval(() => {
        const sleepStart = localStorage.getItem('steven_sleep_start');
        const wakeTime = localStorage.getItem('steven_wake_time');
        if (sleepStart && !wakeTime) updateSleepDurationRealtime(new Date(parseInt(sleepStart)));
    }, 1000);
}

function initAdminToggles() {
    const tUts = document.getElementById('toggle-uts');
    const tUas = document.getElementById('toggle-uas');
    if (tUts) {
        tUts.checked = globalSettings.show_uts;
        tUts.addEventListener('change', (e) => saveSettings({ show_uts: e.target.checked }));
    }
    if (tUas) {
        tUas.checked = globalSettings.show_uas;
        tUas.addEventListener('change', (e) => saveSettings({ show_uas: e.target.checked }));
    }
}

window.switchTab = function(targetId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.className = "tab-btn px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded flex-shrink-0 transition";
    });
    btn.className = "tab-btn active px-3 py-1.5 text-[10px] font-bold bg-indigo-50 border border-indigo-100 shadow-sm rounded-lg text-indigo-700 flex-shrink-0 transition";
    currentCategory = targetId.replace('list-', '');
    loadAdminData(currentCategory);
}

async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Loading...</div>';
    if (!adminPassword) return;
    
    // GUNAKAN SAFE FETCH
    const data = await safeFetch(`/api/schedule?category=${category}`);
    container.innerHTML = ''; 
    
    if (data.length === 0) { 
        container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Data Kosong</div>'; 
        return; 
    }
    
    data.forEach(item => {
        const title = item.matkul || item.nama_kegiatan || item.nama || "Item";
        container.innerHTML += `
            <div class="bg-gray-50 p-2 rounded-lg border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition">
                <div class="overflow-hidden w-full pr-2">
                    <div class="font-bold text-[11px] text-gray-700 truncate">${title}</div>
                    <div class="text-[9px] text-gray-400">${item.hari || item.tanggal} • <span class="text-indigo-500">${item.waktu}</span></div>
                </div>
                <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded transition"><i class="fas fa-trash-alt text-[10px]"></i></button>
            </div>`;
    });
}

const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!adminPassword) { alert("Login dulu!"); return; }
        const rawData = {
            kategori: document.getElementById('kategori').value,
            matkul: document.getElementById('matkul').value,
            hari: document.getElementById('hari').value,
            tanggal: document.getElementById('tanggal').value,
            waktu: document.getElementById('waktu').value,
            ruangan: document.getElementById('ruangan').value,
            kode: document.getElementById('kode').value,
            dosen: document.getElementById('dosen').value,
            kelas: document.getElementById('kelas').value,
            tipe: document.getElementById('tipe').value,
            keterangan: document.getElementById('keterangan').value,
        };
        if(document.getElementById('hari').classList.contains('hidden')) rawData.hari = "";
        if(document.getElementById('tanggal').classList.contains('hidden')) rawData.tanggal = "";

        try {
            const res = await fetch('/api/schedule', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify(rawData)
            });
            if (res.ok) {
                alert("Tersimpan!"); addForm.reset(); 
                if(window.toggleFormFields) window.toggleFormFields(); 
                loadAdminData(rawData.kategori); loadDailyChecklist();
            } else { alert("Gagal simpan."); }
        } catch (err) { alert("Error sistem."); }
    });
}

window.deleteSchedule = async function(id, category) {
    if(!confirm("Hapus?")) return;
    try {
        const res = await fetch(`/api/schedule?id=${id}&category=${category}`, { method: 'DELETE', headers: { 'x-admin-password': adminPassword } });
        if(res.ok) { loadAdminData(category); loadDailyChecklist(); }
    } catch(e) { alert("Error koneksi."); }
}

// --- HEALTH TRACKER ---
function initHealthTracker() {
    calculateBMI();
    document.getElementById('eat-1').checked = localStorage.getItem('steven_eat_1') === 'true';
    document.getElementById('eat-2').checked = localStorage.getItem('steven_eat_2') === 'true';
    document.getElementById('eat-3').checked = localStorage.getItem('steven_eat_3') === 'true';
    const sleepStart = localStorage.getItem('steven_sleep_start');
    const wakeTime = localStorage.getItem('steven_wake_time');
    if (sleepStart && !wakeTime) updateSleepUI(true, new Date(parseInt(sleepStart)));
    else if (sleepStart && wakeTime) updateSleepUI(false, new Date(parseInt(sleepStart)), new Date(parseInt(wakeTime)));
    else updateEnergyUI(50);
    document.getElementById('water-count').innerText = localStorage.getItem('steven_water') || 0;
}
function toggleSleep(isSleeping) {
    const now = new Date();
    if (isSleeping) {
        localStorage.setItem('steven_sleep_start', now.getTime());
        localStorage.removeItem('steven_wake_time'); 
        updateSleepUI(true, now);
    } else {
        const sleepStart = localStorage.getItem('steven_sleep_start');
        if (!sleepStart) return alert("Belum mulai tidur!");
        localStorage.setItem('steven_wake_time', now.getTime());
        updateSleepUI(false, new Date(parseInt(sleepStart)), now);
    }
}
function updateSleepUI(isSleeping, sleepDate, wakeDate = null) {
    const btnSleep = document.getElementById('btn-sleep');
    const btnWake = document.getElementById('btn-wake');
    const statusText = document.getElementById('sleep-status-text');
    const displayS = document.getElementById('sleep-time-display');
    const displayW = document.getElementById('wake-time-display');
    const formatTime = (d) => { const h = String(d.getHours()).padStart(2,'0'); const m = String(d.getMinutes()).padStart(2,'0'); return `${h}.${m}`; };
    if (isSleeping) {
        btnSleep.classList.add('opacity-50', 'cursor-not-allowed'); btnSleep.onclick = null;
        btnWake.classList.remove('opacity-50', 'cursor-not-allowed'); btnWake.onclick = () => toggleSleep(false);
        displayS.innerText = formatTime(sleepDate); displayW.innerText = "--.--"; statusText.innerText = "Zzz..."; updateEnergyUI(0);
    } else {
        btnSleep.classList.remove('opacity-50', 'cursor-not-allowed'); btnSleep.onclick = () => toggleSleep(true);
        btnWake.classList.add('opacity-50', 'cursor-not-allowed'); btnWake.onclick = null;
        displayS.innerText = formatTime(sleepDate); if(wakeDate) displayW.innerText = formatTime(wakeDate); statusText.innerText = "Siap!"; if(wakeDate) calculateTotalEnergy(sleepDate, wakeDate);
    }
}
function updateSleepDurationRealtime(startDate) {
    const now = new Date();
    const diff = now - startDate;
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const sec = Math.floor((diff % (1000 * 60)) / 1000);
    const textEl = document.getElementById('sleep-duration-text');
    if(textEl) textEl.innerText = `Tidur: ${hrs}j ${mins}m ${sec}d`;
}
function calculateTotalEnergy(sleepDate, wakeDate) {
    const diffMs = wakeDate - sleepDate;
    const diffHours = diffMs / (1000 * 60 * 60);
    let energy = (diffHours / 8) * 100;
    if (document.getElementById('eat-1').checked) energy += 15;
    if (document.getElementById('eat-2').checked) energy += 15;
    if (document.getElementById('eat-3').checked) energy += 15;
    const checkedTasks = document.querySelectorAll('.check-anim:checked').length;
    energy -= (checkedTasks * 5);
    if (energy > 100) energy = 100; if (energy < 0) energy = 0;
    const hrs = Math.floor(diffHours); const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const textEl = document.getElementById('sleep-duration-text'); if(textEl) textEl.innerText = `Total: ${hrs}j ${mins}m`;
    updateEnergyUI(Math.round(energy));
}
function updateEnergyUI(value) {
    const bar = document.getElementById('energy-bar'); const text = document.getElementById('energy-level');
    if (bar && text) { bar.style.width = `${value}%`; text.innerText = `${value}%`; bar.className = `h-full transition-all duration-500 ${value > 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`; }
}
function updateEnergyFromFood() {
    localStorage.setItem('steven_eat_1', document.getElementById('eat-1').checked);
    localStorage.setItem('steven_eat_2', document.getElementById('eat-2').checked);
    localStorage.setItem('steven_eat_3', document.getElementById('eat-3').checked);
    const s = localStorage.getItem('steven_sleep_start'); const w = localStorage.getItem('steven_wake_time');
    if (s && w) calculateTotalEnergy(new Date(parseInt(s)), new Date(parseInt(w)));
}
function calculateBMI() {
    const w = parseFloat(document.getElementById('input-bb').value) || 50; const h = 1.8; 
    const bmi = (w / (h*h)).toFixed(1); const res = document.getElementById('bmi-result');
    let st = bmi < 18.5 ? "KURUS" : bmi < 25 ? "IDEAL" : "GEMUK"; res.innerText = `BMI: ${bmi} (${st})`;
}
function updateWater(n) {
    let cur = parseInt(document.getElementById('water-count').innerText) + n; if (cur < 0) cur = 0;
    document.getElementById('water-count').innerText = cur; localStorage.setItem('steven_water', cur);
}
async function loadDailyChecklist() {
    const container = document.getElementById('daily-checklist-container'); const dateDisplay = document.getElementById('date-today-display');
    if (!container) return;
    const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0'); const tglIni = `${year}-${month}-${day}`; 
    if(dateDisplay) dateDisplay.innerText = `${day}/${month}`;
    // container.innerHTML = '<p class="text-center text-xs text-gray-400">Loading...</p>';
    
    // GUNAKAN SAFE FETCH
    const [daily, uts, uas, personal] = await Promise.all([
        safeFetch('/api/schedule?category=daily'),
        safeFetch('/api/schedule?category=uts'),
        safeFetch('/api/schedule?category=uas'),
        safeFetch('/api/schedule?category=personal')
    ]);

    const isToday = (item) => { if (item.tanggal && item.tanggal === tglIni) return true; if (!item.tanggal && (item.hari || "").toLowerCase() === ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][now.getDay()] ) return true; return false; };
    const list = [...uts.filter(u=>u.tanggal===tglIni).map(i=>({...i, c:'orange'})), ...uas.filter(u=>u.tanggal===tglIni).map(i=>({...i, c:'purple'})), ...daily.filter(isToday).map(i=>({...i, c:'blue'})), ...personal.filter(isToday).map(i=>({...i, c:'green'}))];
    list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || ""));
    if (list.length === 0) { container.innerHTML = `<div class="text-center py-4 text-gray-400 text-xs">Kosong</div>`; return; }
    container.innerHTML = "";
    list.forEach((item, index) => {
        const checkId = `check_${tglIni}_${item.id || index}`; const isChecked = localStorage.getItem(checkId) === 'true' ? 'checked' : '';
        const title = item.matkul || item.nama_kegiatan || "Kegiatan";
        container.innerHTML += `<div class="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition"><input type="checkbox" class="w-4 h-4 mt-0.5 accent-indigo-600 check-anim" ${isChecked} onchange="toggleCheck('${checkId}', this)"><span class="text-xs font-bold text-gray-700 truncate">${title}</span></div>`;
    });
    updateEnergyFromFood();
}
window.toggleCheck = function(id, el) { localStorage.setItem(id, el.checked); updateEnergyFromFood(); }
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault(); const email = document.getElementById('email').value; const pass = document.getElementById('password').value;
        if(!email || !pass) return alert("Isi Data!");
        try {
            const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) });
            if (res.ok) { localStorage.setItem('admin_email', email); localStorage.setItem('admin_password', pass); showAdminPanel(); } else { alert("Salah!"); }
        } catch (err) { alert("Error"); }
    });
}
const btnLogout = document.getElementById('btn-logout'); if (btnLogout) btnLogout.addEventListener('click', () => { if(confirm("Logout?")) { localStorage.clear(); location.reload(); }});
