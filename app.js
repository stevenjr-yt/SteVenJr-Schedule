// File: app.js

// 1. SETUP
let adminPassword = null; 
let adminEmail = null;
let currentCategory = 'daily'; 
let globalSettings = { show_uts: false, show_uas: false }; 

document.addEventListener('DOMContentLoaded', () => {
    const savedEmail = localStorage.getItem('admin_email');
    const savedPass = localStorage.getItem('admin_password');
    if (savedEmail && savedPass) {
        adminEmail = savedEmail;
        adminPassword = savedPass;
        if (document.getElementById('admin-panel')) showAdminPanel();
    }

    updateClock();
    setInterval(updateClock, 1000);

    // Load Data
    if (document.getElementById('admin-panel')) initAdminFeatures();
    else if (document.getElementById('main-dashboard')) initDashboardFeatures();

    fetchSettings().then(() => {
        if(window.updateDashboardMenu) updateDashboardMenu();
        if(window.initAdminToggles) initAdminToggles();
        if(document.getElementById('main-dashboard')) loadTodaySchedule();
    });
});

// --- HELPER BENTROK (CORE LOGIC) ---
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

// --- API ---
async function fetchSettings() {
    try { const res = await fetch('/api/settings'); if (res.ok) globalSettings = await res.json(); } catch (e) {}
}
async function saveSettings(newStatus) {
    globalSettings = { ...globalSettings, ...newStatus }; 
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(globalSettings) });
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

// 2. DASHBOARD
function initDashboardFeatures() { updateDashboardMenu(); loadTodaySchedule(); setInterval(() => { fetchSettings().then(() => { updateDashboardMenu(); loadTodaySchedule(); }); }, 5000); }

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

