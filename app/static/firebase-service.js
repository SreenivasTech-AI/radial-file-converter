/**
 * Firebase Service Client
 * Handles:
 * - Authentication (Sign Up, Sign In, Sign Out, Auth State Observers)
 * - Cloud Firestore Database (Storing User Profile & Conversion History)
 * - Seamless Fallback between Live Firebase & Interactive Local Simulation
 */

import { getActiveFirebaseConfig, saveCustomFirebaseConfig, isFirebaseCustomConfigured } from './firebase-config.js';

let app = null;
let auth = null;
let db = null;
let isLiveFirebase = false;
let authStateListeners = [];
let currentUser = null;

// Simulated Local Database for immediate offline/out-of-the-box operation
const SIMULATED_DB_KEY = 'firebase_simulated_database_v2';
const SIMULATED_SESSION_KEY = 'firebase_simulated_session_v2';

function safeHash(str) {
    try {
        return btoa(encodeURIComponent(str || ''));
    } catch (e) {
        return 'hash_' + (str || '').length;
    }
}

function getSimulatedDb() {
    try {
        const raw = localStorage.getItem(SIMULATED_DB_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.users) {
                return parsed;
            }
        }
    } catch (e) {}
    return { users: {}, conversions: [] };
}

function saveSimulatedDb(data) {
    try {
        localStorage.setItem(SIMULATED_DB_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("[Firebase] Could not save to localStorage", e);
    }
}

// Initialize Firebase SDK
export async function initFirebase() {
    const config = getActiveFirebaseConfig();
    const isConfigured = isFirebaseCustomConfigured();

    if (isConfigured) {
        try {
            // Load modular Firebase SDK from CDN
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
            const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

            app = initializeApp(config);
            auth = getAuth(app);
            db = getFirestore(app);
            isLiveFirebase = true;

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email.split('@')[0],
                        isLive: true
                    };
                } else {
                    currentUser = null;
                }
                notifyAuthListeners(currentUser);
            });

            console.log("[Firebase] Successfully connected to Live Firebase project:", config.projectId);
            return { success: true, isLive: true, projectId: config.projectId };
        } catch (err) {
            console.warn("[Firebase] Could not initialize live Firebase. Falling back to local simulation.", err);
            isLiveFirebase = false;
        }
    }

    // Fallback: Local Simulation
    isLiveFirebase = false;
    try {
        const session = localStorage.getItem(SIMULATED_SESSION_KEY);
        if (session) {
            currentUser = JSON.parse(session);
        } else {
            currentUser = null;
        }
    } catch (e) {
        currentUser = null;
    }

    setTimeout(() => {
        notifyAuthListeners(currentUser);
    }, 30);

    return { success: true, isLive: false, projectId: "local-simulation" };
}

export function isUsingLiveFirebase() {
    return isLiveFirebase;
}

export function getCurrentUser() {
    return currentUser;
}

export function subscribeToAuth(callback) {
    authStateListeners.push(callback);
    callback(currentUser);
    return () => {
        authStateListeners = authStateListeners.filter(cb => cb !== callback);
    };
}

function notifyAuthListeners(user) {
    authStateListeners.forEach(cb => {
        try { cb(user); } catch (e) { console.error(e); }
    });
}

/**
 * Register User with Name, Email and Password
 * Stores profile cleanly in Cloud Firestore `users/{uid}`
 */
