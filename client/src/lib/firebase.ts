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
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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

export type FirebaseDriver = {
  id?: string;
  name: string;
  zone: string;
  phone: string;
  product: string;
  unitPrice: number;
  available: boolean;
  approved: boolean;
  rating: number;
  deliveries: number;
  updatedAt?: string;
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

export function observeDriverProfile(userId: string, callback: (profile: FirebaseDriver | null) => void): Unsubscribe {
  return onSnapshot(doc(firestore, "drivers", userId), snapshot => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ ...snapshot.data(), id: snapshot.id } as FirebaseDriver);
  }, error => console.warn("Firestore driver profile:", error.message));
}

export async function saveDriverProfile(userId: string, profile: Omit<FirebaseDriver, "id" | "updatedAt" | "approved" | "rating" | "deliveries">) {
  const existing = await getDoc(doc(firestore, "drivers", userId));
  const current = existing.exists() ? existing.data() : {};
  await setDoc(doc(firestore, "drivers", userId), {
    ...profile,
    approved: current.approved === true,
    rating: typeof current.rating === "number" ? current.rating : 0,
    deliveries: typeof current.deliveries === "number" ? current.deliveries : 0,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setDriverAvailability(userId: string, available: boolean) {
  await updateDoc(doc(firestore, "drivers", userId), { available, updatedAt: serverTimestamp() });
}

export function observeDriverOrders(userId: string, callback: (orders: FirebaseOrder[]) => void): Unsubscribe {
  const ordersQuery = query(collection(firestore, "orders"), where("driverId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(ordersQuery, snapshot => {
    callback(snapshot.docs.map(item => {
      const data = item.data();
      const timestamp = data.createdAt?.toDate?.();
      return { ...data, id: item.id, createdAt: timestamp?.toISOString() || new Date().toISOString() } as FirebaseOrder;
    }));
  }, error => console.warn("Firestore driver orders:", error.message));
}
