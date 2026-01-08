import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let db;
const client = new MongoClient(process.env.MONGODB_URI);

export async function connectDB() {
  try {
    if (!db) {
      await client.connect();
      db = client.db('gestion-escolar');
      console.log('✅ Conectado a MongoDB Atlas');
    }
    return db;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    throw error;
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Base de datos no conectada. Llama a connectDB() primero.');
  }
  return db;
}
