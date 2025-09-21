import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBXb3NfAVC4rRQhTu3fnGkV1x0v4L7Vygs",
  authDomain: "pdf-master-b7d9a.firebaseapp.com",
  projectId: "pdf-master-b7d9a",
  storageBucket: "pdf-master-b7d9a.firebasestorage.app",
  messagingSenderId: "1040217520678",
  appId: "1:1040217520678:web:9f47eadb512d48ebb6c4e7",
  measurementId: "G-J45QLYZW6S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics, firebaseConfig };