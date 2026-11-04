/**
 * Radial Drag & Drop File Converter
 * Clean, Self-Contained, High-Contrast Dark UI
 * Integrated Firebase Authentication & Cloud Firestore Database
 * - Login & Registration Gate
 * - Local & Live Cloud Firebase Engine
 * - Interactive Canvas Particles, Confetti Bursts, Shockwave Ripples
 * - Web Audio Synthesizer Haptics
 */

(function () {
    'use strict';

    // ==============================================================
    // 1. FIREBASE AUTH & FIRESTORE DATABASE ENGINE
    // ==============================================================
    const DB_STORAGE_KEY = 'firebase_db_store_v3';
    const SESSION_STORAGE_KEY = 'firebase_session_v3';
    const CONFIG_STORAGE_KEY = 'firebase_user_config_v3';

    const DEFAULT_CONFIG = {
        apiKey: "AIzaSyAxIOkflZW47bIcj61fFrzlRFmaaQj1fJQ",
        authDomain: "file-converter-78115.firebaseapp.com",
        projectId: "file-converter-78115",
        storageBucket: "file-converter-78115.firebasestorage.app",
        messagingSenderId: "1076029558905",
        appId: "1:1076029558905:web:f4495e80be6d983a9404a8",
        measurementId: "G-C8ZBZL67VY"
    };

    function getFirebaseConfig() {
        try {
            const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.apiKey && parsed.projectId && !parsed.apiKey.includes('Placeholder') && !parsed.apiKey.includes('Demo')) {
                    return parsed;
                }
            }
        } catch (e) {}
        return DEFAULT_CONFIG;
    }

    function isLiveFirebaseConfigured() {
        const cfg = getFirebaseConfig();
        return Boolean(cfg && cfg.apiKey && !cfg.apiKey.includes('Placeholder') && !cfg.apiKey.includes('Demo'));
    }

    function getLocalDb() {
        try {
            const raw = localStorage.getItem(DB_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.users) return parsed;
            }
        } catch (e) {}
        return { users: {}, conversions: [] };
    }

    function saveLocalDb(data) {
        try {
            localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn("[DB] Could not save to localStorage", e);
        }
    }

    function safeHash(str) {
        try {
            return btoa(encodeURIComponent(str || ''));
        } catch (e) {
            return 'hash_' + (str || '').length;
        }
    }

    let currentUser = null;
    let authListeners = [];

    function initAuthSession() {
        try {
            const raw = localStorage.getItem(SESSION_STORAGE_KEY);
            if (raw) {
                currentUser = JSON.parse(raw);
            }
        } catch (e) {
            currentUser = null;
        }
    }

    function notifyAuthSubscribers() {
        authListeners.forEach(cb => {
            try { cb(currentUser); } catch (e) { console.error(e); }
        });
    }

    function subscribeAuth(callback) {
        authListeners.push(callback);
        callback(currentUser);
    }

    /**
     * Register a new user
     * Stores user profile in Firestore
     */
    async function registerUser(name, email, password) {
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

        // Live Firebase REST API
        if (isLiveFirebaseConfigured()) {
            const cfg = getFirebaseConfig();
            try {
                // 1. Firebase Auth Sign Up
                const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cleanEmail, password: password, returnSecureToken: true })
                });
                const authData = await authRes.json();
                if (!authRes.ok) {
                    const rawMsg = authData.error?.message || "Firebase registration failed.";
                    if (rawMsg === "EMAIL_EXISTS") {
                        throw new Error("This email is already registered. Please click 'Sign In' instead.");
                    }
                    if (rawMsg === "OPERATION_NOT_ALLOWED") {
                        throw new Error("Email/Password is not enabled in your Firebase Console. Go to Authentication > Sign-in method > Enable 'Email/Password'.");
                    }
                    if (rawMsg.includes("WEAK_PASSWORD")) {
                        throw new Error("Password is too weak. Please use at least 6 characters.");
                    }
                    throw new Error(rawMsg);
                }

                const uid = authData.localId;
                const idToken = authData.idToken;

                // 2. Set Display Name
                await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${cfg.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken: idToken, displayName: cleanName, returnSecureToken: true })
                });

                // 3. Write User Profile in Cloud Firestore
                await fetch(`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/users/${uid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({
                        fields: {
                            uid: { stringValue: uid },
                            name: { stringValue: cleanName },
                            email: { stringValue: cleanEmail },
                            createdAt: { timestampValue: new Date().toISOString() },
                            lastLoginAt: { timestampValue: new Date().toISOString() },
                            convertedFilesCount: { integerValue: "0" }
                        }
                    })
                });

                currentUser = {
                    uid: uid,
                    name: cleanName,
                    email: cleanEmail,
                    idToken: idToken,
                    isLive: true
                };
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser));
                notifyAuthSubscribers();
                return currentUser;
            } catch (liveErr) {
                console.warn("[Firebase Live] Failed, checking local fallback:", liveErr);
                throw liveErr;
            }
        }

        // Local Simulation Database
        const db = getLocalDb();
        const existing = Object.values(db.users).find(u => u.email === cleanEmail);
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

        db.users[uid] = newUser;
        saveLocalDb(db);

        currentUser = {
            uid: uid,
            name: cleanName,
            email: cleanEmail,
            isLive: false
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser));
        notifyAuthSubscribers();
        return currentUser;
    }

    /**
     * Sign In existing user
     */
    async function loginUser(email, password) {
        const cleanEmail = (email || '').trim().toLowerCase();

        if (!cleanEmail || !password) {
            throw new Error("Please enter both email and password.");
        }

        // Live Firebase Sign In
        if (isLiveFirebaseConfigured()) {
            const cfg = getFirebaseConfig();
            const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail, password: password, returnSecureToken: true })
            });
            const authData = await authRes.json();
            if (!authRes.ok) {
                const msg = authData.error?.message;
                if (msg === 'EMAIL_NOT_FOUND') throw new Error("No account found with this email. Please register first.");
                if (msg === 'INVALID_PASSWORD' || msg === 'INVALID_LOGIN_CREDENTIALS') throw new Error("Incorrect email or password. Please verify.");
                if (msg === 'USER_DISABLED') throw new Error("This user account has been disabled by an administrator in Firebase Console.");
                if (msg === 'OPERATION_NOT_ALLOWED') throw new Error("Email/Password provider is disabled in Firebase Console. Go to Authentication > Sign-in method and enable 'Email/Password'.");
                throw new Error(msg || "Firebase authentication failed.");
            }

            const uid = authData.localId;
            const idToken = authData.idToken;
            const name = authData.displayName || cleanEmail.split('@')[0];

            // Update lastLoginAt in Cloud Firestore in background
            try {
                fetch(`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=lastLoginAt`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({
                        fields: {
                            lastLoginAt: { timestampValue: new Date().toISOString() }
                        }
                    })
                }).catch(() => {});
            } catch (e) {}

            currentUser = {
                uid: uid,
                name: name,
                email: cleanEmail,
                idToken: idToken,
                isLive: true
            };
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser));
            notifyAuthSubscribers();
            return currentUser;
        }

        // Local Simulation Login
        const db = getLocalDb();
        const user = Object.values(db.users).find(u => u.email === cleanEmail);
        if (!user) {
            throw new Error("No account found with this email. Click 'Register' to create one.");
        }
        if (user.passwordHash !== safeHash(password)) {
            throw new Error("Incorrect password. Please verify and try again.");
        }

        user.lastLoginAt = new Date().toISOString();
        db.users[user.uid] = user;
        saveLocalDb(db);

        currentUser = {
            uid: user.uid,
            name: user.name,
            email: user.email,
            isLive: false
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser));
        notifyAuthSubscribers();
        return currentUser;
    }

    function logoutUser() {
        currentUser = null;
        localStorage.removeItem(SESSION_STORAGE_KEY);
        notifyAuthSubscribers();
    }

    async function recordConversionInFirestore(details) {
        if (!currentUser) return;

        // If Live Firebase
        if (currentUser.isLive && currentUser.idToken) {
            const cfg = getFirebaseConfig();
            try {
                await fetch(`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/users/${currentUser.uid}/conversions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentUser.idToken}` },
                    body: JSON.stringify({
                        fields: {
                            filename: { stringValue: details.filename || "file" },
                            targetFormat: { stringValue: details.targetFormat || "unknown" },
                            sizeKb: { doubleValue: details.sizeKb || 0 },
                            durationSec: { doubleValue: details.durationSec || 0 },
                            timestamp: { timestampValue: new Date().toISOString() }
                        }
                    })
                });
            } catch (e) {
                console.warn("[Firestore] Failed to log conversion:", e);
            }
            return;
        }

        // Local Database Record
        try {
            const db = getLocalDb();
            if (db.users[currentUser.uid]) {
                db.users[currentUser.uid].convertedFilesCount = (db.users[currentUser.uid].convertedFilesCount || 0) + 1;
            }
            db.conversions.push({
                uid: currentUser.uid,
                filename: details.filename,
                targetFormat: details.targetFormat,
                sizeKb: details.sizeKb,
                durationSec: details.durationSec,
                timestamp: new Date().toISOString()
            });
            saveLocalDb(db);
        } catch (e) {}
    }

    // ==============================================================
    // 2. MAIN APPLICATION WORKSPACE & USER INTERACTION
    // ==============================================================
    function initApp() {
        // Initialize Lucide Icons immediately
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }

        // Core Format Definitions
        const ALL_FORMAT_DEFS = {
            pdf:  { id: 'pdf',  label: 'PDF',       ext: '.pdf',  sub: 'PDF Document',                 icon: 'file-down', color: '#ef4444', strokeColor: '#f87171' },
            docx: { id: 'docx', label: 'Word',      ext: '.docx', sub: 'Microsoft Word',               icon: 'file-text', color: '#3b82f6', strokeColor: '#60a5fa' },
            png:  { id: 'png',  label: 'PNG',       ext: '.png',  sub: 'Images with transparency',     icon: 'image',     color: '#a855f7', strokeColor: '#c084fc' },
            jpg:  { id: 'jpg',  label: 'JPG',       ext: '.jpg',  sub: 'Compressed photos',            icon: 'camera',    color: '#10b981', strokeColor: '#34d399' },
            gif:  { id: 'gif',  label: 'GIF',       ext: '.gif',  sub: 'Animated / low-color',         icon: 'film',      color: '#ec4899', strokeColor: '#f472b6' },
            txt:  { id: 'txt',  label: 'Text',      ext: '.txt',  sub: 'Clean plaintext',              icon: 'file-code', color: '#f59e0b', strokeColor: '#fbbf24' },
            zip:  { id: 'zip',  label: 'All (ZIP)', ext: '.zip',  sub: 'All-in-one ZIP Folder',        icon: 'archive',   color: '#06b6d4', strokeColor: '#22d3ee' },
        };

        const STREAMLINED_FORMATS = {
            docx: [ALL_FORMAT_DEFS.pdf, ALL_FORMAT_DEFS.png, ALL_FORMAT_DEFS.jpg, ALL_FORMAT_DEFS.gif, ALL_FORMAT_DEFS.txt, ALL_FORMAT_DEFS.zip],
            pdf:  [ALL_FORMAT_DEFS.docx, ALL_FORMAT_DEFS.png, ALL_FORMAT_DEFS.jpg, ALL_FORMAT_DEFS.gif, ALL_FORMAT_DEFS.txt, ALL_FORMAT_DEFS.zip],
            image:[ALL_FORMAT_DEFS.pdf, ALL_FORMAT_DEFS.docx, ALL_FORMAT_DEFS.png, ALL_FORMAT_DEFS.jpg, ALL_FORMAT_DEFS.gif, ALL_FORMAT_DEFS.txt, ALL_FORMAT_DEFS.zip],
            text: [ALL_FORMAT_DEFS.pdf, ALL_FORMAT_DEFS.docx, ALL_FORMAT_DEFS.png, ALL_FORMAT_DEFS.jpg, ALL_FORMAT_DEFS.gif, ALL_FORMAT_DEFS.zip],
            default:[ALL_FORMAT_DEFS.pdf, ALL_FORMAT_DEFS.docx, ALL_FORMAT_DEFS.png, ALL_FORMAT_DEFS.jpg, ALL_FORMAT_DEFS.gif, ALL_FORMAT_DEFS.txt, ALL_FORMAT_DEFS.zip]
        };

        let loadedFile = null;
        let currentFormats = STREAMLINED_FORMATS.default;
        let autoDownload = true;
        let isDraggingFile = false;
        let currentDragTarget = null;
        let lastHoveredId = null;
        let activeConvertedRecord = null;

        // DOM Element Lookups
        const radialStage = document.getElementById('radialStage');
        const stageLockOverlay = document.getElementById('stageLockOverlay');
        const surroundingPodsContainer = document.getElementById('surroundingPodsContainer');
        const spokesGroup = document.getElementById('spokesGroup');
        const laserBeam = document.getElementById('laserBeam');
        const centerUploader = document.getElementById('centerUploader');
        const centerStateIdle = document.getElementById('centerStateIdle');
        const centerStateLoaded = document.getElementById('centerStateLoaded');
        const loadedFileName = document.getElementById('loadedFileName');
        const loadedFileMeta = document.getElementById('loadedFileMeta');
        const replaceFileBtn = document.getElementById('replaceFileBtn');
        const fileInput = document.getElementById('fileInput');
        const shockwaveContainer = document.getElementById('shockwaveContainer');

        // Navigation & Session
        const authHeaderButtons = document.getElementById('authHeaderButtons');
        const headerSignInBtn = document.getElementById('headerSignInBtn');
        const headerRegisterBtn = document.getElementById('headerRegisterBtn');
        const stageRegisterBtn = document.getElementById('stageRegisterBtn');
        const stageSignInBtn = document.getElementById('stageSignInBtn');
        const userProfilePill = document.getElementById('userProfilePill');
        const userInitials = document.getElementById('userInitials');
        const userNameHeader = document.getElementById('userNameHeader');
        const userEmailHeader = document.getElementById('userEmailHeader');
        const logoutBtn = document.getElementById('logoutBtn');

        // Auth Modal Elements
        const authModal = document.getElementById('authModal');
        const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
        const authModalTitle = document.getElementById('authModalTitle');
        const authModalSubtitle = document.getElementById('authModalSubtitle');
        const authTabSignIn = document.getElementById('authTabSignIn');
        const authTabRegister = document.getElementById('authTabRegister');
        const authAlertBox = document.getElementById('authAlertBox');
        const authAlertText = document.getElementById('authAlertText');
        const signInForm = document.getElementById('signInForm');
        const signInEmail = document.getElementById('signInEmail');
        const signInPassword = document.getElementById('signInPassword');
        const signInSubmitBtn = document.getElementById('signInSubmitBtn');
        const switchToRegisterBtn = document.getElementById('switchToRegisterBtn');
        const registerForm = document.getElementById('registerForm');
        const registerName = document.getElementById('registerName');
        const registerEmail = document.getElementById('registerEmail');
        const registerPassword = document.getElementById('registerPassword');
        const registerPasswordConfirm = document.getElementById('registerPasswordConfirm');
        const registerSubmitBtn = document.getElementById('registerSubmitBtn');
        const switchToSignInBtn = document.getElementById('switchToSignInBtn');
        const quickDemoLoginBtn = document.getElementById('quickDemoLoginBtn');

        // Progress & Notification Modals
        const conversionModal = document.getElementById('conversionModal');
        const modalFormatTitle = document.getElementById('modalFormatTitle');
        const modalProgressDetail = document.getElementById('modalProgressDetail');
        const modalProgressBar = document.getElementById('modalProgressBar');
        const modalPdfName = document.getElementById('modalPdfName');
        const resultToast = document.getElementById('resultToast');
        const resultTimeBadge = document.getElementById('resultTimeBadge');
        const resultFileName = document.getElementById('resultFileName');
        const downloadResultBtn = document.getElementById('downloadResultBtn');
        const previewResultBtn = document.getElementById('previewResultBtn');
        const closeToastBtn = document.getElementById('closeToastBtn');
        const previewModal = document.getElementById('previewModal');
        const previewTitle = document.getElementById('previewTitle');
        const previewBody = document.getElementById('previewBody');
        const previewDownloadDirect = document.getElementById('previewDownloadDirect');
        const closePreviewBtn = document.getElementById('closePreviewBtn');

        // ==============================================================
        // CANVAS PARTICLES & CONFETTI
        // ==============================================================
        const canvas = document.getElementById('particleCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        let confettiParticles = [];

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        for (let i = 0; i < 50; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                radius: Math.random() * 2 + 1,
                color: ['#818cf8', '#c084fc', '#38bdf8', '#f472b6', '#34d399', '#fbbf24'][Math.floor(Math.random() * 6)],
                alpha: Math.random() * 0.4 + 0.2
            });
        }

        function spawnConfetti(originX, originY) {
            const colors = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#06b6d4'];
            for (let i = 0; i < 80; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 9 + 4;
                confettiParticles.push({
                    x: originX,
                    y: originY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 3,
                    size: Math.random() * 7 + 4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    rotation: Math.random() * 360,
                    vRot: (Math.random() - 0.5) * 15,
                    gravity: 0.22,
                    alpha: 1,
                    decay: Math.random() * 0.015 + 0.012
                });
            }
        }

        function spawnShockwave(stageX, stageY) {
            const ring = document.createElement('div');
            ring.className = 'shockwave-ring';
            ring.style.left = `${stageX}px`;
            ring.style.top = `${stageY}px`;
            ring.style.width = '70px';
            ring.style.height = '70px';
            shockwaveContainer.appendChild(ring);
            setTimeout(() => { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 760);
        }

        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;

            for (let i = confettiParticles.length - 1; i >= 0; i--) {
                const c = confettiParticles[i];
                c.x += c.vx;
                c.y += c.vy;
                c.vy += c.gravity;
                c.rotation += c.vRot;
                c.alpha -= c.decay;

                if (c.alpha <= 0) {
                    confettiParticles.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.globalAlpha = Math.max(0, c.alpha);
                ctx.translate(c.x, c.y);
                ctx.rotate((c.rotation * Math.PI) / 180);
                ctx.fillStyle = c.color;
                ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.65);
                ctx.restore();
            }

            requestAnimationFrame(animateParticles);
        }
        animateParticles();

        // ==============================================================
        // AUDIO HAPTICS
        // ==============================================================
        let audioCtx = null;
        function getAudioContext() {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            return audioCtx;
        }

        function playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.1) {
            try {
                const actx = getAudioContext();
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, actx.currentTime);
                gain.gain.setValueAtTime(gainVal, actx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + duration);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start();
                osc.stop(actx.currentTime + duration);
            } catch (e) {}
        }

        function playTick() { playTone(720, 'sine', 0.035, 0.08); }
        function playDropSound() { playTone(240, 'triangle', 0.16, 0.16); }
        function playSuccess() {
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                setTimeout(() => playTone(freq, 'sine', 0.15, 0.13), i * 65);
            });
        }
        function playAuthChime() {
            [440, 554.37, 659.25].forEach((freq, i) => {
                setTimeout(() => playTone(freq, 'sine', 0.12, 0.1), i * 70);
            });
        }
        function playAlertTone() { playTone(180, 'sawtooth', 0.2, 0.12); }

        function detectCategory(filename) {
            if (!filename) return 'docx';
            const ext = '.' + filename.split('.').pop().toLowerCase();
            if (['.docx', '.doc'].includes(ext)) return 'docx';
            if (['.pdf'].includes(ext)) return 'pdf';
            if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
            if (['.txt', '.rtf', '.log'].includes(ext)) return 'text';
            return 'docx';
        }

        // ==============================================================
        // RADIAL PODS RENDERING
        // ==============================================================
        const centerX = 280;
        const centerY = 280;
        const orbitRadius = 205;

        function renderRadialPods(formats) {
            currentFormats = formats;
            surroundingPodsContainer.innerHTML = '';
            spokesGroup.innerHTML = '';

            const total = formats.length;
            const startAngle = -Math.PI / 2;

            formats.forEach((fmt, index) => {
                const angle = startAngle + (index * (2 * Math.PI / total));
                const podX = centerX + orbitRadius * Math.cos(angle);
                const podY = centerY + orbitRadius * Math.sin(angle);

                const spoke = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                spoke.setAttribute('x1', centerX);
                spoke.setAttribute('y1', centerY);
                spoke.setAttribute('x2', podX);
                spoke.setAttribute('y2', podY);
                spoke.setAttribute('class', 'spoke-line');
                spoke.setAttribute('id', `spoke-${fmt.id}`);
                spokesGroup.appendChild(spoke);

                const pod = document.createElement('div');
                pod.className = 'radial-pod';
                pod.dataset.format = fmt.id;
                pod.dataset.x = podX;
                pod.dataset.y = podY;
                pod.style.left = `${(podX / 560) * 100}%`;
                pod.style.top = `${(podY / 560) * 100}%`;
                pod.title = `Convert to ${fmt.label} (${fmt.ext}) - ${fmt.sub}`;

                pod.innerHTML = `
                    <div class="w-9 h-9 rounded-full flex items-center justify-center mb-0.5" style="background: ${fmt.color}22; color: ${fmt.strokeColor || fmt.color}; border: 1.5px solid ${fmt.color}55;">
                        <i data-lucide="${fmt.icon}" class="w-5 h-5"></i>
                    </div>
                    <span class="text-xs font-extrabold text-white leading-none tracking-tight">${fmt.label}</span>
                    <span class="text-[9px] font-mono text-slate-300 font-semibold mt-0.5">${fmt.ext}</span>
                    <div class="pod-badge" style="background: ${fmt.color}; box-shadow: 0 0 14px ${fmt.color}80;">${fmt.ext.toUpperCase()}</div>
                `;

                pod.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!currentUser) {
                        showAuthPrompt("Please sign in or register to convert files.");
                        return;
                    }
                    if (loadedFile) {
                        spawnShockwave(podX, podY);
                        executeConversion(loadedFile, fmt.id);
                    } else {
                        fileInput.dataset.targetFormat = fmt.id;
                        fileInput.click();
                    }
                });

                pod.addEventListener('mouseenter', () => {
                    spoke.classList.add('active');
                    spoke.style.stroke = fmt.strokeColor;
                });
                pod.addEventListener('mouseleave', () => {
                    if (!pod.classList.contains('hover-drag')) {
                        spoke.classList.remove('active');
                        spoke.style.stroke = '';
                    }
                });

                surroundingPodsContainer.appendChild(pod);
            });

            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }

        renderRadialPods(STREAMLINED_FORMATS.default);

        function updateWheelForFile(file) {
            const category = detectCategory(file.name);
            const availableFormats = STREAMLINED_FORMATS[category] || STREAMLINED_FORMATS.docx;
            renderRadialPods(availableFormats);
            setLoadedFile(file);
        }

        function setLoadedFile(file) {
            loadedFile = file;
            centerStateIdle.classList.add('hidden');
            centerStateLoaded.classList.remove('hidden');
            loadedFileName.textContent = file.name;
            
            const sizeStr = (file.size > 1024 * 1024) 
                ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
                : `${Math.round(file.size / 1024)} KB`;
            loadedFileMeta.textContent = `${sizeStr} • Ready`;

            playDropSound();
            spawnShockwave(280, 280);
        }

        centerUploader.addEventListener('click', () => {
            if (!currentUser) {
                showAuthPrompt("Please sign in or register to upload files.");
                return;
            }
            fileInput.dataset.targetFormat = '';
            fileInput.click();
        });

        replaceFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentUser) {
                showAuthPrompt("Please sign in or register to upload files.");
                return;
            }
            fileInput.dataset.targetFormat = '';
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (!currentUser) {
                showAuthPrompt("Please sign in or register to convert files.");
                fileInput.value = '';
                return;
            }
            if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const targetFormat = fileInput.dataset.targetFormat || null;
                updateWheelForFile(file);
                if (targetFormat) {
                    executeConversion(file, targetFormat);
                }
                fileInput.value = '';
            }
        });

        // ==============================================================
        // DRAG & DROP LOGIC
        // ==============================================================
        let dragDepth = 0;

        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragDepth++;
            if (dragDepth === 1) {
                isDraggingFile = true;
                document.body.classList.add('is-dragging');
                laserBeam.style.opacity = '1';
                playTone(450, 'sine', 0.05, 0.04);
            }
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragDepth--;
            if (dragDepth <= 0) {
                dragDepth = 0;
                resetDragHighlights();
            }
        });

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            handleDragProximity(e.clientX, e.clientY);
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDepth = 0;
            const target = currentDragTarget;
            resetDragHighlights();

            if (!currentUser) {
                showAuthPrompt("Please sign in or register to convert dropped files.");
                return;
            }

            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                updateWheelForFile(file);

                if (target && target !== 'center') {
                    executeConversion(file, target);
                }
            }
        });

        function resetDragHighlights() {
            isDraggingFile = false;
            document.body.classList.remove('is-dragging');
            centerUploader.classList.remove('drag-active');
            document.querySelectorAll('.radial-pod').forEach(pod => pod.classList.remove('hover-drag'));
            document.querySelectorAll('.spoke-line').forEach(spoke => {
                spoke.classList.remove('active');
                spoke.style.stroke = '';
            });
            laserBeam.style.opacity = '0';
            currentDragTarget = null;
            lastHoveredId = null;
        }

        function handleDragProximity(clientX, clientY) {
            const stageRect = radialStage.getBoundingClientRect();
            const relX = clientX - (stageRect.left + stageRect.width / 2);
            const relY = clientY - (stageRect.top + stageRect.height / 2);
            const distFromCenter = Math.hypot(relX, relY);

            const svgX = 280 + (relX / (stageRect.width / 2)) * 280;
            const svgY = 280 + (relY / (stageRect.height / 2)) * 280;

            let closestPod = null;
            let minDist = 75;

            document.querySelectorAll('.radial-pod').forEach(pod => {
                const px = parseFloat(pod.dataset.x);
                const py = parseFloat(pod.dataset.y);
                const d = Math.hypot(svgX - px, svgY - py);
                if (d < minDist) {
                    minDist = d;
                    closestPod = pod;
                }
            });

            if (closestPod) {
                const formatId = closestPod.dataset.format;
                if (lastHoveredId !== formatId) {
                    playTick();
                    lastHoveredId = formatId;
                }
                currentDragTarget = formatId;
                closestPod.classList.add('hover-drag');
                centerUploader.classList.remove('drag-active');

                const px = parseFloat(closestPod.dataset.x);
                const py = parseFloat(closestPod.dataset.y);
                laserBeam.setAttribute('x2', px);
                laserBeam.setAttribute('y2', py);
                laserBeam.style.opacity = '1';

                const spoke = document.getElementById(`spoke-${formatId}`);
                if (spoke) spoke.classList.add('active');
                return;
            }

            if (distFromCenter < 120) {
                if (lastHoveredId !== 'center') {
                    playTick();
                    lastHoveredId = 'center';
                }
                currentDragTarget = 'center';
                centerUploader.classList.add('drag-active');
                document.querySelectorAll('.radial-pod').forEach(pod => pod.classList.remove('hover-drag'));
                laserBeam.style.opacity = '0';
                return;
            }

            lastHoveredId = null;
            currentDragTarget = null;
            centerUploader.classList.remove('drag-active');
            document.querySelectorAll('.radial-pod').forEach(pod => pod.classList.remove('hover-drag'));
            laserBeam.setAttribute('x2', svgX);
            laserBeam.setAttribute('y2', svgY);
            laserBeam.style.opacity = '0.6';
        }

        // ==============================================================
        // CONVERSION EXECUTION
        // ==============================================================
        async function executeConversion(file, targetFormat) {
            if (!currentUser) {
                showAuthPrompt("Please sign in or register before converting.");
                return;
            }

            const fmtObj = currentFormats.find(f => f.id === targetFormat) || { label: targetFormat.toUpperCase(), ext: `.${targetFormat}` };

            modalFormatTitle.textContent = `Converting to ${fmtObj.label}`;
            modalProgressDetail.textContent = `Rendering format...`;
            modalPdfName.textContent = file.name;
            modalProgressBar.style.width = '25%';
            conversionModal.classList.remove('hidden');

            let prog = 25;
            const progressTimer = setInterval(() => {
                prog = Math.min(prog + 15, 88);
                modalProgressBar.style.width = `${prog}%`;
            }, 110);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('format', targetFormat);

            try {
                const response = await fetch('/api/convert', {
                    method: 'POST',
                    body: formData
                });

                clearInterval(progressTimer);
                modalProgressBar.style.width = '100%';

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || 'Conversion failed');
                }

                const data = await response.json();
                activeConvertedRecord = data;

                playSuccess();
                const stageRect = radialStage.getBoundingClientRect();
                spawnConfetti(stageRect.left + stageRect.width / 2, stageRect.top + stageRect.height / 2);

                // Log conversion cleanly in Cloud Firestore database
                await recordConversionInFirestore({
                    filename: file.name,
                    targetFormat: targetFormat,
                    convertedFilename: data.filename,
                    sizeKb: data.size_kb,
                    durationSec: data.duration_sec
                });

                setTimeout(() => {
                    conversionModal.classList.add('hidden');
                    displayToast(data, fmtObj);

                    if (autoDownload) {
                        triggerDownload(data.download_url, data.filename);
                    }
                }, 200);

            } catch (error) {
                clearInterval(progressTimer);
                conversionModal.classList.add('hidden');
                alert(`Error: ${error.message}`);
            }
        }

        function triggerDownload(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function displayToast(data, fmtObj) {
            resultFileName.textContent = data.filename;
            resultTimeBadge.textContent = `${data.duration_sec}s (${data.size_kb} KB)`;
            downloadResultBtn.href = data.download_url;
            downloadResultBtn.download = data.filename;
            resultToast.classList.remove('hidden');
        }

        closeToastBtn.addEventListener('click', () => {
            resultToast.classList.add('hidden');
        });

        function escapeHtml(text) {
            return (text || '').replace(/[&<>"']/g, m => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
            })[m]);
        }

        previewResultBtn.addEventListener('click', async () => {
            if (!activeConvertedRecord) return;
            const { format, filename, download_url } = activeConvertedRecord;

            previewTitle.textContent = filename;
            previewDownloadDirect.href = download_url;
            previewDownloadDirect.download = filename;
            previewBody.innerHTML = '<div class="py-10 text-center text-slate-500">Loading preview...</div>';
            previewModal.classList.remove('hidden');

            try {
                if (format === 'txt') {
                    const res = await fetch(download_url);
                    const text = await res.text();
                    previewBody.innerHTML = `<pre class="whitespace-pre-wrap font-mono text-slate-200 text-xs">${escapeHtml(text)}</pre>`;
                } else if (['png', 'jpg', 'jpeg', 'gif'].includes(format)) {
                    previewBody.innerHTML = `<div class="flex justify-center"><img src="${download_url}" class="max-w-full max-h-[65vh] rounded-lg shadow-2xl border border-slate-700"></div>`;
                } else if (format === 'pdf') {
                    previewBody.innerHTML = `<iframe src="${download_url}" class="w-full h-[65vh] border-0 rounded-lg"></iframe>`;
                } else if (format === 'zip') {
                    previewBody.innerHTML = `
                        <div class="py-12 flex flex-col items-center justify-center text-center">
                            <div class="w-16 h-16 rounded-2xl bg-cyan-950/70 border border-cyan-500/50 flex items-center justify-center text-cyan-400 mb-3 shadow-lg shadow-cyan-500/20">
                                <i data-lucide="archive" class="w-8 h-8"></i>
                            </div>
                            <p class="text-sm font-extrabold text-white mb-1">${filename}</p>
                            <p class="text-xs text-slate-400 mb-4">All-in-One ZIP folder containing all converted formats</p>
                            <a href="${download_url}" download="${filename}" class="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2">
                                <i data-lucide="download" class="w-4 h-4"></i>
                                <span>Download All-in-One ZIP</span>
                            </a>
                        </div>
                    `;
                    if (window.lucide) window.lucide.createIcons();
                } else {
                    previewBody.innerHTML = `
                        <div class="py-12 flex flex-col items-center justify-center text-center">
                            <div class="w-16 h-16 rounded-2xl bg-indigo-950/70 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-3">
                                <i data-lucide="file-check-2" class="w-8 h-8"></i>
                            </div>
                            <p class="text-sm font-bold text-white mb-1">${filename}</p>
                            <a href="${download_url}" download="${filename}" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2">
                                <i data-lucide="download" class="w-4 h-4"></i>
                                <span>Download Converted File</span>
                            </a>
                        </div>
                    `;
                    if (window.lucide) window.lucide.createIcons();
                }
            } catch (e) {
                previewBody.innerHTML = `<div class="text-rose-500 py-6">Could not load preview: ${e.message}</div>`;
            }
        });

        closePreviewBtn.addEventListener('click', () => {
            previewModal.classList.add('hidden');
        });

        // ==============================================================
        // 3. AUTH MODAL INTERACTION & BUTTON HANDLERS
        // ==============================================================
        function showAuthPrompt(message = null) {
            playAlertTone();
            if (stageLockOverlay) {
                stageLockOverlay.classList.remove('unlocked');
                stageLockOverlay.classList.add('animate-shake');
                setTimeout(() => stageLockOverlay.classList.remove('animate-shake'), 450);
            }
            openAuthModal('register', message);
        }

        function openAuthModal(tab = 'register', alertMsg = null) {
            authModal.classList.remove('hidden');
            switchAuthTab(tab);
            if (alertMsg) {
                showAuthAlert(alertMsg);
            } else {
                hideAuthAlert();
            }
            if (window.lucide) window.lucide.createIcons();
        }

        function closeAuthModal() {
            authModal.classList.add('hidden');
            hideAuthAlert();
        }

        function showAuthAlert(msg) {
            authAlertText.textContent = msg;
            authAlertBox.classList.remove('hidden');
            authAlertBox.classList.add('animate-shake');
            setTimeout(() => authAlertBox.classList.remove('animate-shake'), 450);
        }

        function hideAuthAlert() {
            authAlertBox.classList.add('hidden');
            authAlertText.textContent = '';
        }

        function switchAuthTab(tab) {
            hideAuthAlert();
            if (tab === 'signin') {
                authTabSignIn.className = 'py-2 text-xs font-extrabold rounded-xl transition-all bg-indigo-600 text-white shadow-sm cursor-pointer';
                authTabRegister.className = 'py-2 text-xs font-extrabold rounded-xl transition-all text-slate-400 hover:text-white cursor-pointer';
                signInForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
                authModalTitle.textContent = 'Welcome Back';
                authModalSubtitle.textContent = 'Sign in to unlock drag & drop file conversions';
            } else {
                authTabRegister.className = 'py-2 text-xs font-extrabold rounded-xl transition-all bg-indigo-600 text-white shadow-sm cursor-pointer';
                authTabSignIn.className = 'py-2 text-xs font-extrabold rounded-xl transition-all text-slate-400 hover:text-white cursor-pointer';
                registerForm.classList.remove('hidden');
                signInForm.classList.add('hidden');
                authModalTitle.textContent = 'Create Your Account';
                authModalSubtitle.textContent = 'Register to save details in Firebase & convert files';
            }
            if (window.lucide) window.lucide.createIcons();
        }

        // Toggle Password Visibility
        document.querySelectorAll('.toggle-password-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (!input) return;
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = '<i data-lucide="eye-off" class="w-4 h-4"></i>';
                } else {
                    input.type = 'password';
                    btn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>';
                }
                if (window.lucide) window.lucide.createIcons();
            });
        });

        // Top Navigation Buttons & Stage Triggers
        if (headerSignInBtn) {
            headerSignInBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openAuthModal('signin');
            });
        }

        if (headerRegisterBtn) {
            headerRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openAuthModal('register');
            });
        }

        if (stageRegisterBtn) {
            stageRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openAuthModal('register');
            });
        }

        if (stageSignInBtn) {
            stageSignInBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openAuthModal('signin');
            });
        }

        if (authTabSignIn) {
            authTabSignIn.addEventListener('click', (e) => {
                e.preventDefault();
                switchAuthTab('signin');
            });
        }

        if (authTabRegister) {
            authTabRegister.addEventListener('click', (e) => {
                e.preventDefault();
                switchAuthTab('register');
            });
        }

        if (switchToRegisterBtn) {
            switchToRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                switchAuthTab('register');
            });
        }

        if (switchToSignInBtn) {
            switchToSignInBtn.addEventListener('click', (e) => {
                e.preventDefault();
                switchAuthTab('signin');
            });
        }

        if (closeAuthModalBtn) {
            closeAuthModalBtn.addEventListener('click', closeAuthModal);
        }

        // Handle Registration
        async function handleRegister(e) {
            if (e) e.preventDefault();
            hideAuthAlert();

            const name = (registerName.value || '').trim();
            const email = (registerEmail.value || '').trim();
            const password = registerPassword.value || '';
            const confirm = registerPasswordConfirm.value || '';

            if (!name || name.length < 2) {
                playAlertTone();
                showAuthAlert("Please enter your full name (at least 2 letters).");
                registerName.focus();
                return;
            }
            if (!email || !email.includes('@') || !email.includes('.')) {
                playAlertTone();
                showAuthAlert("Please enter a valid email address (e.g. name@domain.com).");
                registerEmail.focus();
                return;
            }
            if (!password || password.length < 6) {
                playAlertTone();
                showAuthAlert("Password must be at least 6 characters.");
                registerPassword.focus();
                return;
            }
            if (password !== confirm) {
                playAlertTone();
                showAuthAlert("Passwords do not match. Please verify.");
                registerPasswordConfirm.focus();
                return;
            }

            registerSubmitBtn.disabled = true;
            registerSubmitBtn.innerHTML = `
                <div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                <span>Registering...</span>
            `;

            try {
                await registerUser(name, email, password);
                closeAuthModal();
                playAuthChime();
                const stageRect = radialStage.getBoundingClientRect();
                spawnConfetti(stageRect.left + stageRect.width / 2, stageRect.top + stageRect.height / 2);
                registerForm.reset();
            } catch (err) {
                playAlertTone();
                showAuthAlert(err.message || "Registration failed. Please try again.");
            } finally {
                registerSubmitBtn.disabled = false;
                registerSubmitBtn.innerHTML = `<span>Register &amp; Unlock Converter</span><i data-lucide="check-circle" class="w-4 h-4"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }

        registerForm.addEventListener('submit', handleRegister);
        registerSubmitBtn.addEventListener('click', handleRegister);

        // Handle Sign In
        async function handleSignIn(e) {
            if (e) e.preventDefault();
            hideAuthAlert();

            const email = (signInEmail.value || '').trim();
            const password = signInPassword.value || '';

            if (!email || !email.includes('@')) {
                playAlertTone();
                showAuthAlert("Please enter your email address.");
                signInEmail.focus();
                return;
            }
            if (!password) {
                playAlertTone();
                showAuthAlert("Please enter your password.");
                signInPassword.focus();
                return;
            }

            signInSubmitBtn.disabled = true;
            signInSubmitBtn.innerHTML = `
                <div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                <span>Signing in...</span>
            `;

            try {
                await loginUser(email, password);
                closeAuthModal();
                playAuthChime();
                const stageRect = radialStage.getBoundingClientRect();
                spawnConfetti(stageRect.left + stageRect.width / 2, stageRect.top + stageRect.height / 2);
                signInForm.reset();
            } catch (err) {
                playAlertTone();
                showAuthAlert(err.message || "Sign in failed. Check your password or register.");
            } finally {
                signInSubmitBtn.disabled = false;
                signInSubmitBtn.innerHTML = `<span>Sign In &amp; Unlock</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }

        signInForm.addEventListener('submit', handleSignIn);
        signInSubmitBtn.addEventListener('click', handleSignIn);

        // Quick 1-Click Demo Login
        quickDemoLoginBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            signInEmail.value = 'demo.user@converter.io';
            signInPassword.value = 'Demo1234!';

            try {
                await loginUser('demo.user@converter.io', 'Demo1234!');
                closeAuthModal();
                playAuthChime();
                const stageRect = radialStage.getBoundingClientRect();
                spawnConfetti(stageRect.left + stageRect.width / 2, stageRect.top + stageRect.height / 2);
            } catch (e) {
                try {
                    await registerUser('Demo User', 'demo.user@converter.io', 'Demo1234!');
                    closeAuthModal();
                    playAuthChime();
                    const stageRect = radialStage.getBoundingClientRect();
                    spawnConfetti(stageRect.left + stageRect.width / 2, stageRect.top + stageRect.height / 2);
                } catch (regErr) {
                    showAuthAlert(regErr.message);
                }
            }
        });

        // Logout
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
            playTone(320, 'sine', 0.15, 0.08);
        });

        // Subscribe to Auth State Changes
        subscribeAuth((user) => {

            if (user) {
                // Unlocked
                stageLockOverlay.classList.add('unlocked');
                userProfilePill.classList.remove('hidden');
                if (authHeaderButtons) authHeaderButtons.classList.add('hidden');

                const displayName = user.name || user.email.split('@')[0];
                userNameHeader.textContent = displayName;
                userEmailHeader.textContent = user.email;

                const initials = displayName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase() || 'U';
                userInitials.textContent = initials;
            } else {
                // Locked
                stageLockOverlay.classList.remove('unlocked');
                userProfilePill.classList.add('hidden');
                if (authHeaderButtons) authHeaderButtons.classList.remove('hidden');
                centerStateLoaded.classList.add('hidden');
                centerStateIdle.classList.remove('hidden');
                loadedFile = null;
            }

            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        });

        initAuthSession();
        notifyAuthSubscribers();
    }

    // Run safely whether DOMContentLoaded has already fired or is loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
