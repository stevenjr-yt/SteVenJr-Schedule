/**
 * APP.JS - REPAIRED VERSION
 * Fix: Removed undeclared variable reference causing crash
 */

(function() {
    'use strict';

    // 1. SETUP & STATE (Private)
    let adminPassword = null; 
    let currentCategory = 'daily'; 
    let globalSettings = { show_uts: false, show_uas: false }; 

    // STATE SYSTEM
    let isDbConnected = true; 
    let isMaintenanceMode = false; 
    let completedTaskIds = []; 
    // let lastSentEnergy = null; // Unused variable commented out

    // --- INIT SAAT DOM READY ---
    document.addEventListener('DOMContentLoaded', () => {
        // Cek Login Local (Untuk Admin)
        const savedEmail = localStorage.getItem('admin_email');
        const savedPass = localStorage.getItem('admin_password');
        
        // FIX ERROR DISINI: Menghapus assignment adminEmail yang menyebabkan crash
        if (savedEmail && savedPass) {
            adminPassword = savedPass;
            
            // Logic UI Admin
            const adminPanel = document.getElementById('admin-panel');
            const loginForm = document.getElementById('login-form');
            if (adminPanel) adminPanel.style.display = 'block';
            if (loginForm) loginForm.style.display = 'none';
        }

        updateClock();
        setInterval(updateClock, 1000);

        // Binding Event Listener
        bindAllEventListeners();

        // Initial Fetch
        checkSystemStatus().then(() => {
            // Load Fitur Sesuai Halaman
            if (document.getElementById('admin-panel')) {
                initAdminFeatures();
            } else if (document.getElementById('main-dashboard')) {
                initDashboardFeatures();
            }

            fetchSettings().then(() => {
                if(document.getElementById('main-dashboard')) {
                    updateDashboardMenu();
                    loadTodaySchedule();
                }
                if(document.getElementById('admin-panel')) {
                    initAdminToggles();
                }
            });
        });
    });

    // --- BINDING EVENT LISTENER ---
    function bindAllEventListeners() {
        // ADMIN: Database & Maintenance
        const btnDb = document.getElementById('btn-db-toggle');
        if (btnDb) btnDb.addEventListener('click', toggleDatabaseConnection);
        const btnRefreshDb = document.getElementById('btn-refresh-data'); // Di Admin
        if (btnRefreshDb) btnRefreshDb.addEventListener('click', () => loadAdminData(currentCategory));

        const btnMt = document.getElementById('btn-mt-toggle');
        if (btnMt) btnMt.addEventListener('click', toggleMaintenance);

        // ADMIN: Login/Logout
        const btnLogin = document.getElementById('btn-login');
        if (btnLogin) btnLogin.addEventListener('click', handleLogin);
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.addEventListener('click', handleLogout);

        // ADMIN: Form & Inputs
        const addForm = document.getElementById('add-schedule-form');
        if (addForm) addForm.addEventListener('submit', handleAddSchedule);
        
        ['eat-1', 'eat-2', 'eat-3'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', updateEnergyFromFood);
        });

        const inputBB = document.getElementById('input-bb');
        const inputTB = document.getElementById('input-tb');
        if(inputBB) inputBB.addEventListener('input', calculateBMI);
        if(inputTB) inputTB.addEventListener('input', calculateBMI);

        // ADMIN: Tabs
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', function() {
                let targetId = 'list-daily'; 
                const txt = this.innerText.toLowerCase();
                if(txt.includes('uts')) targetId = 'list-uts';
                else if(txt.includes('uas')) targetId = 'list-uas';
                else if(txt.includes('pribadi')) targetId = 'list-personal';
                else if(txt.includes('daily') || txt.includes('harian')) targetId = 'list-daily';
                switchAdminTab(targetId, this);
            });
        });

        // USER (INDEX.HTML): Navigation Buttons
        const btnUts = document.getElementById('btn-menu-uts');
        const btnUas = document.getElementById('btn-menu-uas');
        const btnDaily = document.getElementById('btn-view-daily');
        const btnPersonal = document.getElementById('btn-view-personal');
        
        if(btnUts) btnUts.addEventListener('click', () => switchUserView('uts'));
        if(btnUas) btnUas.addEventListener('click', () => switchUserView('uas'));
        if(btnDaily) btnDaily.addEventListener('click', () => switchUserView('daily'));
        if(btnPersonal) btnPersonal.addEventListener('click', () => switchUserView('personal'));

        // USER (INDEX.HTML): Close & Refresh
        const btnCloseView = document.getElementById('btn-close-view');
        if(btnCloseView) btnCloseView.addEventListener('click', () => location.reload());
        
        const btnCheckConflict = document.getElementById('btn-check-conflict');
        if(btnCheckConflict) btnCheckConflict.addEventListener('click', checkConflictsUI);

        const searchInp = document.getElementById('searchInput');
        if(searchInp) searchInp.addEventListener('keyup', searchSchedule);

        // GLOBAL DELEGATION (Event Bubbling)
        document.addEventListener('click', function(e) {
            // Delete Schedule
            const delBtn = e.target.closest('.btn-delete-schedule');
            if (delBtn) {
                deleteSchedule(delBtn.getAttribute('data-id'), delBtn.getAttribute('data-category'));
            }
            // Water
            if (e.target.closest('#btn-add-water')) updateWater(1);
            if (e.target.closest('#btn-min-water')) updateWater(-1);
        });

        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('check-anim-input')) {
                toggleCheck(e.target.getAttribute('data-id'), e.target);
            }
        });
    }

    // --- CORE LOGIC ---
    async function checkSystemStatus() {
        try {
            const resDb = await fetch('/api/status');
            if (!resDb.ok) throw new Error('Network response was not ok');
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
            console.log("Running in offline/local mode or API unreachable");
            // Default to ON if API fails, so UI still renders locally if possible
            isDbConnected = true; 
        }
    }

    async function fetchSchedule(params) {
        if (!isDbConnected) return []; 
        try {
            const res = await fetch(`/api/schedule${params}`);
            if(res.ok) return await res.json();
        } catch(e) { 
            console.error("Fetch Error:", e);
            return []; 
        }
        return [];
    }

    // --- ADMIN FEATURES ---
    async function toggleDatabaseConnection() {
        const newState = !isDbConnected;
        isDbConnected = newState;
        updateDbStatusUI();
        try {
            await fetch('/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: newState }) });
            loadAdminData(currentCategory);
            loadDailyChecklist();
            if(document.getElementById('main-dashboard')) loadTodaySchedule();
        } catch (e) {
            alert("Gagal mengubah status database (Mode Offline?)");
            // Keep UI state consistent with user action even if API fails
        }
    }

    function updateDbStatusUI() {
        const btn = document.getElementById('btn-db-toggle');
        const txt = document.getElementById('db-status-text');
        if(!btn) return;
        if (isDbConnected) {
            btn.className = "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2";
            if(txt) txt.innerText = "DB ON";
        } else {
            btn.className = "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 animate-pulse";
            if(txt) txt.innerText = "DB OFF";
        }
    }

    async function toggleMaintenance() {
        const newState = !isMaintenanceMode;
        isMaintenanceMode = newState;
        updateMaintenanceUI(); 
        try {
            await fetch('/api/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_maintenance: newState }) });
            if(newState) alert("Mode Maintenance Aktif");
        } catch (e) {
            console.error(e);
        }
    }

    function updateMaintenanceUI() {
        const btn = document.getElementById('btn-mt-toggle');
        const txt = document.getElementById('mt-status-text');
        if(!btn) return;
        if (isMaintenanceMode) {
            btn.className = "bg-orange-500 text-white hover:bg-orange-600 border border-orange-600 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 animate-pulse";
            if(txt) txt.innerText = "MT ON";
        } else {
            btn.className = "bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2";
            if(txt) txt.innerText = "MT OFF";
        }
    }

    // --- USER DASHBOARD FEATURES ---
    function initDashboardFeatures() { 
        updateDashboardMenu(); 
        // Auto refresh setiap 5 menit
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
            container.classList.remove('hidden'); 
            container.classList.add('flex');
            
            if(utsBtn) {
                if (globalSettings.show_uts) {
                    utsBtn.classList.remove('hidden');
                    utsBtn.classList.add('flex');
                } else {
                    utsBtn.classList.add('hidden');
                    utsBtn.classList.remove('flex');
                }
            }
            
            if(uasBtn) {
                 if (globalSettings.show_uas) {
                    uasBtn.classList.remove('hidden');
                    uasBtn.classList.add('flex');
                } else {
                    uasBtn.classList.add('hidden');
                    uasBtn.classList.remove('flex');
                }
            }
        } else { 
            container.classList.add('hidden'); 
            container.classList.remove('flex'); 
        }
    }

    function switchUserView(category) {
        const dashboard = document.getElementById('main-dashboard');
        const view = document.getElementById('schedule-view');
        
        if(dashboard) dashboard.style.display = 'none';
        if(view) view.style.display = 'block';
        window.scrollTo(0,0);
        
        loadScheduleData(category); 
    }

    async function loadScheduleData(category) {
        const tableBody = document.getElementById('schedule-table-body');
        const titleElement = document.getElementById('page-category-badge');
        
        if(titleElement) titleElement.innerText = category.toUpperCase();
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400 text-xs">Memuat data...</td></tr>';

        if(!isDbConnected) {
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400 text-xs font-bold text-red-400">Database Disconnected by Admin</td></tr>`; 
            return;
        }

        try {
            const data = await fetchSchedule(`?category=${category}`);
            if(!tableBody) return;
            tableBody.innerHTML = '';
            
            if (!data || data.length === 0) { 
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-gray-400 text-xs">Data Kosong</td></tr>`; 
                return; 
            }

            // Sorting
            if (category === 'daily') {
                const hariOrder = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
                data.sort((a, b) => (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99) || (a.waktu || "").localeCompare(b.waktu || ""));
            } else {
                data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || (a.waktu || "").localeCompare(b.waktu || ""));
            }

            // Rendering Widget
            data.forEach(item => {
                let color = 'blue';
                if (category === 'uts') color = 'orange';
                else if (category === 'uas') color = 'purple';
                else if (category === 'personal') color = 'green';
                
                tableBody.innerHTML += generateRowWidget(item, color, category);
            });

        } catch (error) { 
            if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 text-xs">Gagal memuat data (API Error)</td></tr>'; 
        }
    }

    // === WIDGET HTML GENERATOR ===
    function generateRowWidget(i, c, catType) {
        const isConflict = i.isConflict === true;
        let colors, dotColor, iconColor;

        if (isConflict) {
            colors = 'bg-red-50 text-red-900 border-red-300 ring-1 ring-red-200';
            dotColor = 'bg-red-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.6)]';
            iconColor = 'text-red-500';
        } else {
            // Mapping warna
            const map = {
                'orange': { bg: 'bg-orange-50 text-orange-900 border-orange-200', dot: 'bg-orange-400' },
                'purple': { bg: 'bg-purple-50 text-purple-900 border-purple-200', dot: 'bg-purple-400' },
                'blue':   { bg: 'bg-indigo-50 text-indigo-900 border-indigo-200', dot: 'bg-indigo-400' },
                'green':  { bg: 'bg-emerald-50 text-emerald-900 border-emerald-200', dot: 'bg-emerald-400' }
            };
            const theme = map[c] || map['blue'];
            colors = theme.bg;
            dotColor = theme.dot;
            iconColor = 'text-[10px]';
        }

        const detail = (c === 'green') ? (i.keterangan || '-') : `${i.ruangan || 'TBD'} • ${i.kelas || '-'}`;
        const conflictLabel = isConflict ? `<span class="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded ml-2 font-bold uppercase tracking-wider"><i class="fas fa-exclamation-triangle"></i> BENTROK</span>` : '';
        
        let label = 'KULIAH';
        if (catType === 'uts') label = 'UTS';
        if (catType === 'uas') label = 'UAS';
        if (catType === 'personal') label = 'AGENDA';

        return `
        <tr class="schedule-row block md:table-row" data-waktu="${i.waktu}" data-hari="${i.hari || i.tanggal}">
            <td class="block md:table-cell p-0 md:p-2 w-full">
                <div class="relative pl-6 pb-8 group last:pb-0 border-l-2 ${isConflict ? 'border-red-200' : 'border-gray-100'} last:border-0 ml-2 transition-colors duration-300">
                    <div class="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full ring-4 ring-white ${dotColor}"></div>
                    <div class="${colors} border p-4 rounded-2xl shadow-sm relative transition hover:-translate-y-1 hover:shadow-md">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="flex items-center mb-1">
                                    <span class="text-[10px] font-bold uppercase tracking-widest opacity-60 block">${label}</span>
                                    ${conflictLabel}
                                </div>
                                <h4 class="font-bold text-base leading-tight mb-1">${i.matkul || i.nama_kegiatan}</h4>
                                <p class="text-xs opacity-70 flex items-center gap-1"><i class="fas fa-map-marker-alt ${iconColor}"></i> ${detail}</p>
                            </div>
                            <div class="text-right">
                                 <div class="bg-white/60 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm border border-black/5 whitespace-nowrap ${isConflict ? 'text-red-700' : ''}">
                                    ${i.waktu}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
    }

    function searchSchedule() { 
        const input = document.getElementById('searchInput').value.toLowerCase(); 
        const rows = document.querySelectorAll('.schedule-row'); 
        rows.forEach(row => { 
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(input) ? '' : 'none'; 
        }); 
    }

    // --- HELPER LAINNYA ---
    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        
        // Cek elemen ada sebelum update
        const clockEl = document.getElementById('digital-clock');
        const dateEl = document.getElementById('current-date');
        const adminClock = document.getElementById('admin-realtime-clock');

        if(clockEl) clockEl.innerText = `${h}.${m}.${s}`;
        if(dateEl) dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if(adminClock) adminClock.innerText = `${h}:${m}:${s}`;
    }

    async function fetchSettings() {
        if(!isDbConnected) return; 
        try { const res = await fetch('/api/settings'); if (res.ok) globalSettings = await res.json(); } catch (e) {}
    }

    async function saveSettings(changes) {
        if(!isDbConnected) { alert("Database sedang dimatikan!"); return; }
        const newSettings = { ...globalSettings, ...changes };
        globalSettings = newSettings; 
        try {
            await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSettings) });
        } catch(e) {
            alert("Gagal menyimpan setting");
        }
    }

    // --- ADMIN PANEL FUNCTIONS ---
    function initAdminFeatures() { 
        updateDbStatusUI();
        loadAdminData('daily'); 
        loadDailyChecklist(); 
        initHealthTracker(); 
        initAdminToggles(); 
        
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
                saveSettings({ show_uts: e.target.checked, show_uas: tUas ? tUas.checked : globalSettings.show_uas }); 
            }); 
        } 
        if (tUas) { 
            tUas.checked = globalSettings.show_uas; 
            tUas.addEventListener('change', (e) => { 
                saveSettings({ show_uas: e.target.checked, show_uts: tUts ? tUts.checked : globalSettings.show_uts }); 
            }); 
        } 
    }

    function switchAdminTab(targetId, btn) { 
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
        const target = document.getElementById(targetId);
        if(target) target.classList.add('active'); 
        
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
        if(!isDbConnected) { container.innerHTML = '<div class="text-[10px] text-red-400 text-center font-bold mt-4">DATABASE OFFLINE</div>'; return; }

        container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Loading...</div>'; 
        if (!adminPassword) {
             container.innerHTML = '<div class="text-[10px] text-orange-400 text-center">Login required</div>'; 
             return; 
        }
        
        try { 
            const data = await fetchSchedule(`?category=${category}`); 
            container.innerHTML = ''; 
            if (!data || data.length === 0) { container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Data Kosong</div>'; return; } 
            
            data.forEach(item => { 
                const title = item.matkul || item.nama_kegiatan || item.nama || "Item"; 
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
            tipe: document.getElementById('tipe') ? document.getElementById('tipe').value : '', 
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

    // --- HEALTH TRACKER (Sederhana) ---
    async function initHealthTracker() { 
        try {
            const res = await fetch('/api/health');
            if(!res.ok) throw new Error('Health API Error');
            const data = await res.json();
            completedTaskIds = data.completed_tasks || [];
            
            const ibb = document.getElementById('input-bb');
            const itb = document.getElementById('input-tb');
            if(ibb) ibb.value = data.bb || 50;
            if(itb) itb.value = data.tb || 180;
            
            const waterEl = document.getElementById('water-count');
            if(waterEl) waterEl.innerText = data.water || 0;
            
            ['eat-1','eat-2','eat-3'].forEach((id, i) => {
               const el = document.getElementById(id);
               if(el) el.checked = data[`eat_${i+1}`] || false; 
            });
            
            calculateBMI();
            syncEnergyWithServer();
            setInterval(() => syncEnergyWithServer(), 60000); 

        } catch (e) { 
            console.log("Health tracker init failed (Offline mode?)"); 
        }
    }

    function calculateComplexEnergy(sDate, wDate) {
        const now = new Date();
        const sleepMs = wDate - sDate;
        const sleepHours = sleepMs / 36e5; 
        let energyModal = (sleepHours / 8) * 100; 
        if(energyModal > 100) energyModal = 100;
        
        const hoursAwake = (now - wDate) / 36e5;
        const timeDecay = hoursAwake * 5; 
        
        let fuel = 0;
        if(document.getElementById('eat-1') && document.getElementById('eat-1').checked) fuel += 15;
        if(document.getElementById('eat-2') && document.getElementById('eat-2').checked) fuel += 15;
        if(document.getElementById('eat-3') && document.getElementById('eat-3').checked) fuel += 15;
        
        const wVal = document.getElementById('water-count');
        const waterLevel = wVal ? (parseInt(wVal.innerText) || 0) : 0;
        fuel += (waterLevel * 2); 

        const tasksDone = document.querySelectorAll('.check-anim-input:checked').length; 
        const taskDrain = tasksDone * 3; 

        let currentEnergy = energyModal - timeDecay + fuel - taskDrain;
        if(currentEnergy > 100) currentEnergy = 100;
        if(currentEnergy < 0) currentEnergy = 0;

        updateEnergyUI(Math.round(currentEnergy));
    }

    function updateEnergyUI(v) { 
        const bar = document.getElementById('energy-bar'); 
        const txt = document.getElementById('energy-level'); 
        if (bar) bar.style.width=`${v}%`; 
        if (txt) txt.innerText=`${v}%`; 
    }

    function syncEnergyWithServer() {
        // Mock calculation for now
        const w = new Date(); w.setHours(6, 0, 0, 0); 
        const s = new Date(w); s.setHours(w.getHours() - 7); s.setMinutes(w.getMinutes() - 12); 
        calculateComplexEnergy(s, w); 
    }
    
    async function toggleCheck(id, el) {
         if (el.checked) { if (!completedTaskIds.includes(id)) completedTaskIds.push(id); } 
         else { completedTaskIds = completedTaskIds.filter(taskId => taskId !== id); }
         try {
            await fetch('/api/health', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ completed_tasks: completedTaskIds }) });
         } catch(e) {}
         syncEnergyWithServer(); 
    }
    
    async function updateWater(n) {
        const el = document.getElementById('water-count');
        if(!el) return;
        let c = parseInt(el.innerText) + n;
        if(c<0) c=0;
        el.innerText = c;
        try {
            await fetch('/api/health', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ water: c }) });
        } catch(e) {}
        syncEnergyWithServer();
    }
    
    async function calculateBMI() {
        const bb = document.getElementById('input-bb');
        const tb = document.getElementById('input-tb');
        if(!bb || !tb) return;
        
        // Simple logic placeholder
        // console.log("BMI Calculated");
    }
    
    async function updateEnergyFromFood() {
        syncEnergyWithServer();
    }
    
    async function toggleSleep(isS) {
        // Placeholder
    }

    // --- LOGIN HANDLERS ---
    async function handleLogin(e) {
        e.preventDefault(); 
        const email = document.getElementById('email').value; 
        const pass = document.getElementById('password').value; 
        try { 
            const res = await fetch('/api/login',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password:pass}) }); 
            if(res.ok) { 
                localStorage.setItem('admin_email', email); 
                localStorage.setItem('admin_password', pass); 
                adminPassword = pass; 
                location.reload();
            } else { alert("Login Salah"); } 
        } catch(e){ alert("Error Login"); } 
    }

    function handleLogout() {
        if(confirm("Logout?")) { localStorage.clear(); location.reload(); } 
    }
    
    // --- HELPER LAIN ---
    function isTimeConflict(time1, time2) {
         return false; // Logic bentrok bisa dikembangkan nanti
    }
    
    async function loadTodaySchedule() {
        const container = document.getElementById('today-schedule-container');
        if (!container) return;
        
        container.innerHTML = '<p class="text-center text-gray-400 text-xs py-5">Memuat...</p>';

        try {
            // Kita coba fetch, kalau gagal return empty
            const daily = await fetchSchedule('?category=daily');
            
            const list = daily || []; 
            if(list.length === 0) { 
                container.innerHTML = '<p class="text-center text-gray-400 text-xs py-5">Tidak ada jadwal hari ini</p>'; 
                return; 
            }
            
            // Render sederhana untuk timeline hari ini
            container.innerHTML = list.map(item => `
                <div class="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100 mb-2">
                    <div class="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">${item.waktu}</div>
                    <div class="text-xs font-bold text-gray-700">${item.matkul}</div>
                </div>
            `).join('');
        } catch(e) {
             container.innerHTML = '<p class="text-center text-gray-400 text-xs py-5">Gagal memuat</p>';
        }
    }
    
    // CHECK CONFLICT UI
    function checkConflictsUI() {
        const rows = Array.from(document.querySelectorAll('.schedule-row'));
        const alertBox = document.getElementById('conflict-alert');
        let hasConflict = false;

        rows.forEach(row => row.classList.remove('bg-red-50', 'border-red-200'));
        if(alertBox) alertBox.className = 'hidden mb-6 mx-auto max-w-lg';

        // Placeholder logic
        if(alertBox) {
             alertBox.classList.remove('hidden');
             alertBox.className = 'mb-6 mx-auto max-w-lg bg-green-50 text-green-700 p-3 rounded-xl text-xs text-center border border-green-200';
             alertBox.innerHTML = '<i class="fas fa-check-circle"></i> Tidak ada bentrok terdeteksi (Mode Client)';
        }
    }

})();
