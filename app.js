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
    }
}

// Pemicu Utama Saat Halaman Dimuat
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek Sesi Login
    const savedEmail = localStorage.getItem('admin_email');
    const savedPass = localStorage.getItem('admin_password');

    if (savedEmail && savedPass) {
        adminEmail = savedEmail;
        adminPassword = savedPass;
        showAdminPanel();
    }

    // 2. Jalankan Jam Digital
    updateClock();
    setInterval(updateClock, 1000);

    // 3. Pemicu Widget Beranda
    if (document.getElementById('today-schedule-container')) {
        loadTodaySchedule();
    }
    
    // 4. Cek Toggle Fitur
    checkToggles();

    // 5. Auto Sync
    window.addEventListener('storage', (event) => {
        if (event.key === 'show_uts' || event.key === 'show_uas') {
            loadTodaySchedule();
        }
    });
});

// ==========================================
// 1. LOGIC LOGIN ADMIN
// ==========================================
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        errorMsg.style.display = 'none';

        if(!email || !pass) {
            errorMsg.innerText = "Email dan Password tidak boleh kosong!";
            errorMsg.style.display = 'block';
            return;
        }

        loginBtn.innerText = "Memeriksa...";
        loginBtn.disabled = true;

        try {
            const res = await fetch('/api/login', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass }) 
            });

            if (res.ok) {
                adminEmail = email;
                adminPassword = pass; 
                localStorage.setItem('admin_email', email);
                localStorage.setItem('admin_password', pass); 
                showAdminPanel();
            } else {
                const errorData = await res.json();
                throw new Error(errorData.message || "Akses Ditolak."); 
            }
        } catch (err) {
            errorMsg.innerText = err.message;
            errorMsg.style.display = 'block';
        } finally {
            loginBtn.innerText = "MASUK";
            loginBtn.disabled = false;
        }
    });
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        if(confirm("Yakin Logout?")) {
            adminPassword = null;
            adminEmail = null;
            localStorage.removeItem('admin_email');
            localStorage.removeItem('admin_password');
            location.reload();
        }
    });
}

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
function getSafeTitle(item) {
    return item.matkul || item.nama_kegiatan || item.nama || item.keterangan || "Kegiatan";
}

function isTimeConflict(existingWaktu, newWaktu) {
    const timeToMinutes = (time) => {
        try {
            const [h, m] = time.split(/[:.]/).map(Number);
            return h * 60 + m;
        } catch (error) { return 0; }
    };

    try {
        const [existingStartStr, existingEndStr] = existingWaktu.split('-');
        const [newStartStr, newEndStr] = newWaktu.split('-');

        const existingStart = timeToMinutes(existingStartStr.trim());
        const existingEnd = timeToMinutes(existingEndStr.trim());
        const newStart = timeToMinutes(newStartStr.trim());
        const newEnd = timeToMinutes(newEndStr.trim());

        return newStart < existingEnd && newEnd > existingStart;
    } catch (error) { return false; }
}

// ==========================================
// FITUR: INDIKATOR KESIBUKAN (STEVEN'S RULE)
// ==========================================
function calculateBusyness(schedules) {
    let totalMinutes = 0;
    let maxEndTime = 0; 

    schedules.forEach(item => {
        let startMin = 0;
        let endMin = 0;
        try {
            if (item.waktu.includes('-')) {
                const parts = item.waktu.split('-');
                const s = parts[0].trim().split(/[:.]/).map(Number);
                const e = parts[1].trim().split(/[:.]/).map(Number);
                startMin = (s[0] * 60) + s[1];
                endMin = (e[0] * 60) + e[1];
                if (endMin > startMin) totalMinutes += (endMin - startMin);
            } else {
                const s = item.waktu.trim().split(/[:.]/).map(Number);
                startMin = (s[0] * 60) + s[1];
                endMin = startMin + 60; 
                totalMinutes += 60;
            }
            if (endMin > maxEndTime) maxEndTime = endMin;
        } catch (err) {}
    });
    updateBusynessUI(totalMinutes, maxEndTime);
}

