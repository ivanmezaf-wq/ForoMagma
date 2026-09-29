// Configuración oficial de Google Firebase para ForoMagma

const firebaseConfig = {
  apiKey: "AIzaSyAs0RJlJ3N-y9FHY4D80mO3nOKIaxbQzrY",
  authDomain: "foromagma-7365e.firebaseapp.com",
  projectId: "foromagma-7365e",
  storageBucket: "foromagma-7365e.firebasestorage.app",
  messagingSenderId: "797065879420",
  appId: "1:797065879420:web:97aa7f0bc525401f9c8ef9",
  measurementId: "G-2TMH310363"
};

// Inicializar Firebase
let firebaseApp = null;
let firestoreDb = null;
let firestoreStorage = null;

try {
  if (typeof firebase !== 'undefined') {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firestoreDb = firebase.firestore();
    firestoreStorage = firebase.storage();
    console.log("⚡ ForoMagma: Conectado exitosamente a Firebase Cloud");
  }
} catch (e) {
  console.warn("Error al inicializar Firebase:", e);
}
