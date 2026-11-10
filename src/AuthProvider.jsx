import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseReady } from "./firebase.js";

const AuthContext = createContext({ user: null, claims: {}, loading: true, configured: false });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(firebaseReady);
  useEffect(() => {
    if (!firebaseReady || !auth || !db) { setLoading(false); return; }
    return onAuthStateChanged(auth, async current => {
      setUser(current);
      if (current) {
        try {
          const roleSnap = await getDoc(doc(db, "roles", current.uid));
          const role = roleSnap.exists() ? roleSnap.data().role : "customer";
          setClaims({ role, superAdmin: role === "superAdmin", staffRole: role === "customer" || role === "superAdmin" ? null : role });
        } catch { setClaims({ role: "customer", superAdmin: false, staffRole: null }); }
      } else setClaims({});
      setLoading(false);
    });
  }, []);
  return <AuthContext.Provider value={{ user, claims, loading, configured: firebaseReady }}>{children}</AuthContext.Provider>;
}
