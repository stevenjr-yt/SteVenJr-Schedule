// Konfigurasi State
let adminPassword = null; 

// ==========================================
// HELPER: KONVERSI WAKTU & CEK BENTROK
// ==========================================
function parseTime(timeStr) {
    // Ubah "07:30-10:00" jadi menit (450 - 600)
    if (!timeStr || !timeStr.includes('-')) return { start: 0, end: 0 };
    const [start, end] = timeStr.split('-').map(t => t.trim());
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return { start: sH * 60 + sM, end: eH * 60 + eM };
}

async function checkConflict(kategori, hari, waktu, tanggal) {
    try {
        // Ambil data yang ada di server berdasarkan kategori
        const response = await fetch(`/api/schedule?category=${kategori}`);
        const existingData = await response.json();
        
        const newTime = parseTime(waktu);

        // Filter data yang bentrok
        const conflict = existingData.find(item => {
            // 1. Cek Hari / Tanggal
            let isSameDay = false;
            if (kategori === 'daily') {
                isSameDay = item.hari === hari;
            } else {
                // Untuk UTS & Personal cek Tanggal
                isSameDay = item.tanggal === tanggal;
            }

            if (!isSameDay) return false;

            // 2. Cek Jam (Overlap Logic)
            const existTime = parseTime(item.waktu);
            // Rumus: (StartBaru < EndLama) && (EndBaru > StartLama)
            return (newTime.start < existTime.end && newTime.end > existTime.start);
        });

        return conflict; // Return data yg bentrok kalau ada
    } catch (e) {
        console.error("Gagal cek conflict:", e);
        return null; // Asumsikan aman jika error server biar ga macet
    }
}

// ==========================================
// BAGIAN 1: LOGIC UTAMA (PUBLIC VIEW)
// ==========================================

// Fungsi Load Data Tabel (Halaman Jadwal)
window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    
    // Reset tampilan
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Mengambil data dari server...</td></tr>';
    if(titleElement) titleElement.innerText = category.toUpperCase();

    try {
        const response = await fetch(`/api/schedule?category=${category}`);
        const data = await response.json();
        renderTable(data, category);
    } catch (error) {
        console.error("Error:", error);
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Gagal koneksi server</td></tr>';
    }
}

function renderTable(data, category) {
    const tableBody = document.getElementById('schedule-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = ''; 

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Data kosong.</td></tr>';
        return;
    }

    // Sorting
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
                    ${item.matkul || item.nama_kegiatan}
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

// LOGIKA TOMBOL TOGGLE UTS (INDEX)
// Cek status dari LocalStorage (Simulasi Database Settings)
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
// Jalankan saat halaman dimuat
checkUtsVisibility();


// ==========================================
// BAGIAN 2: LOGIC ADMIN (LOGIN, CRUD & LOGOUT)
// ==========================================

// 1. LOGOUT LOGIC
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm("Apakah Anda yakin ingin logout admin?")) {
            adminPassword = null;
            document.getElementById('admin-panel').style.display = 'none';
            document.getElementById('login-form').style.display = 'flex'; // Balik ke form login
            document.getElementById('password').value = ''; // Kosongkan password
        }
    });
}

// 2. TOGGLE SWITCH LOGIC (ADMIN)
const toggleUts = document.getElementById('toggle-uts');
const statusText = document.getElementById('uts-status-text');

if (toggleUts) {
    // Load state awal
    const savedState = localStorage.getItem('mode_uts') === 'true';
    toggleUts.checked = savedState;
    updateStatusText(savedState);

    toggleUts.addEventListener('change', (e) => {
        const isOn = e.target.checked;
        localStorage.setItem('mode_uts', isOn); // Simpan state
        updateStatusText(isOn);
        // Alert opsional
        // alert(`Mode UTS sekarang: ${isOn ? 'ON' : 'OFF'}`);
    });
}

function updateStatusText(isOn) {
    if(statusText) {
        statusText.innerText = isOn ? "ON" : "OFF";
        statusText.className = isOn ? "text-xs font-bold uppercase text-purple-600" : "text-xs font-bold uppercase text-gray-400";
    }
}


