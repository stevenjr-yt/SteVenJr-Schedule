import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
    }),
  });
}

const db = admin.firestore();

// 1. DATA JADWAL KULIAH HARIAN (KRS Semester 5 Ganjil 2026/2027)
const dailyData = [
  {
    hari: 'Senin',
    waktu: '07:30 - 09:00',
    matkul: 'Mobile Technology and IoT',
    kode: 'TIF26213',
    kelas: '5TI3',
    sks: 2,
    ruangan: 'G24',
    dosen: 'Riko Herwanto, S.Kom. MTI',
    tipe: 'Praktek'
  },
  {
    hari: 'Senin',
    waktu: '13:00 - 16:10',
    matkul: 'Software Engineering',
    kode: 'TIF26408',
    kelas: '3TI4',
    sks: 4,
    ruangan: 'F43',
    dosen: 'ISNANDAR AGUS, S.Pd., M.Kom',
    tipe: 'Teori'
  },
  {
    hari: 'Selasa',
    waktu: '10:30 - 12:00',
    matkul: 'Kekayaan Intelektual',
    kode: 'FIK25202',
    kelas: '7TI1',
    sks: 2,
    ruangan: 'F31',
    dosen: 'LIA ROSMALIA, S.T., M.Kom.',
    tipe: 'Teori'
  },
  {
    hari: 'Selasa',
    waktu: '14:40 - 16:10',
    matkul: 'Bahasa Inggris',
    kode: 'FIK25203',
    kelas: '1TI7',
    sks: 2,
    ruangan: 'G16',
    dosen: 'RIONALDI ALI',
    tipe: 'Teori'
  },
  {
    hari: 'Rabu',
    waktu: '07:30 - 09:00',
    matkul: 'Pancasila',
    kode: 'IBI25205',
    kelas: '7TI1',
    sks: 2,
    ruangan: 'F47',
    dosen: 'JAKA DARMAWAN',
    tipe: 'Teori'
  },
  {
    hari: 'Rabu',
    waktu: '10:30 - 14:30',
    matkul: 'Cyber Security',
    kode: 'TIF26413',
    kelas: '5TI3',
    sks: 4,
    ruangan: 'E21',
    dosen: 'ADIMAS AGLASIA, S.Kom., MTI',
    tipe: 'Teori'
  },
  {
    hari: 'Kamis',
    waktu: '07:30 - 09:00',
    matkul: 'Kewarganegaraan',
    kode: 'IBI25208',
    kelas: '7TI2',
    sks: 2,
    ruangan: 'F31',
    dosen: 'MONETA NAULI BASA HARAHAP, SE., MM',
    tipe: 'Teori'
  },
  {
    hari: 'Kamis',
    waktu: '13:00 - 14:30',
    matkul: 'Pendidikan Karakter dan Anti Korupsi',
    kode: 'IBI25206',
    kelas: '7TI2',
    sks: 2,
    ruangan: 'F44',
    dosen: 'KETUT ARTAYE',
    tipe: 'Teori'
  },
  {
    hari: 'Jumat',
    waktu: '07:30 - 10:30',
    matkul: 'Advanced Mobile Programming',
    kode: 'TIF26491',
    kelas: '5TI2',
    sks: 4,
    ruangan: 'F11',
    dosen: 'MUHAMMAD FAUZAN AZIMA, S.Kom., M.T.I.',
    tipe: 'Praktek'
  }
];

