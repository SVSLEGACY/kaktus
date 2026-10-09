// @ts-nocheck -- ported as-is from the original kaktus app

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/kaktus/lib/firebase';
import { useRouter, usePathname } from '@/kaktus/next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  plan: string;
  planExpiresAt: Date | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, plan: 'free', planExpiresAt: null });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<Date | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
          const docData = docSnap.exists() ? docSnap.data() : null;
          let p = docData?.plan || 'free';
          let expires: Date | null = null;
          
          if (docData?.planExpiresAt) {
            const expiresAt = docData.planExpiresAt.toDate ? docData.planExpiresAt.toDate() : new Date(docData.planExpiresAt);
            if (new Date() > expiresAt) {
              p = 'free';
              // Update in Firestore to clear expired plan
              import('firebase/firestore').then(({ updateDoc }) => {
                updateDoc(doc(db, 'users', currentUser.uid), { plan: 'free' }).catch(console.error);
              });
            } else {
              expires = expiresAt;
            }
          }
          
          setPlan(p);
          setPlanExpiresAt(expires);
          localStorage.setItem('kaktus_user_plan', p);
          localStorage.setItem('kaktus_user_uid', currentUser.uid);
        } catch (e) {
          console.error("Failed to fetch plan", e);
        }
      } else {
        setPlan('free');
        setPlanExpiresAt(null);
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
    <AuthContext.Provider value={{ user, loading, plan, planExpiresAt }}>
      {children}
    </AuthContext.Provider>
  );
}
