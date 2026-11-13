import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDyfVWLPdmecpQWA35Bt4y-fLr8MTRz4ug",
  authDomain: "venchats-bot.firebaseapp.com",
  projectId: "venchats-bot",
  storageBucket: "venchats-bot.firebasestorage.app",
  messagingSenderId: "962126234109",
  appId: "1:962126234109:web:4cdd33702fbdbbc6cd5994",
  measurementId: "G-WTRC4Y5B8S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore using named database "optirutas" with persistent offline cache
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  },
  "optirutas"
);
