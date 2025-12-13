// Konfigurasi State
let adminPassword = null; 

// ==========================================
// HELPER: KONVERSI WAKTU & PARSING
// ==========================================
function parseTime(timeStr) {
    if (!timeStr || !timeStr.includes('-')) return { start: 0, end: 0 };
    const [start, end] = timeStr.split('-').map(t => t.trim());
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return { start: sH * 60 + sM, end: eH * 60 + eM };
}

// Helper untuk menampilkan nama kegiatan yang valid (Handle beda nama field di DB)
function getTitle(item) {
    return item.matkul || item.nama_kegiatan || item.nama || "Tanpa Judul";
}

// Cek Bentrok (Dipakai saat Admin Tambah Data)
async function checkConflict(kategori, hari, waktu, tanggal) {
    try {
        const response = await fetch(`/api/schedule?category=${kategori}`);
        const existingData = await response.json();
        const newTime = parseTime(waktu);

        const conflict = existingData.find(item => {
            let isSameDay = false;
            // Logika: Daily cek Hari, UTS/Personal cek Tanggal
            if (kategori === 'daily') {
                isSameDay = item.hari === hari;
            } else {
                isSameDay = item.tanggal === tanggal;
            }

            if (!isSameDay) return false;

            // Cek Tabrakan Jam
            const existTime = parseTime(item.waktu);
            return (newTime.start < existTime.end && newTime.end > existTime.start);
        });

        return conflict; 
    } catch (e) {
        console.error("Gagal cek conflict:", e);
        return null; 
    }
}

// ==========================================
// BAGIAN 1: LOGIC UTAMA (BERANDA / USER VIEW)
// ==========================================

// Load Tabel Besar (Halaman Detail Jadwal)
window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Mengambil data...</td></tr>';
    if(titleElement) titleElement.innerText = category.toUpperCase();

    try {
        const response = await fetch(`/api/schedule?category=${category}`);
        const data = await response.json();
        renderTable(data, category);
    } catch (error) {
        console.error("Error:", error);
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Gagal memuat data.</td></tr>';
    }
}

function renderTable(data, category) {
    const tableBody = document.getElementById('schedule-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = ''; 

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-400">Belum ada jadwal di kategori ini.</td></tr>';
        return;
    }

    // Sorting biar rapi
    if (category === 'uts' || category === 'personal') {
        data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || a.waktu.localeCompare(b.waktu));
    } else {
        const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
        data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || a.waktu.localeCompare(b.waktu));
    }

    data.forEach(item => {
        const badgeColor = item.tipe === 'Praktek' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
        const row = `
            <tr class="hover:bg-gray-50 border-b last:border-0 transition">
                <td class="p-4">
                    <div class="font-bold text-gray-800">${item.hari || item.tanggal}</div>
                    <div class="text-xs text-gray-500">${item.waktu}</div>
                </td>
                <td class="p-4 font-medium text-gray-900">
                    ${getTitle(item)}
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

// Logika Tampilan Tombol UTS di Beranda (Sesuai Toggle Admin)
function checkUtsVisibility() {
    const btnUts = document.getElementById('btn-menu-uts');
    if(btnUts) {
        // Cek LocalStorage (diset oleh Admin panel)
        const isUtsOn = localStorage.getItem('mode_uts') === 'true';
        if(isUtsOn) {
            btnUts.classList.remove('hidden');
            btnUts.classList.add('flex');
        } else {
            btnUts.classList.add('hidden');
            btnUts.classList.remove('flex');
        }
    }
}
checkUtsVisibility();


// ==========================================
// BAGIAN 2: LOGIC ADMIN (PANEL PENGELOLA)
// ==========================================

// 1. LOGIN ADMIN
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const passInput = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');

        // Simple Auth Check (Cek koneksi ke API)
        try {
            const res = await fetch('/api/schedule?category=daily', { method: 'GET' });
            if(res.ok) {
                if(passInput) { 
                     adminPassword = passInput; 
                     document.getElementById('login-form').style.display = 'none';
                     document.getElementById('admin-panel').style.display = 'block';
                     // Load Default Data (Harian)
                     loadAdminData('daily'); 
                } else {
                    errorMsg.innerText = "Password tidak boleh kosong";
                    errorMsg.style.display = 'block';
                }
            }
        } catch (err) {
            errorMsg.innerText = "Gagal Login / Koneksi Error";
            errorMsg.style.display = 'block';
        }
    });
}

// 2. LOGOUT ADMIN
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm("Keluar dari Admin Panel?")) {
            adminPassword = null;
            document.getElementById('admin-panel').style.display = 'none';
            document.getElementById('login-form').style.display = 'flex';
            document.getElementById('password').value = ''; 
        }
    });
}

// 3. TOGGLE UTS (ON/OFF)
const toggleUts = document.getElementById('toggle-uts');
const statusText = document.getElementById('uts-status-text');

if (toggleUts) {
    const savedState = localStorage.getItem('mode_uts') === 'true';
    toggleUts.checked = savedState;
    updateStatusText(savedState);

    toggleUts.addEventListener('change', (e) => {
        const isOn = e.target.checked;
        localStorage.setItem('mode_uts', isOn);
        updateStatusText(isOn);
    });
}

function updateStatusText(isOn) {
    if(statusText) {
        statusText.innerText = isOn ? "ON" : "OFF";
        statusText.className = isOn ? "text-xs font-bold uppercase text-purple-600" : "text-xs font-bold uppercase text-gray-400";
    }
}

// 4. LOAD DATA ADMIN (FIX SINKRONISASI)
// Fungsi ini diperbaiki untuk handle nama field yang beda-beda (matkul vs nama_kegiatan)
async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return; // Jika tab tidak aktif, skip
    
    container.innerHTML = '<div class="text-center p-4 text-gray-400"><i class="fas fa-spinner fa-spin"></i> Loading data...</div>';
    
    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
        container.innerHTML = ''; 

        if(!data || data.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-gray-400 italic">Belum ada data di database.</div>';
            return;
        }

        // Render Item
        data.forEach(item => {
            // FIX: Gunakan getTitle biar Personal (yg gapunya matkul) tetap muncul
            const judul = getTitle(item);
            const subInfo = item.hari || item.tanggal;
            
            container.innerHTML += `
                <div class="bg-gray-50 p-3 rounded border flex justify-between items-center group mb-2 hover:bg-white hover:shadow-sm transition">
                    <div>
                        <div class="font-bold text-sm text-gray-800">${judul}</div>
                        <div class="text-xs text-gray-500">
                            <i class="fas fa-calendar-alt mr-1"></i>${subInfo} • 
                            <i class="fas fa-clock mr-1"></i>${item.waktu}
                        </div>
                         <div class="text-[10px] text-gray-400 mt-1">${item.ruangan || 'Online'}</div>
                    </div>
                    <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-400 hover:text-red-600 font-bold px-3 py-1 rounded hover:bg-red-50 transition" title="Hapus">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>`;
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="text-red-500 text-sm p-4">Gagal memuat list. Cek koneksi.</div>';
    }
}

