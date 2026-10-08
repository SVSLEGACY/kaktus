import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface PaymentSettings {
  upiId: string;
  upiQrUrl: string;
}

export interface PaymentTransaction {
  id: string;
  uid: string;
  email: string | null;
  planId: string;
  txnId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

export const getAdminPaymentSettings = async (): Promise<PaymentSettings> => {
  try {
    const docSnap = await getDoc(doc(db, 'admin', 'settings'));
    if (docSnap.exists() && docSnap.data().payment) {
      return docSnap.data().payment as PaymentSettings;
    }
  } catch (error) {
    console.error("Error fetching payment settings:", error);
  }
  return { upiId: '', upiQrUrl: '' };
};

export const updateAdminPaymentSettings = async (settings: PaymentSettings) => {
  await setDoc(doc(db, 'admin', 'settings'), { payment: settings }, { merge: true });
};

export const submitPaymentVerification = async (uid: string, email: string | null, planId: string, txnId: string) => {
  const docRef = doc(collection(db, 'payments'));
  await setDoc(docRef, {
    id: docRef.id,
    uid,
    email,
    planId,
    txnId,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const getPendingPayments = async (): Promise<PaymentTransaction[]> => {
  const q = query(collection(db, 'payments'), where("status", "==", "pending"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc: any) => doc.data() as PaymentTransaction);
};

export const approvePayment = async (txn: PaymentTransaction) => {
  // 1. Mark payment as approved
  await updateDoc(doc(db, 'payments', txn.id), { status: 'approved' });
  
  // 2. Grant plan to user
  let proRuns = 0;
  if (txn.planId === 'starter') proRuns = 10;
  if (txn.planId === 'booster') proRuns = 20;
  if (txn.planId === 'pro') proRuns = 50;

  const userRef = doc(db, 'users', txn.uid);
  const userSnap = await getDoc(userRef);
  
  let currentProRuns = 0;
  if (userSnap.exists() && userSnap.data().proRuns) {
    currentProRuns = userSnap.data().proRuns;
  }
  
  let expiresAt = new Date();
  if (txn.planId === 'starter') {
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
  } else if (txn.planId === 'booster') {
    expiresAt.setDate(expiresAt.getDate() + 14);
  } else if (txn.planId === 'pro') {
    expiresAt.setDate(expiresAt.getDate() + 30);
  }

  await setDoc(userRef, {
    plan: txn.planId,
    proRuns: currentProRuns + proRuns,
    planUpdatedAt: serverTimestamp(),
    planExpiresAt: expiresAt
  }, { merge: true });
};

export const rejectPayment = async (txnId: string) => {
  await updateDoc(doc(db, 'payments', txnId), { status: 'rejected' });
};
