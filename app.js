// File: app.js

// ==========================================
// 1. GLOBAL VARIABLES
// ==========================================
let adminPassword = null; 
let adminEmail = null;
let currentCategory = 'daily'; 
let globalSettings = { show_uts: false, show_uas: false }; // Default

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cek Login (Khusus Admin)
    const savedEmail = localStorage.getItem('admin_email');
    const savedPass = localStorage.getItem('admin_password');
    if (savedEmail && savedPass) {
        adminEmail = savedEmail;
        adminPassword = savedPass;
        if (document.getElementById('admin-panel')) showAdminPanel();
    }

    // 2. Jalankan Jam
    updateClock();
    setInterval(updateClock, 1000);

    // 3. FETCH SETTINGS DARI SERVER (WAJIB DULUAN)
    // Kita paksa tunggu fetch selesai baru init fitur lain
    await fetchSettings();

    // 4. Init Fitur Sesuai Halaman
    if (document.getElementById('admin-panel')) {
        initAdminFeatures();
    } else if (document.getElementById('main-dashboard')) {
        initDashboardFeatures();
    }
});

// --- API SINKRONISASI ---
async function fetchSettings() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            globalSettings = await res.json();
            console.log("Settings Loaded from Firebase:", globalSettings);
        }
    } catch (e) {
        console.error("Gagal load settings:", e);
    }
}

async function saveSettings(newSettings) {
    try {
        // Update variable lokal
        globalSettings = { ...globalSettings, ...newSettings };
        // Kirim ke server
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(globalSettings)
        });
        console.log("Settings Saved to Firebase");
    } catch (e) { console.error("Save failed:", e); }
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
// 2. DASHBOARD USER (INDEX.HTML)
// ==========================================
function initDashboardFeatures() {
    updateDashboardMenu(); // Update tombol berdasarkan data server
    loadTodaySchedule();
    
    // Auto Refresh Settings tiap 10 detik (Biar HP Ortu update sendiri)
    setInterval(async () => {
        await fetchSettings();
        updateDashboardMenu();
        loadTodaySchedule();
    }, 10000);
}

function updateDashboardMenu() {
    const utsBtn = document.getElementById('btn-menu-uts');
    const uasBtn = document.getElementById('btn-menu-uas');
    const container = document.getElementById('exam-buttons-container');

    // Reset Class
    if (utsBtn) utsBtn.classList.add('hidden');
    if (uasBtn) uasBtn.classList.add('hidden');
    if (container) container.classList.add('hidden');

    // Cek Global Settings dari Server
    if (globalSettings.show_uts || globalSettings.show_uas) {
        if(container) {
            container.classList.remove('hidden');
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
    const hariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()];

    container.innerHTML = `<div class="text-center py-5 text-gray-400 text-xs">Syncing...</div>`;

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

        // Filter List berdasarkan Settings Server
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

    } catch (e) {
        container.innerHTML = '<p class="text-red-400 text-center text-xs">Gagal memuat jadwal.</p>';
    }
}

function calculateSimpleBusyness(items) {
    let totalMinutes = 0;
    items.forEach(item => {
        if(item.waktu.includes('-')) {
            const [start, end] = item.waktu.split('-');
            const [sh, sm] = start.split(/[:.]/).map(Number);
            const [eh, em] = end.split(/[:.]/).map(Number);
            totalMinutes += ((eh*60+em) - (sh*60+sm));
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
    initAdminToggles(); // Init Tombol dengan data Server

    // Realtime Sleep
    setInterval(() => {
        const sleepStart = localStorage.getItem('steven_sleep_start');
        const wakeTime = localStorage.getItem('steven_wake_time');
        if (sleepStart && !wakeTime) {
            updateSleepDurationRealtime(new Date(parseInt(sleepStart)));
        }
    }, 1000);
}

// --- INIT TOGGLES (DATA SERVER) ---
function initAdminToggles() {
    const tUts = document.getElementById('toggle-uts');
    const tUas = document.getElementById('toggle-uas');

    // Set Visual Awal dari Data Server
    if (tUts) tUts.checked = globalSettings.show_uts;
    if (tUas) tUas.checked = globalSettings.show_uas;

    // Listener (Kirim ke Server)
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

// --- CRUD HELPER ---
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

// --- HEALTH TRACKER FUNCTIONS (SAMA SEPERTI SEBELUMNYA) ---
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
        // Lupa absen logic (3 pagi - 10 pagi)
        const currentHour = now.getHours();
        if (currentHour >= 3 && currentHour <= 10) {
            if(confirm("Lupa absen tidur semalam? OK = Input Manual")) {
                const m = prompt("Jam tidur (HH:MM):", "23:00");
                if(m) {
                    const [hh, mm] = m.split(':');
                    now.setHours(hh, mm, 0);
                    if (parseInt(hh) > currentHour) now.setDate(now.getDate() - 1);
                }
            }
        }
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
    container.innerHTML = '<p class="text-center text-xs text-gray-400">Loading...</p>';
    try {
        const [resDaily, resUts, resUas, resPersonal] = await Promise.all([fetch('/api/schedule?category=daily'), fetch('/api/schedule?category=uts'), fetch('/api/schedule?category=uas'), fetch('/api/schedule?category=personal')]);
        const daily = resDaily.ok ? await resDaily.json() : []; const uts = resUts.ok ? await resUts.json() : []; const uas = resUas.ok ? await resUas.json() : []; const personal = resPersonal.ok ? await resPersonal.json() : [];
        const isToday = (item) => { if (item.tanggal && item.tanggal === tglIni) return true; if (!item.tanggal && (item.hari || "").toLowerCase() === ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][now.getDay()] ) return true; return false; };
        const list = [...uts.filter(u=>u.tanggal===tglIni).map(i=>({...i, c:'orange'})), ...uas.filter(u=>u.tanggal===tglIni).map(i=>({...i, c:'purple'})), ...daily.filter(isToday).map(i=>({...i, c:'blue'})), ...personal.filter(isToday).map(i=>({...i, c:'green'}))];
        list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || ""));
        if (list.length === 0) { container.innerHTML = `<div class="text-center py-4 text-gray-400 text-xs">Kosong</div>`; return; }
        container.innerHTML = "";
        list.forEach((item, index) => {
            const checkId = `check_${tglIni}_${item.id || index}`; const isChecked = localStorage.getItem(checkId) === 'true' ? 'checked' : '';
            container.innerHTML += `<div class="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition"><input type="checkbox" class="w-4 h-4 mt-0.5 accent-indigo-600 check-anim" ${isChecked} onchange="toggleCheck('${checkId}', this)"><span class="text-xs font-bold text-gray-700 truncate">${item.matkul || item.nama_kegiatan}</span></div>`;
        });
        updateEnergyFromFood();
    } catch (e) { container.innerHTML = '<p class="text-red-400 text-center text-xs">Error</p>'; }
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