// 5. TAMBAH JADWAL (SUBMIT FORM)
const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSubmit = addForm.querySelector('button[type="submit"]');
        const oldText = btnSubmit.innerText;
        btnSubmit.innerText = "Menyimpan...";
        btnSubmit.disabled = true;

        const kategori = document.getElementById('kategori').value;
        const hari = document.getElementById('hari').value;
        const waktu = document.getElementById('waktu').value;
        const tanggal = document.getElementById('tanggal').value;

        // Cek Bentrok dulu
        const conflictData = await checkConflict(kategori, hari, waktu, tanggal);
        if (conflictData) {
            alert(`GAGAL: Jadwal Bentrok!\nSudah ada: ${getTitle(conflictData)}\nJam: ${conflictData.waktu}`);
            btnSubmit.innerText = oldText;
            btnSubmit.disabled = false;
            return;
        }

        const rawData = {
            kategori: kategori,
            matkul: document.getElementById('matkul').value, // API akan mapping ini ke nama_kegiatan jika perlu
            hari: hari,
            waktu: waktu,
            ruangan: document.getElementById('ruangan').value,
            kode: document.getElementById('kode').value,
            dosen: document.getElementById('dosen').value,
            kelas: document.getElementById('kelas').value,
            tipe: document.getElementById('tipe').value,
            tanggal: tanggal,
        };

        try {
            const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
                body: JSON.stringify(rawData)
            });

            if (res.ok) {
                alert("Berhasil disimpan!");
                addForm.reset();
                toggleFormFields(); 
                // Refresh list admin biar langsung muncul
                loadAdminData(kategori);
            } else {
                alert("Gagal menyimpan (Cek Password Admin)");
            }
        } catch (err) { 
            console.error(err); 
            alert("Error koneksi.");
        } finally {
            btnSubmit.innerText = oldText;
            btnSubmit.disabled = false;
        }
    });
}

// 6. HAPUS JADWAL
window.deleteSchedule = async function(id, category) {
    if(!confirm("Yakin hapus data ini permanen?")) return;
    try {
        await fetch(`/api/schedule?id=${id}&category=${category}`, {
            method: 'DELETE', headers: { 'x-admin-password': adminPassword }
        });
        // Refresh list setelah hapus
        loadAdminData(category);
    } catch(e) {
        alert("Gagal menghapus.");
    }
}

// ==========================================
// BAGIAN 3: WIDGET DASHBOARD (JAM & JADWAL HARI INI)
// ==========================================

// Jam Digital
function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    if(clockEl) clockEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false });
    if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

