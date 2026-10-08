'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  plan: string;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, plan: 'free' });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState('free');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
          const p = docSnap.exists() && docSnap.data().plan ? docSnap.data().plan : 'free';
          setPlan(p);
          localStorage.setItem('kaktus_user_plan', p);
          localStorage.setItem('kaktus_user_uid', currentUser.uid);
        } catch (e) {
          console.error("Failed to fetch plan", e);
        }
      } else {
        setPlan('free');
        localStorage.removeItem('kaktus_user_plan');
        localStorage.removeItem('kaktus_user_uid');
      }
      
      setLoading(false);
      
      // Route guarding logic
      if (!currentUser && (pathname === '/ide' || pathname === '/pcb-designer')) {
        router.push('/login?redirect=' + pathname);
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, plan }}>
      {children}
    </AuthContext.Provider>
  );
}
