// Konfigurasi State
let adminPassword = null; 

// ==========================================
// 0. HELPER PENTING (JANGAN DIHAPUS)
// ==========================================

// Fungsi: Ubah "08:00-10:00" jadi angka menit (480 - 600) biar bisa dihitung
function parseTime(timeStr) {
    if (!timeStr || !timeStr.includes('-')) return { start: 0, end: 0 };
    const [start, end] = timeStr.split('-').map(t => t.trim());
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return { start: sH * 60 + sM, end: eH * 60 + eM };
}

// FUNGSI SAKTI: Ini yang bikin data PASTI MUNCUL di Admin & Beranda
// Dia nyari judul dari berbagai kemungkinan nama field di database
function getSafeTitle(item) {
    return item.matkul || item.nama_kegiatan || item.nama || item.kegiatan || "Tanpa Judul";
}

// Cek Bentrok (Logic Server/Database)
async function checkConflictServer(kategori, hari, waktu, tanggal) {
    try {
        const response = await fetch(`/api/schedule?category=${kategori}`);
        const existingData = await response.json();
        const newTime = parseTime(waktu);

        return existingData.find(item => {
            let isSameDay = (kategori === 'daily') ? (item.hari === hari) : (item.tanggal === tanggal);
            if (!isSameDay) return false;

            const existTime = parseTime(item.waktu);
            // Rumus Tabrakan Waktu
            return (newTime.start < existTime.end && newTime.end > existTime.start);
        });
    } catch (e) {
        console.error("Gagal cek conflict server:", e);
        return null; 
    }
}

// ==========================================
// BAGIAN 1: LOGIC BERANDA (USER VIEW)
// ==========================================

// Load Data Tabel
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
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Gagal memuat data.</td></tr>';
    }
}

function renderTable(data, category) {
    const tableBody = document.getElementById('schedule-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = ''; 

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-400">Belum ada jadwal.</td></tr>';
        return;
    }

    // Sorting Data
    if (category === 'uts' || category === 'personal') {
        data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || a.waktu.localeCompare(b.waktu));
    } else {
        const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
        data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || a.waktu.localeCompare(b.waktu));
    }

    data.forEach(item => {
        const badgeColor = item.tipe === 'Praktek' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
        
        // PENTING: Pake getSafeTitle biar judulnya gak kosong
        const judul = getSafeTitle(item);
        
        // Tambahkan atribut data-hari dan data-waktu ke baris TR untuk fitur Cek Bentrok
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

// === LOGIKA CEK BENTROK (UI BERANDA) YANG LU MINTA ===
// Hijau kalau aman, Merah kalau bentrok
window.checkConflictsUI = function() {
    const rows = document.querySelectorAll('.schedule-row');
    const alertBox = document.getElementById('conflict-alert');
    let conflictFound = false;

    // 1. Reset Tampilan Dulu
    rows.forEach(r => r.classList.remove('bg-red-50', 'border-l-4', 'border-red-500'));
    if(alertBox) {
        alertBox.classList.add('hidden');
        alertBox.className = 'hidden mt-4 px-4 py-3 rounded relative text-center font-bold border'; // Reset class dasar
    }

    // 2. Loop Cek Tabrakan (Baris vs Baris)
    for (let i = 0; i < rows.length; i++) {
        const rowA = rows[i];
        const hariA = rowA.dataset.hari;
        const timeA = parseTime(rowA.dataset.waktu);

        for (let j = i + 1; j < rows.length; j++) {
            const rowB = rows[j];
            const hariB = rowB.dataset.hari;
            const timeB = parseTime(rowB.dataset.waktu);

            // Cek jika Hari/Tanggal SAMA
            if (hariA === hariB) {
                // Cek jika Jam BENTROK
                if (timeA.start < timeB.end && timeA.end > timeB.start) {
                    // Tandai Merah di Tabel
                    rowA.classList.add('bg-red-50', 'border-l-4', 'border-red-500');
                    rowB.classList.add('bg-red-50', 'border-l-4', 'border-red-500');
                    conflictFound = true;
                }
            }
        }
    }

    // 3. TAMPILKAN HASIL (MERAH / HIJAU)
    if (alertBox) {
        alertBox.classList.remove('hidden');
        if (conflictFound) {
            // KONDISI MERAH (BENTROK)
            alertBox.classList.add('bg-red-100', 'border-red-400', 'text-red-700');
            alertBox.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Ditemukan Jadwal Bentrok! (Cek baris berwarna merah)';
        } else {
            // KONDISI HIJAU (AMAN)
            alertBox.classList.add('bg-green-100', 'border-green-400', 'text-green-700');
            alertBox.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Aman! Tidak ada jadwal yang bentrok.';
            
            // Opsional: Hilang sendiri setelah 3 detik biar rapi
            setTimeout(() => { alertBox.classList.add('hidden'); }, 4000);
        }
    }
}


// Toggle Tombol UTS di Beranda
function checkUtsVisibility() {
    const btnUts = document.getElementById('btn-menu-uts');
    if(btnUts) {
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
// BAGIAN 2: LOGIC ADMIN (PANEL)
// ==========================================

// Login
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const passInput = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        try {
            const res = await fetch('/api/schedule?category=daily', { method: 'GET' });
            if(res.ok && passInput) {
                 adminPassword = passInput; 
                 document.getElementById('login-form').style.display = 'none';
                 document.getElementById('admin-panel').style.display = 'block';
                 loadAdminData('daily'); 
            } else {
                errorMsg.innerText = "Password Wajib Diisi / Koneksi Gagal";
                errorMsg.style.display = 'block';
            }
        } catch (err) {
            errorMsg.innerText = "Error Koneksi";
            errorMsg.style.display = 'block';
        }
    });
}

// Logout
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm("Keluar dari Admin?")) {
            adminPassword = null;
            document.getElementById('admin-panel').style.display = 'none';
            document.getElementById('login-form').style.display = 'flex';
            document.getElementById('password').value = ''; 
        }
    });
}

