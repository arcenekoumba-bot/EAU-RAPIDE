import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAvJS7EDCy96gCg3RIP7TqAZIFQCOiP9D0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "eau-rapide.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "eau-rapide",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "eau-rapide.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "795967479599",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:795967479599:web:3a0c79afa2d23d99cf8bda",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);

export const observeFirebaseUser = (callback: (user: User | null) => void) => onAuthStateChanged(firebaseAuth, callback);
export const loginWithEmail = (email: string, password: string) => signInWithEmailAndPassword(firebaseAuth, email, password);
export const registerWithEmail = (email: string, password: string) => createUserWithEmailAndPassword(firebaseAuth, email, password);
export const logoutFromFirebase = () => signOut(firebaseAuth);

export type FirebaseOrder = {
  id?: string;
  customerId: string;
  driverId: string;
  livreur: Record<string, unknown>;
  quantity: number;
  address: string;
  total: number;
  status: string;
  createdAt?: string;
};

export async function createFirebaseOrder(order: Omit<FirebaseOrder, "id" | "createdAt">) {
  const ref = await addDoc(collection(firestore, "orders"), { ...order, createdAt: serverTimestamp() });
  return ref.id;
}

export function observeCustomerOrders(userId: string, callback: (orders: FirebaseOrder[]) => void): Unsubscribe {
  const ordersQuery = query(collection(firestore, "orders"), where("customerId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(ordersQuery, snapshot => {
    callback(snapshot.docs.map(item => {
      const data = item.data();
      const timestamp = data.createdAt?.toDate?.();
      return { ...data, id: item.id, createdAt: timestamp?.toISOString() || new Date().toISOString() } as FirebaseOrder;
    }));
  }, error => console.warn("Firestore orders listener:", error.message));
}

export async function updateFirebaseOrderStatus(orderId: string, status: string) {
  await updateDoc(doc(firestore, "orders", orderId), { status });
}
