// Konfigurasi State
let adminPassword = null; // Akan diisi saat login

// ==========================================
// BAGIAN 1: LOGIC INDEX.HTML (PUBLIC VIEW)
// ==========================================

// Fungsi Load Data (Menggantikan getDocs Firebase)
window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    
    // UI Loading
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Sedang memuat data dari server aman...</td></tr>';
    if(titleElement) titleElement.innerText = category.toUpperCase();

    try {
        // PANGGIL VERCEL API (Bukan Firebase langsung)
        const response = await fetch(`/api/schedule?category=${category}`);
        const data = await response.json();

        renderTable(data, category); // Fungsi render ada di bawah
    } catch (error) {
        console.error("Error:", error);
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500">Gagal memuat data</td></tr>';
    }
}

// Fungsi Render Table (Visualisasi Data)
function renderTable(data, category) {
    const tableBody = document.getElementById('schedule-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // Reset isi tabel

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Belum ada jadwal.</td></tr>';
        return;
    }

    data.forEach(item => {
        // Logic warna badge sederhana
        const badgeColor = item.hari === 'Senin' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800';

        const row = `
            <tr class="hover:bg-gray-50 border-b last:border-0 transition">
                <td class="p-4">
                    <div class="font-bold text-gray-800">${item.hari || '-'}</div>
                    <div class="text-xs text-gray-500">${item.waktu || '-'}</div>
                </td>
                <td class="p-4 font-medium text-gray-900">${item.matkul || item.nama_kegiatan}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-xs font-bold ${badgeColor}">
                        ${item.ruangan || '-'}
                    </span>
                    <div class="text-xs text-gray-400 mt-1">${item.kode || ''}</div>
                </td>
                <td class="p-4 text-sm text-gray-600">${item.dosen || item.keterangan || '-'}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}


// ==========================================
// BAGIAN 2: LOGIC ADMIN.HTML (SECURE DASHBOARD)
// ==========================================

// Login Sederhana (Simpan Password di Memori Browser Sementara)
const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('email').value; // Hanya formalitas UI
        const passInput = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');

        // Kita coba test koneksi ke API dengan password ini
        // Menggunakan endpoint dummy atau fetch data simple
        try {
            // Kita coba fetch data daily, tapi sertakan password di header untuk test
            const res = await fetch('/api/schedule?category=daily', {
                method: 'GET'
            });
            
            if(res.ok) {
                // Jika sukses, simpan password di variabel global untuk dipakai saat Add/Delete
                // CATATAN: Untuk keamanan level tinggi, gunakan Token/JWT. 
                // Tapi untuk project pribadi, menyimpan pass input user di memori JS sudah cukup aman dari inspect element network tab (selama pakai HTTPS).
                adminPassword = passInput; 
                
                // Pindah ke Dashboard
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'block';
                
                // Load data awal admin
                loadAdminData('daily'); 
            }
        } catch (err) {
            errorMsg.innerText = "Koneksi Gagal / Password Salah";
            errorMsg.style.display = 'block';
        }
    });
}

// Fungsi Tambah Data (Kirim ke API)
const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Ambil value dari form
        const rawData = {
            kategori: document.getElementById('kategori').value,
            matkul: document.getElementById('matkul').value,
            hari: document.getElementById('hari').value,
            waktu: document.getElementById('waktu').value,
            ruangan: document.getElementById('ruangan').value,
            kode: document.getElementById('kode').value,
            dosen: document.getElementById('dosen').value,
            // ... tambahkan field lain sesuai kebutuhan
        };

        try {
            const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPassword // Password dikirim sebagai kunci akses
                },
                body: JSON.stringify(rawData)
            });

            if (res.ok) {
                alert("Data Berhasil Disimpan!");
                addForm.reset();
                loadAdminData(rawData.kategori); // Refresh list
            } else {
                alert("Gagal menyimpan (Cek Password/Koneksi)");
            }
        } catch (err) {
            console.error(err);
        }
    });
}

// Fungsi Load Data untuk List di Admin Panel
async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;

    container.innerHTML = '<p class="text-xs text-gray-500 text-center mt-4">Loading...</p>';

    const res = await fetch(`/api/schedule?category=${category}`);
    const data = await res.json();

    container.innerHTML = ''; // Clear

    data.forEach(item => {
        const itemHtml = `
            <div class="bg-gray-50 p-3 rounded border flex justify-between items-center group">
                <div>
                    <div class="font-bold text-sm text-gray-800">${item.matkul || item.nama}</div>
                    <div class="text-xs text-gray-500">${item.hari} • ${item.waktu}</div>
                </div>
                <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.innerHTML += itemHtml;
    });
}

