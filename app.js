// File: app.js

// ==========================================
// 1. GLOBAL VARIABLES & KONFIGURASI
// ==========================================
let adminPassword = null; 
let adminEmail = null;
let currentCategory = 'daily'; 

// State Global untuk Settings (Sinkronisasi Antar Device)
let globalSettings = { show_uts: false, show_uas: false };

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek Login (Khusus Admin)
    const savedEmail = localStorage.getItem('admin_email');
    const savedPass = localStorage.getItem('admin_password');
    if (savedEmail && savedPass) {
        adminEmail = savedEmail;
        adminPassword = savedPass;
        // Jika sedang di halaman admin, buka panelnya
        if (document.getElementById('admin-panel')) showAdminPanel();
    }

    // 2. Jalankan Jam Global (Detik Berjalan)
    updateClock();
    setInterval(updateClock, 1000);

    // 3. LOAD DATA & LOGIC SESUAI HALAMAN
    // Kita fetch settings dulu dari server agar UI sinkron
    fetchSettings().then(() => {
        // Routing Logic: Cek elemen ID untuk tahu ini halaman Admin atau Index
        if (document.getElementById('admin-panel')) {
            initAdminFeatures();
        } else if (document.getElementById('main-dashboard')) {
            initDashboardFeatures();
        }
    });
});

// ==========================================
// 2. SERVER SYNC (TOGGLE SETTINGS)
// ==========================================

// Ambil Status Toggle dari Database
async function fetchSettings() {
    try {
        const res = await fetch('/api/settings'); // Endpoint backend baru
        if(res.ok) {
            globalSettings = await res.json();
            console.log("System Settings Loaded:", globalSettings);
        }
    } catch (e) { 
        console.error("Gagal sync settings:", e);
        // Default fallback jika offline
        globalSettings = { show_uts: false, show_uas: false };
    }
}

// Simpan Status Toggle ke Database (Dipanggil Admin)
async function saveSettings(newStatus) {
    try {
        // Update lokal dulu (biar UI responsif)
        globalSettings = { ...globalSettings, ...newStatus };
        
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(globalSettings)
        });
        console.log("Settings Updated to Cloud");
    } catch (e) { 
        console.error("Gagal save settings:", e);
        alert("Gagal menyimpan status ke server!");
    }
}

// ==========================================
// 3. GLOBAL UTILS (JAM & FORMAT)
// ==========================================
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    
    // Tampilan Jam Dashboard (Index) - Format Titik (08.10.20)
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    if(clockEl) clockEl.innerText = `${h}.${m}.${s}`;
    if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Tampilan Jam Admin (Navbar) - Format Titik Dua (08:10:20)
    const adminClock = document.getElementById('admin-realtime-clock');
    if(adminClock) adminClock.innerText = `${h}:${m}:${s}`;
}

// ==========================================
// 4. LOGIC DASHBOARD (HALAMAN DEPAN/ORTU)
// ==========================================
function initDashboardFeatures() {
    // Render awal
    updateDashboardMenu(); 
    loadTodaySchedule();
    
    // AUTO REFRESH (Polling setiap 10 detik)
    // Agar HP orang tua update otomatis tanpa refresh page
    setInterval(() => {
        fetchSettings().then(() => {
            updateDashboardMenu();
            // Opsional: Reload jadwal juga jika ingin super realtime
            // loadTodaySchedule(); 
        });
    }, 10000); 
}