function updateBusynessUI(totalMinutes, maxEndTime) {
    const totalHours = (totalMinutes / 60).toFixed(1);
    const statusText = document.getElementById('busy-status-text');
    const hoursText = document.getElementById('total-hours-text');
    const bar = document.getElementById('busy-progress-bar');
    const advice = document.getElementById('busy-advice');

    if (!statusText) return;

    const limitSore = 18 * 60; 
    let level = {};

    if (maxEndTime > limitSore) {
        level = { status: "LEMBUR / EXTRA 🔥", color: "bg-purple-600", textCol: "text-purple-600", percent: 100, msg: "Ada agenda malam. Semangat!" };
    } else if (totalHours > 8) {
        level = { status: "SANGAT SIBUK 💀", color: "bg-red-500", textCol: "text-red-500", percent: 90, msg: "Hari yang panjang. Istirahat cukup nanti." };
    } else if (totalHours >= 4) {
        level = { status: "PRODUKTIF ✅", color: "bg-green-500", textCol: "text-green-600", percent: 60, msg: "Performa optimal. Selesaikan sebelum petang." };
    } else {
        level = { status: "SANTAI / LIGHT ☕", color: "bg-blue-400", textCol: "text-blue-500", percent: 30, msg: "Jadwal longgar. Waktunya hobi." };
    }

    hoursText.innerText = totalHours;
    statusText.innerText = level.status;
    statusText.className = `text-xl font-bold ${level.textCol}`;
    bar.className = `h-full rounded-full transition-all duration-1000 ease-out ${level.color}`;
    bar.style.width = `${level.percent}%`;
    advice.innerText = `"${level.msg}"`;
}

// ==========================================
// 3. LOGIC UTAMA (PUBLIC VIEW - TABEL)
// ==========================================
window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400">Memuat data...</td></tr>';
    if(titleElement) titleElement.innerText = category.toUpperCase();

    try {
        const response = await fetch(`/api/schedule?category=${category}`);
        const data = await response.json();
        renderTable(data, category);
    } catch (error) {
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Gagal koneksi server</td></tr>';
    }
}

function renderTable(data, category) {
    const tableBody = document.getElementById('schedule-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = ''; 

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400">Jadwal Kosong</td></tr>`;
        return;
    }

    // Hybrid Sorting (Bisa Hari atau Tanggal)
    if (category === 'daily') {
        const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
        data.sort((a, b) => {
            // Prioritas sorting: Tanggal dulu (kalo ada), baru Hari
            if (a.tanggal && b.tanggal) return new Date(a.tanggal) - new Date(b.tanggal);
            if (a.hari && b.hari) return (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99);
            return (a.waktu || "").localeCompare(b.waktu || "");
        });
    } else {
        data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || (a.waktu || "").localeCompare(b.waktu || ""));
    }

    data.forEach(item => {
        const badgeColor = (item.tipe === 'Praktek') ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
        const detailText = (category === 'personal') ? (item.keterangan || '-') : (item.dosen || '-');
        
        tableBody.innerHTML += `
            <tr class="hover:bg-gray-50 border-b last:border-0 transition text-sm">
                <td class="p-5 align-middle">
                    <div class="font-bold text-gray-800">${item.hari || item.tanggal}</div>
                    <div class="text-xs text-blue-500 font-bold mt-1 px-2 py-1 bg-blue-50 rounded w-fit">${item.waktu}</div>
                </td>
                <td class="p-5 font-bold text-gray-800 text-lg">${getSafeTitle(item)}</td>
                <td class="p-5">
                    <div class="font-semibold text-gray-700">${item.ruangan || '-'}</div>
                    <div class="text-xs text-gray-500">Kelas: ${item.kelas || '-'}</div>
                </td>
                <td class="p-5"><span class="px-3 py-1 rounded-full text-xs font-bold ${badgeColor}">${item.tipe || 'Info'}</span></td>
                <td class="p-5 text-sm text-gray-600 italic">${detailText}</td>
            </tr>`;
    });
}

// ==========================================
// 4. BAGIAN ADMIN (CRUD)
// ==========================================
window.switchTab = function(targetId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.className = "tab-btn px-5 py-3 text-sm font-bold text-gray-500 hover:text-blue-600 border-b-2 border-transparent transition whitespace-nowrap";
    });
    btn.className = "tab-btn active px-5 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 transition whitespace-nowrap";
    loadAdminData(targetId.replace('list-', ''));
}