// --- FUNGSI LOAD SCHEDULE DATA (SIMPLE FETCH) ---
window.loadScheduleData = async function(category) {
    const tableBody = document.getElementById('schedule-table-body');
    const titleElement = document.getElementById('page-category-badge');
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-400 text-xs">Memuat data...</td></tr>';
    if(titleElement) titleElement.innerText = category.toUpperCase();

    try {
        const res = await fetch(`/api/schedule?category=${category}`);
        const data = await res.json();
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

            // Tambahkan CLASS schedule-row dan DATA ATTRIBUTE agar bisa dicek bentroknya
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

// --- CEK BENTROK UI (DIPANGGIL TOMBOL INDEX) ---
window.checkConflictsUI = function() {
    const rows = document.querySelectorAll('.schedule-row');
    const alertBox = document.getElementById('conflict-alert');
    let conflictCount = 0;
    
    // Reset Warna
    rows.forEach(row => row.classList.remove('bg-red-50', 'bg-red-100'));

    for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
            const r1 = rows[i];
            const r2 = rows[j];
            
            // Cek Hari/Tanggal Sama
            if (r1.dataset.hari === r2.dataset.hari) {
                // Cek Jam
                if (isTimeConflict(r1.dataset.waktu, r2.dataset.waktu)) {
                    r1.classList.add('bg-red-100'); // Merah Nyala
                    r2.classList.add('bg-red-100');
                    conflictCount++;
                }
            }
        }
    }

    if (alertBox) {
        alertBox.classList.remove('hidden');
        if (conflictCount > 0) {
            alertBox.className = "mb-4 px-6 py-4 rounded-xl text-center font-bold border-2 text-lg shadow-lg transition-all animate-bounce bg-red-600 text-white border-red-700 block";
            alertBox.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i> BAHAYA! ADA ${conflictCount} JADWAL BENTROK`;
        } else {
            alertBox.className = "mb-4 px-6 py-4 rounded-xl text-center font-bold border-2 text-lg shadow-lg transition-all bg-green-500 text-white border-green-600 block";
            alertBox.innerHTML = `<i class="fas fa-check-circle mr-2"></i> AMAN! Tidak ada jadwal bentrok.`;
            setTimeout(() => alertBox.classList.add('hidden'), 3000);
        }
    }
}

// --- DASHBOARD HARI INI ---
async function loadTodaySchedule() {
    const container = document.getElementById('today-schedule-container');
    if (!container) return;
    const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0'); const tglIni = `${year}-${month}-${day}`; const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; const hariIni = days[now.getDay()];
    try {
        const [resDaily, resUts, resUas, resPersonal] = await Promise.all([fetch('/api/schedule?category=daily'), fetch('/api/schedule?category=uts'), fetch('/api/schedule?category=uas'), fetch('/api/schedule?category=personal')]);
        const daily = resDaily.ok ? await resDaily.json() : []; const uts = resUts.ok ? await resUts.json() : []; const uas = resUas.ok ? await resUas.json() : []; const personal = resPersonal.ok ? await resPersonal.json() : [];
        
        const isToday = (item) => { if (item.tanggal && item.tanggal === tglIni) return true; if (!item.tanggal && (item.hari || "").toLowerCase() === hariIni.toLowerCase()) return true; return false; };
        
        const list = [...uts.filter(u => u.tanggal === tglIni && globalSettings.show_uts).map(i => ({...i, c: 'orange', label:'UTS'})), ...uas.filter(u => u.tanggal === tglIni && globalSettings.show_uas).map(i => ({...i, c: 'purple', label:'UAS'})), ...daily.filter(isToday).map(i => ({...i, c: 'blue', label:'KULIAH'})), ...personal.filter(isToday).map(i => ({...i, c: 'green', label:'AGENDA'}))];
        list.sort((a, b) => (a.waktu || "").localeCompare(b.waktu || "")); calculateSimpleBusyness(list);

        if (list.length === 0) { container.innerHTML = `<div class="text-center py-8 text-gray-300"><i class="fas fa-mug-hot text-2xl mb-2"></i><p class="text-xs">Hari ini kosong. Santai!</p></div>`; return; }
        container.innerHTML = list.map(item => { if(window.rowWidget) return window.rowWidget(item, item.c); return `<div>${item.matkul}</div>`; }).join('');
    } catch (e) { container.innerHTML = '<p class="text-red-400 text-center text-xs">Gagal memuat jadwal.</p>'; }
}

function calculateSimpleBusyness(items) {
    let totalMinutes = 0; items.forEach(item => { if(item.waktu && item.waktu.includes('-')) { const [start, end] = item.waktu.split('-'); try { const [sh, sm] = start.split(/[:.]/).map(Number); const [eh, em] = end.split(/[:.]/).map(Number); totalMinutes += ((eh*60+em) - (sh*60+sm)); } catch(e) { totalMinutes += 60; } } else { totalMinutes += 60; } });
    const bar = document.getElementById('energy-bar'); const text = document.getElementById('energy-level'); const advice = document.getElementById('busy-advice');
    if (bar && text && !document.getElementById('admin-panel')) { let percent = Math.round((totalMinutes / 480) * 100); if(percent > 100) percent = 100; text.innerText = `${percent}%`; bar.style.width = `${percent}%`; if (percent > 80) { bar.className = "h-full bg-red-500 transition-all duration-1000"; if(advice) advice.innerText = "Sangat Sibuk!"; } else if (percent > 40) { bar.className = "h-full bg-indigo-500 transition-all duration-1000"; if(advice) advice.innerText = "Produktif."; } else { bar.className = "h-full bg-green-500 transition-all duration-1000"; if(advice) advice.innerText = "Santai."; } }
}

// 3. ADMIN
function showAdminPanel() { document.getElementById('login-form').style.display = 'none'; document.getElementById('admin-panel').style.display = 'block'; }
function initAdminFeatures() { loadAdminData('daily'); loadDailyChecklist(); initHealthTracker(); initAdminToggles(); setInterval(() => { const s = localStorage.getItem('steven_sleep_start'); const w = localStorage.getItem('steven_wake_time'); if (s && !w) updateSleepDurationRealtime(new Date(parseInt(s))); }, 1000); }
function initAdminToggles() { const tUts = document.getElementById('toggle-uts'); const tUas = document.getElementById('toggle-uas'); if (tUts) { tUts.checked = globalSettings.show_uts; tUts.addEventListener('change', (e) => saveSettings({ show_uts: e.target.checked })); } if (tUas) { tUas.checked = globalSettings.show_uas; tUas.addEventListener('change', (e) => saveSettings({ show_uas: e.target.checked })); } }
window.switchTab = function(targetId, btn) { document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); document.getElementById(targetId).classList.add('active'); document.querySelectorAll('.tab-btn').forEach(b => { b.className = "tab-btn px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded flex-shrink-0 transition"; }); btn.className = "tab-btn active px-3 py-1.5 text-[10px] font-bold bg-indigo-50 border border-indigo-100 shadow-sm rounded-lg text-indigo-700 flex-shrink-0 transition"; currentCategory = targetId.replace('list-', ''); loadAdminData(currentCategory); }
async function loadAdminData(category) { const container = document.getElementById(`list-${category}`); if(!container) return; container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Loading...</div>'; if (!adminPassword) return; try { const res = await fetch(`/api/schedule?category=${category}`); const data = await res.json(); container.innerHTML = ''; if (!data || data.length === 0) { container.innerHTML = '<div class="text-[10px] text-gray-400 text-center">Data Kosong</div>'; return; } data.forEach(item => { const title = item.matkul || item.nama_kegiatan || item.nama || "Item"; container.innerHTML += `<div class="bg-gray-50 p-2 rounded-lg border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition"><div class="overflow-hidden w-full pr-2"><div class="font-bold text-[11px] text-gray-700 truncate">${title}</div><div class="text-[9px] text-gray-400">${item.hari || item.tanggal} • <span class="text-indigo-500">${item.waktu}</span></div></div><button onclick="deleteSchedule('${item.id}', '${category}')" class="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded transition"><i class="fas fa-trash-alt text-[10px]"></i></button></div>`; }); } catch(e) { container.innerHTML = '<div class="text-[10px] text-red-400 text-center">Error</div>'; } }
const addForm = document.getElementById('add-schedule-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault(); if (!adminPassword) { alert("Login dulu!"); return; }
        const rawData = { kategori: document.getElementById('kategori').value, matkul: document.getElementById('matkul').value, hari: document.getElementById('hari').value, tanggal: document.getElementById('tanggal').value, waktu: document.getElementById('waktu').value, ruangan: document.getElementById('ruangan').value, kode: document.getElementById('kode').value, dosen: document.getElementById('dosen').value, kelas: document.getElementById('kelas').value, tipe: document.getElementById('tipe').value, keterangan: document.getElementById('keterangan').value };
        if(document.getElementById('hari').classList.contains('hidden')) rawData.hari = ""; if(document.getElementById('tanggal').classList.contains('hidden')) rawData.tanggal = "";
        
        // CEK BENTROK (ADMIN)
        try {
            const resCek = await fetch(`/api/schedule?category=${rawData.kategori}`); const existingData = await resCek.json();
            let conflict = null;
            for (const item of existingData) { const sameDay = (item.hari && item.hari === rawData.hari) || (item.tanggal && item.tanggal === rawData.tanggal); if (sameDay && isTimeConflict(item.waktu, rawData.waktu)) { conflict = item; break; } }
            if (conflict) { alert(`GAGAL! BENTROK DENGAN:\n"${conflict.matkul||conflict.nama_kegiatan}"\nJam: ${conflict.waktu}`); return; }
            const res = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword }, body: JSON.stringify(rawData) });
            if (res.ok) { alert("Tersimpan!"); addForm.reset(); if(window.toggleFormFields) window.toggleFormFields(); loadAdminData(rawData.kategori); loadDailyChecklist(); } else { alert("Gagal simpan."); }
        } catch (err) { alert("Error sistem."); }
    });
}
window.deleteSchedule = async function(id, category) { if(!confirm("Hapus?")) return; try { const res = await fetch(`/api/schedule?id=${id}&category=${category}`, { method: 'DELETE', headers: { 'x-admin-password': adminPassword } }); if(res.ok) { loadAdminData(category); loadDailyChecklist(); } } catch(e) { alert("Error koneksi."); } }

// HEALTH (SAMA)
function initHealthTracker() { calculateBMI(); document.getElementById('eat-1').checked = localStorage.getItem('steven_eat_1')==='true'; document.getElementById('eat-2').checked = localStorage.getItem('steven_eat_2')==='true'; document.getElementById('eat-3').checked = localStorage.getItem('steven_eat_3')==='true'; const s = localStorage.getItem('steven_sleep_start'); const w = localStorage.getItem('steven_wake_time'); if (s && !w) updateSleepUI(true, new Date(parseInt(s))); else if (s && w) updateSleepUI(false, new Date(parseInt(s)), new Date(parseInt(w))); else updateEnergyUI(50); document.getElementById('water-count').innerText = localStorage.getItem('steven_water')||0; }
function toggleSleep(isS) { const now = new Date(); if (isS) { localStorage.setItem('steven_sleep_start', now.getTime()); localStorage.removeItem('steven_wake_time'); updateSleepUI(true, now); } else { const s = localStorage.getItem('steven_sleep_start'); if (!s) return alert("Belum tidur!"); localStorage.setItem('steven_wake_time', now.getTime()); updateSleepUI(false, new Date(parseInt(s)), now); } }
function updateSleepUI(isS, sDate, wDate=null) { const bS = document.getElementById('btn-sleep'); const bW = document.getElementById('btn-wake'); const st = document.getElementById('sleep-status-text'); const dS = document.getElementById('sleep-time-display'); const dW = document.getElementById('wake-time-display'); const fmt = d => `${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}`; if (isS) { bS.classList.add('opacity-50','cursor-not-allowed'); bS.onclick=null; bW.classList.remove('opacity-50','cursor-not-allowed'); bW.onclick=()=>toggleSleep(false); dS.innerText=fmt(sDate); dW.innerText="--.--"; st.innerText="Zzz..."; updateEnergyUI(0); } else { bS.classList.remove('opacity-50','cursor-not-allowed'); bS.onclick=()=>toggleSleep(true); bW.classList.add('opacity-50','cursor-not-allowed'); bW.onclick=null; dS.innerText=fmt(sDate); if(wDate) dW.innerText=fmt(wDate); st.innerText="Siap!"; if(wDate) calculateTotalEnergy(sDate, wDate); } }
function updateSleepDurationRealtime(sDate) { const now = new Date(); const diff = now - sDate; const h = Math.floor(diff/3600000); const m = Math.floor((diff%3600000)/60000); const s = Math.floor((diff%60000)/1000); document.getElementById('sleep-duration-text').innerText=`Tidur: ${h}j ${m}m ${s}d`; }
function calculateTotalEnergy(sDate, wDate) { const diff = wDate - sDate; let e = (diff/3600000/8)*100; if(document.getElementById('eat-1').checked) e+=15; if(document.getElementById('eat-2').checked) e+=15; if(document.getElementById('eat-3').checked) e+=15; const tasks = document.querySelectorAll('.check-anim:checked').length; e-=(tasks*5); if(e>100)e=100; if(e<0)e=0; const h = Math.floor(diff/3600000); const m = Math.floor((diff%3600000)/60000); document.getElementById('sleep-duration-text').innerText=`Total: ${h}j ${m}m`; updateEnergyUI(Math.round(e)); }
function updateEnergyUI(v) { const bar = document.getElementById('energy-bar'); const txt = document.getElementById('energy-level'); if (bar && txt) { bar.style.width=`${v}%`; txt.innerText=`${v}%`; bar.className=`h-full transition-all duration-500 ${v>50?'bg-green-500':'bg-red-500'}`; } }
function updateEnergyFromFood() { localStorage.setItem('steven_eat_1', document.getElementById('eat-1').checked); localStorage.setItem('steven_eat_2', document.getElementById('eat-2').checked); localStorage.setItem('steven_eat_3', document.getElementById('eat-3').checked); const s = localStorage.getItem('steven_sleep_start'); const w = localStorage.getItem('steven_wake_time'); if(s && w) calculateTotalEnergy(new Date(parseInt(s)), new Date(parseInt(w))); }
function calculateBMI() { const w = parseFloat(document.getElementById('input-bb').value)||50; const h=1.8; const bmi=(w/(h*h)).toFixed(1); document.getElementById('bmi-result').innerText=`BMI: ${bmi}`; }
function updateWater(n) { let c = parseInt(document.getElementById('water-count').innerText)+n; if(c<0)c=0; document.getElementById('water-count').innerText=c; localStorage.setItem('steven_water',c); }
async function loadDailyChecklist() { const c = document.getElementById('daily-checklist-container'); if(!c) return; const now = new Date(); const tglIni = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; c.innerHTML='Loading...'; try { const [d, uts, uas, p] = await Promise.all([fetch('/api/schedule?category=daily').then(r=>r.json()), fetch('/api/schedule?category=uts').then(r=>r.json()), fetch('/api/schedule?category=uas').then(r=>r.json()), fetch('/api/schedule?category=personal').then(r=>r.json())]); const list = [...d,...uts,...uas,...p].filter(i => (i.tanggal && i.tanggal===tglIni) || (!i.tanggal && (i.hari||"").toLowerCase()===['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][now.getDay()])); list.sort((a,b)=>(a.waktu||"").localeCompare(b.waktu||"")); c.innerHTML=''; list.forEach((i,idx)=>{ const cid=`check_${tglIni}_${i.id||idx}`; c.innerHTML+=`<div class="flex gap-2"><input type="checkbox" class="check-anim" ${localStorage.getItem(cid)==='true'?'checked':''} onchange="toggleCheck('${cid}',this)"><span>${i.matkul||i.nama_kegiatan}</span></div>`; }); updateEnergyFromFood(); } catch(e){} }
window.toggleCheck = function(id, el) { localStorage.setItem(id, el.checked); updateEnergyFromFood(); }
// Login
const loginBtn = document.getElementById('btn-login'); if(loginBtn) loginBtn.addEventListener('click', async (e)=>{ e.preventDefault(); const email=document.getElementById('email').value; const pass=document.getElementById('password').value; try { const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email, password: pass})}); if(res.ok) { localStorage.setItem('admin_email',email); localStorage.setItem('admin_password',pass); showAdminPanel(); } else alert("Salah"); } catch(e){alert("Error");} });
const btnLogout = document.getElementById('btn-logout'); if(btnLogout) btnLogout.addEventListener('click', ()=>{ if(confirm("Logout?")) { localStorage.clear(); location.reload(); } });

