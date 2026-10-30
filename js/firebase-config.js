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
let firebaseAuth = null;

try {
  if (typeof firebase !== 'undefined') {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    firestoreDb = firebase.firestore();
    firestoreStorage = firebase.storage();
    // Sin esto, un fallo de red o de bucket reintenta hasta 10 minutos antes de avisar
    firestoreStorage.setMaxUploadRetryTime(2 * 60 * 1000);
    console.log("⚡ ForoMagma: Conectado exitosamente a Firebase Cloud");
  }
} catch (e) {
  console.warn("Error al inicializar Firebase:", e);
}
