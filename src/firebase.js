import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyBapdQFqBNpe3etGoFN_7LC7frevswz7eI",
    authDomain: "songclash-26720.firebaseapp.com",
    projectId: "songclash-26720",
    storageBucket: "songclash-26720.firebasestorage.app",
    messagingSenderId: "459543906300",
    appId: "1:459543906300:web:8837a2825b4465d5181479",
    measurementId: "G-8SGKDCX5KK"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