// Toggle UTS
const toggleUts = document.getElementById('toggle-uts');
const statusText = document.getElementById('uts-status-text');
if (toggleUts) {
    const savedState = localStorage.getItem('mode_uts') === 'true';
    toggleUts.checked = savedState;
    if(statusText) statusText.innerText = savedState ? "ON" : "OFF";

    toggleUts.addEventListener('change', (e) => {
        const isOn = e.target.checked;
        localStorage.setItem('mode_uts', isOn);
        if(statusText) statusText.innerText = isOn ? "ON" : "OFF";
    });
}

// LOAD ADMIN DATA (INILAH PERBAIKAN UTAMA BIAR BISA HAPUS)
async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    
    container.innerHTML = '<div class="text-center p-4 text-gray-400">Loading...</div>';
    
    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
        container.innerHTML = ''; 

        if(!data || data.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-gray-400 italic">Data Kosong</div>';
            return;
        }

        data.forEach(item => {
            // KUNCI PERBAIKAN: Gunakan getSafeTitle()
            // Ini akan memaksa data "Personal" tampil meski nama kolomnya beda
            const judul = getSafeTitle(item);
            const subInfo = item.hari || item.tanggal;
            
            container.innerHTML += `
                <div class="bg-gray-50 p-3 rounded border flex justify-between items-center group mb-2 hover:bg-white hover:shadow-sm transition">
                    <div class="overflow-hidden">
                        <div class="font-bold text-sm text-gray-800 truncate">${judul}</div>
                        <div class="text-xs text-gray-500">
                            ${subInfo} • ${item.waktu}
                        </div>
                    </div>
                    <button onclick="deleteSchedule('${item.id}', '${category}')" class="ml-2 text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded bg-white border border-red-100 hover:bg-red-50 transition text-sm">
                        HAPUS
                    </button>
                </div>`;
        });
    } catch (e) {
        container.innerHTML = '<div class="text-red-500 text-sm p-4">Error loading list.</div>';
    }
}

// Tambah Jadwal (Dengan Cek Bentrok)
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

        // Cek Bentrok di Server dulu sebelum simpan
        const conflictData = await checkConflictServer(kategori, hari, waktu, tanggal);
        if (conflictData) {
            alert(`GAGAL: BENTROK!\nJadwal yang nabrak: ${getSafeTitle(conflictData)}\nJam: ${conflictData.waktu}`);
            btnSubmit.innerText = oldText;
            btnSubmit.disabled = false;
            return;
        }

        const rawData = {
            kategori: kategori,
            matkul: document.getElementById('matkul').value, 
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
                alert("Sukses Tersimpan!");
                addForm.reset();
                // Refresh list admin
                loadAdminData(kategori);
            } else {
                alert("Gagal (Cek Password/Koneksi)");
            }
        } catch (err) { 
            alert("Error Sistem.");
        } finally {
            btnSubmit.innerText = oldText;
            btnSubmit.disabled = false;
        }
    });
}

