import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseReady } from "./firebase.js";

const AuthContext = createContext({ user: null, claims: {}, loading: true, configured: false });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(firebaseReady);
  useEffect(() => {
    if (!firebaseReady || !auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async current => {
      setUser(current);
      if (current) {
        try { const token = await current.getIdTokenResult(true); setClaims(token.claims || {}); }
        catch { setClaims({}); }
      } else setClaims({});
      setLoading(false);
    });
  }, []);
  return <AuthContext.Provider value={{ user, claims, loading, configured: firebaseReady }}>{children}</AuthContext.Provider>;
}
