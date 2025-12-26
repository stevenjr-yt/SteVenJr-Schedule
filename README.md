# 🖥️ SteVenJr OS - Personal Schedule Manager

**SteVenJr OS** adalah aplikasi web manajemen jadwal pribadi yang dikembangkan untuk membantu menyeimbangkan kehidupan akademik dan pribadi. Project ini didesain dengan antarmuka ala "OS" dashboard yang futuristik dan fungsional.

> *"Productivity meets Work-Life Balance."*

## ✨ Fitur Utama

### 1. 📊 Interactive Dashboard
- **Real-time Clock & Date:** Penunjuk waktu digital yang presisi.
- **Widget "Agenda Hari Ini":** - Menampilkan mata kuliah atau aktivitas hari ini secara detail (Nama, Waktu, Lokasi, Dosen).
  - **Relax Mode:** Jika tidak ada jadwal, menampilkan animasi *Coffee Cup* yang estetik menandakan waktu istirahat.

### 2. 📅 Comprehensive Scheduling
- **Multi-View:** Mendukung jadwal Harian, UTS, UAS, dan Kegiatan Pribadi.
- **Conflict Checker (Cek Bentrok):** Algoritma pintar yang otomatis mendeteksi jadwal yang tumpang tindih dan menandainya dengan warna merah (Alert).

### 3. 🛡️ Admin Panel & Dynamic Input
- Fitur CRUD (Create, Read, Update, Delete) untuk mengelola data jadwal.
- **Formulir Dinamis:** Input otomatis menyesuaikan kategori. Jika memilih "Pribadi", kolom akademik (Kode MK, Dosen, Kelas) otomatis disembunyikan.

### 4. ⚖️ Work-Life Balance Logic
- Sistem otomatis mendeteksi jam produktif.
- **Lembur Alert:** Aktivitas di atas jam 18:00 (6 PM) otomatis ditandai sebagai "Lembur / Extra" untuk mengingatkan pengguna akan kesehatan waktu istirahat.

## 🛠️ Teknologi yang Digunakan

* **Frontend:** HTML5, CSS3 (Modern UI/UX), JavaScript (DOM Manipulation & Logic).
* **Backend:** PHP (Native).
* **Database:** MySQL.

## 🚀 Cara Install & Menjalankan

1.  **Clone repository ini:**
    ```bash
    git clone [https://github.com/username-lu/stevenjr-os-schedule.git](https://github.com/username-lu/stevenjr-os-schedule.git)
    ```
2.  **Pindahkan folder project** ke dalam direktori `htdocs` (jika menggunakan XAMPP) atau `www`.
3.  **Import Database:**
    - Buka `phpMyAdmin`.
    - Buat database baru (misal: `stevenjr_db`).
    - Import file `database.sql` yang ada di folder project.
4.  **Konfigurasi Koneksi:**
    - Sesuaikan file `koneksi.php` dengan settingan database lokal kamu.
5.  **Jalankan:**
    - Buka browser dan akses `http://localhost/stevenjr-os-schedule`.

## 👤 Author

**Steven Erlinto (SteVenJr)**
* Mahasiswa Teknik Informatika - IIB Darmajaya
* Tim Oosthaven Cyber Security

---
-- --------------------------------------------------------
-- SteVenJr OS Database Schema
-- Version: 2.0 (Stable)
-- Author: Steven Erlinto (SteVenJr)
-- Description: Advanced scheduling system with work-life balance logic
-- --------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+07:00";