// 2. DATA JADWAL UTS (Ganjil 2026/2027 Sesuai Kelas KRS)
// GSA: 27 Okt (Malam) s/d 31 Okt 2026 -> Semua ujian di Jumat 30 Okt Bentrok!
const utsData = [
  {
    tanggal: '2026-10-26',
    hari: 'Senin',
    waktu: '10:30-12:00',
    matkul: 'Cyber Security (Teori)',
    kode: 'TIF26413',
    kelas: '5TI3',
    ruangan: 'F.2.5 / F.2.6',
    dosen: 'ADIMAS AGLASIA, S.Kom., MTI',
    tipe: 'Teori'
  },
  {
    tanggal: '2026-10-26',
    hari: 'Senin',
    waktu: '13:00-14:30',
    matkul: 'Pendidikan Karakter dan Anti Korupsi',
    kode: 'IBI25206',
    kelas: '7TI2',
    ruangan: 'E.2.2 / E.2.3',
    dosen: 'KETUT ARTAYE',
    tipe: 'Teori'
  },
  {
    tanggal: '2026-10-27',
    hari: 'Selasa',
    waktu: '09:00-10:30',
    matkul: 'Bahasa Inggris',
    kode: 'FIK25203',
    kelas: '1TI7',
    ruangan: 'G.1.3',
    dosen: 'RIONALDI ALI',
    tipe: 'Teori'
  },
  {
    tanggal: '2026-10-27',
    hari: 'Selasa',
    waktu: '13:00-14:30',
    matkul: 'Kekayaan Intelektual',
    kode: 'FIK25202',
    kelas: '7TI1',
    ruangan: 'F.2.2',
    dosen: 'LIA ROSMALIA, S.T., M.Kom.',
    tipe: 'Teori'
  },
  {
    tanggal: '2026-10-30',
    hari: 'Jumat',
    waktu: '07:30-09:00',
    matkul: 'Advanced Mobile Programming',
    kode: 'TIF26491',
    kelas: '5TI2',
    ruangan: 'LAB Artificial Intelligence (F.1.1)',
    dosen: 'MUHAMMAD FAUZAN AZIMA, S.Kom., M.T.I.',
    tipe: 'Praktek',
    isConflict: true,
    solusi: 'Bentrok Penugasan GSA 2026 (27-31 Okt) -> Solusi: Mengajukan Dispensasi & Mengikuti UTS Susulan ke Dosen (M. Fauzan Azima, M.T.I.)'
  },
  {
    tanggal: '2026-10-30',
    hari: 'Jumat',
    waktu: '10:30-12:00',
    matkul: 'Software Engineering',
    kode: 'TIF26408',
    kelas: '3TI4',
    ruangan: 'F.4.3 / F.4.4',
    dosen: 'ISNANDAR AGUS, S.Pd., M.Kom',
    tipe: 'Teori',
    isConflict: true,
    solusi: 'Bentrok Penugasan GSA 2026 (27-31 Okt) -> Solusi: Mengajukan Dispensasi & Mengikuti UTS Susulan ke Dosen (Isnandar Agus, M.Kom)'
  },
  {
    tanggal: '2026-10-30',
    hari: 'Jumat',
    waktu: '13:00-14:30',
    matkul: 'Kewarganegaraan',
    kode: 'IBI25208',
    kelas: '7TI2',
    ruangan: 'F.3.5',
    dosen: 'MONETA NAULI BASA HARAHAP, SE., MM',
    tipe: 'Teori',
    isConflict: true,
    solusi: 'Bentrok Penugasan GSA 2026 (27-31 Okt) -> Solusi: Mengajukan Dispensasi & Mengikuti UTS Susulan ke Dosen (Moneta Nauli Basa Harahap, MM)'
  },
  {
    tanggal: '2026-10-30',
    hari: 'Jumat',
    waktu: '07:30-17:00',
    matkul: '[BENTROK SEHARIAN] Penugasan Google Student Ambassador (GSA 2026 Batch 2)',
    kode: 'GSA-B2',
    kelas: 'GSA Batch 2',
    ruangan: 'Onboarding & Training Event (27-31 Okt)',
    dosen: 'Google Team & BAAK/PLPP',
    tipe: 'Penugasan Resmi',
    isConflict: true,
    solusi: 'Penugasan resmi mewakili kampus (27-31 Okt). KETIGA ujian hari Jumat (Advanced Mobile Programming, Software Engineering, Kewarganegaraan) wajib mengajukan UTS Susulan resmi ke BAAK / PLPP.'
  },
  {
    tanggal: '2026-11-02',
    hari: 'Senin',
    waktu: '07:30-09:00',
    matkul: 'Mobile Technology and IoT',
    kode: 'TIF26213',
    kelas: '5TI3',
    ruangan: 'LAB Animation (G.2.4)',
    dosen: 'Riko Herwanto, S.Kom. MTI',
    tipe: 'Praktek'
  },
  {
    tanggal: '2026-11-04',
    hari: 'Rabu',
    waktu: '13:00-14:30',
    matkul: 'Cyber Security (Praktek)',
    kode: 'TIF26413',
    kelas: '5TI3',
    ruangan: 'LAB Networking (G.3.5)',
    dosen: 'ADIMAS AGLASIA, S.Kom., MTI',
    tipe: 'Praktek'
  },
  {
    tanggal: '2026-11-05',
    hari: 'Kamis',
    waktu: '13:00-14:30',
    matkul: 'Pancasila',
    kode: 'IBI25205',
    kelas: '7TI1',
    ruangan: 'F.2.6',
    dosen: 'JAKA DARMAWAN',
    tipe: 'Teori'
  }
];

