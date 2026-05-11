import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { collection, query, where, getDocs } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  const message = `Error de Base de Datos (${operationType} en ${path}):\n\n${errInfo.error}\n\nSi el error persiste, contacte a soporte informando su email: ${errInfo.authInfo.email}`;
  if (typeof window !== 'undefined') {
    alert(message);
  }
  throw new Error(JSON.stringify(errInfo));
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch or create profile
        const profileRef = doc(db, 'users', user.uid);
        try {
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            setProfile(profileSnap.data() as UserProfile);
          } else {
            // Check if there's a pre-registered profile with this email
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            let querySnap;
            try {
              querySnap = await getDocs(q);
            } catch (err) {
              handleFirestoreError(err, OperationType.LIST, 'users');
            }
            
            let initialProfile: UserProfile;

              if (querySnap && !querySnap.empty) {
                // Use the pre-registered data
                const preRegDoc = querySnap.docs[0];
                const preRegData = preRegDoc.data() as UserProfile;
                
                initialProfile = {
                  ...preRegData,
                  uid: user.uid, // Ensure we use the real Auth UID
                  createdAt: preRegData.createdAt || serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  isPreRegistered: false,
                };

                // Link existing evaluations to this new UID
                const evRef = collection(db, 'evaluations');
                const evQuery = query(evRef, where('collaboratorEmail', '==', user.email));
                let evSnap;
                try {
                  evSnap = await getDocs(evQuery);
                } catch (err) {
                  handleFirestoreError(err, OperationType.LIST, 'evaluations');
                }
                
                if (evSnap) {
                  for (const evDoc of evSnap.docs) {
                    try {
                      await updateDoc(doc(db, 'evaluations', evDoc.id), {
                        collaboratorId: user.uid,
                        updatedAt: serverTimestamp()
                      });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `evaluations/${evDoc.id}`);
                    }
                  }
                }

                try {
                  // Create the new document with the correct UID
                  await setDoc(profileRef, initialProfile);
                  // Delete the old one if it has a different ID
                  if (preRegDoc.id !== user.uid) {
                    const { deleteDoc: deleteDocFn } = await import('firebase/firestore');
                    await deleteDocFn(doc(db, 'users', preRegDoc.id));
                  }
                } catch (err) {
                  handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
                }
              } else {
              // Create brand new profile
              initialProfile = {
                uid: user.uid,
                name: user.displayName || 'Usuario',
                email: user.email || '',
                role: user.email === 'miguelreyesduran@gmail.com' ? UserRole.ADMIN : UserRole.COLABORADOR,
                createdAt: serverTimestamp(),
              };
              try {
                await setDoc(profileRef, initialProfile);
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
              }
            }
            
            setProfile(initialProfile);
          }
        } catch (err) {
          console.error("Error in auth profile sync:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, loginWithEmail, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