export async function registerUser(name, email, password) {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
        throw new Error("Please enter your full name (at least 2 characters).");
    }
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
        throw new Error("Please enter a valid email address (e.g. name@domain.com).");
    }
    if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
    }

    console.log("[Firebase Service] Registering user:", cleanEmail);

    if (isLiveFirebase && auth && db) {
        const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = cred.user;

        await updateProfile(user, { displayName: cleanName });

        // Store clean user profile in Cloud Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: cleanName,
            email: cleanEmail,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            convertedFilesCount: 0
        });

        currentUser = {
            uid: user.uid,
            email: cleanEmail,
            displayName: cleanName,
            isLive: true
        };
        notifyAuthListeners(currentUser);
        return currentUser;
    } else {
        // Local Simulation Register
        const sDb = getSimulatedDb();
        const existing = Object.values(sDb.users).find(u => u.email === cleanEmail);
        if (existing) {
            throw new Error("This email is already registered. Please sign in instead.");
        }

        const uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newUser = {
            uid: uid,
            name: cleanName,
            email: cleanEmail,
            passwordHash: safeHash(password),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            convertedFilesCount: 0
        };

        sDb.users[uid] = newUser;
        saveSimulatedDb(sDb);

        currentUser = {
            uid: uid,
            email: cleanEmail,
            displayName: cleanName,
            isLive: false
        };
        localStorage.setItem(SIMULATED_SESSION_KEY, JSON.stringify(currentUser));
        notifyAuthListeners(currentUser);
        console.log("[Firebase Service] Registered and stored locally in Firestore simulated DB:", currentUser);
        return currentUser;
    }
}

/**
 * Sign In User with Email and Password
 * Updates lastLoginAt in Firestore
 */
export async function loginUser(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
        throw new Error("Please enter both email and password.");
    }

    if (isLiveFirebase && auth && db) {
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const user = cred.user;

        try {
            await updateDoc(doc(db, "users", user.uid), {
                lastLoginAt: serverTimestamp()
            });
        } catch (e) {
            console.warn("Could not update lastLoginAt in firestore", e);
        }

        currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            isLive: true
        };
        notifyAuthListeners(currentUser);
        return currentUser;
    } else {
        // Local Simulation Login
        const sDb = getSimulatedDb();
        const user = Object.values(sDb.users).find(u => u.email === cleanEmail);
        if (!user) {
            throw new Error("No account found with this email. Please click 'Register' to create one.");
        }
        if (user.passwordHash !== safeHash(password) && user.passwordHash !== btoa(password)) {
            throw new Error("Incorrect password. Please verify and try again.");
        }

        user.lastLoginAt = new Date().toISOString();
        sDb.users[user.uid] = user;
        saveSimulatedDb(sDb);

        currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.name,
            isLive: false
        };
        localStorage.setItem(SIMULATED_SESSION_KEY, JSON.stringify(currentUser));
        notifyAuthListeners(currentUser);
        return currentUser;
    }
}

/**
 * Sign Out User
 */
export async function logoutUser() {
    if (isLiveFirebase && auth) {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        await signOut(auth);
    }
    currentUser = null;
    localStorage.removeItem(SIMULATED_SESSION_KEY);
    notifyAuthListeners(null);
}

/**
 * Record a completed file conversion in Firestore
 */
export async function recordConversionInDatabase(details) {
    if (!currentUser) return;

    if (isLiveFirebase && db) {
        try {
            const { collection, addDoc, doc, updateDoc, increment, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
            
            await addDoc(collection(db, "users", currentUser.uid, "conversions"), {
                filename: details.filename || "file",
                targetFormat: details.targetFormat || "unknown",
                sizeKb: details.sizeKb || 0,
                durationSec: details.durationSec || 0,
                timestamp: serverTimestamp()
            });

            await updateDoc(doc(db, "users", currentUser.uid), {
                convertedFilesCount: increment(1),
                lastConversionAt: serverTimestamp()
            });
        } catch (e) {
            console.warn("Could not save conversion to Firestore:", e);
        }
    } else {
        // Local simulation record
        try {
            const sDb = getSimulatedDb();
            if (sDb.users[currentUser.uid]) {
                sDb.users[currentUser.uid].convertedFilesCount = (sDb.users[currentUser.uid].convertedFilesCount || 0) + 1;
            }
            sDb.conversions.push({
                uid: currentUser.uid,
                filename: details.filename,
                targetFormat: details.targetFormat,
                sizeKb: details.sizeKb,
                durationSec: details.durationSec,
                timestamp: new Date().toISOString()
            });
            saveSimulatedDb(sDb);
        } catch (e) {}
    }
}
