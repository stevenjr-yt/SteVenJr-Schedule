// Konfigurasi State
let adminPassword = null; 

// ==========================================
// 1. HELPER FUNCTIONS
// ==========================================

function getSafeTitle(item) {
    // Mapping judul biar gak undefined
    return item.matkul || item.nama_kegiatan || item.nama || item.keterangan || "Kegiatan";
}

function parseTime(timeStr) {
    // Helper buat hitung bentrok (Konversi jam ke menit)
    if (!timeStr || !timeStr.includes('-')) return { start: 0, end: 0 };
    const [start, end] = timeStr.split('-').map(t => t.trim());
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return { start: sH * 60 + sM, end: eH * 60 + eM };
}

// ==========================================
// 2. LOGIC LOGIN ADMIN (VERIFIKASI KE API)
// ==========================================

// Cek Sesi Login di LocalStorage (Opsional, biar pas refresh gak logout)
document.addEventListener('DOMContentLoaded', () => {
    const savedPass = localStorage.getItem('admin_session');
    if (savedPass && document.getElementById('admin-panel')) {
        // Coba validasi ulang session
        validateLogin(savedPass, true);
    }
});

const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const pass = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        
        if(!pass) {
            errorMsg.innerText = "Password tidak boleh kosong!";
            errorMsg.style.display = 'block';
            return;
        }

        // Tampilkan loading state
        loginBtn.innerText = "Memeriksa...";
        loginBtn.disabled = true;

        // Validasi ke API
        validateLogin(pass, false);
    });
}

// Fungsi Validasi Password ke Backend
async function validateLogin(password, isAutoLogin) {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');
    const errorMsg = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    try {
        // Kita nembak API 'daily' cuma buat ngetes password bener/gak
        const res = await fetch('/api/schedule?category=daily', {
            method: 'GET',
            headers: { 'x-admin-password': password } // Kirim pass di header
        });

        if (res.ok) {
            // LOGIN SUKSES
            adminPassword = password;
            localStorage.setItem('admin_session', password); // Simpan sesi
            
            if(loginForm) loginForm.style.display = 'none';
            if(adminPanel) {
                adminPanel.style.display = 'block';
                loadAdminData('daily'); // Load data awal admin
            }
        } else {
            // LOGIN GAGAL (401/403 dari API)
            if(!isAutoLogin) {
                errorMsg.innerText = "Password Salah / Akses Ditolak!";
                errorMsg.style.display = 'block';
            }
            localStorage.removeItem('admin_session');
        }
    } catch (err) {
        if(!isAutoLogin) {
            errorMsg.innerText = "Gagal koneksi ke Server.";
            errorMsg.style.display = 'block';
        }
    } finally {
        if(btn) {
            btn.innerText = "MASUK";
            btn.disabled = false;
        }
    }
}

// Logout
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        if(confirm("Yakin Logout?")) {
            adminPassword = null;
            localStorage.removeItem('admin_session');
            location.reload();
        }
    });
}

// ==========================================
// 3. LOGIC UTAMA (PUBLIC VIEW)
// ==========================================