// 3. LOGIN LOGIC
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const passInput = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');

        try {
            // Test Login (Menggunakan GET daily sebagai auth check sederhana)
            const res = await fetch('/api/schedule?category=daily', { method: 'GET' });
            if(res.ok) {
                // Login Berhasil (Client Side Validation Only for UI)
                // Note: Security idealnya di backend, ini hanya simulasi UI based on prompt
                if(passInput) { // Pastikan password diisi
                     adminPassword = passInput; 
                     document.getElementById('login-form').style.display = 'none';
                     document.getElementById('admin-panel').style.display = 'block';
                     loadAdminData('daily'); 
                } else {
                    throw new Error("Password kosong");
                }
            }
        } catch (err) {
            errorMsg.innerText = "Gagal Login / Koneksi Error";
            errorMsg.style.display = 'block';
        }
    });
}

// 4. ADD DATA LOGIC (DENGAN CEK BENTROK)
const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Ambil Data Form
        const kategori = document.getElementById('kategori').value;
        const hari = document.getElementById('hari').value;
        const waktu = document.getElementById('waktu').value;
        const tanggal = document.getElementById('tanggal').value;

        // --- LOGIKA CEK BENTROK ---
        const btnSubmit = addForm.querySelector('button[type="submit"]');
        const oldText = btnSubmit.innerText;
        btnSubmit.innerText = "Mengecek...";
        btnSubmit.disabled = true;

        const conflictData = await checkConflict(kategori, hari, waktu, tanggal);

        if (conflictData) {
            alert(`GAGAL SIMPAN!\nJadwal Bentrok dengan:\nMatkul: ${conflictData.matkul || conflictData.nama_kegiatan}\nWaktu: ${conflictData.waktu}`);
            btnSubmit.innerText = oldText;
            btnSubmit.disabled = false;
            return; // STOP DISINI, JANGAN LANJUT FETCH POST
        }
        // -------------------------

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
                const result = await res.json();
                alert("Berhasil disimpan!");
                addForm.reset();
                // Reset select box tipe agar form rapi
                toggleFormFields(); 
                loadAdminData(result.kategori);
            } else {
                alert("Gagal menyimpan (Cek Password Admin)");
            }
        } catch (err) { 
            console.error(err); 
            alert("Terjadi kesalahan koneksi.");
        } finally {
            btnSubmit.innerText = oldText;
            btnSubmit.disabled = false;
        }
    });
}

async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    container.innerHTML = '<div class="text-center p-4 text-gray-400">Loading data...</div>';
    
    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
        container.innerHTML = ''; 

        if(data.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-gray-400 italic">Belum ada data</div>';
            return;
        }

        data.forEach(item => {
            container.innerHTML += `
                <div class="bg-gray-50 p-3 rounded border flex justify-between items-center group mb-2 hover:bg-white hover:shadow-sm transition">
                    <div>
                        <div class="font-bold text-sm text-gray-800">${item.matkul || item.nama_kegiatan}</div>
                        <div class="text-xs text-gray-500">
                            <i class="fas fa-calendar-alt mr-1"></i>${item.hari || item.tanggal} • 
                            <i class="fas fa-clock mr-1"></i>${item.waktu}
                        </div>
                    </div>
                    <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-400 hover:text-red-600 font-bold px-3 py-1 rounded hover:bg-red-50 transition">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>`;
        });
    } catch (e) {
        container.innerHTML = '<div class="text-red-500 text-sm">Gagal memuat list.</div>';
    }
}

window.deleteSchedule = async function(id, category) {
    if(!confirm("Yakin hapus data ini? Data akan hilang permanen dari database.")) return;
    try {
        await fetch(`/api/schedule?id=${id}&category=${category}`, {
            method: 'DELETE', headers: { 'x-admin-password': adminPassword }
        });
        loadAdminData(category);
    } catch(e) {
        alert("Gagal menghapus.");
    }
}

// ==========================================
// BAGIAN 3: WIDGET BERANDA (SINKRON WAKTU & JAM)
// ==========================================

// 1. JAM DIGITAL
function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    if(clockEl) clockEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false });
    if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