async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    container.innerHTML = '<div class="text-xs text-gray-400 p-2">Loading data...</div>';

    if (!adminPassword) {
        container.innerHTML = '<div class="text-xs text-red-400 p-4 text-center italic">Akses Ditolak. Silakan Login.</div>';
        return;
    }
    
    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
        container.innerHTML = ''; 

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-400 p-4 text-center italic">Data Kosong</div>';
            return;
        }

        data.forEach(item => {
            container.innerHTML += `
                <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition">
                    <div class="overflow-hidden">
                        <div class="font-bold text-sm text-gray-800 truncate">${getSafeTitle(item)}</div>
                        <div class="text-xs text-gray-500 mt-0.5">${item.hari || item.tanggal} • <span class="text-blue-500 font-medium">${item.waktu}</span></div>
                    </div>
                    <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>`;
        });
    } catch(e) {
        container.innerHTML = '<div class="text-xs text-red-400 p-2">Gagal Load Data API.</div>';
    }
}

const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!adminPassword) {
            alert("Sesi habis, silakan login ulang.");
            location.reload();
            return;
        }
        
        // Ambil data dengan aman (kosongkan jika tidak relevan)
        const rawData = {
            kategori: document.getElementById('kategori').value,
            matkul: document.getElementById('matkul').value,
            // Jika form hari hidden, kirim string kosong
            hari: document.getElementById('field-hari').classList.contains('hidden') ? "" : document.getElementById('hari').value,
            // Jika form tanggal hidden, kirim string kosong
            tanggal: document.getElementById('field-tanggal').classList.contains('hidden') ? "" : document.getElementById('tanggal').value,
            waktu: document.getElementById('waktu').value,
            ruangan: document.getElementById('ruangan').value,
            kode: document.getElementById('kode').value,
            dosen: document.getElementById('dosen').value,
            kelas: document.getElementById('kelas').value,
            tipe: document.getElementById('tipe').value,
            keterangan: document.getElementById('keterangan').value,
        };

        // CEK BENTROK (LOGIKA BARU: HYBRID)
        try {
            const checkRes = await fetch(`/api/schedule?category=${rawData.kategori}`);
            if (!checkRes.ok) throw new Error("Gagal cek data.");
            const existingSchedules = await checkRes.json();
            
            let isConflict = false;
            let conflictDetails = null;

            for (const existing of existingSchedules) {
                let keyMatch = false;

                // 1. Cek Bentrok TANGGAL (Jika input pakai tanggal)
                if (rawData.tanggal && existing.tanggal) {
                    keyMatch = (existing.tanggal === rawData.tanggal);
                } 
                // 2. Cek Bentrok HARI (Jika input pakai hari)
                else if (rawData.hari && existing.hari) {
                    keyMatch = (existing.hari.toLowerCase() === rawData.hari.toLowerCase());
                }

                if (keyMatch && isTimeConflict(existing.waktu, rawData.waktu)) {
                    isConflict = true;
                    conflictDetails = existing;
                    break;
                }
            }
            
            if (isConflict) {
                alert(`Gagal! Bentrok dengan: ${getSafeTitle(conflictDetails)} pada ${conflictDetails.hari || conflictDetails.tanggal} (${conflictDetails.waktu}).`);
                return; 
            }

            // Simpan
            const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
                body: JSON.stringify(rawData)
            });

            if (res.ok) {
                alert("Data tersimpan!");
                addForm.reset();
                // Kembalikan form ke kondisi default
                if(window.toggleFormFields) window.toggleFormFields(); 
                loadAdminData(rawData.kategori);
            } else {
                alert("Gagal simpan.");
            }
        } catch (err) { alert("Error sistem."); console.error(err); }
    });
}

window.deleteSchedule = async function(id, category) {
    if(!confirm("Hapus jadwal ini?")) return;
    if (!adminPassword) return alert("Login dulu.");
    
    try {
        const res = await fetch(`/api/schedule?id=${id}&category=${category}`, {
            method: 'DELETE', 
            headers: { 'x-admin-password': adminPassword } 
        });
        if(res.ok) loadAdminData(category);
        else alert("Gagal hapus.");
    } catch(e) { alert("Error koneksi."); }
}

