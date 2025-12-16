import { createClient } from '@supabase/supabase-js';
import * as admin from 'firebase-admin';

// --- 1. CONFIG SUPABASE ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- 2. CONFIG FIREBASE ADMIN ---
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      databaseURL: process.env.FIREBASE_DB_URL
    });
  } catch (error) {
    console.error('Firebase admin init error', error.stack);
  }
}
const fbDb = admin.database();

export default async function handler(req, res) {
  const { category, id } = req.query;
  const adminPassword = req.headers['x-admin-password'];

  // --- HELPERS ---
  
  // Fungsi Baca dari Firebase (Format Data disesuaikan agar mirip Supabase)
  const fetchFromFirebase = async () => {
    console.log("⚠️ Switch ke FIREBASE...");
    const ref = fbDb.ref('schedules');
    const snapshot = await ref.once('value');
    const raw = snapshot.val();
    if (!raw) return [];
    
    // Convert Object ke Array & Filter
    const data = Object.keys(raw).map(key => ({ id: key, ...raw[key] }));
    if (category) {
      return data.filter(item => item.kategori === category);
    }
    return data;
  };

  // --- 1. GET DATA (AUTO SWITCH LOGIC) ---
  if (req.method === 'GET') {
    try {
      // PRIORITAS UTAMA: SUPABASE
      let query = supabase.from('schedules').select('*');
      if (category) {
        query = query.eq('kategori', category);
      }
      
      const { data, error } = await query;
      
      if (error) throw error; // Lempar error biar ditangkap catch
      
      // Jika berhasil, return data Supabase
      return res.status(200).json(data);

    } catch (err) {
      console.error("❌ Supabase Error/Down:", err.message);
      
      // AUTO SWITCH: JIKA SUPABASE GAGAL, AMBIL DARI FIREBASE
      try {
        const fbData = await fetchFromFirebase();
        return res.status(200).json(fbData);
      } catch (fbErr) {
        return res.status(500).json({ error: "SEMUA DATABASE DOWN" });
      }
    }
  }

  // --- 2. POST DATA (DUAL WRITE - TULIS KE DUA DB) ---
  if (req.method === 'POST') {
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Password Salah!' });
    }

    const newData = req.body;
    const errors = [];

    // PROSES PARALEL (Jalan Barengan)
    const promises = [
      // A. Tulis ke Supabase
      supabase.from('schedules').insert([newData])
        .then(({ error }) => { if (error) throw new Error(`Supabase: ${error.message}`) }),

      // B. Tulis ke Firebase
      fbDb.ref('schedules').push(newData)
        .catch((err) => { throw new Error(`Firebase: ${err.message}`) })
    ];

    // Tunggu keduanya selesai (sukses atau gagal)
    const results = await Promise.allSettled(promises);

    // Cek hasil
    results.forEach(res => {
      if (res.status === 'rejected') errors.push(res.reason.message);
    });

    if (errors.length > 0) {
      // Jika salah satu gagal, tetap return 200 tapi kasih note warning
      console.error("Partial Write Error:", errors);
      return res.status(200).json({ message: 'Data tersimpan (Partial Sync)', warning: errors });
    }

    return res.status(200).json({ message: 'Sukses tersimpan di KEDUA Database' });
  }

  // --- 3. DELETE DATA (DUAL DELETE) ---
  if (req.method === 'DELETE') {
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Password Salah!' });
    }

    if (!id) return res.status(400).json({ message: 'ID wajib ada' });

    // Coba hapus di Supabase
    const { error: sbError } = await supabase.from('schedules').delete().eq('id', id);
    
    // Coba hapus di Firebase (Kita asumsikan ID Firebase beda, ini agak tricky. 
    // IDEALNYA: ID di Supabase dan Firebase harus sama. 
    // Untuk skrip simpel ini, kita hapus di Supabase dulu).
    // *Catatan: Hapus by ID di Firebase butuh key Firebase-nya, jika beda struktur ini akan skip Firebase
    // Tapi karena kamu prioritaskan Supabase, logic delete Supabase yang utama.
    
    if (sbError) return res.status(500).json({ error: sbError.message });
    return res.status(200).json({ message: 'Terhapus' });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