// 2. WIDGET JADWAL HARI INI (Logic Tampil di Dashboard)
async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const hariIni = days[now.getDay()]; 
    
    // Format Tanggal YYYY-MM-DD (Penting untuk cek UTS/Personal)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const tglIni = `${year}-${month}-${day}`;

    container.innerHTML = '<p class="text-center italic text-gray-400">Cek jadwal...</p>';

    try {
        // Ambil Data
        const [resDaily, resUts, resPersonal] = await Promise.all([
            fetch('/api/schedule?category=daily'),
            fetch('/api/schedule?category=uts'), 
            fetch('/api/schedule?category=personal')
        ]);
        
        const daily = await resDaily.json();
        const uts = await resUts.json();
        const personal = await resPersonal.json();

        // LOGIKA FILTER:
        const todayUts = uts.filter(u => u.tanggal === tglIni);
        const todayDaily = daily.filter(d => d.hari === hariIni);
        const todayPersonal = personal.filter(p => p.tanggal === tglIni); // Pastikan tanggal personal format YYYY-MM-DD

        let html = '';
        let adaJadwal = false;

        // Render UTS (Merah)
        if (todayUts.length > 0) {
            adaJadwal = true;
            html += `<div class="text-xs font-bold text-red-500 mb-1 uppercase tracking-wide">Jadwal Ujian (UTS)</div>`;
            todayUts.forEach(item => {
                html += `
                    <div class="bg-red-50 border-l-4 border-red-500 p-3 rounded-r mb-2 text-left">
                        <div class="flex justify-between"><b class="text-red-900">${item.matkul}</b> <span class="bg-red-200 text-red-800 text-xs px-2 rounded">${item.waktu}</span></div>
                        <div class="text-xs text-gray-600 mt-1">Ruang: ${item.ruangan} | Pengawas: ${item.dosen}</div>
                    </div>`;
            });
        }

        // Render Kuliah Harian (Biru)
        if (todayDaily.length > 0) {
            adaJadwal = true;
            if(todayUts.length > 0) html += `<div class="mt-3 text-xs font-bold text-blue-500 mb-1 uppercase tracking-wide">Jadwal Reguler</div>`;
            todayDaily.forEach(item => {
                html += `
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r mb-2 text-left">
                        <div class="flex justify-between"><b class="text-blue-900">${item.matkul}</b> <span class="bg-blue-200 text-blue-800 text-xs px-2 rounded">${item.waktu}</span></div>
                        <div class="text-xs text-gray-600 mt-1">Ruang: ${item.ruangan} | Dosen: ${item.dosen}</div>
                    </div>`;
            });
        }

        // Render Personal (Hijau)
        if (todayPersonal.length > 0) {
            adaJadwal = true;
            html += `<div class="mt-3 text-xs font-bold text-green-500 mb-1 uppercase tracking-wide">Agenda Pribadi</div>`;
            todayPersonal.forEach(item => {
                html += `
                    <div class="bg-green-50 border-l-4 border-green-500 p-3 rounded-r mb-2 text-left">
                        <div class="flex justify-between"><b class="text-green-900">${item.matkul || item.nama_kegiatan}</b> <span class="bg-green-200 text-green-800 text-xs px-2 rounded">${item.waktu}</span></div>
                        <div class="text-xs text-gray-600 mt-1">Note: ${item.keterangan || item.dosen || '-'}</div>
                    </div>`;
            });
        }

        if (!adaJadwal) {
            container.innerHTML = `<div class="text-center py-4 text-gray-500">
                <i class="fas fa-bed text-2xl mb-2 text-gray-300"></i><br>
                Tidak ada jadwal hari ini (${hariIni}).
            </div>`;
        } else {
            container.innerHTML = html;
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="text-sm text-red-400">Gagal memuat widget jadwal.</div>';
    }
}
loadTodaySchedule();

// ==========================================
// BAGIAN 4: RESTORE DATA LAMA & DATA DUMMY PERSONAL
// ==========================================

