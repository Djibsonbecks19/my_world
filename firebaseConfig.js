import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// FIX: Ensure you are importing these specific functions from the firestore module
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXQr6uxyuSJkbunaZRnN2dXMa8sR8qW0Q",
  authDomain: "iibs-test.firebaseapp.com",
  projectId: "iibs-test",
  storageBucket: "iibs-test.firebasestorage.app",
  messagingSenderId: "941043265021",
  appId: "1:941043265021:web:ba65eb95f8e56f9e65bd94",
  measurementId: "G-BBGN3NGR1H"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export db and firestore helpers so script.js can use them
export { db, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit };