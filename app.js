import { db, auth, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, orderBy, onSnapshot, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "./firebase-config.js";

// --- 1. JAM DIGITAL & TANGGAL ---
function updateClock() {
    const clockEl = document.getElementById('digital-clock');
    const dateEl = document.getElementById('current-date');
    if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('id-ID', {hour12: false});
        dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
}
setInterval(updateClock, 1000);

// --- 2. CEK STATUS UTS (Toggle Button) ---
async function checkUTSSettings() {
    const btnUTS = document.getElementById('btn-menu-uts');
    if(!btnUTS) return;
    try {
        const docRef = doc(db, "settings", "config");
        const docSnap = await getDoc(docRef);
        // Default false jika belum disetting
        if (docSnap.exists() && docSnap.data().show_uts === true) {
            btnUTS.classList.remove('hidden');
        } else {
            btnUTS.classList.add('hidden');
        }
    } catch (e) {
        console.error("Gagal load setting UTS:", e);
    }
}
// Jalankan saat load
if(document.getElementById('btn-menu-uts')) checkUTSSettings();


// --- 3. LOAD DATA UTAMA (USER VIEW - TABEL) ---
window.loadScheduleData = async (type) => {
    const title = document.getElementById('page-title');
    const badge = document.getElementById('page-category-badge');
    const tbody = document.getElementById('schedule-table-body');
    const conflictAlert = document.getElementById('conflict-alert');

    // Reset UI
    tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400">Memuat data...</td></tr>';
    conflictAlert.classList.add('hidden');
    document.getElementById('searchInput').value = '';

    // Set Judul Halaman
    if(type === 'uts') {
        title.textContent = "Jadwal UTS/UAS";
        badge.textContent = "Akademik";
        badge.className = "text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-600";
    } else if(type === 'daily') {
        title.textContent = "Jadwal Kuliah Harian";
        badge.textContent = "Akademik";
        badge.className = "text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-600";
    } else {
        title.textContent = "Jadwal Pribadi Saya";
        badge.textContent = "Personal";
        badge.className = "text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-600";
    }

    try {
        const q = query(collection(db, "schedules")); 
        const querySnapshot = await getDocs(q);
        
        let schedules = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if(data.kategori === type) schedules.push(data);
        });

        // Sorting Logika
        schedules.sort((a, b) => {
            const timeA = a.waktu || "00:00";
            const timeB = b.waktu || "00:00";
            // Jika UTS, urutkan tanggal string. Jika Daily, urutkan Hari.
            if (type === 'uts') return (a.tanggal || "").localeCompare(b.tanggal || "") || timeA.localeCompare(timeB);
            
            const days = { "Senin":1, "Selasa":2, "Rabu":3, "Kamis":4, "Jumat":5, "Sabtu":6, "Minggu":7 };
            const dayA = days[a.hari] || 8;
            const dayB = days[b.hari] || 8;
            return (dayA - dayB) || timeA.localeCompare(timeB);
        });
        
        let html = '';
        schedules.forEach((data) => {
            let waktuCol, detailCol, infoCol;

            if (type === 'personal') {
                waktuCol = `<div class="font-bold text-gray-800">${data.hari || '-'}</div><div class="text-xs text-gray-500">${data.tanggal || ''}</div><div class="text-blue-600 font-mono mt-1">${data.waktu}</div>`;
                detailCol = `<div class="text-gray-600"><i class="fas fa-map-marker-alt mr-1"></i> ${data.ruangan || 'Lokasi tidak set'}</div>`;
                infoCol = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Pribadi</span>`;
            } else {
                waktuCol = `<div class="font-bold text-gray-800">${type === 'uts' ? data.tanggal : data.hari}</div><div class="text-blue-600 font-mono mt-1">${data.waktu}</div>`;
                detailCol = `<div><span class="font-bold">Kode:</span> ${data.kode || '-'}</div><div><span class="font-bold">R:</span> ${data.ruangan}</div>`;
                infoCol = `<div class="text-xs text-gray-500">${data.dosen || '-'}</div><div class="mt-1"><span class="bg-blue-100 text-blue-700 px-1 rounded text-xs">${data.tipe}</span> <span class="text-xs ml-1">${data.kelas || ''}</span></div>`;
            }

            html += `
            <tr class="schedule-row hover:bg-gray-50 transition border-b" data-waktu="${data.waktu}" data-hari="${data.hari}" data-tanggal="${data.tanggal}">
                <td class="p-4 align-top">${waktuCol}</td>
                <td class="p-4 align-top font-bold text-gray-800 text-lg row-subject">${data.matkul}</td>
                <td class="p-4 align-top text-sm">${detailCol}</td>
                <td class="p-4 align-top">${infoCol}</td>
            </tr>`;
        });

        if(html === '') html = '<tr><td colspan="4" class="p-6 text-center text-gray-400 italic">Belum ada jadwal di kategori ini.</td></tr>';
        tbody.innerHTML = html;

    } catch (error) {
        console.error("Error load data tabel:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat data: ${error.message}</td></tr>`;
    }
};

// --- 4. LOAD AGENDA HARI INI (DASHBOARD WIDGET) ---
async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if(!container) return;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const todayName = days[now.getDay()]; // Contoh: "Sabtu"
    
    // Format tanggal YYYY-MM-DD
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${yyyy}-${mm}-${dd}`; 

    try {
        const q = query(collection(db, "schedules"));
        const snapshot = await getDocs(q);
        
        let todaysEvents = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            let isToday = false;

            // 1. Cek Jadwal Harian (Berdasarkan HARI)
            if (data.kategori === 'daily' && data.hari === todayName) {
                isToday = true;
            }
            
            // 2. Cek Jadwal Personal & UTS (Berdasarkan TANGGAL atau HARI)
            if (data.kategori === 'personal' || data.kategori === 'uts') {
                // Cocok jika Tanggalnya sama persis (YYYY-MM-DD)
                if (data.tanggal === todayDateStr) isToday = true;
                // ATAU jika Harinya sama (misal user set "Sabtu" manual)
                if (data.hari === todayName) isToday = true;
            }

            if (isToday) {
                todaysEvents.push(data);
            }
        });

        // Urutkan Pagi -> Malam
        todaysEvents.sort((a, b) => (a.waktu || "00:00").localeCompare(b.waktu || "00:00"));

        let html = '';
        if (todaysEvents.length > 0) {
            todaysEvents.forEach(data => {
                let borderClass = 'border-primary'; 
                let textClass = 'text-primary';
                let label = 'Kuliah';

                if(data.kategori === 'personal') {
                    borderClass = 'border-green-500'; 
                    textClass = 'text-green-600';
                    label = 'Pribadi';
                } else if (data.kategori === 'uts') {
                    borderClass = 'border-red-500'; 
                    textClass = 'text-red-600';
                    label = 'Ujian';
                }

                html += `
                <div class="bg-white border-l-4 ${borderClass} p-4 shadow-sm rounded-r-lg mb-3 hover:shadow-md transition">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-xl font-bold ${textClass}">${data.waktu}</div>
                            <div class="font-semibold text-gray-800 text-lg">${data.matkul}</div>
                            <div class="text-sm text-gray-500 mt-1">
                                ${data.ruangan ? `<i class="fas fa-map-marker-alt mr-1"></i>${data.ruangan}` : ''} 
                            </div>
                        </div>
                        <span class="text-[10px] font-bold uppercase px-2 py-1 bg-gray-100 text-gray-500 rounded">${label}</span>
                    </div>
                </div>`;
            });
        } else {
            html = `
            <div class="text-center py-6 bg-white rounded-xl border border-dashed border-gray-300">
                <i class="fas fa-mug-hot text-gray-300 text-4xl mb-2"></i>
                <p class="text-gray-400">Tidak ada jadwal untuk hari ${todayName}.<br>Waktunya istirahat!</p>
            </div>`;
        }
        container.innerHTML = html;

    } catch (e) {
        console.error("Error load agenda hari ini:", e);
        container.innerHTML = `<p class="text-center text-red-400">Error: ${e.message}</p>`;
    }
}
// Load Widget
if(document.getElementById('today-schedule-container')) {
    loadTodaySchedule();
}

// --- 5. LOGIKA UI (Search & Conflict) ---
window.searchSchedule = () => {
    const input = document.getElementById('searchInput').value.toUpperCase();
    const rows = document.querySelectorAll('.schedule-row');
    rows.forEach(row => {
        const subject = row.querySelector('.row-subject').textContent || "";
        row.style.display = subject.toUpperCase().indexOf(input) > -1 ? "" : "none";
    });
}

window.checkConflictsUI = () => {
    const rows = Array.from(document.querySelectorAll('.schedule-row'));
    let conflictFound = false;
    rows.forEach(r => r.classList.remove('bg-red-100', 'text-red-900'));

    const timeToMin = (str) => {
        if(!str || !str.includes('-')) return null;
        const p = str.split('-');
        const s = p[0].split(':'), e = p[1].split(':');
        return { start: parseInt(s[0])*60 + parseInt(s[1]), end: parseInt(e[0])*60 + parseInt(e[1]) };
    };

    for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
            const rA = rows[i], rB = rows[j];
            // Cek Bentrok: Jika Hari SAMA atau Tanggal SAMA
            const sameDay = (rA.dataset.hari === rB.dataset.hari) || (rA.dataset.tanggal === rB.dataset.tanggal);
            
            if (sameDay) {
                const tA = timeToMin(rA.dataset.waktu), tB = timeToMin(rB.dataset.waktu);
                if (tA && tB && tA.start < tB.end && tA.end > tB.start) {
                    rA.classList.add('bg-red-100', 'text-red-900');
                    rB.classList.add('bg-red-100', 'text-red-900');
                    conflictFound = true;
                }
            }
        }
    }
    const alertBox = document.getElementById('conflict-alert');
    alertBox.classList.remove('hidden');
    if (conflictFound) {
        alertBox.textContent = "⚠️ Ditemukan Jadwal Bentrok! (Baris ditandai Merah)";
        alertBox.className = "mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-center font-bold";
    } else {
        alertBox.textContent = "✅ Aman! Tidak ada jadwal bentrok.";
        alertBox.className = "mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-center font-bold";
        setTimeout(() => alertBox.classList.add('hidden'), 3000);
    }
}


// --- 6. LOGIKA ADMIN PANEL ---
const loginForm = document.getElementById('login-form');
const adminPanel = document.getElementById('admin-panel');
const btnLogin = document.getElementById('btn-login');

if (btnLogin) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginForm.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            loadAdminData(); // Load data terpisah
            loadUTSToggleState();
        } else {
            loginForm.classList.remove('hidden');
            adminPanel.classList.add('hidden');
        }
    });

    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            document.getElementById('login-error').classList.remove('hidden');
            document.getElementById('login-error').textContent = "Error: " + error.message;
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

    // Toggle UTS Logic
    const toggleUTS = document.getElementById('toggle-uts');
    const textUTS = document.getElementById('uts-status-text');
    async function loadUTSToggleState() {
        try {
            const docRef = doc(db, "settings", "config");
            const docSnap = await getDoc(docRef);
            if(docSnap.exists()) {
                toggleUTS.checked = docSnap.data().show_uts;
                textUTS.textContent = toggleUTS.checked ? "ON" : "OFF";
            } else {
                await setDoc(docRef, { show_uts: false });
            }
        } catch (e) { console.log("Init setting error", e); }
    }
    toggleUTS.addEventListener('change', async () => {
        const isActive = toggleUTS.checked;
        textUTS.textContent = isActive ? "ON" : "OFF";
        await setDoc(doc(db, "settings", "config"), { show_uts: isActive }, { merge: true });
    });

    // Add Schedule Logic
    document.getElementById('add-schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const kategori = document.getElementById('kategori').value;
        let newData = {
            kategori: kategori,
            matkul: document.getElementById('matkul').value,
            waktu: document.getElementById('waktu').value,
            hari: document.getElementById('hari').value,
            tanggal: document.getElementById('tanggal').value,
            ruangan: document.getElementById('ruangan').value,
            kode: document.getElementById('kode').value,
            createdAt: new Date()
        };
        if (kategori !== 'personal') {
            newData.dosen = document.getElementById('dosen').value;
            newData.kelas = document.getElementById('kelas').value;
            newData.tipe = document.getElementById('tipe').value;
        }
        await addDoc(collection(db, "schedules"), newData);
        alert("Data Tersimpan!");
        document.getElementById('add-schedule-form').reset();
        loadAdminData();
    });
}

// --- FUNGSI LOAD ADMIN DATA (TABBED) ---
async function loadAdminData() {
    const listDaily = document.getElementById('list-daily');
    const listUts = document.getElementById('list-uts');
    const listPersonal = document.getElementById('list-personal');

    if(listDaily) listDaily.innerHTML = '';
    if(listUts) listUts.innerHTML = '';
    if(listPersonal) listPersonal.innerHTML = '';

    const q = query(collection(db, "schedules"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    let hasDaily = false, hasUts = false, hasPersonal = false;

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        const itemHTML = `
        <div class="flex justify-between items-center bg-white border border-gray-100 p-4 rounded-xl mb-3 hover:shadow-md transition">
            <div class="flex items-start gap-3">
                <div class="mt-1"><i class="fas fa-circle text-[8px] ${data.kategori === 'uts' ? 'text-red-500' : (data.kategori === 'personal' ? 'text-green-500' : 'text-blue-500')}"></i></div>
                <div>
                    <h4 class="font-bold text-gray-800 leading-tight">${data.matkul}</h4>
                    <div class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                        <span><i class="far fa-calendar mr-1"></i>${data.hari || data.tanggal || '-'}</span>
                        <span><i class="far fa-clock mr-1"></i>${data.waktu}</span>
                        ${data.ruangan ? `<span><i class="fas fa-map-marker-alt mr-1"></i>${data.ruangan}</span>` : ''}
                    </div>
                </div>
            </div>
            <button onclick="deleteSchedule('${docSnap.id}')" class="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition" title="Hapus">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>`;

        if (data.kategori === 'daily') {
            if(listDaily) listDaily.innerHTML += itemHTML;
            hasDaily = true;
        } else if (data.kategori === 'uts') {
            if(listUts) listUts.innerHTML += itemHTML;
            hasUts = true;
        } else if (data.kategori === 'personal') {
            if(listPersonal) listPersonal.innerHTML += itemHTML;
            hasPersonal = true;
        }
    });

    const emptyHTML = '<div class="text-center py-10 text-gray-300 flex flex-col items-center"><i class="far fa-folder-open text-4xl mb-2 opacity-50"></i><p class="text-sm">Belum ada data</p></div>';
    
    if(!hasDaily && listDaily) listDaily.innerHTML = emptyHTML;
    if(!hasUts && listUts) listUts.innerHTML = emptyHTML;
    if(!hasPersonal && listPersonal) listPersonal.innerHTML = emptyHTML;
}

window.deleteSchedule = async (id) => {
    if(confirm("Yakin hapus jadwal ini?")) {
        await deleteDoc(doc(db, "schedules", id));
        loadAdminData();
    }
}