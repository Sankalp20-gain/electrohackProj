import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, getAuth, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, app } from "../utils/firebase"; // ensure db is exported from firebase.js

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Try to get extra user info from Firestore
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            // Merge Firestore user data with auth user object
            setUser({ ...currentUser, ...docSnap.data() });
          } else {
            setUser(currentUser);
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const Logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, Logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