// 3. DATA KEGIATAN PERSONAL
const personalData = [
  {
    matkul: 'Penugasan Google Student Ambassador (GSA 2026 Batch 2)',
    keterangan: 'Orientation, Training & Onboarding Event se-Indonesia',
    ruangan: 'Google Indonesia / National Summit',
    hari: '27-31 Okt 2026',
    tanggal: '2026-10-27',
    waktu: '27 Okt (Malam) - 31 Okt 2026',
    tipe: 'Penugasan',
    isConflict: true,
    solusi: 'Agenda resmi GSA bertabrakan dengan UTS 30 Okt -> Wajib UTS Susulan untuk 3 Matkul'
  },
  {
    matkul: 'Mengajar Koding dan Kecerdasan Artifisial',
    keterangan: 'SMKK BPK PENABUR Bandar Lampung',
    ruangan: 'SMKK BPK PENABUR Bandar Lampung',
    hari: 'Jumat',
    waktu: '07:00 - 10:25',
    tipe: 'Pengajaran'
  },
  {
    matkul: 'Pembina SMBB & Ibadah Rutin',
    keterangan: 'Vihara Bodhisattva',
    ruangan: 'Vihara Bodhisattva',
    hari: 'Minggu',
    waktu: '08:00 - 12:00',
    tipe: 'Sosial / Ibadah'
  }
];

export default async function handler(req, res) {
  try {
    // 1. Hapus isi collection daily lama & update baru
    const dailySnap = await db.collection('daily').get();
    for (const doc of dailySnap.docs) {
      await doc.ref.delete();
    }
    for (const item of dailyData) {
      await db.collection('daily').add(item);
    }

    // 2. Hapus isi collection uts lama & update baru
    const utsSnap = await db.collection('uts').get();
    for (const doc of utsSnap.docs) {
      await doc.ref.delete();
    }
    for (const item of utsData) {
      await db.collection('uts').add(item);
    }

    // 3. Hapus isi collection personal lama & update baru
    const personalSnap = await db.collection('personal').get();
    for (const doc of personalSnap.docs) {
      await doc.ref.delete();
    }
    for (const item of personalData) {
      await db.collection('personal').add(item);
    }

    // 4. Aktifkan mode UTS di config/display_mode
    await db.collection('config').doc('display_mode').set({
      show_uts: true,
      show_uas: false
    }, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Jadwal Kuliah Harian, UTS 2026, dan Bentrok GSA (27-31 Okt) dengan UTS Susulan berhasil disinkronkan!',
      daily_count: dailyData.length,
      uts_count: utsData.length,
      personal_count: personalData.length,
      show_uts: true
    });
  } catch (error) {
    console.error('Sync Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
