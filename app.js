// File: app.js

// ==========================================
// KONFIGURASI STATE & INISIALISASI
// ==========================================
let adminPassword = null; 
let adminEmail = null;

function showAdminPanel() {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');

    if(loginForm) loginForm.style.display = 'none';
    if(adminPanel) {
        adminPanel.style.display = 'block';
        loadAdminData('daily'); 
        
        // Init Fitur Kesehatan
        initHealthTracker();
        loadDailyChecklist();
        
        // Init Toggle Listener (Agar Dashboard di Tab lain update)
        initAdminToggles();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedEmail = localStorage.getItem('admin_email');
    const savedPass = localStorage.getItem('admin_password');

    if (savedEmail && savedPass) {
        adminEmail = savedEmail;
        adminPassword = savedPass;
        showAdminPanel();
    }

    if (document.getElementById('today-schedule-container')) {
        updateClock();
        setInterval(updateClock, 1000);
        loadTodaySchedule();
        checkToggles(); // Untuk Dashboard View
    }

    // Auto Sync antar Tab
    window.addEventListener('storage', (event) => {
        if (event.key === 'show_uts' || event.key === 'show_uas') {
            if (window.loadTodaySchedule) loadTodaySchedule();
        }
    });

    setInterval(checkSleepAlert, 60000);
});

// ==========================================
// 1. LOGIC LOGIN
// ==========================================
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

// ==========================================
// 2. ADMIN TOGGLE LISTENER (PENTING!)
// ==========================================
function initAdminToggles() {
    const tUts = document.getElementById('toggle-uts');
    const tUas = document.getElementById('toggle-uas');

    if (tUts) {
        tUts.checked = localStorage.getItem('show_uts') === 'true';
        tUts.addEventListener('change', (e) => {
            localStorage.setItem('show_uts', e.target.checked);
        });
    }
    if (tUas) {
        tUas.checked = localStorage.getItem('show_uas') === 'true';
        tUas.addEventListener('change', (e) => {
            localStorage.setItem('show_uas', e.target.checked);
        });
    }
}

// ==========================================
// 3. HEALTH, SLEEP & ENERGY ALGORITHM
// ==========================================
function initHealthTracker() {
    calculateBMI();
    
    // Load Checkbox Makan
    document.getElementById('eat-1').checked = localStorage.getItem('steven_eat_1') === 'true';
    document.getElementById('eat-2').checked = localStorage.getItem('steven_eat_2') === 'true';
    document.getElementById('eat-3').checked = localStorage.getItem('steven_eat_3') === 'true';

    // Load Data Tidur
    const sleepStart = localStorage.getItem('steven_sleep_start');
    const wakeTime = localStorage.getItem('steven_wake_time');
    
    if (sleepStart && !wakeTime) {
        updateSleepUI(true, new Date(parseInt(sleepStart)));
    } else if (sleepStart && wakeTime) {
        const s = new Date(parseInt(sleepStart));
        const w = new Date(parseInt(wakeTime));
        updateSleepUI(false, s, w);
    } else {
        calculateTotalEnergy(0); // Default 0 jika belum ada data
    }

    const water = localStorage.getItem('steven_water') || 0;
    document.getElementById('water-count').innerText = water;
}

function calculateBMI() {
    const heightCm = 180; 
    const weightKg = parseFloat(document.getElementById('input-bb').value) || 52;
    const heightM = heightCm / 100;
    
    const bmi = (weightKg / (heightM * heightM)).toFixed(1);
    const resultEl = document.getElementById('bmi-result');
    
    let status = "";
    if (bmi < 18.5) status = "UNDERWEIGHT";
    else if (bmi >= 18.5 && bmi < 24.9) status = "IDEAL";
    else status = "OVERWEIGHT";

    resultEl.innerText = `BMI: ${bmi} (${status})`;
}

function updateWater(amount) {
    let current = parseInt(document.getElementById('water-count').innerText);
    current += amount;
    if (current < 0) current = 0;
    document.getElementById('water-count').innerText = current;
    localStorage.setItem('steven_water', current);
}

