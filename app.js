// ==========================================
// 1. CONFIG FIREBASE (WAJIB ISI!)
// ==========================================
const firebaseConfig = {
    apiKey: "API_KEY_LU_DISINI",
    authDomain: "PROJECT_ID.firebaseapp.com",
    databaseURL: "https://PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "PROJECT_ID",
    storageBucket: "PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Init Firebase (Cek biar gak double init)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// State
let adminPassword = null; 

// ==========================================
// 2. HELPER FUNCTIONS (JANTUNGNYA)
// ==========================================

// Parse Jam (ex: "13:00" -> 780 menit)
function parseTime(timeStr) {
    if (!timeStr || !timeStr.includes('-')) return { start: 0, end: 0 };
    const [start, end] = timeStr.split('-').map(t => t.trim());
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return { start: sH * 60 + sM, end: eH * 60 + eM };
}

// JUDUL AMAN (Biar Admin gak kosong kalau nama field beda)
function getSafeTitle(item) {
    return item.matkul || item.nama_kegiatan || item.nama || item.kegiatan || "Tanpa Judul";
}

// Cek Bentrok (Server Side Logic)
async function checkConflictServer(kategori, hari, waktu, tanggal) {
    try {
        const snap = await db.ref('jadwal').orderByChild('kategori').equalTo(kategori).once('value');
        const data = snap.val();
        if(!data) return null;

        const newTime = parseTime(waktu);
        
        // Convert object ke array
        const list = Object.keys(data).map(key => data[key]);

        return list.find(item => {
            let isSameDay = (kategori === 'daily') ? (item.hari === hari) : (item.tanggal === tanggal);
            if (!isSameDay) return false;

            const existTime = parseTime(item.waktu);
            return (newTime.start < existTime.end && newTime.end > existTime.start);
        });
    } catch (e) {
        console.error("Gagal cek conflict:", e);
        return null; 
    }
}

// ==========================================
// 3. LOGIC BERANDA (USER VIEW) - ADA KOPI NYA ☕
// ==========================================

// Load Data Tabel Utama
window.loadScheduleData = function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Loading...</td></tr>';
    if(titleElement) titleElement.innerText = category.toUpperCase();

    // Tarik Data dari Firebase
    db.ref('jadwal').orderByChild('kategori').equalTo(category).once('value', (snapshot) => {
        const dataRaw = snapshot.val();
        const data = dataRaw ? Object.keys(dataRaw).map(key => ({ id: key, ...dataRaw[key] })) : [];
        renderTable(data, category);
    });
}

