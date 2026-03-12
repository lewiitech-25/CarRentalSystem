// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8YDRUI70CrTDP_8JJe5--nG0CxReQmCk",
  authDomain: "car-rental-system-26cbd.firebaseapp.com",
  projectId: "car-rental-system-26cbd",
  storageBucket: "car-rental-system-26cbd.firebasestorage.app",
  messagingSenderId: "41364752127",
  appId: "1:41364752127:web:c550433d2f33cd05b06eca"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app)
export const db = getFirestore(app)