import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyBBhHBTlYX50-jRvgO9hYPgNCgOfWrOVuk",
  authDomain: "arbo-f5b2a.firebaseapp.com",
  projectId: "arbo-f5b2a",
  storageBucket: "arbo-f5b2a.firebasestorage.app",
  messagingSenderId: "310883840542",
  appId: "1:310883840542:web:b2bbc22571443ccfa0740f",
  measurementId: "G-66K3TE2S7T",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
