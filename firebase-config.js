import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// SAYA SUDAH TAMBAHKAN getDoc dan setDoc DI SINI:
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Config Firebase Kamu (Sudah disesuaikan dengan screenshotmu)
const firebaseConfig = {
  apiKey: "AIzaSyAhC6qGwpvDLXKLsfqJFmg-klsITU0dxFU",
  authDomain: "stevenjr-schedule.firebaseapp.com",
  projectId: "stevenjr-schedule",
  storageBucket: "stevenjr-schedule.firebasestorage.app",
  messagingSenderId: "19037511752",
  appId: "1:19037511752:web:76afb1e53bddbe915f787d",
  measurementId: "G-RVMQH7GJCH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// EXPORT JUGA HARUS LENGKAP:
export { db, auth, collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, onSnapshot, signInWithEmailAndPassword, onAuthStateChanged, signOut, getDoc, setDoc };