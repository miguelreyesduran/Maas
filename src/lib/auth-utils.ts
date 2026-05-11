import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export async function createNewUserWithPassword(email: string, pass: string) {
  const appName = `Secondary-${Date.now()}`;
  let secondaryApp;
  try {
    secondaryApp = initializeApp(firebaseConfig, appName);
  } catch (e) {
    secondaryApp = getApp(appName);
  }
  
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    // CRITICAL: Use in-memory persistence so this doesn't affect the main app's login state
    await setPersistence(secondaryAuth, inMemoryPersistence);
    
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const uid = userCredential.user.uid;
    
    // We don't really need to signOut if it's in-memory and we delete the app, 
    // but it doesn't hurt.
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
    return uid;
  } catch (error) {
    try {
      await deleteApp(secondaryApp);
    } catch (e) {
      console.error("Error deleting secondary app", e);
    }
    throw error;
  }
}
