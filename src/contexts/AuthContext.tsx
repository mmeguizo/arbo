import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/config";

// Type definitions for user profile roles
export type UserRole = "arb" | "staff" | "encoder" | "admin" | "arbo_head";

export interface UserProfile {
  uid: string;
  email: string | null;
  name: string;
  address: string;
  age: number;
  contact: string;
  barangay: string;
  municipality: string;
  province: string;
  role: UserRole;
  createdAt: string;
  isActive?: boolean;
  arboId?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (currentUser: User) => {
    try {
      const docRef = doc(db, "users", currentUser.uid);
      // Use onSnapshot for real-time profile updates (role changes reflect immediately)
      const unsub = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setProfile({
            uid: currentUser.uid,
            ...docSnap.data(),
          } as UserProfile);
        } else {
          console.warn("User profile not found in Firestore — signing out.");
          signOut(auth);
          setProfile(null);
          setUser(null);
        }
        setLoading(false);
      });
      return unsub;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setProfile(null);
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  useEffect(() => {
    let unsubFirestore: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Clean up previous listener before setting a new one
        if (unsubFirestore) unsubFirestore();
        const result = await fetchProfile(currentUser);
        if (typeof result === "function") {
          unsubFirestore = result;
        }
      } else {
        if (unsubFirestore) unsubFirestore();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, logout, refreshProfile }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
