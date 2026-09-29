import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyAgrMp79tl5iEH8ydkotpc1VruQmnNX1_Q",
  authDomain: "arbo-90356.firebaseapp.com",
  projectId: "arbo-90356",
  messagingSenderId: "147311949988",
  appId: "1:147311949988:web:8460ed7db372a9cca38e31",
  measurementId: "G-SFPG6C5EM4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
