// File: app.js

// ==========================================
// KONFIGURASI STATE & INISIALISASI
// ==========================================
let adminPassword = null; 
let adminEmail = null;

// DEFINISI FUNGSI ADMIN PANEL
function showAdminPanel() {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');

    if(loginForm) loginForm.style.display = 'none';
    if(adminPanel) {
        adminPanel.style.display = 'block';
        loadAdminData('daily'); 
        
        // FITUR BARU: Load Data Kesehatan & Checklist
        initHealthTracker();
        loadDailyChecklist();
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

    // Pemicu Widget Beranda (Dashboard User)
    if (document.getElementById('today-schedule-container')) {
        updateClock();
        setInterval(updateClock, 1000);
        loadTodaySchedule();
        checkToggles();
    }

    // Auto Sync
    window.addEventListener('storage', (event) => {
        if (event.key === 'show_uts' || event.key === 'show_uas') {
            if (window.loadTodaySchedule) loadTodaySchedule();
        }
    });

    // Cek Alert Tidur (Jalan setiap menit)
    setInterval(checkSleepAlert, 60000);
});

// ==========================================
// LOGIC LOGIN & AUTH
// ==========================================
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        errorMsg.style.display = 'none';

        if(!email || !pass) { errorMsg.innerText = "Isi semua field!"; errorMsg.style.display = 'block'; return; }

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
            loginBtn.innerText = "MASUK"; loginBtn.disabled = false;
        }
    });
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        if(confirm("Logout?")) {
            localStorage.removeItem('admin_email'); localStorage.removeItem('admin_password');
            location.reload();
        }
    });
}

// ==========================================
// FITUR BARU: HEALTH & SLEEP TRACKER
// ==========================================

function initHealthTracker() {
    // 1. Load BMI
    calculateBMI();
    
    // 2. Load Sleep Data
    const sleepStart = localStorage.getItem('steven_sleep_start');
    const wakeTime = localStorage.getItem('steven_wake_time');
    
    if (sleepStart && !wakeTime) {
        // Sedang Tidur
        updateSleepUI(true, new Date(parseInt(sleepStart)));
    } else if (sleepStart && wakeTime) {
        // Sudah Bangun (Tampilkan Data Terakhir)
        const s = new Date(parseInt(sleepStart));
        const w = new Date(parseInt(wakeTime));
        updateSleepUI(false, s, w);
    }

    // 3. Load Water
    const water = localStorage.getItem('steven_water') || 0;
    document.getElementById('water-count').innerText = water;
}

