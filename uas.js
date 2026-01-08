// Data Jadwal UAS dari Gambar (Januari 2026)
const jadwalData = [
    {
        matkul: "Analisis Struktur Data",
        kode: "TIF21208",
        dosen: "SULYONO, S.Kom., M.T.I",
        kelas: "3TI1", // Di gambar tertulis 3TI1
        ruangan: "G.1.5",
        tanggal: "2026-01-13",
        waktu: "07:30-09:00",
        tipe: "Teori"
    },
    {
        matkul: "Multimedia",
        kode: "TIF21213",
        dosen: "HARIYANTO WIBOWO, S.Kom., M.T.I",
        kelas: "3TI2",
        ruangan: "Lab.Das.F (F.1)",
        tanggal: "2026-01-14",
        waktu: "09:00-10:30",
        tipe: "Praktek"
    },
    {
        matkul: "Pengantar Ilmu Komputer",
        kode: "TIF21202",
        dosen: "SITI NUR LAILA, S.Kom., M.T.I.",
        kelas: "3TI2",
        ruangan: "G.1.5",
        tanggal: "2026-01-14",
        waktu: "13:00-14:30",
        tipe: "Teori"
    },
    {
        matkul: "Pemrograman Lanjut",
        kode: "TIF21410",
        dosen: "SULYONO, S.Kom., M.T.I",
        kelas: "5TI1", // Di gambar tertulis 5TI1
        ruangan: "Lab.Das.A (G.2)",
        tanggal: "2026-01-14",
        waktu: "14:40-16:10",
        tipe: "Praktek"
    },
    {
        matkul: "Penjaminan Mutu Perangkat Lunak",
        kode: "TIF21442",
        dosen: "ISNANDAR AGUS, S.Pd., M.Kom",
        kelas: "3TI2",
        ruangan: "G.1.5",
        tanggal: "2026-01-15",
        waktu: "07:30-09:00",
        tipe: "Teori"
    },
    {
        matkul: "Organisasi dan Arsitektur",
        kode: "FIK21406",
        dosen: "SHERLI TRISNAWATI, S.Kom., MTI",
        kelas: "3TI3", // Di gambar tertulis 3TI3
        ruangan: "F.2.5",
        tanggal: "2026-01-15",
        waktu: "09:00-10:30",
        tipe: "Teori"
    },
    {
        matkul: "Mobile Computing",
        kode: "TIF21209",
        dosen: "ADIMAS AGLASIA, S.Kom., MTI",
        kelas: "3TI2",
        ruangan: "G.1.3",
        tanggal: "2026-01-20",
        waktu: "09:00-10:30",
        tipe: "Teori"
    },
    {
        matkul: "Aljabar Linear",
        kode: "TIF21211",
        dosen: "SUCI MUTIARA, S.Kom., MTI",
        kelas: "3TI2",
        ruangan: "G.1.5",
        tanggal: "2026-01-23",
        waktu: "13:00-14:30",
        tipe: "Teori"
    },
    {
        matkul: "Kecerdasan Buatan",
        kode: "TIF21212",
        dosen: "Dr Chairani, S.Kom., M.Eng",
        kelas: "3TI2",
        ruangan: "F.4.3",
        tanggal: "2026-01-26",
        waktu: "10:30-12:00",
        tipe: "Teori"
    },
    {
        matkul: "Pemrograman Lanjut",
        kode: "TIF21410",
        dosen: "SULYONO, S.Kom., M.T.I",
        kelas: "5TI1",
        ruangan: "F.2.3",
        tanggal: "2026-01-26",
        waktu: "13:00-14:30",
        tipe: "Teori"
    }
];

// Ganti nama collection di sini kalau mau tetep masuk ke 'uts'
const COLLECTION_NAME = "uas"; 

async function uploadJadwal() {
    console.log(`🚀 Mengirim ${jadwalData.length} data ke collection '${COLLECTION_NAME}'...`);
    
    let successCount = 0;

    for (const item of jadwalData) {
        try {
            // Menggunakan .add() biar ID dokumen auto-generate
            await db.collection(COLLECTION_NAME).add(item);
            
            console.log(`✅ Masuk: ${item.matkul} (${item.tipe})`);
            successCount++;
        } catch (error) {
            console.error(`❌ Gagal: ${item.matkul}`, error);
        }
    }
    
    console.log(`🎉 Selesai! Berhasil upload ${successCount} dari ${jadwalData.length} jadwal.`);
}

uploadJadwal();
