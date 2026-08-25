import fs from "fs";
import path from "path";
import { cert, initializeApp } from "firebase-admin";

/**
 * Resolves the Firebase service account credential.
 *
 * serviceAccountKey.json is gitignored, so CI-built images never contain it —
 * importing it directly crashed the container on startup. Prefer credentials
 * supplied through the environment (raw JSON or base64) and fall back to the
 * local key file for development.
 */
const loadServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "";

  if (encoded.trim()) {
    return JSON.parse(Buffer.from(encoded.trim(), "base64").toString("utf8"));
  }

  if (raw.trim()) {
    return JSON.parse(raw.trim());
  }

  const keyPath = path.resolve(import.meta.dirname, "../serviceAccountKey.json");
  if (fs.existsSync(keyPath)) {
    return JSON.parse(fs.readFileSync(keyPath, "utf8"));
  }

  return null;
};

let firebaseApp = null;

try {
  const serviceAccount = loadServiceAccount();

  if (serviceAccount) {
    firebaseApp = initializeApp({ credential: cert(serviceAccount) });
    console.log("[Firebase] Admin SDK initialized.");
  } else {
    // Keep the service alive so unrelated routes (credits, plans) still work;
    // Firebase-backed login will fail explicitly instead of killing the task.
    console.error(
      "[Firebase] No credentials found. Set FIREBASE_SERVICE_ACCOUNT_BASE64 (or FIREBASE_SERVICE_ACCOUNT), or add serviceAccountKey.json for local dev. Firebase auth routes will be unavailable."
    );
  }
} catch (error) {
  console.error("[Firebase] Failed to initialize Admin SDK:", error.message);
}

export const app = firebaseApp;