function calculateBMI() {
    const heightCm = 180; // Hardcoded sesuai request
    const weightKg = parseFloat(document.getElementById('input-bb').value) || 52;
    const heightM = heightCm / 100;
    
    const bmi = (weightKg / (heightM * heightM)).toFixed(1);
    const resultEl = document.getElementById('bmi-result');
    
    let status = "";
    let color = "";

    if (bmi < 18.5) {
        status = "UNDERWEIGHT (Kurang Berat)";
        color = "bg-yellow-100 text-yellow-700";
    } else if (bmi >= 18.5 && bmi < 24.9) {
        status = "IDEAL (Mantap!)";
        color = "bg-green-100 text-green-700";
    } else {
        status = "OVERWEIGHT";
        color = "bg-red-100 text-red-700";
    }

    resultEl.innerText = `BMI: ${bmi} - ${status}`;
    resultEl.className = `text-[10px] font-bold p-2 rounded text-center ${color}`;
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
        
        // Logika "Lupa Ceklis Tidur"
        // Jika ceklis tidur jam 3 pagi - 10 pagi, kemungkinan lupa absen semalam
        const currentHour = now.getHours();
        if (currentHour >= 3 && currentHour <= 10) {
            const confirmLupa = confirm("Sudah jam segini. Apakah kamu lupa absen tidur semalam? \nOK = Ya (Input Manual), Cancel = Tidak (Baru mau tidur sekarang/Begadang)");
            
            if (confirmLupa) {
                const manualTime = prompt("Masukkan jam tidur sebenarnya (Format HH:MM, contoh 23:30):");
                if (manualTime) {
                    const [h, m] = manualTime.split(':');
                    sleepTime.setHours(h, m, 0);
                    // Jika jam input > jam sekarang (misal input 23:00 padahal skrg 08:00), berarti kemarin
                    if (parseInt(h) > currentHour) {
                        sleepTime.setDate(sleepTime.getDate() - 1);
                    }
                } else return; // Batal
            }
        }

        localStorage.setItem('steven_sleep_start', sleepTime.getTime());
        localStorage.removeItem('steven_wake_time'); // Reset bangun
        updateSleepUI(true, sleepTime);

    } else {
        // MAU BANGUN
        let wakeTime = now;
        const sleepStartVal = localStorage.getItem('steven_sleep_start');
        
        if (!sleepStartVal) {
            alert("Kamu belum absen tidur!");
            return;
        }

        // Logika "Lupa Ceklis Bangun"
        // Jika selisih waktu > 12 jam, curiga lupa
        const diffHours = (wakeTime - parseInt(sleepStartVal)) / (1000 * 60 * 60);
        if (diffHours > 14) {
             const confirmLupaBangun = confirm("Waktu tidur tercatat > 14 jam. Lupa absen bangun? \nOK = Ya (Input Manual), Cancel = Tidak");
             if (confirmLupaBangun) {
                const manualWake = prompt("Masukkan jam bangun sebenarnya (HH:MM):");
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
    const energyLevel = document.getElementById('energy-level');

    const formatTime = (d) => d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});

    if (isSleeping) {
        // UI Mode Tidur
        btnSleep.classList.add('opacity-50', 'cursor-not-allowed');
        btnSleep.onclick = null;
        document.getElementById('sleep-time-display').innerText = formatTime(sleepDate);
        
        btnWake.classList.remove('opacity-50', 'cursor-not-allowed');
        btnWake.onclick = () => toggleSleep(false);
        document.getElementById('wake-time-display').innerText = "--:--";

        statusText.innerText = "Zzz... Sedang Tidur";
        durationText.innerText = "Istirahat yang cukup ya!";
        energyLevel.innerText = "Charging...";
    } else {
        // UI Mode Bangun (Hasil)
        btnSleep.classList.remove('opacity-50', 'cursor-not-allowed');
        btnSleep.onclick = () => toggleSleep(true);
        document.getElementById('sleep-time-display').innerText = formatTime(sleepDate);

        btnWake.classList.add('opacity-50', 'cursor-not-allowed');
        btnWake.onclick = null;
        if(wakeDate) document.getElementById('wake-time-display').innerText = formatTime(wakeDate);

        statusText.innerText = "Siap beraktivitas!";
        
        // Hitung Durasi & Energi
        if (sleepDate && wakeDate) {
            const diffMs = wakeDate - sleepDate;
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            durationText.innerText = `Durasi: ${diffHrs} Jam ${diffMins} Menit`;

            // Simulasi Energi (8 jam = 100%)
            let energy = Math.round((diffHrs / 8) * 100);
            if (energy > 100) energy = 100;
            energyLevel.innerText = `${energy}%`;
        }
    }
}

function checkSleepAlert() {
    const now = new Date();
    const h = now.getHours();
    
    // Cek jika jam 22:00 dan belum tidur
    if (h === 22) {
        const isSleeping = localStorage.getItem('steven_sleep_start') && !localStorage.getItem('steven_wake_time');
        if (!isSleeping) {
            // Gunakan Notification API jika mau canggih, alert biasa cukup mengganggu :D
            // alert("Jam 10 Malam! Waktunya tidur untuk kesehatan optimal."); 
            console.log("Alert Tidur Triggered");
        }
    }
}

