// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAitPVhjdgp45nSWa4_zbgNPIK8mlVwsw0",
  authDomain: "prepwise-628da.firebaseapp.com",
  projectId: "prepwise-628da",
  storageBucket: "prepwise-628da.firebasestorage.app",
  messagingSenderId: "328468813043",
  appId: "1:328468813043:web:6803f00a54ca941096d386",
  measurementId: "G-XRVKP43BHL"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);