--
-- Database: `stevenjr_os_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `users`
-- Menghandle otentikasi admin untuk masuk ke Control Panel
--

CREATE TABLE `users` (
  `id_user` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `role` enum('admin','guest') DEFAULT 'admin',
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `users`
-- Password default: admin123 (Hash ini cuma contoh, ganti pake password_hash di PHP)
--

INSERT INTO `users` (`username`, `password`, `full_name`, `role`, `last_login`) VALUES
('stevenjr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Steven Erlinto', 'admin', '2025-12-26 19:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
-- Kategori kegiatan untuk filter di Dashboard (Harian, UTS, Pribadi, dll)
--

CREATE TABLE `categories` (
  `id_category` int(11) NOT NULL AUTO_INCREMENT,
  `category_name` varchar(50) NOT NULL,
  `color_code` varchar(7) NOT NULL DEFAULT '#ffffff',
  `icon_class` varchar(50) DEFAULT 'fas fa-calendar',
  PRIMARY KEY (`id_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_name`, `color_code`, `icon_class`) VALUES
('Kuliah Reguler', '#3498db', 'fas fa-book'),
('UTS / UAS', '#e74c3c', 'fas fa-exclamation-circle'),
('Organisasi (DCSC)', '#f1c40f', 'fas fa-users'),
('Pribadi & Hobi', '#2ecc71', 'fas fa-gamepad'),
('Project Koding', '#9b59b6', 'fas fa-code');

-- --------------------------------------------------------

--
-- Table structure for table `schedules`
-- Core table: Menyimpan semua jadwal kegiatan
--

CREATE TABLE `schedules` (
  `id_schedule` int(11) NOT NULL AUTO_INCREMENT,
  `id_user` int(11) NOT NULL,
  `id_category` int(11) NOT NULL,
  `title` varchar(150) NOT NULL,
  `description` text,
  `location` varchar(100) DEFAULT 'Online / Rumah',
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `is_overtime` tinyint(1) DEFAULT 0 COMMENT '1 jika kegiatan di atas jam 18:00 (Logic Work-Life Balance)',
  `status` enum('pending','ongoing','completed','cancelled') DEFAULT 'pending',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_schedule`),
  KEY `fk_user_schedule` (`id_user`),
  KEY `fk_category_schedule` (`id_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `schedules` (Sample Data)
--

INSERT INTO `schedules` (`id_user`, `id_category`, `title`, `description`, `location`, `start_time`, `end_time`, `is_overtime`, `status`) VALUES
(1, 1, 'Pemrograman Lanjut', 'Materi: Framework PHP & Database Optimization', 'Gedung F - Lab 3', '2025-12-27 08:00:00', '2025-12-27 10:30:00', 0, 'pending'),
(1, 3, 'Rapat Tim Oosthaven', 'Persiapan CTF bulan depan, bahas strategi defense.', 'Basecamp DCSC', '2025-12-27 15:00:00', '2025-12-27 17:00:00', 0, 'pending'),
(1, 5, 'Push Rank & Ngoding Santai', 'Lanjutin project SteVenJr OS sambil ngopi.', 'Kamar', '2025-12-27 19:00:00', '2025-12-27 22:00:00', 1, 'pending');

-- --------------------------------------------------------

--
-- Table structure for table `app_settings`
-- Konfigurasi tampilan OS (Theme, Notifikasi, dll)
--

CREATE TABLE `app_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `app_settings` (`setting_key`, `setting_value`, `description`) VALUES
('app_version', '2.0.1', 'Versi Aplikasi'),
('dark_mode', 'true', 'Mode tampilan default'),
('maintenance_mode', 'false', 'Kunci akses publik jika sedang update'),
('notification_sound', 'cyberpunk.mp3', 'Suara notifikasi default');

-- --------------------------------------------------------

--
-- Table structure for table `system_logs`
-- Mencatat aktivitas user (Audit Trail) biar kelihatan secure
--

CREATE TABLE `system_logs` (
  `id_log` int(11) NOT NULL AUTO_INCREMENT,
  `id_user` int(11) DEFAULT NULL,
  `activity` varchar(255) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` varchar(255) NOT NULL,
  `log_time` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_log`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Constraints for dumped tables
--

ALTER TABLE `schedules`
  ADD CONSTRAINT `fk_category_schedule` FOREIGN KEY (`id_category`) REFERENCES `categories` (`id_category`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_schedule` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`) ON DELETE CASCADE;

COMMIT;

---
*Dibuat dengan ❤️ dan Kopi untuk manajemen waktu yang lebih baik.*