function renderTable(data, category) {
    const tableBody = document.getElementById('schedule-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = ''; 

    // --- LOGIKA KOPI (JIKA DATA KOSONG) ---
    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-12">
                    <div class="flex flex-col items-center justify-center text-gray-400">
                        <i class="fas fa-mug-hot text-6xl mb-4 text-gray-300 animate-pulse"></i>
                        <p class="font-bold text-lg text-gray-500">Santai Dulu, Ngopi Bro...</p>
                        <p class="text-sm mt-1 text-gray-400">Gak ada jadwal di kategori ini.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }
    // --------------------------------------

    // Sorting Data
    if (category === 'uts' || category === 'personal') {
        data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || a.waktu.localeCompare(b.waktu));
    } else {
        const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
        data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || a.waktu.localeCompare(b.waktu));
    }

    data.forEach(item => {
        const badgeColor = item.tipe === 'Praktek' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
        const judul = getSafeTitle(item);
        
        const row = `
            <tr class="hover:bg-gray-50 border-b last:border-0 transition schedule-row" 
                data-hari="${item.hari || item.tanggal}" 
                data-waktu="${item.waktu}">
                
                <td class="p-4">
                    <div class="font-bold text-gray-800">${item.hari || item.tanggal}</div>
                    <div class="text-xs text-gray-500 font-mono">${item.waktu}</div>
                </td>
                <td class="p-4 font-medium text-gray-900">
                    ${judul}
                    <div class="text-xs text-gray-400 mt-1">${item.kode || ''}</div>
                </td>
                <td class="p-4">
                    <div class="font-bold text-gray-700">${item.ruangan || '-'}</div>
                    <div class="text-xs text-gray-500">Kelas: ${item.kelas || '-'}</div>
                </td>
                <td class="p-4">
                     <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${badgeColor}">
                        ${item.tipe || 'Info'}
                    </span>
                </td>
                <td class="p-4 text-sm text-gray-600">${item.dosen || item.keterangan || '-'}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

// Cek Bentrok UI (Tombol Kuning di Beranda)
window.checkConflictsUI = function() {
    const rows = document.querySelectorAll('.schedule-row');
    const alertBox = document.getElementById('conflict-alert');
    let conflictFound = false;

    rows.forEach(r => r.classList.remove('bg-red-50', 'border-l-4', 'border-red-500'));

    for (let i = 0; i < rows.length; i++) {
        const rowA = rows[i];
        const hariA = rowA.dataset.hari;
        const timeA = parseTime(rowA.dataset.waktu);

        for (let j = i + 1; j < rows.length; j++) {
            const rowB = rows[j];
            const hariB = rowB.dataset.hari;
            const timeB = parseTime(rowB.dataset.waktu);

            if (hariA === hariB && timeA.start < timeB.end && timeA.end > timeB.start) {
                rowA.classList.add('bg-red-50', 'border-l-4', 'border-red-500');
                rowB.classList.add('bg-red-50', 'border-l-4', 'border-red-500');
                conflictFound = true;
            }
        }
    }

    if (alertBox) {
        alertBox.classList.remove('hidden');
        if (conflictFound) {
            alertBox.className = "mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center font-bold";
            alertBox.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> ADA JADWAL BENTROK! (Cek warna merah)';
        } else {
            alertBox.className = "mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative text-center font-bold";
            alertBox.innerHTML = '<i class="fas fa-check-circle mr-2"></i> AMAN! Tidak ada jadwal bentrok.';
            setTimeout(() => { alertBox.classList.add('hidden'); }, 3000);
        }
    }
}

// ==========================================
// 4. LOGIC ADMIN (PANEL PENGELOLA)
// ==========================================

// Login & Auth Check
document.addEventListener('DOMContentLoaded', () => {
    // Cek Session
    if(localStorage.getItem('isAdmin') === 'true') {
        const loginForm = document.getElementById('login-form');
        const adminPanel = document.getElementById('admin-panel');
        if(loginForm && adminPanel) {
            loginForm.style.display = 'none';
            adminPanel.style.display = 'block';
            loadAdminData('daily'); // Load default tab
        }
    }
    checkUtsVisibility(); // Cek toggle buat index
});

const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const passInput = document.getElementById('password').value;
        // Password sederhana (Ganti sesuai keinginan)
        if(passInput === "admin123") {
             localStorage.setItem('isAdmin', 'true');
             location.reload(); 
        } else {
            const errorMsg = document.getElementById('login-error');
            errorMsg.innerText = "Password Salah!";
            errorMsg.style.display = 'block';
        }
    });
}

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm("Logout Admin?")) {
            localStorage.removeItem('isAdmin');
            location.reload();
        }
    });
}

// --- FIX UTAMA: LOGIC PINDAH TAB & LOAD DATA ---
// Ini yang bikin admin lu kosong kemarin, fungsinya ga manggil data.
window.switchTab = function(targetId, btn) {
    // 1. UI Changes (Sesuai HTML lu)
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.className = "tab-btn px-4 py-2 text-sm font-bold text-gray-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-300 transition whitespace-nowrap";
    });
    btn.className = "tab-btn active px-4 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600 transition whitespace-nowrap";

    // 2. DATA FETCHING (Ini yang kurang!)
    // targetId = "list-daily" -> category = "daily"
    // targetId = "list-uts" -> category = "uts"
    const category = targetId.replace('list-', ''); 
    loadAdminData(category);
}

// Load Data Admin (Dengan Delete Button)
function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    
    container.innerHTML = '<div class="text-center p-4 text-gray-400">Loading...</div>';
    
    db.ref('jadwal').orderByChild('kategori').equalTo(category).once('value', (snapshot) => {
        container.innerHTML = ''; 
        const dataRaw = snapshot.val();

        if(!dataRaw) {
            container.innerHTML = '<div class="text-center p-4 text-gray-400 italic">Data Kosong</div>';
            return;
        }

        Object.keys(dataRaw).forEach(key => {
            const item = dataRaw[key];
            const judul = getSafeTitle(item); // Pake safe title biar Personal muncul
            const subInfo = item.hari || item.tanggal;
            
            container.innerHTML += `
                <div class="bg-gray-50 p-3 rounded border flex justify-between items-center group mb-2 hover:bg-white hover:shadow-sm transition">
                    <div class="overflow-hidden">
                        <div class="font-bold text-sm text-gray-800 truncate">${judul}</div>
                        <div class="text-xs text-gray-500">
                            ${subInfo} • ${item.waktu}
                        </div>
                    </div>
                    <button onclick="deleteSchedule('${key}', '${category}')" class="ml-2 text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded bg-white border border-red-100 hover:bg-red-50 transition text-sm">
                        HAPUS
                    </button>
                </div>`;
        });
    });
}

// Hapus Jadwal
window.deleteSchedule = function(key, category) {
    if(!confirm("Yakin hapus?")) return;
    db.ref('jadwal/' + key).remove()
        .then(() => loadAdminData(category)) // Refresh list
        .catch(err => alert("Gagal hapus: " + err.message));
}

// Submit Form Tambah
const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = addForm.querySelector('button[type="submit"]');
        const oldText = btn.innerText;
        btn.innerText = "Cek Bentrok..."; btn.disabled = true;

        const kategori = document.getElementById('kategori').value;
        const hari = document.getElementById('hari').value;
        const waktu = document.getElementById('waktu').value;
        const tanggal = document.getElementById('tanggal').value;

        // Cek Bentrok Server
        const conflict = await checkConflictServer(kategori, hari, waktu, tanggal);
        if(conflict) {
            alert(`GAGAL: Bentrok dengan "${getSafeTitle(conflict)}" jam ${conflict.waktu}`);
            btn.innerText = oldText; btn.disabled = false;
            return;
        }

        // Simpan Data
        const newData = {
            kategori: kategori,
            matkul: document.getElementById('matkul').value,
            hari: hari, waktu: waktu, tanggal: tanggal,
            ruangan: document.getElementById('ruangan').value,
            kode: document.getElementById('kode').value,
            dosen: document.getElementById('dosen').value,
            kelas: document.getElementById('kelas').value,
            tipe: document.getElementById('tipe').value,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        db.ref('jadwal').push(newData).then(() => {
            alert("Berhasil!");
            addForm.reset();
            // Kembalikan form ke default state
            document.getElementById('kategori').value = kategori;
            loadAdminData(kategori);
            btn.innerText = oldText; btn.disabled = false;
        });
    });
}

// Toggle UTS (Disimpan di Firebase biar sinkron Admin <-> Index)
const toggleUts = document.getElementById('toggle-uts');
const statusText = document.getElementById('uts-status-text');

if (toggleUts) {
    // Listen perubahan dari database
    db.ref('settings/mode_uts').on('value', (snap) => {
        const isOn = snap.val();
        toggleUts.checked = isOn;
        if(statusText) statusText.innerText = isOn ? "ON" : "OFF";
        // Simpan juga ke localstorage buat backup
        localStorage.setItem('mode_uts', isOn);
    });

    toggleUts.addEventListener('change', (e) => {
        db.ref('settings/mode_uts').set(e.target.checked);
    });
}

// Logic Tampilan Tombol UTS di Index (Baca dari Firebase)
function checkUtsVisibility() {
    const btnUts = document.getElementById('btn-menu-uts');
    if(btnUts) {
        db.ref('settings/mode_uts').on('value', (snap) => {
            const isOn = snap.val();
            if(isOn) {
                btnUts.classList.remove('hidden');
                btnUts.classList.add('flex');
            } else {
                btnUts.classList.add('hidden');
                btnUts.classList.remove('flex');
            }
        });
    }
}

// ==========================================
// 5. WIDGET DASHBOARD (JAM & HARI INI)
// ==========================================
function updateClock() {
    const now = new Date();
    document.getElementById('digital-clock').innerText = now.toLocaleTimeString('id-ID', { hour12: false });
    document.getElementById('current-date').innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
if(document.getElementById('digital-clock')) setInterval(updateClock, 1000);

// Widget Jadwal Hari Ini (Juga pake logic Kopi kalau kosong)
async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const hariIni = days[now.getDay()];
    const offset = now.getTimezoneOffset() * 60000;
    const tglIni = new Date(now.getTime() - offset).toISOString().split('T')[0];

    // Ambil semua data
    const snap = await db.ref('jadwal').once('value');
    const dataRaw = snap.val();
    
    if(!dataRaw) {
        renderEmptyWidget(container);
        return;
    }

    const allData = Object.values(dataRaw);
    const todayUts = allData.filter(i => i.kategori === 'uts' && i.tanggal === tglIni);
    const todayDaily = allData.filter(i => i.kategori === 'daily' && i.hari === hariIni);
    const todayPersonal = allData.filter(i => i.kategori === 'personal' && i.tanggal === tglIni);

    let html = '';
    let adaJadwal = false;

    if (todayUts.length > 0) {
        adaJadwal = true;
        html += `<div class="text-xs font-bold text-red-500 mb-1 uppercase">Ujian</div>`;
        todayUts.forEach(item => html += renderWidgetRow(item, 'red'));
    }
    if (todayDaily.length > 0) {
        adaJadwal = true;
        html += `<div class="mt-2 text-xs font-bold text-blue-500 mb-1 uppercase">Kuliah</div>`;
        todayDaily.forEach(item => html += renderWidgetRow(item, 'blue'));
    }
    if (todayPersonal.length > 0) {
        adaJadwal = true;
        html += `<div class="mt-2 text-xs font-bold text-green-500 mb-1 uppercase">Personal</div>`;
        todayPersonal.forEach(item => html += renderWidgetRow(item, 'green'));
    }

    if (adaJadwal) {
        container.innerHTML = html;
    } else {
        renderEmptyWidget(container);
    }
}

function renderWidgetRow(item, color) {
    return `<div class="bg-${color}-50 border-l-4 border-${color}-500 p-2 rounded-r mb-2 text-left shadow-sm">
        <div class="flex justify-between"><b class="text-${color}-900 text-xs">${getSafeTitle(item)}</b> <span class="bg-${color}-200 text-${color}-800 text-[10px] px-1 rounded">${item.waktu}</span></div>
        <div class="text-[10px] text-gray-600 mt-1">${item.ruangan || '-'}</div>
    </div>`;
}

function renderEmptyWidget(container) {
    // Versi mini kopi buat widget
    container.innerHTML = `
        <div class="text-center py-6 text-gray-400">
            <i class="fas fa-mug-hot text-2xl mb-2 text-gray-300"></i>
            <p class="text-xs font-medium">Hari ini kosong.</p>
            <p class="text-[10px]">Silakan ngopi dulu.</p>
        </div>`;
}

if(document.getElementById('today-schedule-container')) loadTodaySchedule();