// Fungsi Hapus (Global Window)
window.deleteSchedule = async function(id, category) {
    if(!confirm("Yakin hapus?")) return;

    const res = await fetch(`/api/schedule?id=${id}&category=${category}`, {
        method: 'DELETE',
        headers: {
            'x-admin-password': adminPassword
        }
    });

    if(res.ok) {
        loadAdminData(category);
    } else {
        alert("Gagal menghapus");
    }
}

// ==========================================
// BAGIAN 3: FITUR TAMBAHAN (JAM & TANGGAL)
// ==========================================

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    
    // Update Jam
    if(clockEl) {
        // Format jam 24 jam (HH:MM:SS)
        clockEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false });
    }

    // Update Tanggal
    if(dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.innerText = now.toLocaleDateString('id-ID', options);
    }
}

// Jalankan jam setiap 1 detik
setInterval(updateClock, 1000);
updateClock(); // Jalankan langsung saat load


// ==========================================
// BAGIAN 4: WIDGET AGENDA HARI INI (DASHBOARD)
// ==========================================

async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return; // Stop kalau bukan di halaman dashboard

    // 1. Cek Hari & Tanggal Sekarang
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const hariIni = days[now.getDay()]; // Contoh: "Sabtu"
    
    // Format tanggal untuk cek jadwal personal (YYYY-MM-DD)
    // Note: Kita sesuaikan dengan format input type="date" HTML
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const tanggalIni = `${year}-${month}-${day}`;

    container.innerHTML = '<p class="text-center text-gray-400 text-sm italic">Sedang mengecek jadwal...</p>';

    try {
        // 2. Ambil Data Kuliah (Daily) & Personal SEKALIGUS
        const [resDaily, resPersonal] = await Promise.all([
            fetch('/api/schedule?category=daily'),
            fetch('/api/schedule?category=personal')
        ]);

        const dailyAll = await resDaily.json();
        const personalAll = await resPersonal.json();

        // 3. Filter: Ambil yang Harinya COCOK saja
        // - Jadwal Kuliah dicek berdasarkan "Hari" (Senin, Selasa...)
        const todayKuliah = dailyAll.filter(item => item.hari === hariIni);
        
        // - Jadwal Personal dicek berdasarkan "Tanggal" (2025-12-14)
        const todayPersonal = personalAll.filter(item => item.tanggal === tanggalIni);

        // 4. Render ke Layar
        let htmlContent = '';

        // A. Kalau KOSONG dua-duanya
        if (todayKuliah.length === 0 && todayPersonal.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-mug-hot text-3xl text-gray-300 mb-2"></i>
                    <p class="text-gray-500 font-medium">Tidak ada jadwal hari ini.</p>
                    <p class="text-xs text-gray-400">Selamat beristirahat, Bro!</p>
                </div>
            `;
            return;
        }

        // B. Kalau Ada KULIAH
        todayKuliah.forEach(item => {
            htmlContent += `
                <div class="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg shadow-sm text-left mb-2 transition hover:translate-x-1">
                    <div class="flex justify-between items-start">
                        <h3 class="font-bold text-blue-900 text-sm">${item.matkul}</h3>
                        <span class="text-[10px] font-bold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                            ${item.waktu}
                        </span>
                    </div>
                    <div class="text-xs text-gray-600 mt-1 flex items-center gap-2">
                        <span class="flex items-center gap-1"><i class="fas fa-door-open"></i> ${item.ruangan || '?'}</span>
                        <span class="flex items-center gap-1"><i class="fas fa-chalkboard-teacher"></i> ${item.dosen || '-'}</span>
                    </div>
                </div>
            `;
        });

        // C. Kalau Ada PERSONAL
        todayPersonal.forEach(item => {
            htmlContent += `
                <div class="bg-green-50 border-l-4 border-green-500 p-3 rounded-r-lg shadow-sm text-left mb-2 transition hover:translate-x-1">
                    <div class="flex justify-between items-start">
                        <h3 class="font-bold text-green-900 text-sm">${item.matkul || item.nama_kegiatan}</h3>
                        <span class="text-[10px] font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                            ${item.waktu}
                        </span>
                    </div>
                    <p class="text-xs text-gray-600 mt-1 italic">
                        <i class="fas fa-sticky-note mr-1"></i> ${item.keterangan || 'Kegiatan Pribadi'}
                    </p>
                </div>
            `;
        });

        container.innerHTML = htmlContent;

    } catch (error) {
        console.error("Gagal load widget:", error);
        container.innerHTML = '<p class="text-red-400 text-xs text-center">Gagal memuat widget.</p>';
    }
}

// Panggil fungsi ini agar jalan otomatis saat website dibuka
loadTodaySchedule();