// Load Data Tabel
window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400">Loading data...</td></tr>';
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

    // ANIMASI KOPI (JIKA KOSONG)
    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-20">
                    <div class="flex flex-col items-center justify-center text-gray-400">
                        <i class="fas fa-mug-hot text-7xl mb-6 text-gray-300 animate-bounce-slow"></i>
                        <p class="font-bold text-xl text-gray-500">Santai Dulu...</p>
                        <p class="text-md mt-1 text-gray-400">Jadwal ${category.toUpperCase()} kosong.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    // Sorting
    if (category === 'daily') {
        const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
        data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || a.waktu.localeCompare(b.waktu));
    } else {
        data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || a.waktu.localeCompare(b.waktu));
    }

    // Render Rows (DETAIL LENGKAP)
    data.forEach(item => {
        const badgeColor = (item.tipe === 'Praktek') ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
        
        // Logic Detail: Personal -> Keterangan, Akademik -> Dosen
        const detailText = (category === 'personal') ? (item.keterangan || '-') : (item.dosen || '-');
        const badgeText = (category === 'personal') ? 'PRIBADI' : (item.tipe || 'Info');

        const row = `
            <tr class="hover:bg-gray-50 border-b last:border-0 transition schedule-row text-sm" 
                data-hari="${item.hari || item.tanggal}" data-waktu="${item.waktu}">
                
                <td class="p-5 align-middle">
                    <div class="font-bold text-gray-800 text-base">${item.hari || item.tanggal}</div>
                    <div class="text-xs text-blue-500 font-bold font-mono mt-1 px-2 py-1 bg-blue-50 rounded w-fit">${item.waktu}</div>
                </td>
                <td class="p-5 font-bold text-gray-800 text-lg align-middle">
                    ${getSafeTitle(item)}
                    <div class="text-xs text-gray-400 mt-1 font-normal">${item.kode || ''}</div>
                </td>
                <td class="p-5 align-middle">
                    <div class="font-semibold text-gray-700"><i class="fas fa-map-marker-alt text-red-400 mr-2"></i>${item.ruangan || '-'}</div>
                    <div class="text-xs text-gray-500 mt-1 pl-5">Kelas: ${item.kelas || '-'}</div>
                </td>
                <td class="p-5 align-middle">
                     <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeColor}">${badgeText}</span>
                </td>
                <td class="p-5 text-sm text-gray-600 align-middle italic border-l border-dashed border-gray-100">
                    ${detailText}
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

// LOGIC CEK BENTROK (IJO / MERAH)
window.checkConflictsUI = function() {
    const rows = document.querySelectorAll('.schedule-row');
    const alertBox = document.getElementById('conflict-alert');
    let conflictFound = false;

    // Helper Parse Jam
    const parseTime = (t) => {
        if(!t) return {s:0,e:0};
        const [s, e] = t.split('-').map(x => {
            const [h,m] = x.split(':').map(Number);
            return h*60+m;
        });
        return {s, e};
    };

    rows.forEach(r => r.classList.remove('bg-red-50', 'border-l-4', 'border-red-500'));

    for (let i = 0; i < rows.length; i++) {
        const rowA = rows[i];
        const tA = parseTime(rowA.dataset.waktu);
        const dA = rowA.dataset.hari;

        for (let j = i + 1; j < rows.length; j++) {
            const rowB = rows[j];
            const tB = parseTime(rowB.dataset.waktu);
            const dB = rowB.dataset.hari;

            if (dA === dB && tA.s < tB.e && tA.e > tB.s) {
                rowA.classList.add('bg-red-50', 'border-l-4', 'border-red-500');
                rowB.classList.add('bg-red-50', 'border-l-4', 'border-red-500');
                conflictFound = true;
            }
        }
    }

    if (alertBox) {
        alertBox.classList.remove('hidden');
        if (conflictFound) {
            alertBox.className = "mt-6 px-6 py-4 rounded-xl relative text-center font-bold border-2 text-lg shadow-md bg-red-100 border-red-400 text-red-700 animate-pulse";
            alertBox.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> PERINGATAN: ADA JADWAL BENTROK!';
        } else {
            alertBox.className = "mt-6 px-6 py-4 rounded-xl relative text-center font-bold border-2 text-lg shadow-md bg-green-100 border-green-400 text-green-700";
            alertBox.innerHTML = '<i class="fas fa-check-circle mr-2"></i> AMAN! Tidak ada jadwal yang bentrok.';
            setTimeout(() => alertBox.classList.add('hidden'), 4000);
        }
    }
}

// TOGGLE UTS & UAS DI INDEX (LocalStorage)
// Karena lu gak mau init Firebase di sini, kita pake LocalStorage yang diset Admin
function checkToggles() {
    const btnUts = document.getElementById('btn-menu-uts');
    const btnUas = document.getElementById('btn-menu-uas');
    
    if(btnUts) {
        const show = localStorage.getItem('show_uts') === 'true';
        btnUts.classList.toggle('hidden', !show);
        btnUts.classList.toggle('flex', show);
    }
    if(btnUas) {
        const show = localStorage.getItem('show_uas') === 'true';
        btnUas.classList.toggle('hidden', !show);
        btnUas.classList.toggle('flex', show);
    }
}
checkToggles();


// ==========================================
// 4. BAGIAN ADMIN (CRUD & TAMPILAN)
// ==========================================

// Handle Toggle Change di Admin
const tUts = document.getElementById('toggle-uts');
const tUas = document.getElementById('toggle-uas');

if(tUts) {
    tUts.checked = localStorage.getItem('show_uts') === 'true';
    tUts.addEventListener('change', e => localStorage.setItem('show_uts', e.target.checked));
}
if(tUas) {
    tUas.checked = localStorage.getItem('show_uas') === 'true';
    tUas.addEventListener('change', e => localStorage.setItem('show_uas', e.target.checked));
}

// Logic Tab Admin
window.switchTab = function(targetId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.className = "tab-btn px-3 py-2 text-xs font-bold text-gray-500 hover:text-blue-600 border-b-2 border-transparent transition whitespace-nowrap");
    btn.className = "tab-btn active px-3 py-2 text-xs font-bold text-blue-600 border-b-2 border-blue-600 transition whitespace-nowrap";
    loadAdminData(targetId.replace('list-', ''));
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
            tanggal: document.getElementById('tanggal').value,
            keterangan: document.getElementById('keterangan').value, // Field Keterangan
        };

        try {
            // KIRIM DATA KE BACKEND
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
                alert("Gagal menyimpan. Cek Password atau Koneksi.");
            }
        } catch (err) { console.error(err); }
    });
}

async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    container.innerHTML = '<div class="text-xs text-gray-400 p-2">Loading...</div>';
    
    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
        container.innerHTML = ''; 

        if (data.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-400 p-4 italic text-center">Data Kosong</div>';
            return;
        }

        data.forEach(item => {
            container.innerHTML += `
                <div class="bg-gray-50 p-2 rounded border flex justify-between items-center group mb-2 hover:bg-white hover:shadow-sm">
                    <div class="overflow-hidden">
                        <div class="font-bold text-xs truncate">${getSafeTitle(item)}</div>
                        <div class="text-[10px] text-gray-500">${item.hari || item.tanggal} • ${item.waktu}</div>
                    </div>
                    <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-500 text-[10px] font-bold px-2 hover:bg-red-100 rounded">HAPUS</button>
                </div>`;
        });
    } catch(e) {
        container.innerHTML = '<div class="text-xs text-red-400 p-2">Gagal Load Data</div>';
    }
}

window.deleteSchedule = async function(id, category) {
    if(!confirm("Yakin hapus?")) return;
    try {
        await fetch(`/api/schedule?id=${id}&category=${category}`, {
            method: 'DELETE', headers: { 'x-admin-password': adminPassword }
        });
        loadAdminData(category);
    } catch(e) { alert("Gagal menghapus"); }
}

// ==========================================
// 5. WIDGET BERANDA (VERSI BESAR & DETAIL)
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
    // const offset = now.getTimezoneOffset() * 60000; // Opsional kalau timezone ngaco
    // const tglIni = new Date(now.getTime() - offset).toISOString().split('T')[0];
    const tglIni = now.toISOString().split('T')[0]; // Format YYYY-MM-DD

    container.innerHTML = '<p class="text-center italic text-gray-400">Cek jadwal...</p>';

    try {
        // Ambil SEMUA data dari API (Backend yang filter? atau kita filter di sini?)
        // Sesuai kode lama: Kita fetch semua kategori lalu filter client-side biar aman.
        const [resDaily, resUts, resUas, resPersonal] = await Promise.all([
            fetch('/api/schedule?category=daily'),
            fetch('/api/schedule?category=uts'),
            fetch('/api/schedule?category=uas'),
            fetch('/api/schedule?category=personal')
        ]);
        
        const daily = await resDaily.json();
        const uts = await resUts.json();
        const uas = await resUas.json();
        const personal = await resPersonal.json();

        // LOGIC FILTER TANGGAL / HARI
        const todayUts = uts.filter(u => u.tanggal === tglIni);
        const todayUas = uas.filter(u => u.tanggal === tglIni);
        const todayDaily = daily.filter(d => d.hari === hariIni);
        const todayPersonal = personal.filter(p => p.tanggal === tglIni);

        let html = '';
        let hasData = false;

        // RENDER WIDGET (BESAR)
        if (todayUts.length > 0) {
            hasData = true;
            html += `<div class="text-xs font-bold text-orange-500 mb-2 uppercase tracking-wider">Ujian Tengah Semester</div>`;
            todayUts.forEach(item => html += rowWidget(item, 'orange'));
        }
        if (todayUas.length > 0) {
            hasData = true;
            html += `<div class="mt-4 text-xs font-bold text-purple-500 mb-2 uppercase tracking-wider">Ujian Akhir Semester</div>`;
            todayUas.forEach(item => html += rowWidget(item, 'purple'));
        }
        if (todayDaily.length > 0) {
            hasData = true;
            html += `<div class="mt-4 text-xs font-bold text-blue-500 mb-2 uppercase tracking-wider">Jadwal Kuliah</div>`;
            todayDaily.forEach(item => html += rowWidget(item, 'blue'));
        }
        if (todayPersonal.length > 0) {
            hasData = true;
            html += `<div class="mt-4 text-xs font-bold text-green-500 mb-2 uppercase tracking-wider">Agenda Pribadi</div>`;
            todayPersonal.forEach(item => html += rowWidget(item, 'green'));
        }

        // TAMPILAN KOSONG (BESAR)
        container.innerHTML = hasData ? html : `
            <div class="text-center py-8 text-gray-300">
                <i class="fas fa-mug-hot text-4xl mb-2 animate-bounce-slow"></i>
                <p class="text-sm font-medium">Kosong hari ini.</p>
            </div>`;

    } catch (e) {
        console.error(e);
        container.innerHTML = 'Gagal memuat widget.';
    }
}

// FUNGSI RENDER KOTAK WIDGET (YANG DIMINTA BESAR & DETAIL)
function rowWidget(i, c) {
    // Warna tema
    const colors = {
        'orange': 'border-orange-500 bg-orange-50 text-orange-900',
        'purple': 'border-purple-500 bg-purple-50 text-purple-900',
        'blue':   'border-blue-500 bg-blue-50 text-blue-900',
        'green':  'border-green-500 bg-green-50 text-green-900'
    }[c];

    // Detil Info
    let detailUtama = i.ruangan || 'Online / TBD';
    let detailTambahan = '';

    if (c === 'green') { 
        // Kalau Personal
        detailTambahan = i.keterangan || '-';
    } else { 
        // Kalau Akademik
        let kelas = i.kelas ? `(${i.kelas})` : '';
        let dosen = i.dosen ? `• ${i.dosen}` : '';
        detailTambahan = `${kelas} ${dosen}`;
    }

    return `
    <div class="${colors} border-l-8 p-5 rounded-xl mb-4 shadow-sm hover:shadow-md transition relative overflow-hidden group">
        <div class="flex justify-between items-start">
            <div class="flex-1 pr-4">
                <h4 class="font-extrabold text-lg leading-tight mb-2">${getSafeTitle(i)}</h4>
                
                <div class="text-sm opacity-80 space-y-1">
                    <p class="flex items-center gap-2 font-semibold">
                        <i class="fas fa-map-marker-alt w-4 text-center"></i> 
                        ${detailUtama}
                    </p>
                    <p class="flex items-center gap-2 text-xs italic">
                        <i class="fas fa-info-circle w-4 text-center"></i> 
                        ${detailTambahan}
                    </p>
                </div>
            </div>

            <div class="flex flex-col items-end">
                <span class="bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm border border-black/5 whitespace-nowrap">
                    ${i.waktu}
                </span>
            </div>
        </div>
    </div>`;
}

// RESTORE DATA (TOOLS)
// ... (Kode restoreJadwal sama seperti sebelumnya, tidak diubah)
