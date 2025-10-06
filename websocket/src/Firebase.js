// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, OAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "ms-login-2737a.firebaseapp.com",
  projectId: "ms-login-2737a",
  storageBucket: "ms-login-2737a.appspot.com",
  messagingSenderId: "100679991447",
  appId: "1:100679991447:web:669d139e21d896b2e829d2",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new OAuthProvider("microsoft.com");
provider.setCustomParameters({
  prompt: "select_account", // 👈 Forces Microsoft to show account chooser
});

export { auth, provider };
