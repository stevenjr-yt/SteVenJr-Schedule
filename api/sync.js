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
    tipe: 'Praktek'
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
    solusi: 'Bentrok dengan Jadwal GSA 2026 Batch 2 -> Solusi: Mengikuti UTS Susulan'
  },
  {
    tanggal: '2026-10-30',
    hari: 'Jumat',
    waktu: '10:30-12:00',
    matkul: '[BENTROK] Google Student Ambassador (GSA 2026)',
    kode: 'GSA-B2',
    kelas: 'GSA Batch 2',
    ruangan: 'Google Meet / Onboarding Session',
    dosen: 'Google Team',
    tipe: 'Praktek',
    isConflict: true,
    solusi: 'Agenda Wajib GSA Batch 2 -> Rekomendasi: Mengajukan Dispensasi & UTS Susulan Software Engineering ke BAAK'
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
    tipe: 'Teori'
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

export default async function handler(req, res) {
  try {
    // 1. Hapus isi collection daily lama
    const dailySnap = await db.collection('daily').get();
    for (const doc of dailySnap.docs) {
      await doc.ref.delete();
    }

    // 2. Masukkan jadwal kuliah harian baru
    for (const item of dailyData) {
      await db.collection('daily').add(item);
    }

    // 3. Hapus isi collection uts lama
    const utsSnap = await db.collection('uts').get();
    for (const doc of utsSnap.docs) {
      await doc.ref.delete();
    }

    // 4. Masukkan jadwal UTS baru beserta bentrok GSA & solusi susulan
    for (const item of utsData) {
      await db.collection('uts').add(item);
    }

    // 5. Aktifkan mode UTS di config/display_mode
    await db.collection('config').doc('display_mode').set({
      show_uts: true,
      show_uas: false
    }, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Jadwal Kuliah Harian (9 Matkul) & Jadwal UTS Ganjil 2026 berhasil disinkronkan ke Firebase!',
      daily_count: dailyData.length,
      uts_count: utsData.length,
      show_uts: true
    });
  } catch (error) {
    console.error('Sync Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
