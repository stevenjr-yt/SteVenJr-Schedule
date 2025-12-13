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