import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let client: MongoClient | null = null;
let db: Db | null = null;
let isConnecting = false;
let connectionError: any = null;

/**
 * Lazily retrieves the MongoDB connection.
 * If MONGODB_URI resides in the environment, it establishes a singleton client connection.
 * If not present or if the connection fails, it returns null to enable a smooth fallback.
 */
export async function getMongoDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (!connectionError) {
      console.warn("⚠️ MONGODB_URI is not set. Falling back to the robust in-memory database store.");
      connectionError = new Error("MONGODB_URI environment variable is missing.");
    }
    return null;
  }

  if (db) {
    return db;
  }

  if (isConnecting) {
    // Basic delay block if a connection attempt is already in flight
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (db) return db;
    }
  }

  isConnecting = true;
  try {
    console.log("🔌 Connecting to MongoDB Database...");
    
    // Setup client with 5-second connection timeouts to fail fast instead of freezing the server
    const newClient = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    
    await newClient.connect();
    client = newClient;
    db = client.db();
    
    console.log("✅ Successfully connected to MongoDB Database!");
    connectionError = null;
    return db;
  } catch (err: any) {
    console.error("❌ Failed to connect to MongoDB Database:", err.message || err);
    connectionError = err;
    client = null;
    db = null;
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * Returns connection metrics and active status.
 */
export function getDbStatus(): { status: 'connected' | 'fallback'; error: string | null } {
  if (db) {
    return { status: 'connected', error: null };
  }
  return { 
    status: 'fallback', 
    error: connectionError ? connectionError.message || String(connectionError) : "MONGODB_URI not provided." 
  };
}