// === SMART SLEEP LOGIC ===
function toggleSleep(isSleeping) {
    const now = new Date();
    
    if (isSleeping) {
        // MAU TIDUR
        let sleepTime = now;
        const currentHour = now.getHours();
        
        // Logika Lupa Absen (Jika input jam 03:00 - 10:00 pagi)
        if (currentHour >= 3 && currentHour <= 10) {
            const confirmLupa = confirm("Lupa absen tidur semalam? OK untuk input jam manual.");
            if (confirmLupa) {
                const manualTime = prompt("Masukkan jam tidur (HH:MM):", "23:00");
                if (manualTime) {
                    const [h, m] = manualTime.split(':');
                    sleepTime.setHours(h, m, 0);
                    // Jika jam input > jam sekarang, berarti kemarin
                    if (parseInt(h) > currentHour) sleepTime.setDate(sleepTime.getDate() - 1);
                } else return;
            }
        }
        localStorage.setItem('steven_sleep_start', sleepTime.getTime());
        localStorage.removeItem('steven_wake_time');
        updateSleepUI(true, sleepTime);

    } else {
        // MAU BANGUN
        let wakeTime = now;
        const sleepStartVal = localStorage.getItem('steven_sleep_start');
        
        if (!sleepStartVal) { alert("Anda belum absen tidur!"); return; }

        // Logika Lupa Bangun (>14 jam)
        const diffHours = (wakeTime - parseInt(sleepStartVal)) / (1000 * 60 * 60);
        if (diffHours > 14) {
             const confirmLupaBangun = confirm("Tidur > 14 jam? Lupa absen bangun?");
             if (confirmLupaBangun) {
                const manualWake = prompt("Jam bangun (HH:MM):", "06:00");
                if (manualWake) {
                    const [h, m] = manualWake.split(':');
                    wakeTime.setHours(h, m, 0);
                } else return;
             }
        }
        localStorage.setItem('steven_wake_time', wakeTime.getTime());
        updateSleepUI(false, new Date(parseInt(sleepStartVal)), wakeTime);
    }
}

function updateSleepUI(isSleeping, sleepDate, wakeDate = null) {
    const btnSleep = document.getElementById('btn-sleep');
    const btnWake = document.getElementById('btn-wake');
    const statusText = document.getElementById('sleep-status-text');
    const durationText = document.getElementById('sleep-duration-text');
    const formatTime = (d) => d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});

    if (isSleeping) {
        btnSleep.classList.add('opacity-50', 'cursor-not-allowed'); btnSleep.onclick = null;
        document.getElementById('sleep-time-display').innerText = formatTime(sleepDate);
        
        btnWake.classList.remove('opacity-50', 'cursor-not-allowed'); btnWake.onclick = () => toggleSleep(false);
        document.getElementById('wake-time-display').innerText = "--:--";
        statusText.innerText = "Status: Sleeping...";
        durationText.innerText = "Zzz...";
        
        calculateTotalEnergy(0); // Reset energi saat tidur

    } else {
        btnSleep.classList.remove('opacity-50', 'cursor-not-allowed'); btnSleep.onclick = () => toggleSleep(true);
        document.getElementById('sleep-time-display').innerText = formatTime(sleepDate);

        btnWake.classList.add('opacity-50', 'cursor-not-allowed'); btnWake.onclick = null;
        if(wakeDate) document.getElementById('wake-time-display').innerText = formatTime(wakeDate);

        statusText.innerText = "Status: Active";
        
        if (sleepDate && wakeDate) {
            const diffMs = wakeDate - sleepDate;
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            durationText.innerText = `Tidur: ${diffHrs}j ${diffMins}m`;
            
            // Hitung Energi Dasar dari Durasi Tidur
            // Rumus: (Jam Tidur / 8) * 100. Max 100%.
            const hoursFloat = diffHrs + (diffMins/60);
            let baseEnergy = Math.round((hoursFloat / 8) * 100);
            if (baseEnergy > 100) baseEnergy = 100;
            
            calculateTotalEnergy(baseEnergy);
        }
    }
}

// === RUMUS ENERGI STEVENJR ===
function calculateTotalEnergy(baseEnergy) {
    // 1. Ambil Base Energy (dari Tidur)
    // Jika fungsi dipanggil tanpa argumen, ambil dari tampilan terakhir/default
    let currentEnergy = baseEnergy;
    
    // 2. Hitung Pengurangan (Drain) dari Checklist Kegiatan
    // Setiap item yang dicentang mengurangi 5% energi
    const checkboxes = document.querySelectorAll('.check-anim');
    let completedTasks = 0;
    checkboxes.forEach(cb => {
        if (cb.checked) completedTasks++;
    });
    const energyDrain = completedTasks * 5; 

    // 3. Hitung Penambahan (Refuel) dari Makanan
    // Setiap kali makan nambah 15%
    let foodEnergy = 0;
    if (document.getElementById('eat-1').checked) foodEnergy += 15;
    if (document.getElementById('eat-2').checked) foodEnergy += 15;
    if (document.getElementById('eat-3').checked) foodEnergy += 15;

    // 4. Kalkulasi Akhir
    let finalEnergy = currentEnergy - energyDrain + foodEnergy;
    
    // Batas Max 100, Min 0
    if (finalEnergy > 100) finalEnergy = 100;
    if (finalEnergy < 0) finalEnergy = 0;

    // Update UI
    const bar = document.getElementById('energy-bar');
    const text = document.getElementById('energy-level');
    
    if (bar && text) {
        bar.style.width = `${finalEnergy}%`;
        text.innerText = `${finalEnergy}%`;
        
        // Ubah warna bar sesuai level
        bar.className = `h-full transition-all duration-1000 ${
            finalEnergy > 70 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
            finalEnergy > 30 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
            'bg-gradient-to-r from-red-500 to-pink-600'
        }`;
    }
}