// Widget Jadwal Hari Ini
async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const hariIni = days[now.getDay()]; 
    
    // Format YYYY-MM-DD local
    const offset = now.getTimezoneOffset() * 60000;
    const tglIni = new Date(now.getTime() - offset).toISOString().split('T')[0];

    container.innerHTML = '<p class="text-center italic text-gray-400 text-xs">Mengecek jadwal...</p>';

    try {
        const [resDaily, resUts, resPersonal] = await Promise.all([
            fetch('/api/schedule?category=daily'),
            fetch('/api/schedule?category=uts'), 
            fetch('/api/schedule?category=personal')
        ]);
        
        const daily = await resDaily.json();
        const uts = await resUts.json();
        const personal = await resPersonal.json();

        // Filter Logic
        const todayUts = uts.filter(u => u.tanggal === tglIni);
        const todayDaily = daily.filter(d => d.hari === hariIni);
        const todayPersonal = personal.filter(p => p.tanggal === tglIni);

        let html = '';
        let adaJadwal = false;

        // 1. UTS (Merah)
        if (todayUts.length > 0) {
            adaJadwal = true;
            html += `<div class="text-xs font-bold text-red-500 mb-1 uppercase tracking-wide">Jadwal Ujian (UTS)</div>`;
            todayUts.forEach(item => {
                html += `
                    <div class="bg-red-50 border-l-4 border-red-500 p-3 rounded-r mb-2 text-left shadow-sm">
                        <div class="flex justify-between"><b class="text-red-900 text-sm">${getTitle(item)}</b> <span class="bg-red-200 text-red-800 text-[10px] px-2 py-0.5 rounded">${item.waktu}</span></div>
                        <div class="text-xs text-gray-600 mt-1">Ruang: ${item.ruangan}</div>
                    </div>`;
            });
        }

        // 2. Kuliah (Biru)
        if (todayDaily.length > 0) {
            adaJadwal = true;
            if(todayUts.length > 0) html += `<div class="mt-3 text-xs font-bold text-blue-500 mb-1 uppercase tracking-wide">Jadwal Reguler</div>`;
            todayDaily.forEach(item => {
                html += `
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r mb-2 text-left shadow-sm">
                        <div class="flex justify-between"><b class="text-blue-900 text-sm">${getTitle(item)}</b> <span class="bg-blue-200 text-blue-800 text-[10px] px-2 py-0.5 rounded">${item.waktu}</span></div>
                        <div class="text-xs text-gray-600 mt-1">Ruang: ${item.ruangan}</div>
                    </div>`;
            });
        }

        // 3. Personal (Hijau)
        if (todayPersonal.length > 0) {
            adaJadwal = true;
            html += `<div class="mt-3 text-xs font-bold text-green-500 mb-1 uppercase tracking-wide">Agenda Pribadi</div>`;
            todayPersonal.forEach(item => {
                html += `
                    <div class="bg-green-50 border-l-4 border-green-500 p-3 rounded-r mb-2 text-left shadow-sm">
                        <div class="flex justify-between"><b class="text-green-900 text-sm">${getTitle(item)}</b> <span class="bg-green-200 text-green-800 text-[10px] px-2 py-0.5 rounded">${item.waktu}</span></div>
                        <div class="text-xs text-gray-600 mt-1">${item.keterangan || item.ruangan || '-'}</div>
                    </div>`;
            });
        }

        if (!adaJadwal) {
            container.innerHTML = `<div class="text-center py-6 text-gray-400">
                <i class="fas fa-mug-hot text-2xl mb-2 text-gray-300"></i><br>
                <span class="text-xs">Tidak ada jadwal hari ini.</span>
            </div>`;
        } else {
            container.innerHTML = html;
        }

    } catch (e) {
        container.innerHTML = '<div class="text-xs text-red-400 text-center">Gagal memuat widget.</div>';
    }
}
loadTodaySchedule();

// ==========================================
// BAGIAN 4: RESTORE DATA (TOOLS)
// ==========================================
// Gunakan ini di console browser: restoreJadwal() jika database kosong total

const backupJadwal = [
    // Jadwal Personal (Contoh)
    { kategori: 'personal', tanggal: new Date().toISOString().split('T')[0], waktu: '08:00-10:00', matkul: 'Jogging Pagi', ruangan: 'Stadion', tipe: 'Praktek', keterangan: 'Olahraga rutin' },
    
    // Jadwal UTS
    { kategori: 'uts', tanggal: '2025-11-11', waktu: '07:30-09:00', matkul: 'Analisis Struktur Data', ruangan: 'G.1.5', kode: 'TIF21208', dosen: 'SULYONO', kelas: '3TI1', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-12', waktu: '09:00-10:30', matkul: 'Multimedia', ruangan: 'Lab F', kode: 'TIF21213', dosen: 'HARIYANTO', kelas: '3TI2', tipe: 'Praktek' },
    
    // Jadwal Harian
    { kategori: 'daily', hari: 'Senin', waktu: '07:30-10:00', matkul: 'Algoritma', ruangan: 'G.2.1', dosen: 'Dr. Budi', kelas: '1TI1', tipe: 'Teori' }
];

window.restoreJadwal = async function() {
    const password = prompt("Password Admin:");
    if (!password) return;

    let count = 0;
    for (const item of backupJadwal) {
        try {
            const dataKirim = { ...item };
            delete dataKirim.kategori; 
            await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
                body: JSON.stringify({ kategori: item.kategori, ...dataKirim })
            });
            count++;
            console.log(`OK: ${item.matkul}`);
        } catch(e) { console.error(e); }
    }
    alert(`Restore selesai: ${count} data.`);
    location.reload();
};