// Hapus Jadwal
window.deleteSchedule = async function(id, category) {
    if(!confirm("Yakin hapus data ini?")) return;
    try {
        await fetch(`/api/schedule?id=${id}&category=${category}`, {
            method: 'DELETE', headers: { 'x-admin-password': adminPassword }
        });
        loadAdminData(category); // Refresh list biar langsung hilang
    } catch(e) {
        alert("Gagal menghapus.");
    }
}

// ==========================================
// BAGIAN 3: WIDGET DASHBOARD
// ==========================================

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    if(clockEl) clockEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false });
    if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const hariIni = days[now.getDay()]; 
    // Format YYYY-MM-DD local timezone
    const offset = now.getTimezoneOffset() * 60000;
    const tglIni = new Date(now.getTime() - offset).toISOString().split('T')[0];

    container.innerHTML = '<p class="text-center italic text-gray-400 text-xs">...</p>';

    try {
        const [resDaily, resUts, resPersonal] = await Promise.all([
            fetch('/api/schedule?category=daily'),
            fetch('/api/schedule?category=uts'), 
            fetch('/api/schedule?category=personal')
        ]);
        
        const daily = await resDaily.json();
        const uts = await resUts.json();
        const personal = await resPersonal.json();

        const todayUts = uts.filter(u => u.tanggal === tglIni);
        const todayDaily = daily.filter(d => d.hari === hariIni);
        const todayPersonal = personal.filter(p => p.tanggal === tglIni);

        let html = '';
        let adaJadwal = false;

        if (todayUts.length > 0) {
            adaJadwal = true;
            html += `<div class="text-xs font-bold text-red-500 mb-1 uppercase">Ujian (UTS)</div>`;
            todayUts.forEach(item => {
                html += renderWidgetRow(item, 'red');
            });
        }

        if (todayDaily.length > 0) {
            adaJadwal = true;
            if(todayUts.length > 0) html += `<div class="mt-2 text-xs font-bold text-blue-500 mb-1 uppercase">Kuliah</div>`;
            todayDaily.forEach(item => {
                html += renderWidgetRow(item, 'blue');
            });
        }

        if (todayPersonal.length > 0) {
            adaJadwal = true;
            html += `<div class="mt-2 text-xs font-bold text-green-500 mb-1 uppercase">Personal</div>`;
            todayPersonal.forEach(item => {
                html += renderWidgetRow(item, 'green');
            });
        }

        container.innerHTML = adaJadwal ? html : `<div class="text-center py-6 text-gray-400"><span class="text-xs">Tidak ada jadwal hari ini.</span></div>`;

    } catch (e) {
        container.innerHTML = '<div class="text-xs text-red-400 text-center">Gagal Widget</div>';
    }
}

function renderWidgetRow(item, color) {
    return `<div class="bg-${color}-50 border-l-4 border-${color}-500 p-2 rounded-r mb-2 text-left shadow-sm">
        <div class="flex justify-between"><b class="text-${color}-900 text-xs">${getSafeTitle(item)}</b> <span class="bg-${color}-200 text-${color}-800 text-[10px] px-1 rounded">${item.waktu}</span></div>
        <div class="text-[10px] text-gray-600 mt-1">${item.ruangan || '-'}</div>
    </div>`;
}
loadTodaySchedule();

// ==========================================
// BAGIAN 4: RESTORE / UPLOAD ULANG DATA
// ==========================================
// Kalau Database lu kosong, jalankan restoreJadwal() di console browser.
const backupJadwal = [
    { kategori: 'personal', tanggal: new Date().toISOString().split('T')[0], waktu: '20:00-21:00', matkul: 'Belajar Coding', ruangan: 'Rumah', tipe: 'Praktek', keterangan: 'Target selesai admin' },
    { kategori: 'daily', hari: 'Senin', waktu: '07:30-10:00', matkul: 'Algoritma', ruangan: 'G.2.1', dosen: 'Dr. Budi', kelas: '1TI1', tipe: 'Teori' }
];

window.restoreJadwal = async function() {
    const password = prompt("Password Admin:");
    if (!password) return;
    for (const item of backupJadwal) {
        try {
            const dataKirim = { ...item };
            delete dataKirim.kategori; 
            await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
                body: JSON.stringify({ kategori: item.kategori, ...dataKirim })
            });
            console.log(`OK: ${item.matkul}`);
        } catch(e) {}
    }
    alert("Restore Selesai.");
    location.reload();
};