function updateDashboardMenu() {
    const utsBtn = document.getElementById('btn-menu-uts');
    const uasBtn = document.getElementById('btn-menu-uas');
    const container = document.getElementById('exam-buttons-container');

    // Reset hidden dulu
    if (utsBtn) utsBtn.classList.add('hidden');
    if (uasBtn) uasBtn.classList.add('hidden');
    if (container) container.classList.add('hidden');

    // Cek Global Settings (Data Server)
    if (globalSettings.show_uts || globalSettings.show_uas) {
        if(container) {
            container.classList.remove('hidden');
            // Tambahkan animasi fade-in biar halus
            container.classList.add('flex'); 
        }
        if (globalSettings.show_uts && utsBtn) { utsBtn.classList.remove('hidden'); utsBtn.classList.add('flex'); }
        if (globalSettings.show_uas && uasBtn) { uasBtn.classList.remove('hidden'); uasBtn.classList.add('flex'); }
    }
}

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

    container.innerHTML = `<div class="text-center py-5 text-gray-400 text-xs">Syncing data...</div>`;

    try {
        const [resDaily, resUts, resUas, resPersonal] = await Promise.all([
            fetch('/api/schedule?category=daily'),
            fetch('/api/schedule?category=uts'),
            fetch('/api/schedule?category=uas'),
            fetch('/api/schedule?category=personal')
        ]);

        const daily = resDaily.ok ? await resDaily.json() : [];
        const uts = resUts.ok ? await resUts.json() : [];
        const uas = resUas.ok ? await resUas.json() : [];
        const personal = resPersonal.ok ? await resPersonal.json() : [];

        const isToday = (item) => {
            if (item.tanggal && item.tanggal === tglIni) return true;
            if (!item.tanggal && (item.hari || "").toLowerCase() === hariIni.toLowerCase()) return true;
            return false;
        };

        // FILTER UTAMA: Gabungkan data berdasarkan settings server
        const list = [
            ...uts.filter(u => u.tanggal === tglIni && globalSettings.show_uts).map(i => ({...i, c: 'orange', label:'UTS'})),
            ...uas.filter(u => u.tanggal === tglIni && globalSettings.show_uas).map(i => ({...i, c: 'purple', label:'UAS'})),
            ...daily.filter(isToday).map(i => ({...i, c: 'blue', label:'KULIAH'})),
            ...personal.filter(isToday).map(i => ({...i, c: 'green', label:'AGENDA'}))
        ];

        list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || ""));
        calculateSimpleBusyness(list); // Update Bar Kesibukan

        if (list.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-300">
                    <i class="fas fa-mug-hot text-2xl mb-2"></i>
                    <p class="text-xs">Hari ini kosong. Santai!</p>
                </div>`;
            return;
        }

        container.innerHTML = list.map(item => {
             // Cek apakah ada custom widget renderer di HTML
             if(window.rowWidget) return window.rowWidget(item, item.c);
             // Fallback renderer
             return `<div class="p-3 bg-white mb-2 rounded shadow-sm text-xs border-l-4 border-blue-500">${item.matkul}</div>`;
        }).join('');

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-red-400 text-center text-xs">Gagal memuat jadwal.</p>';
    }
}

// Logic Bar Kesibukan (Hanya Jam Total) untuk Dashboard
function calculateSimpleBusyness(items) {
    let totalMinutes = 0;
    items.forEach(item => {
        if(item.waktu.includes('-')) {
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
    
    // Pastikan ini hanya jalan di Dashboard (bukan Admin)
    if (bar && text && !document.getElementById('admin-panel')) {
        let percent = Math.round((totalMinutes / 480) * 100); // Base: 8 Jam
        if(percent > 100) percent = 100;
        
        text.innerText = `${percent}%`;
        bar.style.width = `${percent}%`;
        
        if (percent > 80) {
            bar.className = "h-full bg-red-500 transition-all duration-1000";
            if(advice) advice.innerText = "Sangat Sibuk! Istirahatlah.";
        } else if (percent > 40) {
            bar.className = "h-full bg-indigo-500 transition-all duration-1000";
            if(advice) advice.innerText = "Produktif. Tetap fokus!";
        } else {
            bar.className = "h-full bg-green-500 transition-all duration-1000";
            if(advice) advice.innerText = "Hari yang santai.";
        }
    }
}

// ==========================================
// 5. LOGIC ADMIN PANEL
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
    initAdminToggles(); // Setup Listener Tombol Switch

    // Realtime Sleep Ticker (Jalan Tiap Detik)
    setInterval(() => {
        const sleepStart = localStorage.getItem('steven_sleep_start');
        const wakeTime = localStorage.getItem('steven_wake_time');
        // Hanya update jika SEDANG TIDUR (Ada Start, Tidak ada Wake)
        if (sleepStart && !wakeTime) {
            updateSleepDurationRealtime(new Date(parseInt(sleepStart)));
        }
    }, 1000);
}

// --- SETUP TOGGLE ADMIN KE SERVER (FIX BUG) ---
function initAdminToggles() {
    const tUts = document.getElementById('toggle-uts');
    const tUas = document.getElementById('toggle-uas');

    // 1. Set Visual Awal (Dari data server yg sudah diload di awal)
    if (tUts) tUts.checked = globalSettings.show_uts;
    if (tUas) tUas.checked = globalSettings.show_uas;

    // 2. Listener: Kalau diklik, KIRIM KE SERVER
    if (tUts) {
        tUts.addEventListener('change', (e) => {
            saveSettings({ show_uts: e.target.checked });
        });
    }
    if (tUas) {
        tUas.addEventListener('change', (e) => {
            saveSettings({ show_uas: e.target.checked });
        });
    }
}

// --- HEALTH TRACKER (ENERGI & TIDUR) ---
function initHealthTracker() {
    calculateBMI();
    // Load Checkbox
    document.getElementById('eat-1').checked = localStorage.getItem('steven_eat_1') === 'true';
    document.getElementById('eat-2').checked = localStorage.getItem('steven_eat_2') === 'true';
    document.getElementById('eat-3').checked = localStorage.getItem('steven_eat_3') === 'true';

    // Load Data Tidur
    const sleepStart = localStorage.getItem('steven_sleep_start');
    const wakeTime = localStorage.getItem('steven_wake_time');
    
    if (sleepStart && !wakeTime) {
        updateSleepUI(true, new Date(parseInt(sleepStart))); // Sedang tidur
    } else if (sleepStart && wakeTime) {
        updateSleepUI(false, new Date(parseInt(sleepStart)), new Date(parseInt(wakeTime))); // Sudah bangun
    } else {
        updateEnergyUI(50); // Default
    }
    
    document.getElementById('water-count').innerText = localStorage.getItem('steven_water') || 0;
}

function toggleSleep(isSleeping) {
    const now = new Date();
    if (isSleeping) {
        // Mulai Tidur
        localStorage.setItem('steven_sleep_start', now.getTime());
        localStorage.removeItem('steven_wake_time'); 
        updateSleepUI(true, now);
    } else {
        // Bangun
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
    const formatTime = (d) => d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});

    if (isSleeping) {
        // UI Mode Tidur
        btnSleep.classList.add('opacity-50', 'cursor-not-allowed'); btnSleep.onclick = null;
        btnWake.classList.remove('opacity-50', 'cursor-not-allowed'); btnWake.onclick = () => toggleSleep(false);
        displayS.innerText = formatTime(sleepDate);
        displayW.innerText = "--:--";
        statusText.innerText = "Zzz... Sedang Tidur";
        updateEnergyUI(0); // Reset Energi
    } else {
        // UI Mode Bangun
        btnSleep.classList.remove('opacity-50', 'cursor-not-allowed'); btnSleep.onclick = () => toggleSleep(true);
        btnWake.classList.add('opacity-50', 'cursor-not-allowed'); btnWake.onclick = null;
        displayS.innerText = formatTime(sleepDate);
        if(wakeDate) displayW.innerText = formatTime(wakeDate);
        statusText.innerText = "Siap Beraktivitas!";
        if(wakeDate) calculateTotalEnergy(sleepDate, wakeDate);
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

// Rumus Energi (Tidur + Makan - Ceklis)
function calculateTotalEnergy(sleepDate, wakeDate) {
    const diffMs = wakeDate - sleepDate;
    const diffHours = diffMs / (1000 * 60 * 60);
    let energy = (diffHours / 8) * 100; // Base: Tidur 8 jam = 100%
    
    // Refuel Makan
    if (document.getElementById('eat-1').checked) energy += 15;
    if (document.getElementById('eat-2').checked) energy += 15;
    if (document.getElementById('eat-3').checked) energy += 15;

    // Drain Aktivitas
    const checkedTasks = document.querySelectorAll('.check-anim:checked').length;
    energy -= (checkedTasks * 5);

    if (energy > 100) energy = 100;
    if (energy < 0) energy = 0;

    // Teks Durasi Static
    const hrs = Math.floor(diffHours);
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const textEl = document.getElementById('sleep-duration-text');
    if(textEl) textEl.innerText = `Total Tidur: ${hrs} Jam ${mins} Menit`;

    updateEnergyUI(Math.round(energy));
}

function updateEnergyUI(value) {
    const bar = document.getElementById('energy-bar');
    const text = document.getElementById('energy-level');
    if (bar && text) {
        bar.style.width = `${value}%`;
        text.innerText = `${value}%`;
        bar.className = `h-full transition-all duration-500 ${value > 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`;
    }
}

function updateEnergyFromFood() {
    localStorage.setItem('steven_eat_1', document.getElementById('eat-1').checked);
    localStorage.setItem('steven_eat_2', document.getElementById('eat-2').checked);
    localStorage.setItem('steven_eat_3', document.getElementById('eat-3').checked);
    // Recalc
    const s = localStorage.getItem('steven_sleep_start');
    const w = localStorage.getItem('steven_wake_time');
    if (s && w) calculateTotalEnergy(new Date(parseInt(s)), new Date(parseInt(w)));
}

function calculateBMI() {
    const w = parseFloat(document.getElementById('input-bb').value) || 50;
    const h = 1.8; 
    const bmi = (w / (h*h)).toFixed(1);
    const res = document.getElementById('bmi-result');
    let st = bmi < 18.5 ? "KURUS" : bmi < 25 ? "IDEAL" : "GEMUK";
    res.innerText = `BMI: ${bmi} (${st})`;
}

function updateWater(n) {
    let cur = parseInt(document.getElementById('water-count').innerText) + n;
    if (cur < 0) cur = 0;
    document.getElementById('water-count').innerText = cur;
    localStorage.setItem('steven_water', cur);
}

// --- CHECKLIST & DATABASE ADMIN ---
async function loadDailyChecklist() {
    const container = document.getElementById('daily-checklist-container');
    const dateDisplay = document.getElementById('date-today-display');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const tglIni = `${year}-${month}-${day}`; 
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = days[now.getDay()];

    if(dateDisplay) dateDisplay.innerText = `${hariIni}, ${day}/${month}`;
    container.innerHTML = '<p class="text-center text-xs text-gray-400">Loading...</p>';

    try {
        const [resDaily, resUts, resUas, resPersonal] = await Promise.all([
            fetch('/api/schedule?category=daily'),
            fetch('/api/schedule?category=uts'),
            fetch('/api/schedule?category=uas'),
            fetch('/api/schedule?category=personal')
        ]);

        const daily = resDaily.ok ? await resDaily.json() : [];
        const uts = resUts.ok ? await resUts.json() : [];
        const uas = resUas.ok ? await resUas.json() : [];
        const personal = resPersonal.ok ? await resPersonal.json() : [];

        const isToday = (item) => {
            if (item.tanggal && item.tanggal === tglIni) return true;
            if (!item.tanggal && (item.hari || "").toLowerCase() === hariIni.toLowerCase()) return true;
            return false;
        };

        const list = [
            ...uts.filter(u => u.tanggal === tglIni).map(i => ({...i, c: 'orange', type: 'UTS'})),
            ...uas.filter(u => u.tanggal === tglIni).map(i => ({...i, c: 'purple', type: 'UAS'})),
            ...daily.filter(isToday).map(i => ({...i, c: 'blue', type: 'KULIAH'})),
            ...personal.filter(isToday).map(i => ({...i, c: 'green', type: 'AGENDA'}))
        ];

        list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || ""));

        if (list.length === 0) {
            container.innerHTML = `<div class="text-center py-4 text-gray-400 text-xs">Kosong. Hari santai!</div>`;
            return;
        }

        container.innerHTML = "";
        list.forEach((item, index) => {
            const checkId = `check_${tglIni}_${item.id || index}`;
            const isChecked = localStorage.getItem(checkId) === 'true' ? 'checked' : '';
            const title = item.matkul || item.nama_kegiatan || "Kegiatan";
            const badgeClass = item.c === 'blue' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 bg-gray-50';

            container.innerHTML += `
            <div class="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                <input type="checkbox" class="w-4 h-4 mt-0.5 accent-indigo-600 cursor-pointer check-anim" ${isChecked} onchange="toggleCheck('${checkId}', this)">
                <div class="flex-1 overflow-hidden">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-bold text-gray-700 truncate">${title}</span>
                        <span class="text-[9px] ${badgeClass} px-1.5 py-0.5 rounded font-bold">${item.waktu}</span>
                    </div>
                </div>
            </div>`;
        });
        updateEnergyFromFood();
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-red-400 text-center text-xs">Gagal load data.</p>';
    }
}

window.toggleCheck = function(id, el) {
    localStorage.setItem(id, el.checked);
    updateEnergyFromFood(); 
}

// --- CRUD DATABASE ---
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
    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
        container.innerHTML = ''; 
        if (!data || data.length === 0) { container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Data Kosong</div>'; return; }
        
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
    } catch(e) { container.innerHTML = '<div class="text-[10px] text-red-400 text-center">Error</div>'; }
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
        // Clean Hidden
        if(document.getElementById('hari').classList.contains('hidden')) rawData.hari = "";
        if(document.getElementById('tanggal').classList.contains('hidden')) rawData.tanggal = "";

        try {
            const res = await fetch('/api/schedule', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify(rawData)
            });
            if (res.ok) {
                alert("Tersimpan!"); 
                addForm.reset(); 
                if(window.toggleFormFields) window.toggleFormFields(); 
                loadAdminData(rawData.kategori); 
                loadDailyChecklist();
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

// 5. LOGIN
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        errorMsg.style.display = 'none';

        if(!email || !pass) { errorMsg.innerText = "Isi email & password!"; errorMsg.style.display = 'block'; return; }

        loginBtn.innerText = "Memeriksa..."; loginBtn.disabled = true;

        try {
            const res = await fetch('/api/login', { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) 
            });
            if (res.ok) {
                adminEmail = email; adminPassword = pass; 
                localStorage.setItem('admin_email', email); localStorage.setItem('admin_password', pass); 
                showAdminPanel();
            } else {
                throw new Error("Akses Ditolak."); 
            }
        } catch (err) {
            errorMsg.innerText = err.message; errorMsg.style.display = 'block';
        } finally {
            loginBtn.innerText = "UNLOCK"; loginBtn.disabled = false;
        }
    });
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        if(confirm("Logout dari sistem?")) {
            localStorage.removeItem('admin_email'); localStorage.removeItem('admin_password');
            location.reload();
        }
    });
}
