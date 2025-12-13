// Konfigurasi State
let adminPassword = null; 

// ==========================================
// BAGIAN 1: LOGIC UTAMA (PUBLIC VIEW)
// ==========================================

// Load Data Tabel
window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    
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
    if (category === 'daily') {
        const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
        data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || a.waktu.localeCompare(b.waktu));
    } else {
        // UTS, UAS, Personal sort tanggal
        data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || a.waktu.localeCompare(b.waktu));
    }

    data.forEach(item => {
        const badgeColor = item.tipe === 'Praktek' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
        
        // Tambah data attribute buat cek bentrok
        const row = `
            <tr class="hover:bg-gray-50 border-b last:border-0 transition schedule-row" data-hari="${item.hari || item.tanggal}" data-waktu="${item.waktu}">
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

    // Reset style
    rows.forEach(r => r.classList.remove('bg-red-50', 'border-l-4', 'border-red-500'));

    // Loop Cek
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

    // Tampilkan Alert Ijo/Merah
    if (alertBox) {
        alertBox.classList.remove('hidden');
        if (conflictFound) {
            alertBox.className = "mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center font-bold";
            alertBox.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ADA JADWAL BENTROK!';
        } else {
            alertBox.className = "mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative text-center font-bold";
            alertBox.innerHTML = '<i class="fas fa-check-circle"></i> AMAN! TIDAK ADA BENTROK.';
            setTimeout(() => alertBox.classList.add('hidden'), 3000);
        }
    }
}

// TOGGLE UTS & UAS DI INDEX (Pake localStorage biar gampang tanpa config db)
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
// BAGIAN 2: LOGIC ADMIN (LOGIN & CRUD)
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
    
    const category = targetId.replace('list-', '');
    loadAdminData(category);
}

const loginBtn = document.getElementById('btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const passInput = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');

        try {
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
            tanggal: document.getElementById('tanggal').value,
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
    container.innerHTML = '<div class="text-xs text-gray-400 p-2">Loading...</div>';
    
    const res = await fetch(`/api/schedule?category=${category}`);
    const data = await res.json();
    container.innerHTML = ''; 

    data.forEach(item => {
        container.innerHTML += `
            <div class="bg-gray-50 p-2 rounded border flex justify-between items-center group mb-2">
                <div class="overflow-hidden">
                    <div class="font-bold text-xs truncate">${item.matkul || item.nama}</div>
                    <div class="text-[10px] text-gray-500">${item.hari || item.tanggal} • ${item.waktu}</div>
                </div>
                <button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-500 text-[10px] font-bold px-2 hover:bg-red-100 rounded">HAPUS</button>
            </div>`;
    });
}

window.deleteSchedule = async function(id, category) {
    if(!confirm("Yakin hapus?")) return;
    await fetch(`/api/schedule?id=${id}&category=${category}`, {
        method: 'DELETE', headers: { 'x-admin-password': adminPassword }
    });
    loadAdminData(category);
}

// ==========================================
// BAGIAN 3: WIDGET BERANDA
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
    const offset = now.getTimezoneOffset() * 60000;
    const tglIni = new Date(now.getTime() - offset).toISOString().split('T')[0];

    container.innerHTML = '<p class="text-center italic text-gray-400">Cek jadwal...</p>';

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

        const todayUts = uts.filter(u => u.tanggal === tglIni);
        const todayUas = uas.filter(u => u.tanggal === tglIni);
        const todayDaily = daily.filter(d => d.hari === hariIni);
        const todayPersonal = personal.filter(p => p.tanggal === tglIni);

        let html = '';
        let adaJadwal = false;

        if (todayUts.length > 0) {
            adaJadwal = true;
            html += `<div class="text-xs font-bold text-orange-500 mb-1">UTS</div>`;
            todayUts.forEach(item => html += rowWidget(item, 'orange'));
        }
        if (todayUas.length > 0) {
            adaJadwal = true;
            html += `<div class="mt-2 text-xs font-bold text-purple-500 mb-1">UAS</div>`;
            todayUas.forEach(item => html += rowWidget(item, 'purple'));
        }
        if (todayDaily.length > 0) {
            adaJadwal = true;
            html += `<div class="mt-2 text-xs font-bold text-blue-500 mb-1">KULIAH</div>`;
            todayDaily.forEach(item => html += rowWidget(item, 'blue'));
        }
        if (todayPersonal.length > 0) {
            adaJadwal = true;
            html += `<div class="mt-2 text-xs font-bold text-green-500 mb-1">PERSONAL</div>`;
            todayPersonal.forEach(item => html += rowWidget(item, 'green'));
        }

        container.innerHTML = adaJadwal ? html : `<div class="text-center py-4 text-gray-500 text-xs">Kosong.</div>`;

    } catch (e) {
        container.innerHTML = 'Gagal memuat widget.';
    }
}
function rowWidget(item, c) {
    return `<div class="bg-${c}-50 border-l-2 border-${c}-500 p-2 rounded mb-1 text-left"><div class="flex justify-between"><b class="text-${c}-900 text-xs">${item.matkul || item.nama_kegiatan}</b> <span class="bg-white text-[10px] px-1 rounded border">${item.waktu}</span></div></div>`;
}
loadTodaySchedule();

// ==========================================
// BAGIAN 4: RESTORE DATA (UPDATE UNTUK UAS JUGA)
// ==========================================
const backupJadwal = [
    // UTS & HARIAN LAMA LU
    { kategori: 'uts', tanggal: '2025-11-21', waktu: '13:00-14:30', matkul: 'Aljabar Linier', ruangan: 'G.1.5', kode: 'TIF21211', dosen: 'SUCI MUTIARA', kelas: '3TI2', tipe: 'Teori' },
    { kategori: 'daily', hari: 'Senin', waktu: '10:30-12:00', matkul: 'Analisis Struktur Data', ruangan: 'F48', kode: 'TIF21208', dosen: 'SULYONO', kelas: '3TI1', tipe: 'Teori' },
    // CONTOH UAS
    { kategori: 'uas', tanggal: '2026-01-20', waktu: '08:00-10:00', matkul: 'UAS Algoritma', ruangan: 'Lab 1', kode: 'ALG01', dosen: 'Pak Budi', kelas: '1TI1', tipe: 'Praktek' }
];

window.restoreJadwal = async function() {
    const password = prompt("Masukkan Password Admin:");
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
    alert("Restore Selesai!");
};
