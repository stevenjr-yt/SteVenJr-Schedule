// Konfigurasi State
let adminPassword = null; 

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
        // Ambil SEMUA data (Tanpa filter tanggal, jadi data lewat TETAP MUNCUL)
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

    // Urutkan data biar rapi
    // UTS berdasarkan Tanggal, Daily berdasarkan Waktu
    if (category === 'uts') {
        data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || a.waktu.localeCompare(b.waktu));
    } else {
        const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
        data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || a.waktu.localeCompare(b.waktu));
    }

    data.forEach(item => {
        // Tentukan warna badge
        const badgeColor = item.tipe === 'Praktek' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
        
        // Tampilan Baris Tabel
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

// ==========================================
// BAGIAN 2: LOGIC ADMIN (LOGIN & CRUD)
// ==========================================

const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const passInput = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');

        try {
            // Test Login ke API
            const res = await fetch('/api/schedule?category=daily', { method: 'GET' });
            if(res.ok) {
                adminPassword = passInput; 
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'block';
                loadAdminData('daily'); 
            }
        } catch (err) {
            errorMsg.innerText = "Gagal Login / Koneksi Error";
            errorMsg.style.display = 'block';
        }
    });
}

const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawData = {
            kategori: document.getElementById('kategori').value,
            matkul: document.getElementById('matkul').value,
            hari: document.getElementById('hari').value,
            waktu: document.getElementById('waktu').value,
            ruangan: document.getElementById('ruangan').value,
            kode: document.getElementById('kode').value,
            dosen: document.getElementById('dosen').value,
            kelas: document.getElementById('kelas').value,
            tipe: document.getElementById('tipe').value,
            tanggal: document.getElementById('tanggal').value, // Khusus UTS
        };

        try {
            const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
                body: JSON.stringify(rawData)
            });

            if (res.ok) {
                alert("Tersimpan!");
                addForm.reset();
                loadAdminData(rawData.kategori);
            } else {
                alert("Gagal menyimpan (Cek Password)");
            }
        } catch (err) { console.error(err); }
    });
}

async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    container.innerHTML = 'Loading...';
    
    const res = await fetch(`/api/schedule?category=${category}`);
    const data = await res.json();
    container.innerHTML = ''; 

    data.forEach(item => {
        container.innerHTML += `
            <div class="bg-gray-50 p-3 rounded border flex justify-between items-center group mb-2">
                <div>
                    <div class="font-bold text-sm">${item.matkul || item.nama}</div>
                    <div class="text-xs text-gray-500">${item.hari || item.tanggal} • ${item.waktu}</div>
                </div>
                <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-500 font-bold px-2 hover:bg-red-100 rounded">
                    <i class="fas fa-trash"></i> HAPUS
                </button>
            </div>`;
    });
}

window.deleteSchedule = async function(id, category) {
    if(!confirm("Yakin hapus data ini? Data akan hilang permanen dari database.")) return;
    await fetch(`/api/schedule?id=${id}&category=${category}`, {
        method: 'DELETE', headers: { 'x-admin-password': adminPassword }
    });
    loadAdminData(category);
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
        // Ambil Data (Tanpa Filter di Server, Filter di sini saja)
        const [resDaily, resUts, resPersonal] = await Promise.all([
            fetch('/api/schedule?category=daily'),
            fetch('/api/schedule?category=uts'), // Cek juga UTS
            fetch('/api/schedule?category=personal')
        ]);
        
        const daily = await resDaily.json();
        const uts = await resUts.json();
        const personal = await resPersonal.json();

        // LOGIKA FILTER:
        // 1. Cek UTS dulu (Prioritas). UTS dicek berdasarkan TANGGAL yang SAMA PERCIS.
        const todayUts = uts.filter(u => u.tanggal === tglIni);

        // 2. Cek Daily (Hanya tampil kalau TIDAK ADA UTS di hari itu, atau mau ditampilkan bareng?)
        //    Biasanya kalau ada UTS, kuliah libur. Tapi di sini saya tampilkan sesuai hari saja.
        const todayDaily = daily.filter(d => d.hari === hariIni);

        // 3. Personal
        const todayPersonal = personal.filter(p => p.tanggal === tglIni);

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
                        <div class="text-xs text-gray-600 mt-1">Note: ${item.keterangan}</div>
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
        container.innerHTML = 'Gagal memuat widget.';
    }
}
loadTodaySchedule();

// ==========================================
// BAGIAN 4: RESTORE DATA LAMA (DATA REAL DARI HTML KAMU)
// ==========================================
// Note: Saya sudah melengkapi nama dosen di Jadwal Harian berdasarkan data UTS kamu.

