// @ts-nocheck -- ported as-is from the original kaktus app
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface ApiKeyData {
  key: string;
  label: string;
  status: 'active' | 'exhausted';
  addedAt: any;
}

export const getApiPool = async (): Promise<ApiKeyData[]> => {
  try {
    const docSnap = await getDoc(doc(db, 'admin', 'apiPool'));
    if (docSnap.exists() && docSnap.data().keys) {
      return docSnap.data().keys as ApiKeyData[];
    }
  } catch (error) {
    console.error("Error fetching API pool:", error);
  }
  return [];
};

export const updateApiPool = async (keys: ApiKeyData[]) => {
  await setDoc(doc(db, 'admin', 'apiPool'), { keys }, { merge: true });
};
