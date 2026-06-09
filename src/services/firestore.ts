import { 
  collection, 
  onSnapshot, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';

// TypeScript Interfaces
export interface Stop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  completed: boolean;
  orderIndex: number;
  deliveryDay: string;
  mapLink?: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  mapLink?: string;
  phone?: string;
  email?: string;
}

export interface RouteHistory {
  id: string;
  dateMillis: number;
  day: string;
  stopsCount: number;
  stopsSummary: string;
  driverName?: string;
  duration?: string;
}

// Collection Names
const STOPS_COLLECTION = 'delivery_stops';
const CLIENTS_COLLECTION = 'clients';
const HISTORY_COLLECTION = 'route_history';

// ---------------- STOPS SERVICES ----------------

export const subscribeToStops = (callback: (stops: Stop[]) => void) => {
  const q = query(collection(db, STOPS_COLLECTION), orderBy('orderIndex', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const stops: Stop[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      stops.push({
        id: doc.id,
        name: data.name || '',
        address: data.address || '',
        latitude: Number(data.latitude) || 0,
        longitude: Number(data.longitude) || 0,
        completed: !!data.completed,
        orderIndex: data.orderIndex !== undefined ? Number(data.orderIndex) : 0,
        deliveryDay: data.deliveryDay || '',
        mapLink: data.mapLink || '',
      });
    });
    callback(stops);
  }, (error) => {
    console.error("Error subscribing to stops: ", error);
  });
};

export const addStop = async (stop: Omit<Stop, 'id'> & { id?: string }) => {
  try {
    const data = {
      name: stop.name,
      address: stop.address,
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
      completed: stop.completed,
      orderIndex: Number(stop.orderIndex),
      deliveryDay: stop.deliveryDay,
      mapLink: stop.mapLink || '',
    };
    if (stop.id) {
      await setDoc(doc(db, STOPS_COLLECTION, stop.id), data);
    } else {
      await addDoc(collection(db, STOPS_COLLECTION), data);
    }
  } catch (error) {
    console.error("Error adding stop: ", error);
    throw error;
  }
};

export const updateStop = async (id: string, updates: Partial<Omit<Stop, 'id'>>) => {
  try {
    const docRef = doc(db, STOPS_COLLECTION, id);
    const cleanUpdates: Record<string, any> = {};
    
    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.address !== undefined) cleanUpdates.address = updates.address;
    if (updates.latitude !== undefined) cleanUpdates.latitude = Number(updates.latitude);
    if (updates.longitude !== undefined) cleanUpdates.longitude = Number(updates.longitude);
    if (updates.completed !== undefined) cleanUpdates.completed = updates.completed;
    if (updates.orderIndex !== undefined) cleanUpdates.orderIndex = Number(updates.orderIndex);
    if (updates.deliveryDay !== undefined) cleanUpdates.deliveryDay = updates.deliveryDay;
    if (updates.mapLink !== undefined) cleanUpdates.mapLink = updates.mapLink;

    await updateDoc(docRef, cleanUpdates);
  } catch (error) {
    console.error("Error updating stop: ", error);
    throw error;
  }
};

export const deleteStop = async (id: string) => {
  try {
    await deleteDoc(doc(db, STOPS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting stop: ", error);
    throw error;
  }
};

// ---------------- CLIENTS SERVICES ----------------

export const subscribeToClients = (callback: (clients: Client[]) => void) => {
  const q = collection(db, CLIENTS_COLLECTION);
  return onSnapshot(q, (snapshot) => {
    const clients: Client[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      clients.push({
        id: doc.id,
        name: data.name || '',
        address: data.address || '',
        latitude: Number(data.latitude) || 0,
        longitude: Number(data.longitude) || 0,
        mapLink: data.mapLink || '',
        phone: data.phone || '',
        email: data.email || '',
      });
    });
    callback(clients);
  }, (error) => {
    console.error("Error subscribing to clients: ", error);
  });
};

export const addClient = async (client: Omit<Client, 'id'> & { id?: string }) => {
  try {
    const data = {
      name: client.name,
      address: client.address,
      latitude: Number(client.latitude),
      longitude: Number(client.longitude),
      mapLink: client.mapLink || '',
      phone: client.phone || '',
      email: client.email || '',
    };
    if (client.id) {
      await setDoc(doc(db, CLIENTS_COLLECTION, client.id), data);
    } else {
      await addDoc(collection(db, CLIENTS_COLLECTION), data);
    }
  } catch (error) {
    console.error("Error adding client: ", error);
    throw error;
  }
};

export const updateClient = async (id: string, updates: Partial<Omit<Client, 'id'>>) => {
  try {
    const docRef = doc(db, CLIENTS_COLLECTION, id);
    const cleanUpdates: Record<string, any> = {};

    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.address !== undefined) cleanUpdates.address = updates.address;
    if (updates.latitude !== undefined) cleanUpdates.latitude = Number(updates.latitude);
    if (updates.longitude !== undefined) cleanUpdates.longitude = Number(updates.longitude);
    if (updates.mapLink !== undefined) cleanUpdates.mapLink = updates.mapLink;
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone;
    if (updates.email !== undefined) cleanUpdates.email = updates.email;

    await updateDoc(docRef, cleanUpdates);
  } catch (error) {
    console.error("Error updating client: ", error);
    throw error;
  }
};

export const deleteClient = async (id: string) => {
  try {
    await deleteDoc(doc(db, CLIENTS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting client: ", error);
    throw error;
  }
};

// ---------------- HISTORY SERVICES ----------------

export const subscribeToHistory = (callback: (history: RouteHistory[]) => void) => {
  const q = query(collection(db, HISTORY_COLLECTION), orderBy('dateMillis', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const history: RouteHistory[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      history.push({
        id: doc.id,
        dateMillis: Number(data.dateMillis) || Date.now(),
        day: data.day || '',
        stopsCount: Number(data.stopsCount) || 0,
        stopsSummary: data.stopsSummary || '',
        driverName: data.driverName || '',
        duration: data.duration || '',
      });
    });
    callback(history);
  }, (error) => {
    console.error("Error subscribing to history: ", error);
  });
};

export const addHistory = async (historyItem: Omit<RouteHistory, 'id'> & { id?: string }) => {
  try {
    const data = {
      dateMillis: Number(historyItem.dateMillis),
      day: historyItem.day,
      stopsCount: Number(historyItem.stopsCount),
      stopsSummary: historyItem.stopsSummary,
      driverName: historyItem.driverName || 'Repartidor',
      duration: historyItem.duration || 'N/A',
    };
    if (historyItem.id) {
      await setDoc(doc(db, HISTORY_COLLECTION, historyItem.id), data);
    } else {
      await addDoc(collection(db, HISTORY_COLLECTION), data);
    }
  } catch (error) {
    console.error("Error adding history item: ", error);
    throw error;
  }
};

export const deleteHistory = async (id: string) => {
  try {
    await deleteDoc(doc(db, HISTORY_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting history item: ", error);
    throw error;
  }
};
