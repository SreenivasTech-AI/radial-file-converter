/**
 * Firebase Configuration & Service Initializer
 * Supports:
 * - Direct config or dynamic localStorage config override
 * - Firebase Auth (Email/Password & Profile Management)
 * - Cloud Firestore Database (User Details & Conversion Logging)
 */

// Live Firebase Configuration for file-converter-78115
export const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAxIOkflZW47bIcj61fFrzlRFmaaQj1fJQ",
    authDomain: "file-converter-78115.firebaseapp.com",
    projectId: "file-converter-78115",
    storageBucket: "file-converter-78115.firebasestorage.app",
    messagingSenderId: "1076029558905",
    appId: "1:1076029558905:web:f4495e80be6d983a9404a8",
    measurementId: "G-C8ZBZL67VY"
};

export function getActiveFirebaseConfig() {
    try {
        const stored = localStorage.getItem("firebase_converter_config");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.apiKey && parsed.projectId) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn("Could not read custom Firebase config from localStorage", e);
    }
    return DEFAULT_FIREBASE_CONFIG;
}

export function saveCustomFirebaseConfig(configObj) {
    localStorage.setItem("firebase_converter_config", JSON.stringify(configObj));
}

export function isFirebaseCustomConfigured() {
    try {
        const stored = localStorage.getItem("firebase_converter_config");
        if (stored) {
            const parsed = JSON.parse(stored);
            return !!(parsed && parsed.apiKey && !parsed.apiKey.includes("Placeholder"));
        }
    } catch (e) {}
    return false;
}