function updateEnergyFromFood() {
    // Simpan status makan ke LocalStorage
    localStorage.setItem('steven_eat_1', document.getElementById('eat-1').checked);
    localStorage.setItem('steven_eat_2', document.getElementById('eat-2').checked);
    localStorage.setItem('steven_eat_3', document.getElementById('eat-3').checked);
    
    // Recalculate (Perlu ambil base energy dulu dari durasi tidur yg tersimpan)
    // Untuk simplifikasi, kita trigger ulang logic UI tidur untuk dapet base energy
    const sleepStart = localStorage.getItem('steven_sleep_start');
    const wakeTime = localStorage.getItem('steven_wake_time');
    if (sleepStart && wakeTime) {
        const s = new Date(parseInt(sleepStart));
        const w = new Date(parseInt(wakeTime));
        updateSleepUI(false, s, w); // Ini akan memanggil calculateTotalEnergy di dalamnya
    }
}

function checkSleepAlert() {
    const now = new Date();
    const h = now.getHours();
    if (h === 22) { // Jam 10 Malam
        const isSleeping = localStorage.getItem('steven_sleep_start') && !localStorage.getItem('steven_wake_time');
        if (!isSleeping) {
            console.log("Waktunya tidur!"); 
            // alert("Jam 22:00! Waktunya istirahat."); // Optional alert
        }
    }
}

// ==========================================
// 4. CHECKLIST & DATABASE
// ==========================================
async function loadDailyChecklist() {
    const container = document.getElementById('daily-checklist-container');
    const dateDisplay = document.getElementById('date-today-display');
    if (!container) return;

    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = days[now.getDay()];
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const tglIni = `${year}-${month}-${day}`;

    dateDisplay.innerText = `${hariIni}, ${day}/${month}`;
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
            if (item.tanggal === tglIni) return true;
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
            const badgeColor = {
                'orange': 'bg-orange-100 text-orange-700',
                'purple': 'bg-purple-100 text-purple-700',
                'blue': 'bg-blue-100 text-blue-700',
                'green': 'bg-green-100 text-green-700'
            }[item.c];
            const title = item.matkul || item.nama_kegiatan || "Kegiatan";

            container.innerHTML += `
            <div class="flex items-start gap-3 p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition">
                <input type="checkbox" class="w-5 h-5 mt-1 accent-indigo-600 cursor-pointer check-anim" ${isChecked} onchange="toggleCheck('${checkId}', this)">
                <div class="flex-1 transition-all duration-300">
                    <div class="flex justify-between items-start">
                        <span class="text-xs font-bold text-gray-800 line-clamp-1">${title}</span>
                        <span class="text-[10px] ${badgeColor} px-2 py-0.5 rounded font-bold">${item.waktu}</span>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-0.5">${item.ruangan || 'Online'} • ${item.type}</p>
                </div>
            </div>`;
        });
        
        // Update Energi setelah render checklist selesai
        // Kita panggil updateEnergyFromFood karena di dalamnya ada logic recalc
        updateEnergyFromFood();

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-red-500 text-center text-xs">Gagal load checklist.</p>';
    }
}

window.toggleCheck = function(id, el) {
    localStorage.setItem(id, el.checked);
    // Recalculate Energy saat checklist berubah
    updateEnergyFromFood(); 
}

// ... (BAGIAN CRUD DATABASE - COPY DARI KODE SEBELUMNYA ATAU BIARKAN JIKA SUDAH ADA) ...
// ... Pastikan fungsi switchTab, loadAdminData, deleteSchedule, addForm listener ada di sini ...

// Helper CRUD Functions (Singkat untuk App.js Full)
window.switchTab = function(targetId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.className = "tab-btn px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 rounded transition");
    btn.className = "tab-btn active px-2 py-1 text-[10px] font-bold bg-white border border-gray-200 shadow-sm rounded text-indigo-600";
    loadAdminData(targetId.replace('list-', ''));
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
                        <div class="text-[9px] text-gray-400">${item.hari || item.tanggal} • <span class="text-blue-500">${item.waktu}</span></div>
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
                alert("Tersimpan!"); addForm.reset(); if(window.toggleFormFields) window.toggleFormFields(); 
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