const backupJadwal = [
    // --- 1. JADWAL UTS (Sesuai HTML) ---
    { kategori: 'uts', tanggal: '2025-11-21', waktu: '13:00-14:30', matkul: 'Aljabar Linier', ruangan: 'G.1.5', kode: 'TIF21211', dosen: 'SUCI MUTIARA, S.Kom., MTI', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-21', waktu: '13:00-14:30', matkul: 'Aljabar Linier', ruangan: 'G.1.6', kode: 'TIF21211', dosen: 'SUCI MUTIARA, S.Kom., MTI', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-14', waktu: '10:30-12:00', matkul: 'Kecerdasan Buatan', ruangan: 'F.4.3', kode: 'TIF21212', dosen: 'Dr Chairani, S.Kom., M.Eng', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-14', waktu: '10:30-12:00', matkul: 'Kecerdasan Buatan', ruangan: 'F.4.4', kode: 'TIF21212', dosen: 'Dr Chairani, S.Kom., M.Eng', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-18', waktu: '09:00-10:30', matkul: 'Mobile Computing', ruangan: 'G.1.3', kode: 'TIF21209', dosen: 'ADIMAS AGLASIA, S.Kom., MTI', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-18', waktu: '09:00-10:30', matkul: 'Mobile Computing', ruangan: 'G.1.4', kode: 'TIF21209', dosen: 'ADIMAS AGLASIA, S.Kom., MTI', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-12', waktu: '09:00-10:30', matkul: 'Multimedia', ruangan: 'Lab Das. F (F.1)', kode: 'TIF21213', dosen: 'HARIYANTO WIBOWO, S.Kom., MTI', kelas: '3TI2', tipe: 'Praktek' },
    { kategori: 'uts', tanggal: '2025-11-12', waktu: '13:00-14:30', matkul: 'Pengantar Ilmu Komputer', ruangan: 'G.1.5', kode: 'TIF21202', dosen: 'SITI NUR LAILA, S.Kom., M.T.I.', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-12', waktu: '13:00-14:30', matkul: 'Pengantar Ilmu Komputer', ruangan: 'G.1.6', kode: 'TIF21202', dosen: 'SITI NUR LAILA, S.Kom., M.T.I.', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-13', waktu: '07:30-09:00', matkul: 'Penjaminan Mutu Perangkat Lunak', ruangan: 'G.1.5', kode: 'TIF21442', dosen: 'ISNANDAR AGUS, S.Pd., M.Kom', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-13', waktu: '07:30-09:00', matkul: 'Penjaminan Mutu Perangkat Lunak', ruangan: 'G.1.6', kode: 'TIF21442', dosen: 'ISNANDAR AGUS, S.Pd., M.Kom', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-13', waktu: '09:00-10:30', matkul: 'Organisasi dan Arsitektur Komputer', ruangan: 'F.2.5', kode: 'FIK21406', dosen: 'SHERLI TRISNAWATI, S.Kom., MTI', kelas: '3TI3', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-11', waktu: '07:30-09:00', matkul: 'Analisis Struktur Data', ruangan: 'G.1.5', kode: 'TIF21208', dosen: 'SULYONO, S.Kom., M.T.I', kelas: '3TI1', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-11', waktu: '07:30-09:00', matkul: 'Analisis Struktur Data', ruangan: 'G.1.6', kode: 'TIF21208', dosen: 'SULYONO, S.Kom., M.T.I', kelas: '3TI1', tipe: 'Teori' },
    { kategori: 'uts', tanggal: '2025-11-12', waktu: '14:40-16:10', matkul: 'Pemrograman Lanjut', ruangan: 'Lab. Das A (G.2)', kode: 'TIF21410', dosen: 'SULYONO, S.Kom., M.T.I', kelas: '5TI1', tipe: 'Praktek' },
    { kategori: 'uts', tanggal: '2025-11-14', waktu: '13:00-14:30', matkul: 'Pemrograman Lanjut', ruangan: 'F.2.3', kode: 'TIF21410', dosen: 'SULYONO, S.Kom., M.T.I', kelas: '5TI1', tipe: 'Teori' },

    // --- 2. JADWAL HARIAN (DARI TABEL HTML LAMA) ---
    // Nama Dosen sudah saya mapping dari UTS agar tidak kosong
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

// FUNGSI UPLOAD OTOMATIS (JALANKAN DI CONSOLE)
window.restoreJadwal = async function() {
    const password = prompt("Masukkan Password Admin (Environment Variable) untuk upload semua data ini:");
    if (!password) return alert("Password dibutuhkan!");

    console.log("🚀 Memulai upload data...");
    let count = 0;
    let errors = 0;
    
    for (const item of backupJadwal) {
        try {
            const dataKirim = { ...item };
            delete dataKirim.kategori; // Bersihkan field kategori sebelum kirim

            // Kirim request ke Vercel API
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
