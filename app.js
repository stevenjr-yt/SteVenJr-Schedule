// ==========================================
// Konfigurasi State & Inisialisasi
// ==========================================
let adminPassword = null; 

// Pemicu Utama Saat Halaman Dimuat
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek Sesi Login
    const savedPass = localStorage.getItem('admin_session');
    if (savedPass) {
        validateLogin(savedPass, true);
    }

    // 2. Jalankan Jam Digital
    updateClock();
    setInterval(updateClock, 1000);

    // 3. Pemicu Widget Beranda (Agenda Hari Ini)
    // Ini yang membuat Beranda tidak lagi stuck di "Memuat data..."
    if (document.getElementById('today-schedule-container')) {
        loadTodaySchedule();
    }
    
    // 4. Cek Toggle Fitur (UTS/UAS)
    checkToggles();
});

// ==========================================
// 1. HELPER FUNCTIONS
// ==========================================

function getSafeTitle(item) {
    return item.matkul || item.nama_kegiatan || item.nama || item.keterangan || "Kegiatan";
}

// ==========================================
// 2. LOGIC LOGIN ADMIN (VERIFIKASI KE API)
// ==========================================

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

        loginBtn.innerText = "Memeriksa...";
        loginBtn.disabled = true;
        validateLogin(pass, false);
    });
}

async function validateLogin(password, isAutoLogin) {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');
    const errorMsg = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    try {
        // Mengetes password ke API
        const res = await fetch('/api/schedule?category=daily', {
            method: 'GET',
            headers: { 'x-admin-password': password }
        });

        if (res.ok) {
            // LOGIN BENAR-BENAR SUKSES
            adminPassword = password;
            localStorage.setItem('admin_session', password); 
            
            if(loginForm) loginForm.style.display = 'none';
            if(adminPanel) {
                adminPanel.style.display = 'block';
                loadAdminData('daily'); 
            }
        } else {
            // LOGIN GAGAL (Status 401/403 dari Firebase/Backend)
            throw new Error("Password Salah");
        }
    } catch (err) {
        if(!isAutoLogin) {
            errorMsg.innerText = "Akses Ditolak: Password Salah!";
            errorMsg.style.display = 'block';
        }
        localStorage.removeItem('admin_session');
        adminPassword = null;
    } finally {
        if(btn) {
            btn.innerText = "MASUK";
            btn.disabled = false;
        }
    }
}

// Logout
window.logoutAdmin = function() {
    if(confirm("Yakin Logout?")) {
        adminPassword = null;
        localStorage.removeItem('admin_session');
        location.reload();
    }
}

// ==========================================
// 3. LOGIC UTAMA (PUBLIC VIEW - TABEL)
// ==========================================

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
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Gagal koneksi server</td></tr>';
    }
}

function renderTable(data, category) {
    const tableBody = document.getElementById('schedule-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = ''; 

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400">Jadwal Kosong</td></tr>`;
        return;
    }

    // Sorting Logika
    if (category === 'daily') {
        const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
        data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || a.waktu.localeCompare(b.waktu));
    } else {
        data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || a.waktu.localeCompare(b.waktu));
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

async function loadAdminData(category) {
    const container = document.getElementById(`list-${category}`);
    if(!container) return;
    container.innerHTML = '<div class="text-xs text-gray-400 p-2">Loading...</div>';
    
    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
        container.innerHTML = ''; 

        if (data.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-400 p-4 text-center">Data Kosong</div>';
            return;
        }

        data.forEach(item => {
            container.innerHTML += `
                <div class="bg-gray-50 p-2 rounded border flex justify-between items-center mb-2">
                    <div>
                        <div class="font-bold text-xs">${getSafeTitle(item)}</div>
                        <div class="text-[10px] text-gray-500">${item.hari || item.tanggal} • ${item.waktu}</div>
                    </div>
                    <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-500 text-[10px] font-bold px-2">HAPUS</button>
                </div>`;
        });
    } catch(e) {
        container.innerHTML = '<div class="text-xs text-red-400 p-2">Gagal Load</div>';
    }
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
            keterangan: document.getElementById('keterangan').value,
        };

        const res = await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
            body: JSON.stringify(rawData)
        });

        if (res.ok) {
            alert("Berhasil disimpan!");
            addForm.reset();
            loadAdminData(rawData.kategori);
        } else {
            alert("Gagal! Cek Password Admin.");
        }
    });
}

window.deleteSchedule = async function(id, category) {
    if(!confirm("Hapus jadwal ini?")) return;
    await fetch(`/api/schedule?id=${id}&category=${category}`, {
        method: 'DELETE', headers: { 'x-admin-password': adminPassword }
    });
    loadAdminData(category);
}

// ==========================================
// 5. WIDGET BERANDA (AGENDA HARI INI)
// ==========================================

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    if(clockEl) clockEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false });
    if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;

    // Ambil Tanggal & Hari Lokal (WIB)
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = days[now.getDay()]; 
    const tglIni = now.toLocaleDateString('en-CA'); // Format YYYY-MM-DD

    try {
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

        // Filter data yang cocok dengan hari ini
        const combinedToday = [
            ...uts.filter(u => u.tanggal === tglIni).map(i => ({...i, c: 'orange', label: 'UTS'})),
            ...uas.filter(u => u.tanggal === tglIni).map(i => ({...i, c: 'purple', label: 'UAS'})),
            ...daily.filter(d => d.hari === hariIni).map(i => ({...i, c: 'blue', label: 'KULIAH'})),
            ...personal.filter(p => p.tanggal === tglIni).map(i => ({...i, c: 'green', label: 'AGENDA'}))
        ];

        if (combinedToday.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 text-gray-300">
                    <i class="fas fa-mug-hot text-5xl mb-3 animate-bounce"></i>
                    <p>Tidak ada agenda untuk hari ini.</p>
                </div>`;
            return;
        }

        // Render Widget Besar
        container.innerHTML = combinedToday.map(item => rowWidget(item)).join('');

    } catch (e) {
        container.innerHTML = '<p class="text-red-500">Gagal memuat data dari Firebase.</p>';
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
    <div class="${colors} border-l-8 p-5 rounded-xl mb-4 shadow-sm hover:shadow-md transition">
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
    const btnUts = document.getElementById('btn-menu-uts');
    const btnUas = document.getElementById('btn-menu-uas');
    if(btnUts) btnUts.style.display = localStorage.getItem('show_uts') === 'true' ? 'flex' : 'none';
    if(btnUas) btnUas.style.display = localStorage.getItem('show_uas') === 'true' ? 'flex' : 'none';
}