// ==========================================
// 5. WIDGET BERANDA & TOGGLE
// ==========================================
function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    if(clockEl) clockEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false }).replace(/:/g, '.');
    if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-5 text-gray-400 text-sm">Memuat data...</div>`;

    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = days[now.getDay()]; 
    
    // Format YYYY-MM-DD Local
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const tglIni = `${year}-${month}-${day}`;

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

        // === LOGIKA FILTER HYBRID (HARI ATAU TANGGAL) ===
        // Fungsi helper: Apakah item cocok untuk hari ini?
        const isToday = (item) => {
            // 1. Cek Tanggal Spesifik (Prioritas Tinggi)
            if (item.tanggal === tglIni) return true;
            // 2. Cek Hari Rutin (Hanya jika TIDAK ada tanggal spesifik di item tsb)
            if (!item.tanggal && (item.hari || "").toLowerCase() === hariIni.toLowerCase()) return true;
            return false;
        };

        const combinedToday = [
            ...uts.filter(u => u.tanggal === tglIni && localStorage.getItem('show_uts') === 'true').map(i => ({...i, c: 'orange', label: 'UTS'})),
            ...uas.filter(u => u.tanggal === tglIni && localStorage.getItem('show_uas') === 'true').map(i => ({...i, c: 'purple', label: 'UAS'})),
            // Daily & Personal sekarang pakai fungsi isToday()
            ...daily.filter(isToday).map(i => ({...i, c: 'blue', label: 'KULIAH'})),
            ...personal.filter(isToday).map(i => ({...i, c: 'green', label: 'AGENDA'}))
        ];

        // Sorting
        combinedToday.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || ""));

        // Hitung Kesibukan
        calculateBusyness(combinedToday); 

        if (combinedToday.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 text-gray-300">
                    <i class="fas fa-mug-hot text-5xl mb-3"></i>
                    <p>Tidak ada agenda hari ini. Santai!</p>
                </div>`;
            return;
        }

        container.innerHTML = combinedToday.map(item => rowWidget(item)).join('');

    } catch (e) {
        console.error("Error Load Schedule:", e);
        container.innerHTML = '<p class="text-red-500 text-center py-5">Gagal memuat data jadwal.</p>';
    }
}

function rowWidget(i) {
    const colors = {
        'orange': 'border-orange-500 bg-orange-50 text-orange-900',
        'purple': 'border-purple-500 bg-purple-50 text-purple-900',
        'blue':   'border-blue-500 bg-blue-50 text-blue-900',
        'green':  'border-green-500 bg-green-50 text-green-900'
    }[i.c];

    const detail = (i.c === 'green') ? (i.keterangan || '-') : `${i.ruangan || 'TBD'} • ${i.kelas || '-'}`;

    return `
    <div class="${colors} border-l-8 p-5 rounded-xl mb-4 shadow-sm">
        <div class="flex justify-between items-start">
            <div>
                <span class="text-[10px] font-bold uppercase tracking-widest opacity-70">${i.label}</span>
                <h4 class="font-extrabold text-lg leading-tight mb-1">${getSafeTitle(i)}</h4>
                <p class="text-sm opacity-80"><i class="fas fa-map-marker-alt mr-2"></i>${detail}</p>
            </div>
            <div class="bg-white/80 px-3 py-1 rounded-lg text-sm font-bold shadow-sm">${i.waktu}</div>
        </div>
    </div>`;
}

function checkToggles() {
    const tUts = document.getElementById('toggle-uts');
    const tUas = document.getElementById('toggle-uas');
    if(tUts) {
        tUts.checked = localStorage.getItem('show_uts') === 'true';
        tUts.addEventListener('change', e => {
            localStorage.setItem('show_uts', e.target.checked);
            loadTodaySchedule(); 
        });
    }
    if(tUas) {
        tUas.checked = localStorage.getItem('show_uas') === 'true';
        tUas.addEventListener('change', e => {
            localStorage.setItem('show_uas', e.target.checked);
            loadTodaySchedule(); 
        });
    }
}