const backupJadwal = [
    // --- JADWAL PERSONAL CONTOH (Agar tidak kosong saat restore) ---
    // Ganti tanggalnya dengan tanggal hari ini kalau mau test muncul di widget
    { kategori: 'personal', tanggal: new Date().toISOString().split('T')[0], waktu: '19:00-21:00', matkul: 'Belajar Coding (Contoh)', ruangan: 'Kamar', kode: '-', dosen: 'Self Study', kelas: '-', tipe: 'Praktek', keterangan: 'Target selesain fitur admin' },

    // --- 1. JADWAL UTS (Sesuai HTML) ---
    { kategori: 'uts', tanggal: '2025-11-21', waktu: '13:00-14:30', matkul: 'Aljabar Linier', ruangan: 'G.1.5', kode: 'TIF21211', dosen: 'SUCI MUTIARA, S.Kom., MTI', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-21', waktu: '13:00-14:30', matkul: 'Aljabar Linier', ruangan: 'G.1.6', kode: 'TIF21211', dosen: 'SUCI MUTIARA, S.Kom., MTI', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-14', waktu: '10:30-12:00', matkul: 'Kecerdasan Buatan', ruangan: 'F.4.3', kode: 'TIF21212', dosen: 'Dr Chairani, S.Kom., M.Eng', kelas: '3TI2', tipe: 'Teori' },
    // ... (Data UTS lainnya sesuai original kamu) ...

    // --- 2. JADWAL HARIAN ---
    { kategori: 'daily', hari: 'Senin', waktu: '10:30-12:00', matkul: 'Analisis Struktur Data', ruangan: 'F48', kode: 'TIF21208', dosen: 'SULYONO, S.Kom., M.T.I', kelas: '3TI1', tipe: 'Teori' },
    { kategori: 'daily', hari: 'Senin', waktu: '09:00-10:30', matkul: 'Aljabar Linier', ruangan: 'F42', kode: 'TIF21211', dosen: 'SUCI MUTIARA, S.Kom., MTI', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'daily', hari: 'Senin', waktu: '07:30-09:00', matkul: 'Kecerdasan Buatan', ruangan: 'F25', kode: 'TIF21212', dosen: 'Dr Chairani, S.Kom., M.Eng', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'daily', hari: 'Selasa', waktu: '07:30-09:00', matkul: 'Penjaminan Mutu Perangkat Lunak', ruangan: 'G14', kode: 'TIF21442', dosen: 'ISNANDAR AGUS, S.Pd., M.Kom', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'daily', hari: 'Rabu', waktu: '09:00-10:30', matkul: 'Multimedia', ruangan: 'F11', kode: 'TIF21213', dosen: 'HARIYANTO WIBOWO, S.Kom., MTI', kelas: '3TI2', tipe: 'Praktek' },
    { kategori: 'daily', hari: 'Rabu', waktu: '13:00-14:30', matkul: 'Pemrograman Lanjut', ruangan: 'E23', kode: 'TIF21410', dosen: 'SULYONO, S.Kom., M.T.I', kelas: '5TI1', tipe: 'Teori' },
    { kategori: 'daily', hari: 'Rabu', waktu: '14:40-16:10', matkul: 'Pemrograman Lanjut', ruangan: 'G21', kode: 'TIF21410', dosen: 'SULYONO, S.Kom., M.T.I', kelas: '5TI1', tipe: 'Praktek' },
    { kategori: 'daily', hari: 'Kamis', waktu: '13:00-14:30', matkul: 'Organisasi dan Arsitektur Komputer', ruangan: 'G12', kode: 'FIK21406', dosen: 'SHERLI TRISNAWATI, S.Kom., MTI', kelas: '3TI3', tipe: 'Teori' },
    { kategori: 'daily', hari: 'Kamis', waktu: '10:30-12:00', matkul: 'Mobile Computing', ruangan: 'F45', kode: 'TIF21209', dosen: 'ADIMAS AGLASIA, S.Kom., MTI', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'daily', hari: 'Jumat', waktu: '13:00-14:30', matkul: 'Pengantar Ilmu Komputer', ruangan: 'F31', kode: 'TIF21202', dosen: 'SITI NUR LAILA, S.Kom., M.T.I.', kelas: '3TI2', tipe: 'Teori' }
];

window.restoreJadwal = async function() {
    const password = prompt("Masukkan Password Admin (Environment Variable) untuk upload semua data ini:");
    if (!password) return alert("Password dibutuhkan!");

    console.log("🚀 Memulai upload data...");
    let count = 0;
    let errors = 0;
    
    for (const item of backupJadwal) {
        try {
            const dataKirim = { ...item };
            delete dataKirim.kategori; 

            const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-admin-password': password 
                },
                body: JSON.stringify({ 
                    kategori: item.kategori, 
                    ...dataKirim 
                })
            });

            if(res.ok) {
                count++;
                console.log(`✅ [${item.kategori.toUpperCase()}] Sukses: ${item.matkul}`);
            } else {
                errors++;
                console.error(`❌ Gagal: ${item.matkul}`);
            }
        } catch(e) {
            errors++;
            console.error(`❌ Error Network: ${item.matkul}`);
        }
    }
    
    alert(`Proses Selesai!\n✅ Berhasil: ${count}\n❌ Gagal: ${errors}\n\nSilakan refresh halaman.`);
};
