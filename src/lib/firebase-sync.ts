import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore'; 
import { db } from './firebase'; 
import { CHAT_SESSION_REGISTRY_KEY, chatSessionKey, workspaceSessionKey } from './session-store'; 

export async function syncToFirebase(uid: string, registry: any, workspaces: any, chats: any) { 
  if(!uid) return; 
  try { 
    await setDoc(doc(db, 'users', uid, 'data', 'registry'), { payload: JSON.stringify(registry) }); 
    
    const usageStr = localStorage.getItem(`gemini_key_usage_stats_${uid}`);
    if (usageStr) {
      await setDoc(doc(db, 'users', uid, 'data', 'usage'), { payload: usageStr });
    }

    for(let id in workspaces) { 
      await setDoc(doc(db, 'users', uid, 'workspaces', id), { payload: JSON.stringify(workspaces[id]) }); 
    } 
    for(let id in chats) { 
      await setDoc(doc(db, 'users', uid, 'chats', id), { payload: JSON.stringify(chats[id]) }); 
    } 
  } catch(e) { 
    console.error('Sync failed', e); 
  } 
} 

export async function loadFromFirebase(uid: string) { 
  if(!uid) return false; 
  try { 
    const regSnap = await getDoc(doc(db, 'users', uid, 'data', 'registry')); 
    if(!regSnap.exists()) return false; 
    
    const registryStr = regSnap.data().payload; 
    localStorage.setItem(CHAT_SESSION_REGISTRY_KEY(uid), registryStr); 
    
    const usageSnap = await getDoc(doc(db, 'users', uid, 'data', 'usage'));
    if (usageSnap.exists() && usageSnap.data().payload) {
      localStorage.setItem(`gemini_key_usage_stats_${uid}`, usageSnap.data().payload);
    }

    const wsSnap = await getDocs(collection(db, 'users', uid, 'workspaces')); 
    wsSnap.forEach((d: any) => localStorage.setItem(workspaceSessionKey(d.id, uid), d.data().payload)); 
    
    const chatSnap = await getDocs(collection(db, 'users', uid, 'chats')); 
    chatSnap.forEach((d: any) => localStorage.setItem(chatSessionKey(d.id, uid), d.data().payload)); 
    
    return true; 
  } catch(e) { 
    console.error('Load failed', e); 
    return false; 
  } 
}
