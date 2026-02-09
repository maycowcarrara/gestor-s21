// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// COLE AQUI O QUE VOCÊ COPIOU DO CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyDzr5QoKTQEPcYYrnpLEabubUpDKSndML4",
    authDomain: "gestor-s21.firebaseapp.com",
    projectId: "gestor-s21",
    storageBucket: "gestor-s21.firebasestorage.app",
    messagingSenderId: "36719474744",
    appId: "1:36719474744:web:d0ef94650768f044054ecd"
};

// Inicializa o App
const app = initializeApp(firebaseConfig);

// Inicializa o Banco de Dados
const db = getFirestore(app);

// Inicializa a Autenticação
const auth = getAuth(app);
// Exporta tudo
export { db, auth };