// ==========================================
// FITUR BARU: DAILY CHECKLIST (ADMIN)
// ==========================================
async function loadDailyChecklist() {
    const container = document.getElementById('daily-checklist-container');
    const dateDisplay = document.getElementById('date-today-display');
    if (!container) return;

    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = days[now.getDay()];
    
    // Format YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const tglIni = `${year}-${month}-${day}`;

    dateDisplay.innerText = `${hariIni}, ${day}/${month}`;
    container.innerHTML = '<p class="text-center text-xs text-gray-400">Loading...</p>';

    try {
        // Fetch semua data
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

        // Filter Logic (Sama dengan Dashboard)
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
            // Unique ID untuk LocalStorage Checked state
            const checkId = `check_${tglIni}_${item.id || index}`; 
            const isChecked = localStorage.getItem(checkId) === 'true' ? 'checked' : '';

            // Warna Badge
            const badgeColor = {
                'orange': 'bg-orange-100 text-orange-700',
                'purple': 'bg-purple-100 text-purple-700',
                'blue': 'bg-blue-100 text-blue-700',
                'green': 'bg-green-100 text-green-700'
            }[item.c];

            const title = item.matkul || item.nama_kegiatan || "Kegiatan";

            container.innerHTML += `
            <div class="flex items-start gap-3 p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition">
                <input type="checkbox" class="w-5 h-5 mt-1 accent-blue-600 cursor-pointer check-anim" ${isChecked} onchange="toggleCheck('${checkId}', this)">
                <div class="flex-1 transition-all duration-300">
                    <div class="flex justify-between items-start">
                        <span class="text-xs font-bold text-gray-800 line-clamp-1">${title}</span>
                        <span class="text-[10px] ${badgeColor} px-2 py-0.5 rounded font-bold">${item.waktu}</span>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-0.5">${item.ruangan || 'Online'} • ${item.type}</p>
                </div>
            </div>`;
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-red-500 text-center text-xs">Gagal load checklist.</p>';
    }
}

// Simpan status checklist ke LocalStorage
window.toggleCheck = function(id, el) {
    localStorage.setItem(id, el.checked);
}

// ==========================================
// 3. LOGIC LAMA (CRUD & RENDER DATABASE)
// ==========================================

// ... (Bagian CRUD Add/Delete Database Database Scroll) ...
// Code CRUD di bawah ini SAMA dengan versi sebelumnya, hanya UI render database diperkecil

window.switchTab = function(targetId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    // Reset style button
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.className = "tab-btn px-2 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded transition";
    });
    // Active style
    btn.className = "tab-btn active px-2 py-1 text-[10px] font-bold bg-blue-100 text-blue-600 rounded transition";
    
    loadAdminData(targetId.replace('list-', ''));
}

async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Loading...</div>';

    if (!adminPassword) return; // Guard
    
    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
        container.innerHTML = ''; 

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Data Kosong</div>';
            return;
        }

        // Render Database Versi Compact (Kecil)
        data.forEach(item => {
            const title = item.matkul || item.nama_kegiatan || item.nama || "Item";
            container.innerHTML += `
                <div class="bg-gray-50 p-2 rounded-lg border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition">
                    <div class="overflow-hidden w-full pr-2">
                        <div class="font-bold text-[11px] text-gray-700 truncate">${title}</div>
                        <div class="text-[9px] text-gray-400">${item.hari || item.tanggal} • <span class="text-blue-500">${item.waktu}</span></div>
                    </div>
                    <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded transition">
                        <i class="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>`;
        });
    } catch(e) {
        container.innerHTML = '<div class="text-[10px] text-red-400 text-center">Gagal Load</div>';
    }
}

// ... (Function addForm Submit & deleteSchedule tetap sama, copy dari file lama jika belum ada di bawah ini) ...

// Form Submit Handler
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

        // Bersihkan data berdasarkan hidden fields
        if(document.getElementById('hari').classList.contains('hidden')) rawData.hari = "";
        if(document.getElementById('tanggal').classList.contains('hidden')) rawData.tanggal = "";

        // Kirim
        try {
            const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
                body: JSON.stringify(rawData)
            });
            if (res.ok) {
                alert("Tersimpan!");
                addForm.reset();
                if(window.toggleFormFields) window.toggleFormFields(); 
                loadAdminData(rawData.kategori);
                loadDailyChecklist(); // Reload checklist
            } else {
                alert("Gagal simpan.");
            }
        } catch (err) { alert("Error sistem."); }
    });
}

window.deleteSchedule = async function(id, category) {
    if(!confirm("Hapus?")) return;
    try {
        const res = await fetch(`/api/schedule?id=${id}&category=${category}`, {
            method: 'DELETE', headers: { 'x-admin-password': adminPassword } 
        });
        if(res.ok) {
            loadAdminData(category);
            loadDailyChecklist(); // Reload checklist
        }
    } catch(e) { alert("Error koneksi."); }
}
