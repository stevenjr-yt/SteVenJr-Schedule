/**
 * APP.JS - SECURE VERSION
 * Seluruh logika dibungkus dalam IIFE (Immediately Invoked Function Expression)
 * agar variabel dan fungsi tidak bisa diakses/dimanipulasi dari Console Browser.
 */

(function() {
    'use strict'; // Mode ketat untuk keamanan ekstra

    // 1. SETUP & STATE (Semua Private)
    let adminPassword = null; 
    let adminEmail = null;
    let currentCategory = 'daily'; 
    let globalSettings = { show_uts: false, show_uas: false }; 

    // STATE SYSTEM
    let isDbConnected = true; 
    let isMaintenanceMode = false; 
    let completedTaskIds = []; 
    let lastSentEnergy = null; // Helper untuk sync energi

    // --- INIT SAAT DOM READY ---
    document.addEventListener('DOMContentLoaded', () => {
        // Cek Login Local
        const savedEmail = localStorage.getItem('admin_email');
        const savedPass = localStorage.getItem('admin_password');
        if (savedEmail && savedPass) {
            adminEmail = savedEmail;
            adminPassword = savedPass;
            const adminPanel = document.getElementById('admin-panel');
            const loginForm = document.getElementById('login-form');
            if (adminPanel) adminPanel.style.display = 'block';
            if (loginForm) loginForm.style.display = 'none';
        }

        updateClock();
        setInterval(updateClock, 1000);

        // Binding Semua Event Listener (Pengganti onclick HTML)
        bindAllEventListeners();

        // Initial Fetch Status System
        checkSystemStatus().then(() => {
            // Load Data Setelah Tahu Status DB
            if (document.getElementById('admin-panel')) initAdminFeatures();
            else if (document.getElementById('main-dashboard')) initDashboardFeatures();

            fetchSettings().then(() => {
                if(document.getElementById('main-dashboard')) updateDashboardMenu();
                if(document.getElementById('admin-panel')) initAdminToggles();
                if(document.getElementById('main-dashboard')) loadTodaySchedule();
            });
        });
    });

    // --- BINDING EVENT LISTENER (PENGGANTI ONCLICK) ---
    function bindAllEventListeners() {
        // 1. Tombol Toggle Database
        const btnDb = document.getElementById('btn-db-toggle');
        if (btnDb) btnDb.addEventListener('click', toggleDatabaseConnection);

        // 2. Tombol Toggle Maintenance
        const btnMt = document.getElementById('btn-mt-toggle');
        if (btnMt) btnMt.addEventListener('click', toggleMaintenance);

        // 3. Tombol Login & Logout
        const btnLogin = document.getElementById('btn-login');
        if (btnLogin) btnLogin.addEventListener('click', handleLogin);

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.addEventListener('click', handleLogout);

        // 4. Form Tambah Jadwal
        const addForm = document.getElementById('add-schedule-form');
        if (addForm) addForm.addEventListener('submit', handleAddSchedule);

        // 5. Input Checkbox Makan (Energi)
        ['eat-1', 'eat-2', 'eat-3'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', updateEnergyFromFood);
        });

        // 6. Input BB/TB (BMI)
        const inputBB = document.getElementById('input-bb');
        const inputTB = document.getElementById('input-tb');
        if(inputBB) inputBB.addEventListener('input', calculateBMI);
        if(inputTB) inputTB.addEventListener('input', calculateBMI);

        // 7. Tombol Tab Admin (Menggunakan Class .tab-btn)
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', function() {
                // Asumsi di HTML ada attribut onclick="switchTab('list-xxx')"
                // Kita ambil ID target dari logika manual atau data attribute
                // Jika user pakai onclick lama, kita harus parsing atau setup data-target
                // Di sini saya buat logika deteksi ID target berdasarkan kebiasaan:
                // Misal button untuk 'daily' akan membuka 'list-daily'.
                
                // CARA PALING AMAN: Tambahkan data-target="list-daily" di HTML.
                // TAPI UNTUK KOMPATIBILITAS KODE LAMA (String parsing):
                // Kita coba cari tahu tombol mana ini.
                
                let targetId = 'list-daily'; // Default
                if(this.innerText.toLowerCase().includes('uts')) targetId = 'list-uts';
                else if(this.innerText.toLowerCase().includes('uas')) targetId = 'list-uas';
                else if(this.innerText.toLowerCase().includes('pribadi')) targetId = 'list-personal';
                else if(this.innerText.toLowerCase().includes('harian')) targetId = 'list-daily';
                
                // Atau jika HTML sudah ada onclick, kita override logicnya di sini:
                switchTab(targetId, this);
            });
        });

        // 8. GLOBAL DELEGATION (Untuk elemen dinamis: Hapus Jadwal & Checklist)
        document.addEventListener('click', function(e) {
            // Handle Delete Button
            const delBtn = e.target.closest('.btn-delete-schedule');
            if (delBtn) {
                const id = delBtn.getAttribute('data-id');
                const cat = delBtn.getAttribute('data-category');
                deleteSchedule(id, cat);
            }
            // Handle Water Add
            if (e.target.closest('#btn-add-water')) updateWater(1);
            if (e.target.closest('#btn-min-water')) updateWater(-1); // Jika ada tombol minus
        });

        // 9. GLOBAL DELEGATION (Untuk Change Event di Checklist)
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('check-anim-input')) {
                const id = e.target.getAttribute('data-id');
                toggleCheck(id, e.target);
            }
        });
    }


    // --- CORE LOGIC ---

    async function checkSystemStatus() {
        try {
            const resDb = await fetch('/api/status');
            const dataDb = await resDb.json();
            isDbConnected = dataDb.is_active;
            updateDbStatusUI();

            const resMt = await fetch('/api/maintenance');
            const dataMt = await resMt.json();
            isMaintenanceMode = dataMt.is_maintenance;
            updateMaintenanceUI();

            if (isMaintenanceMode && !document.getElementById('admin-panel')) {
                window.location.href = 'maintenance.html';
            }
        } catch (e) {
            console.error("Gagal cek status sistem");
            isDbConnected = true; 
        }
    }

    async function fetchSchedule(params) {
        if (!isDbConnected) return null; 
        try {
            const res = await fetch(`/api/schedule${params}`);
            if(res.ok) return await res.json();
        } catch(e) { return []; }
        return [];
    }

    // --- FEATURES: DATABASE TOGGLE ---
    async function toggleDatabaseConnection() {
        const newState = !isDbConnected;
        isDbConnected = newState;
        updateDbStatusUI();
        try {
            await fetch('/api/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: newState })
            });
            loadAdminData(currentCategory);
            loadDailyChecklist();
            if(document.getElementById('main-dashboard')) loadTodaySchedule();
        } catch (e) {
            alert("Gagal mengubah status database di server!");
            isDbConnected = !newState;
            updateDbStatusUI();
        }
    }

    function updateDbStatusUI() {
        const btn = document.getElementById('btn-db-toggle');
        const txt = document.getElementById('db-status-text');
        if(!btn) return;
        
        if (isDbConnected) {
            btn.className = "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2";
            txt.innerText = "DB ON";
        } else {
            btn.className = "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 animate-pulse";
            txt.innerText = "DB OFF";
        }
    }

    // --- FEATURES: MAINTENANCE TOGGLE ---
    async function toggleMaintenance() {
        const newState = !isMaintenanceMode;
        isMaintenanceMode = newState;
        updateMaintenanceUI(); 
        try {
            await fetch('/api/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_maintenance: newState })
            });
            if(newState) alert("Mode Maintenance Aktif");
        } catch (e) {
            alert("Gagal update maintenance mode!");
            isMaintenanceMode = !newState; 
            updateMaintenanceUI();
        }
    }

    function updateMaintenanceUI() {
        const btn = document.getElementById('btn-mt-toggle');
        const txt = document.getElementById('mt-status-text');
        if(!btn) return;

        if (isMaintenanceMode) {
            btn.className = "bg-orange-500 text-white hover:bg-orange-600 border border-orange-600 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 animate-pulse";
            txt.innerText = "MT ON";
        } else {
            btn.className = "bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2";
            txt.innerText = "MT OFF";
        }
    }

    // --- HELPER BENTROK ---
    function isTimeConflict(time1, time2) {
        try {
            const parse = t => {
                const [s, e] = t.split('-').map(x => {
                    const [h, m] = x.trim().split(/[:.]/).map(Number);
                    return h * 60 + m;
                });
                return { s, e };
            };
            const t1 = parse(time1);
            const t2 = parse(time2);
            return (t1.s < t2.e && t1.e > t2.s);
        } catch (e) { return false; }
    }

    // --- API SETTINGS ---
    async function fetchSettings() {
        if(!isDbConnected) return; 
        try { const res = await fetch('/api/settings'); if (res.ok) globalSettings = await res.json(); } catch (e) {}
    }

    async function saveSettings(changes) {
        if(!isDbConnected) { alert("Database sedang dimatikan!"); return; }
        const newSettings = { ...globalSettings, ...changes };
        globalSettings = newSettings; 
        await fetch('/api/settings', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(newSettings) 
        });
    }

    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        if(document.getElementById('digital-clock')) document.getElementById('digital-clock').innerText = `${h}.${m}.${s}`;
        if(document.getElementById('current-date')) document.getElementById('current-date').innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if(document.getElementById('admin-realtime-clock')) document.getElementById('admin-realtime-clock').innerText = `${h}:${m}:${s}`;
    }

    // 2. DASHBOARD & MENU
    function initDashboardFeatures() { 
        updateDashboardMenu(); 
        
        setInterval(() => { 
            checkSystemStatus().then(() => {
                fetchSettings().then(() => { updateDashboardMenu(); loadTodaySchedule(); });
            });
        }, 300000); 
    }

    function updateDashboardMenu() {
        const utsBtn = document.getElementById('btn-menu-uts');
        const uasBtn = document.getElementById('btn-menu-uas');
        const container = document.getElementById('exam-buttons-container');
        if(!container) return;
        if (globalSettings.show_uts || globalSettings.show_uas) {
            container.classList.remove('hidden'); container.classList.add('flex');
            if(utsBtn) utsBtn.classList.toggle('hidden', !globalSettings.show_uts);
            if(uasBtn) uasBtn.classList.toggle('hidden', !globalSettings.show_uas);
            if(globalSettings.show_uts) utsBtn.classList.add('flex');
            if(globalSettings.show_uas) uasBtn.classList.add('flex');
        } else { container.classList.add('hidden'); container.classList.remove('flex'); }
    }

    // Dibuat local, tidak ditempel ke window
    async function loadScheduleData(category) {
        const tableBody = document.getElementById('schedule-table-body');
        const titleElement = document.getElementById('page-category-badge');
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400 text-xs">Memuat data...</td></tr>';
        if(titleElement) titleElement.innerText = category.toUpperCase();

        if(!isDbConnected) {
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400 text-xs font-bold text-red-400">Database Disconnected by Admin</td></tr>`; 
            return;
        }

        try {
            const data = await fetchSchedule(`?category=${category}`);
            if(!tableBody) return;
            tableBody.innerHTML = '';
            if (!data || data.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400 text-xs">Data Kosong</td></tr>`; return; }

            if (category === 'daily') {
                const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
                data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || (a.waktu || "").localeCompare(b.waktu || ""));
            } else {
                data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || (a.waktu || "").localeCompare(b.waktu || ""));
            }

            data.forEach(item => {
                const badgeColor = item.tipe === 'Praktek' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-50 text-indigo-700';
                const detail = category === 'personal' ? (item.keterangan || '-') : `${item.ruangan || '-'} • ${item.dosen || '-'}`;
                const title = item.matkul || item.nama_kegiatan || item.nama || "Kegiatan";

                tableBody.innerHTML += `
                <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition text-sm schedule-row" data-waktu="${item.waktu}" data-hari="${item.hari || item.tanggal}">
                    <td class="p-4 align-top w-24">
                        <div class="font-bold text-gray-800 text-xs">${item.hari || item.tanggal}</div>
                        <div class="text-[10px] text-gray-500 mt-1 bg-gray-100 px-2 py-0.5 rounded w-fit">${item.waktu}</div>
                    </td>
                    <td class="p-4 align-top">
                        <div class="font-bold text-gray-800 text-sm">${title}</div>
                        <div class="text-xs text-gray-500 mt-1"><i class="fas fa-map-marker-alt text-[10px] mr-1"></i> ${detail}</div>
                    </td>
                    <td class="p-4 align-top text-right">
                        <span class="text-[10px] font-bold ${badgeColor} px-2 py-1 rounded-lg">${item.tipe || 'Info'}</span>
                    </td>
                </tr>`;
            });
        } catch (error) { if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 text-xs">Error Koneksi</td></tr>'; }
    }

    async function loadTodaySchedule() {
        const container = document.getElementById('today-schedule-container');
        if (!container) return;
        
        if(!isDbConnected) {
            container.innerHTML = `<div class="text-center py-8 text-red-300"><i class="fas fa-database text-2xl mb-2"></i><p class="text-xs">Database Off</p></div>`;
            return;
        }

        const now = new Date(); 
        const year = now.getFullYear(); 
        const month = String(now.getMonth() + 1).padStart(2, '0'); 
        const day = String(now.getDate()).padStart(2, '0'); 
        const tglIni = `${year}-${month}-${day}`; 
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; 
        const hariIni = days[now.getDay()];

        try {
            const [daily, uts, uas, personal] = await Promise.all([
                fetchSchedule('?category=daily'), 
                fetchSchedule('?category=uts'), 
                fetchSchedule('?category=uas'), 
                fetchSchedule('?category=personal')
            ]);
            
            const safeList = (arr) => Array.isArray(arr) ? arr : [];
            const isToday = (item) => { 
                if (item.tanggal && item.tanggal === tglIni) return true; 
                if (!item.tanggal && (item.hari || "").toLowerCase() === hariIni.toLowerCase()) return true; 
                return false; 
            };
            
            let list = [
                ...safeList(uts).filter(u => u.tanggal === tglIni && globalSettings.show_uts).map(i => ({...i, c: 'orange', label:'UTS'})), 
                ...safeList(uas).filter(u => u.tanggal === tglIni && globalSettings.show_uas).map(i => ({...i, c: 'purple', label:'UAS'})), 
                ...safeList(daily).filter(isToday).map(i => ({...i, c: 'blue', label:'KULIAH'})), 
                ...safeList(personal).filter(isToday).map(i => ({...i, c: 'green', label:'AGENDA'}))
            ];

            list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || "")); 

            // LOGIKA DAILY LOAD
            let totalMinutes = 0;
            list.forEach(item => {
                if (item.waktu && item.waktu.includes('-')) {
                    try {
                        const parts = item.waktu.split('-').map(t => t.trim());
                        const toMinutes = (t) => {
                            const [h, m] = t.split(/[:.]/).map(Number);
                            return h * 60 + m;
                        };
                        const start = toMinutes(parts[0]);
                        const end = toMinutes(parts[1]);
                        if (end > start) totalMinutes += (end - start);
                    } catch (e) {}
                }
            });

            const targetMinutes = 480; 
            const totalHours = (totalMinutes / 60).toFixed(1); 
            let loadPercent = Math.round((totalMinutes / targetMinutes) * 100);
            if (loadPercent > 100) loadPercent = 100;

            const bar = document.getElementById('energy-bar');
            const txtLvl = document.getElementById('energy-level');
            const txtDrain = document.getElementById('task-drain-text');
            const txtForecast = document.getElementById('energy-forecast-text');

            if(bar) {
                bar.style.width = `${loadPercent}%`;
                bar.className = "h-full transition-all duration-1000";
                if (loadPercent <= 15) bar.classList.add('bg-green-400', 'shadow-[0_0_10px_rgba(74,222,128,0.5)]');
                else if (loadPercent <= 25) bar.classList.add('bg-green-500', 'shadow-[0_0_10px_rgba(34,197,94,0.5)]');
                else if (loadPercent <= 50) bar.classList.add('bg-indigo-500', 'shadow-[0_0_10px_rgba(99,102,241,0.5)]');
                else if (loadPercent <= 80) bar.classList.add('bg-orange-500', 'shadow-[0_0_10px_rgba(249,115,22,0.5)]', 'animate-pulse');
                else bar.classList.add('bg-red-600', 'shadow-[0_0_10px_rgba(220,38,38,0.5)]');
            }

            if(txtLvl) txtLvl.innerText = `${loadPercent}%`;
            if(txtDrain) txtDrain.innerText = `Total: ${totalHours} Jam Kegiatan`;

            if(txtForecast) {
                if (totalMinutes === 0) txtForecast.innerHTML = "<span class='text-gray-400 font-bold'>Hari Kosong.</span>";
                else if (loadPercent <= 15) txtForecast.innerHTML = "<span class='text-green-400 font-bold'>Sangat Santai.</span>";
                else if (loadPercent <= 25) txtForecast.innerHTML = "<span class='text-green-600 font-bold'>Santai.</span>";
                else if (loadPercent <= 50) txtForecast.innerHTML = "<span class='text-indigo-500 font-bold'>Produktif.</span>";
                else if (loadPercent <= 80) txtForecast.innerHTML = "<span class='text-orange-500 font-bold'>Sibuk.</span>";
                else txtForecast.innerHTML = "<span class='text-red-600 font-bold animate-pulse'>SANGAT SIBUK!</span>";
            }

            // Cek Konflik
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const itemA = list[i];
                    const itemB = list[j];
                    if (itemA.waktu && itemA.waktu.includes('-') && itemB.waktu && itemB.waktu.includes('-')) {
                        if (isTimeConflict(itemA.waktu, itemB.waktu)) {
                            itemA.isConflict = true; 
                            itemB.isConflict = true; 
                        }
                    }
                }
            }

            if (list.length === 0) { 
                container.innerHTML = `<div class="text-center py-8 text-gray-300"><i class="fas fa-mug-hot text-2xl mb-2"></i><p class="text-xs">Hari ini kosong. Santai!</p></div>`; 
                return; 
            }

            container.innerHTML = list.map(item => { 
                if(window.rowWidget) return window.rowWidget(item, item.c); 
                return `<div>${item.matkul}</div>`; 
            }).join('');

        } catch (e) { 
            console.error(e);
            container.innerHTML = '<p class="text-red-400 text-center text-xs">Gagal memuat jadwal.</p>'; 
        }
    }

    // 3. ADMIN PANEL
    function initAdminFeatures() { 
        checkSystemStatus(); 
        updateDbStatusUI();
        loadAdminData('daily'); 
        loadDailyChecklist(); 
        
        initHealthTracker(); 
        initAdminToggles(); 
        
        // Setup Sleep Button listeners specifically here because logic is UI dependent
        const bS = document.getElementById('btn-sleep'); 
        const bW = document.getElementById('btn-wake');
        if(bS) bS.addEventListener('click', () => toggleSleep(true));
        if(bW) bW.addEventListener('click', () => toggleSleep(false));
    }

    function initAdminToggles() { 
        const tUts = document.getElementById('toggle-uts'); 
        const tUas = document.getElementById('toggle-uas'); 

        if (tUts) { 
            tUts.checked = globalSettings.show_uts; 
            tUts.addEventListener('change', (e) => { 
                saveSettings({ 
                    show_uts: e.target.checked, 
                    show_uas: tUas ? tUas.checked : globalSettings.show_uas 
                }); 
            }); 
        } 

        if (tUas) { 
            tUas.checked = globalSettings.show_uas; 
            tUas.addEventListener('change', (e) => { 
                saveSettings({ 
                    show_uas: e.target.checked, 
                    show_uts: tUts ? tUts.checked : globalSettings.show_uts 
                }); 
            }); 
        } 
    }

    // Fungsi Switch Tab (Local)
    function switchTab(targetId, btn) { 
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
        document.getElementById(targetId).classList.add('active'); 
        document.querySelectorAll('.tab-btn').forEach(b => { 
            b.className = "tab-btn px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded flex-shrink-0 transition"; 
        }); 
        btn.className = "tab-btn active px-3 py-1.5 text-[10px] font-bold bg-indigo-50 border border-indigo-100 shadow-sm rounded-lg text-indigo-700 flex-shrink-0 transition"; 
        currentCategory = targetId.replace('list-', ''); 
        loadAdminData(currentCategory); 
    }

    async function loadAdminData(category) { 
        const container = document.getElementById(`list-${category}`); 
        if(!container) return; 
        
        if(!isDbConnected) {
            container.innerHTML = '<div class="text-[10px] text-red-400 text-center font-bold mt-4">DATABASE OFFLINE</div>'; 
            return;
        }

        container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Loading...</div>'; 
        if (!adminPassword) return; 
        
        try { 
            const data = await fetchSchedule(`?category=${category}`); 
            container.innerHTML = ''; 
            if (!data || data.length === 0) { container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Data Kosong</div>'; return; } 
            
            data.forEach(item => { 
                const title = item.matkul || item.nama_kegiatan || item.nama || "Item"; 
                // SECURITY CHANGE: Removed onclick="deleteSchedule...". Replaced with class 'btn-delete-schedule' and data attributes.
                container.innerHTML += `
                <div class="bg-gray-50 p-2 rounded-lg border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition">
                    <div class="overflow-hidden w-full pr-2">
                        <div class="font-bold text-[11px] text-gray-700 truncate">${title}</div>
                        <div class="text-[9px] text-gray-400">${item.hari || item.tanggal} • <span class="text-indigo-500">${item.waktu}</span></div>
                    </div>
                    <button class="btn-delete-schedule text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded transition" data-id="${item.id}" data-category="${category}">
                        <i class="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>`; 
            }); 
        } catch(e) { container.innerHTML = '<div class="text-[10px] text-red-400 text-center">Error</div>'; } 
    }

    // HANDLER TAMBAH JADWAL
    async function handleAddSchedule(e) {
        e.preventDefault(); 
        if (!adminPassword) { alert("Login dulu!"); return; }
        if(!isDbConnected) { alert("Hidupkan Database!"); return; }

        const rawData = { 
            kategori: document.getElementById('kategori').value, 
            matkul: document.getElementById('matkul').value, 
            hari: document.getElementById('hari').value, 
            tanggal: document.getElementById('tanggal').value, 
            waktu: document.getElementById('waktu').value, 
            ruangan: document.getElementById('ruangan').value, 
            kode: document.getElementById('kode').value, 
            dosen: document.getElementById('dosen').value, 
            kelas: document.getElementById('kelas').value, 
            tipe: document.getElementById('tipe').value, 
            keterangan: document.getElementById('keterangan').value 
        };
        
        if(document.getElementById('hari').classList.contains('hidden')) rawData.hari = ""; 
        if(document.getElementById('tanggal').classList.contains('hidden')) rawData.tanggal = "";
        
        try {
            const existingData = await fetchSchedule(`?category=${rawData.kategori}`);
            let conflict = null;
            if(existingData) {
                for (const item of existingData) { 
                    const sameDay = (item.hari && item.hari === rawData.hari) || (item.tanggal && item.tanggal === rawData.tanggal); 
                    if (sameDay && isTimeConflict(item.waktu, rawData.waktu)) { conflict = item; break; } 
                }
            }
            if (conflict) { alert(`GAGAL! BENTROK DENGAN:\n"${conflict.matkul||conflict.nama_kegiatan}"\nJam: ${conflict.waktu}`); return; }
            
            const res = await fetch('/api/schedule', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, 
                body: JSON.stringify(rawData) 
            });
            
            if (res.ok) { 
                alert("Tersimpan!"); 
                e.target.reset(); 
                if(window.toggleFormFields) window.toggleFormFields(); 
                loadAdminData(rawData.kategori); 
                loadDailyChecklist(); 
            } else { alert("Gagal simpan."); }
        } catch (err) { alert("Error sistem."); }
    }

    async function deleteSchedule(id, category) { 
        if(!isDbConnected) { alert("Hidupkan Database!"); return; }
        if(!confirm("Hapus?")) return; 
        try { 
            const res = await fetch(`/api/schedule?id=${id}&category=${category}`, { 
                method: 'DELETE', 
                headers: { 'x-admin-password': adminPassword } 
            }); 
            if(res.ok) { loadAdminData(category); loadDailyChecklist(); } 
        } catch(e) { alert("Error koneksi."); } 
    }

    async function initHealthTracker() { 
        const now = new Date();
        const wakeTimeObj = new Date();
        wakeTimeObj.setHours(6, 0, 0, 0); 

        const sleepStartObj = new Date(wakeTimeObj);
        sleepStartObj.setHours(wakeTimeObj.getHours() - 7);
        sleepStartObj.setMinutes(wakeTimeObj.getMinutes() - 12);

        const w = wakeTimeObj.getTime();
        const s = sleepStartObj.getTime();

        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            
            completedTaskIds = data.completed_tasks || [];

            const ibb = document.getElementById('input-bb');
            const itb = document.getElementById('input-tb');
            if(ibb) ibb.value = data.bb || 50;
            if(itb) itb.value = data.tb || 180;
            
            document.getElementById('water-count').innerText = data.water || 0;
            if(document.getElementById('eat-1')) document.getElementById('eat-1').checked = data.eat_1 || false;
            if(document.getElementById('eat-2')) document.getElementById('eat-2').checked = data.eat_2 || false;
            if(document.getElementById('eat-3')) document.getElementById('eat-3').checked = data.eat_3 || false;
            
            calculateBMI();

            updateSleepUI(false, new Date(s), new Date(w));
            
            setInterval(() => {
                syncEnergyWithServer();
            }, 60000); 

        } catch (e) {
            console.error("Gagal load health data", e);
        }
    }

    function calculateComplexEnergy(sDate, wDate) {
        const now = new Date();
        const sleepMs = wDate - sDate;
        const sleepHours = sleepMs / (1000 * 60 * 60); 
        let energyModal = (sleepHours / 8) * 100; 
        if(energyModal > 100) energyModal = 100;

        const sleepAlert = document.getElementById('sleep-quality-alert');
        if(sleepAlert) {
            sleepAlert.classList.remove('hidden');
            if(sleepHours < 6) {
                sleepAlert.className = "mt-2 text-[10px] font-bold px-2 py-1 rounded text-center bg-red-100 text-red-600 border border-red-200 animate-pulse";
                sleepAlert.innerText = `KURANG TIDUR: ${sleepHours.toFixed(1)} JAM`;
            } else {
                sleepAlert.className = "mt-2 text-[10px] font-bold px-2 py-1 rounded text-center bg-green-100 text-green-600 border border-green-200";
                sleepAlert.innerText = `TIDUR CUKUP: ${sleepHours.toFixed(1)} JAM`;
            }
        }

        const hoursAwake = (now - wDate) / (1000 * 60 * 60);
        const timeDecay = hoursAwake * 5; 

        let fuel = 0;
        if(document.getElementById('eat-1') && document.getElementById('eat-1').checked) fuel += 15;
        if(document.getElementById('eat-2') && document.getElementById('eat-2').checked) fuel += 15;
        if(document.getElementById('eat-3') && document.getElementById('eat-3').checked) fuel += 15;
        
        const waterLevel = parseInt(document.getElementById('water-count').innerText) || 0;
        fuel += (waterLevel * 2); 

        const tasksDone = document.querySelectorAll('.check-anim-input:checked').length; 
        const tasksTotal = document.querySelectorAll('.check-anim-input').length; 
        const taskDrain = tasksDone * 3; 

        let currentEnergy = energyModal - timeDecay + fuel - taskDrain;
        if(currentEnergy > 100) currentEnergy = 100;
        if(currentEnergy < 0) currentEnergy = 0;

        const finalEnergy = Math.round(currentEnergy);

        updateEnergyUI(finalEnergy);
        updateProductivityForecast(finalEnergy, tasksTotal, tasksDone);

        if (lastSentEnergy !== finalEnergy) {
            lastSentEnergy = finalEnergy;
            fetch('/api/health', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ last_energy_level: finalEnergy }) 
            }).catch(e => console.log("Silent sync error"));
        }
    }

    function updateProductivityForecast(energy, totalTask, doneTask) {
        const alertBox = document.getElementById('productivity-alert');
        const drainText = document.getElementById('task-drain-text');
        const forecastText = document.getElementById('energy-forecast-text');
        
        if(alertBox) {
            alertBox.classList.remove('hidden');
            const remainingTasks = totalTask - doneTask;
            const estimatedDrain = remainingTasks * 3; 
            drainText.innerText = `-${estimatedDrain}% (Sisa ${remainingTasks} Tugas)`;

            if(energy < 40) {
                forecastText.innerHTML = "<span class='text-red-500 font-bold'>KRITIS! BUTUH MAKAN!</span>";
                const batTxt = document.getElementById('energy-level');
                if(batTxt) batTxt.classList.add('animate-bounce', 'text-red-600');
            } else if (energy < estimatedDrain) {
                 forecastText.innerHTML = "<span class='text-orange-500 font-bold'>Tidak Cukup. Hemat Tenaga.</span>";
            } else {
                 forecastText.innerHTML = "<span class='text-green-600 font-bold'>Cukup untuk hari ini.</span>";
            }
        }
    }

    async function updateEnergyFromFood() { 
        const data = {
            eat_1: document.getElementById('eat-1').checked,
            eat_2: document.getElementById('eat-2').checked,
            eat_3: document.getElementById('eat-3').checked
        };
        
        await fetch('/api/health', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(data) 
        });

        syncEnergyWithServer(); 
    }

    async function calculateBMI() { 
        const w = parseFloat(document.getElementById('input-bb').value)||50; 
        const h_cm = parseFloat(document.getElementById('input-tb').value)||180;
        
        try {
            await fetch('/api/health', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ bb: w, tb: h_cm }) 
            });
        } catch(e) {}

        const h=h_cm/100; const bmi=(w/(h*h)).toFixed(1); 
        document.getElementById('bmi-result').innerText=`BMI: ${bmi}`; 
        let st="",cl=""; if(bmi<18.5){st="Kurus";cl="text-yellow-500";}else if(bmi<=24.9){st="Ideal";cl="text-green-500";}else{st="Gemuk";cl="text-red-500";}
        const el=document.getElementById('bmi-status'); if(el){el.innerText=st; el.className=`text-[10px] font-bold mt-1 ${cl}`;}
    }

    async function updateWater(n) { 
        let c = parseInt(document.getElementById('water-count').innerText) + n; 
        if(c < 0) c = 0; 
        
        document.getElementById('water-count').innerText = c; 
        
        await fetch('/api/health', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ water: c }) 
        });
        
        syncEnergyWithServer(); 
    }

    async function loadDailyChecklist() { 
        const c = document.getElementById('daily-checklist-container'); 
        if(!c) return; 
        
        if(!isDbConnected) {
            c.innerHTML = '<div class="text-[10px] text-red-400 text-center p-4">DB Disconnected</div>';
            return;
        }

        c.innerHTML='<div class="text-[10px] text-gray-400 text-center">Loading...</div>'; 
        const now = new Date(); 
        const tglIni = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const hariIni = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][now.getDay()];

        try { 
            const [d, uts, uas, p, healthRes] = await Promise.all([
                fetchSchedule('?category=daily'), 
                fetchSchedule('?category=uts'), 
                fetchSchedule('?category=uas'), 
                fetchSchedule('?category=personal'),
                fetch('/api/health')
            ]); 

            const healthData = await healthRes.json();
            completedTaskIds = healthData.completed_tasks || [];
            
            const safe = (a) => Array.isArray(a) ? a : [];
            const list = [...safe(d),...safe(uts),...safe(uas),...safe(p)].filter(i => (i.tanggal && i.tanggal===tglIni) || (!i.tanggal && (i.hari||"").toLowerCase()===hariIni)); 
            list.sort((a,b)=>(a.waktu||"").localeCompare(b.waktu||"")); 
            
            c.innerHTML=''; 
            if(list.length === 0) { c.innerHTML = '<div class="text-[10px] text-gray-400 text-center py-2">Kosong</div>'; return; }

            list.forEach((i,idx)=>{ 
                const uniqueId = `check_${tglIni}_${i.id || idx}`;
                const isChecked = completedTaskIds.includes(uniqueId);
                
                // SECURITY CHANGE: Removed onchange="toggleCheck...". Replaced with class 'check-anim-input' and data-id.
                c.innerHTML += `
                <div class="flex gap-2 items-start p-2 hover:bg-gray-50 rounded transition border-b border-gray-50 last:border-0">
                    <input type="checkbox" data-id="${uniqueId}" class="check-anim-input mt-0.5" ${isChecked?'checked':''}>
                    <div class="text-[11px] leading-tight text-gray-700">
                        <span class="font-bold">${i.matkul||i.nama_kegiatan}</span>
                        <br><span class="text-[9px] text-gray-400">${i.waktu}</span>
                    </div>
                </div>`; 
            }); 
            const dd=document.getElementById('date-today-display'); if(dd) dd.innerText=tglIni;
            
            syncEnergyWithServer();

        } catch(e){ c.innerHTML='<div class="text-[10px] text-red-400">Error</div>'; } 
    }

    async function toggleCheck(id, el) { 
        if (el.checked) {
            if (!completedTaskIds.includes(id)) completedTaskIds.push(id);
        } else {
            completedTaskIds = completedTaskIds.filter(taskId => taskId !== id);
        }

        try {
            await fetch('/api/health', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ completed_tasks: completedTaskIds }) 
            });
            syncEnergyWithServer(); 
        } catch (e) {
            el.checked = !el.checked; 
        }
    }

    async function toggleSleep(isS) { 
        const now = new Date(); 
        if (isS) { 
            try {
                await fetch('/api/health', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ sleep_start: now.getTime(), wake_time: null })
                });
                updateSleepUI(true, now); 
            } catch(e) {}
        } else { 
            try {
                const res = await fetch('/api/health');
                const data = await res.json();
                const s = data.sleep_start;
                if (!s) return alert("Data tidur tidak ditemukan di server!"); 

                await fetch('/api/health', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ wake_time: now.getTime() })
                });
                updateSleepUI(false, new Date(s), now); 
            } catch(e) {}
        } 
    }

    function updateSleepUI(isS, sDate, wDate=null) { 
        const bS = document.getElementById('btn-sleep'); 
        const bW = document.getElementById('btn-wake'); 
        const st = document.getElementById('sleep-status-text'); 
        const dS = document.getElementById('sleep-time-display'); 
        const dW = document.getElementById('wake-time-display'); 
        const fmt = d => `${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}`; 
        
        if (isS) { 
            if(bS) { bS.classList.add('opacity-50','cursor-not-allowed'); bS.disabled = true; }
            if(bW) { bW.classList.remove('opacity-50','cursor-not-allowed'); bW.disabled = false; }
            if(dS) dS.innerText=fmt(sDate); 
            if(dW) dW.innerText="--.--"; 
            if(st) st.innerText="Zzz... Charging..."; 
            updateEnergyUI(100); 
            if(document.getElementById('sleep-quality-alert')) document.getElementById('sleep-quality-alert').classList.add('hidden');
        } else { 
            if(bS) { bS.classList.remove('opacity-50','cursor-not-allowed'); bS.disabled = false; }
            if(bW) { bW.classList.add('opacity-50','cursor-not-allowed'); bW.disabled = true; }
            if(dS) dS.innerText=fmt(sDate); 
            if(wDate && dW) dW.innerText=fmt(wDate); 
            if(st) st.innerText="Siap Beraktivitas!"; 
            if(wDate) calculateComplexEnergy(sDate, wDate); 
        } 
    }

    function updateEnergyUI(v) { 
        const bar = document.getElementById('energy-bar'); 
        const txt = document.getElementById('energy-level'); 
        if (bar) bar.style.width=`${v}%`; 
        if (txt) {
            txt.innerText=`${v}%`; 
            txt.classList.remove('animate-bounce', 'text-red-600'); 
        }
    }

    function syncEnergyWithServer() {
        const w = new Date(); 
        w.setHours(6, 0, 0, 0); 
        const s = new Date(w); 
        s.setHours(w.getHours() - 7); 
        s.setMinutes(w.getMinutes() - 12); 
        calculateComplexEnergy(s, w); 
    }

    // LOGIN HANDLERS
    async function handleLogin(e) {
        e.preventDefault(); 
        const email = document.getElementById('email').value; 
        const pass = document.getElementById('password').value; 
        try { 
            const res = await fetch('/api/login',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({email, password:pass})
            }); 
            if(res.ok) { 
                localStorage.setItem('admin_email', email); 
                localStorage.setItem('admin_password', pass); 
                // Redirect logic or Show Panel logic
                adminPassword = pass; // set local var
                const adminPanel = document.getElementById('admin-panel');
                const loginForm = document.getElementById('login-form');
                if (adminPanel) adminPanel.style.display = 'block';
                if (loginForm) loginForm.style.display = 'none';
                
                initAdminFeatures();
                updateDbStatusUI();
            } else { 
                const d = await res.json(); 
                alert(d.message || "Salah"); 
            } 
        } catch(e){alert("Error");} 
    }

    function handleLogout() {
        if(confirm("Logout?")) { 
            localStorage.clear(); 
            location.reload(); 
        } 
    }

})(); // END IIFE
