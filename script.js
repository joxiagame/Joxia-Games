import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPecKQH6DURfYitjY4bXMeW0URLrcNnsI",
  authDomain: "joxiahub-2928b.firebaseapp.com",
  projectId: "joxiahub-2928b",
  storageBucket: "joxiahub-2928b.firebasestorage.app",
  messagingSenderId: "303698595695",
  appId: "1:303698595695:web:5c99c2cb2a9ea88e36a29a",
  databaseURL: "https://joxiahub-2928b-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ================= CONSTANTES AVATAR ================= */
const AVATAR_STYLES = ['adventurer','avataaars','big-smile','bottts','croodles','dylan','fun-emoji','lorelei','micah','notionists','open-peeps','pixel-art','thumbs'];
const AVATAR_BG = ['ffd5dc','c0aede','b6e3f4','d1f4d9','ffd9a8','ffe3a8','c8e6c9','transparent'];

function avatarUrl(avatar, size = 96) {
    const a = avatar || {};
    const style = a.style || 'adventurer';
    const seed = a.seed || 'joxia';
    let u = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    if (a.bg && a.bg !== 'transparent') u += `&backgroundColor=${a.bg}`;
    u += `&size=${size}`;
    return u;
}

/* ================= OUTILS ================= */
const el = id => document.getElementById(id);
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function openModal(id) { el(id).style.display = 'flex'; }
function closeModal(id) { el(id).style.display = 'none'; }

/* ================= ÉTAT ================= */
let currentUser = null;
let profile = null;
let avatarDraft = { style: 'adventurer', seed: '', bg: 'ffd5dc' };
let profileListener = null;
let friendsListener = null;
let requestsListener = null;
let presenceUnsub = null;

/* ================= RECHERCHE ================= */
window.searchGame = function() {
    const input = el('searchInput').value.toLowerCase();
    const cards = document.getElementsByClassName('game-card');
    for (const card of cards) {
        const h3 = card.querySelector('h3');
        const title = h3 ? h3.innerText.toLowerCase() : '';
        card.style.display = title.includes(input) ? 'block' : 'none';
    }
};

/* ================= CLASSEMENT GLOBAL ================= */
const rankBtn = el('rankBtn');
const rankModal = el('leaderboardModal');
const rankContent = el('leaderboardContent');
if (rankBtn) {
    rankBtn.onclick = () => {
        openModal('leaderboardModal');
        rankContent.innerHTML = '<p>Recherche des scores...</p>';
        onValue(ref(db, 'games'), (snapshot) => {
            if (snapshot.exists()) {
                const allGames = snapshot.val();
                const totals = {};
                for (const game in allGames) {
                    const gameScores = allGames[game].scores;
                    if (gameScores) {
                        Object.values(gameScores).forEach(p => {
                            const name = p.name ? p.name.toUpperCase().trim() : 'ANONYME';
                            totals[name] = (totals[name] || 0) + parseInt(p.score || 0);
                        });
                    }
                }
                const sorted = Object.entries(totals).map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);
                rankContent.innerHTML = `<table style="width:100%;max-width:100%;text-align:left;">
                    <tr style="color:var(--neon);border-bottom:2px solid var(--neon);"><th>#</th><th>JOUEUR</th><th style="text-align:right;">PTS</th></tr>
                    ${sorted.slice(0, 10).map((p, i) => `<tr><td>${i+1}</td><td>${p.name}</td><td style="text-align:right;color:var(--neon);font-weight:bold;">${p.score}</td></tr>`).join('')}
                </table>`;
            } else { rankContent.innerHTML = '<p>Aucun score trouvé.</p>'; }
        });
    };
}
// closeRank est fermé via le handler générique `.close-btn[data-close]` plus bas.

/* ================= PLEIN ÉCRAN ================= */
const fsBtn = el('fsBtn');
if (fsBtn) {
    const docEl = document.documentElement;
    const canFs = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
    if (!canFs) {
        fsBtn.style.display = 'none';
    } else {
        const isFs = () => document.fullscreenElement || document.webkitFullscreenElement;
        fsBtn.onclick = () => {
            if (!isFs()) {
                const p = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl);
                if (p && p.catch) p.catch(() => {});
            } else {
                (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            }
        };
        const sync = () => { fsBtn.textContent = isFs() ? '🗕' : '⛶'; fsBtn.title = isFs() ? 'Quitter le plein écran' : 'Plein écran'; };
        document.addEventListener('fullscreenchange', sync);
        document.addEventListener('webkitfullscreenchange', sync);
    }
}

/* ================= AUTHENTIFICATION (modale) ================= */
const authModal = el('authModal');
const authTitle = el('authTitle');
const switchText = el('switchText');
const toggleAuthMode = el('toggleAuthMode');
const confirmBtn = el('confirmBtn');
let isSignUpMode = false;

// Boutons "fermer" : chaque modale a un .close-btn avec data-close
document.querySelectorAll('.close-btn').forEach(btn => {
    const close = () => { const id = btn.dataset.close; if (id) closeModal(id); };
    btn.onclick = close;
    btn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } };
});
document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

toggleAuthMode.onclick = (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    authTitle.innerText = isSignUpMode ? 'Inscription' : 'Connexion';
    switchText.innerText = isSignUpMode ? 'Déjà un compte ?' : 'Pas de compte ?';
    toggleAuthMode.innerText = isSignUpMode ? 'Se connecter' : "S'inscrire";
};

confirmBtn.onclick = async () => {
    const pseudo = el('usernameInput').value.trim();
    const pass = el('passwordInput').value.trim();
    if (!pseudo || !pass) return alert('Veuillez remplir tous les champs !');
    const email = pseudo + '@joxia.fr';
    try {
        if (isSignUpMode) {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await ensureProfile(cred.user, pseudo);
            alert('Compte créé avec succès !');
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
        closeModal('authModal');
    } catch (e) { alert('Erreur : Pseudo déjà pris ou mot de passe incorrect.'); }
};

/* ================= PROFIL ================= */
function defaultProfile(user, username) {
    return {
        username: username,
        displayName: username,
        avatar: { style: 'adventurer', seed: username || user.uid.slice(0, 6), bg: 'ffd5dc' },
        createdAt: Date.now(),
        online: false,
        lastSeen: Date.now(),
        theme: 'light',
        friends: {},
    };
}

async function ensureProfile(user, username) {
    const uname = username || (user.email ? user.email.split('@')[0] : user.uid);
    const snap = await get(ref(db, `users/${user.uid}`));
    if (!snap.exists()) {
        await set(ref(db, `users/${user.uid}`), defaultProfile(user, uname));
    }
    // Toujours garantir l'index pseudo -> uid (pour « ajouter un ami »)
    await set(ref(db, `usernames/${uname.toLowerCase()}`), user.uid);
}

function setupPresence(uid) {
    if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
    const connectedRef = ref(db, '.info/connected');
    const onlineRef = ref(db, `users/${uid}/online`);
    const lastSeenRef = ref(db, `users/${uid}/lastSeen`);
    presenceUnsub = onValue(connectedRef, snap => {
        if (snap.val() === true) {
            onDisconnect(onlineRef).remove();
            onDisconnect(lastSeenRef).set(Date.now());
            set(onlineRef, true);
        }
    });
}

function renderUserButton() {
    if (currentUser && profile) {
        const name = (profile.displayName || profile.username || '').toUpperCase();
        el('userLabel').textContent = ' ' + name;
        el('userAvatar').src = avatarUrl(profile.avatar);
        el('userAvatar').style.display = 'inline-block';
        el('userBtn').classList.add('logged');
    } else {
        el('userLabel').textContent = 'SE CONNECTER';
        el('userAvatar').style.display = 'none';
        el('userBtn').classList.remove('logged');
    }
}

/* ================= AVATAR (sélecteur) ================= */
function buildAvatarChooser() {
    const styleGrid = el('avatarStyleGrid');
    styleGrid.innerHTML = '';
    AVATAR_STYLES.forEach(st => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'avatar-opt';
        b.dataset.style = st;
        b.title = st;
        b.innerHTML = `<img src="${avatarUrl({ style: st, seed: avatarDraft.seed || 'X', bg: avatarDraft.bg }, 80)}" alt="${st}">`;
        b.onclick = () => { avatarDraft.style = st; refreshAvatarPreview(); };
        styleGrid.appendChild(b);
    });

    const colorGrid = el('avatarColorGrid');
    colorGrid.innerHTML = '';
    AVATAR_BG.forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'color-opt';
        b.dataset.bg = c;
        b.title = c === 'transparent' ? 'Transparent' : '#' + c;
        b.style.background = c === 'transparent'
            ? 'repeating-conic-gradient(#e8e0d8 0 25%, #fff 0 50%) 0 0/12px 12px'
            : '#' + c;
        b.onclick = () => { avatarDraft.bg = c; refreshAvatarPreview(); };
        colorGrid.appendChild(b);
    });
}

function refreshAvatarPreview() {
    el('avatarPreviewBig').src = avatarUrl(avatarDraft, 160);
    document.querySelectorAll('.avatar-opt').forEach(b => b.classList.toggle('active', b.dataset.style === avatarDraft.style));
    document.querySelectorAll('.color-opt').forEach(b => b.classList.toggle('active', b.dataset.bg === avatarDraft.bg));
}

function openProfileModal() {
    if (!currentUser) return;
    const p = profile || defaultProfile(currentUser, currentUser.email.split('@')[0]);
    avatarDraft = Object.assign({ style: 'adventurer', seed: p.username || '', bg: 'ffd5dc' }, p.avatar || {});
    el('displayNameInput').value = p.displayName || p.username || '';
    buildAvatarChooser();
    refreshAvatarPreview();
    openModal('profileModal');
}

async function saveProfile() {
    if (!currentUser) return;
    const fallback = (profile && profile.username) || currentUser.email.split('@')[0];
    const displayName = el('displayNameInput').value.trim() || fallback;
    await update(ref(db, `users/${currentUser.uid}`), { displayName, avatar: avatarDraft });
    closeModal('profileModal');
}

/* ================= AMIS ================= */
function attachFriendsListeners(uid) {
    if (friendsListener) { friendsListener(); friendsListener = null; }
    if (requestsListener) { requestsListener(); requestsListener = null; }
    friendsListener = onValue(ref(db, `users/${uid}/friends`), snap => renderFriends(snap.val() || {}));
    requestsListener = onValue(ref(db, `friendRequests/${uid}`), snap => renderRequests(snap.val()));
}

function detachListeners() {
    [profileListener, friendsListener, requestsListener].forEach(f => { if (f) f(); });
    profileListener = friendsListener = requestsListener = null;
    if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
}

function renderRequests(requests) {
    const list = el('requestsList');
    const entries = requests ? Object.entries(requests) : [];
    const badge = el('menuFriendsBadge');
    badge.textContent = entries.length;
    badge.style.display = entries.length ? 'inline-block' : 'none';
    if (!entries.length) {
        list.innerHTML = '<p class="empty">Aucune demande reçue.</p>';
        return;
    }
    list.innerHTML = entries.map(([fromUid, r]) => `
        <div class="request-row">
            <div class="friend-avatar"><img src="${avatarUrl(r.avatar, 64)}" alt=""></div>
            <div class="friend-name">${escapeHtml(r.name || '?')}</div>
            <div class="request-actions">
                <button class="mini-btn ok" data-uid="${fromUid}" title="Accepter">✓</button>
                <button class="mini-btn no" data-uid="${fromUid}" title="Refuser">✕</button>
            </div>
        </div>`).join('');
    list.querySelectorAll('.mini-btn.ok').forEach(b => b.onclick = () => acceptFriend(b.dataset.uid));
    list.querySelectorAll('.mini-btn.no').forEach(b => b.onclick = () => declineFriend(b.dataset.uid));
}

async function renderFriends(friends) {
    const list = el('friendsList');
    if (!currentUser || !profile) {
        list.innerHTML = '<p class="empty">Connecte-toi pour voir tes amis.</p>';
        return;
    }
    friends = friends || {};
    const ids = Object.keys(friends);
    if (!ids.length) {
        list.innerHTML = "<p class=\"empty\">Aucun ami pour l'instant. Ajoute-en un !</p>";
        return;
    }
    list.innerHTML = ids.map(uid => `
        <div class="friend-row" id="fr-${uid}">
            <div class="friend-avatar"><img src="" alt=""></div>
            <div class="friend-name">…</div>
            <span class="dot off"></span>
            <button class="ghost-btn danger" data-uid="${uid}">Retirer</button>
        </div>`).join('');
    ids.forEach(async uid => {
        const snap = await get(ref(db, `users/${uid}`));
        const p = snap.val();
        if (!p) return;
        const row = el('fr-' + uid);
        if (!row) return;
        row.querySelector('img').src = avatarUrl(p.avatar, 64);
        row.querySelector('.friend-name').textContent = p.displayName || p.username;
        const dot = row.querySelector('.dot');
        dot.className = 'dot ' + (p.online ? 'on' : 'off');
        dot.title = p.online ? 'En ligne' : 'Hors ligne';
        row.querySelector('button').onclick = () => removeFriend(uid);
    });
}

async function addFriendByName() {
    const input = el('friendNameInput');
    const msg = el('friendMsg');
    const name = input.value.trim();
    if (!name) return;
    if (!currentUser) return;
    const myName = (profile && (profile.username || profile.displayName)) || currentUser.email.split('@')[0];
    msg.className = 'form-msg';
    if (name.toLowerCase() === myName.toLowerCase()) {
        msg.textContent = "Tu ne peux pas t'ajouter toi-même."; msg.classList.add('bad'); return;
    }
    const s = await get(ref(db, `usernames/${name.toLowerCase()}`));
    if (!s.exists()) {
        msg.textContent = 'Pseudo introuvable.'; msg.classList.add('bad'); return;
    }
    const targetUid = s.val();
    if (profile.friends && profile.friends[targetUid]) {
        msg.textContent = 'Déjà dans tes amis.'; msg.classList.add('bad'); return;
    }
    const existing = await get(ref(db, `friendRequests/${targetUid}/${currentUser.uid}`));
    if (existing.exists()) {
        msg.textContent = 'Demande déjà envoyée.'; msg.classList.add('bad'); return;
    }
    await set(ref(db, `friendRequests/${targetUid}/${currentUser.uid}`), {
        from: currentUser.uid,
        name: myName,
        avatar: profile.avatar || { style: 'adventurer', seed: myName },
        at: Date.now(),
    });
    input.value = '';
    msg.textContent = `Demande envoyée à ${name} !`;
    msg.classList.add('ok');
}

async function acceptFriend(fromUid) {
    if (!currentUser) return;
    const myUid = currentUser.uid;
    const updates = {};
    updates[`users/${myUid}/friends/${fromUid}`] = true;
    updates[`users/${fromUid}/friends/${myUid}`] = true;
    updates[`friendRequests/${myUid}/${fromUid}`] = null;   // supprime la demande
    await update(ref(db), updates);
}

async function declineFriend(fromUid) {
    if (!currentUser) return;
    await remove(ref(db, `friendRequests/${currentUser.uid}/${fromUid}`));
}

async function removeFriend(uid) {
    if (!currentUser) return;
    const myUid = currentUser.uid;
    const updates = {};
    updates[`users/${myUid}/friends/${uid}`] = null;
    updates[`users/${uid}/friends/${myUid}`] = null;
    await update(ref(db), updates);
}

/* ================= PARAMÈTRES (thème / sons) ================= */
function applyTheme(theme, saveProfile = true) {
    if (theme !== 'dark' && theme !== 'light') theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
    el('darkToggle').checked = theme === 'dark';
    el('themeColorMeta').content = theme === 'dark' ? '#1a1512' : '#fff7ec';
    try { localStorage.setItem('joxia-theme', theme); } catch (e) {}
    if (saveProfile && currentUser) {
        update(ref(db, `users/${currentUser.uid}/theme`), theme).catch(() => {});
    }
}

/* ================= JEUX (ouverture centralisée) ================= */
const GAMES = [
    { id: 'snakeLink',       url: 'https://joxiagame.github.io/Snake-Joxia/' },
    { id: 'FlappyLink',      url: 'https://joxiagame.github.io/Flappy-Bird-Joxia/' },
    { id: 'TetrisLink',      url: 'https://joxiagame.github.io/Tetris-Joxia/' },
    { id: 'BallBlastLink',   url: 'https://joxiagame.github.io/Ball-Blast-joxia/' },
    { id: 'BrickBlastLink',  url: 'https://joxiagame.github.io/Breakout-Joxia/' },
    { id: 'Game2048Link',    url: 'https://joxiagame.github.io/2048-joxia/' },
    { id: 'PacmanLink',      url: 'https://joxiagame.github.io/Pacman-Joxia/' },
    { id: 'CodebreakerLink', url: 'https://joxiagame.github.io/Codebreaker-Joxia/' },
    { id: 'CryptoLink',      url: 'https://joxiagame.github.io/Crypto-Tycoon-Joxia/' },
];

function openGame(url) {
    if (!auth.currentUser) {
        alert('Connecte-toi pour jouer et enregistrer ton score !');
        openModal('authModal');
        return;
    }
    const name = auth.currentUser.email.split('@')[0];
    const params = new URLSearchParams({ player: name });
    if (profile) {
        params.set('uid', auth.currentUser.uid);
        if (profile.avatar) {
            params.set('avatarStyle', profile.avatar.style || '');
            params.set('avatarSeed', profile.avatar.seed || '');
        }
    }
    window.location.href = `${url}?${params.toString()}`;
}

GAMES.forEach(g => {
    const link = el(g.id);
    if (link) link.onclick = (e) => { e.preventDefault(); openGame(g.url); };
});

/* ================= MENU UTILISATEUR ================= */
const userBtn = el('userBtn');
const userMenu = el('userMenu');

userBtn.onclick = (e) => {
    e.stopPropagation();
    if (!auth.currentUser) openModal('authModal');
    else userMenu.style.display = (userMenu.style.display === 'flex') ? 'none' : 'flex';
};
window.onclick = () => { userMenu.style.display = 'none'; };

el('menuProfile').onclick = () => { userMenu.style.display = 'none'; openProfileModal(); };
el('menuFriends').onclick = () => { userMenu.style.display = 'none'; openModal('friendsModal'); };
el('menuSettings').onclick = () => { userMenu.style.display = 'none'; openModal('settingsModal'); };

el('saveProfileBtn').onclick = saveProfile;
el('avatarRandomBtn').onclick = () => {
    avatarDraft.style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    avatarDraft.seed = Math.random().toString(36).slice(2, 8);
    refreshAvatarPreview();
};
el('addFriendBtn').onclick = addFriendByName;
el('darkToggle').onchange = (e) => applyTheme(e.target.checked ? 'dark' : 'light');
el('soundToggle').onchange = (e) => { try { localStorage.setItem('joxia-sound', e.target.checked ? 'on' : 'off'); } catch (err) {} };

function doLogout() { signOut(auth); userMenu.style.display = 'none'; }
function doDelete() {
    const user = auth.currentUser;
    if (!user || !confirm('⚠️ SUPPRIMER DÉFINITIVEMENT TON COMPTE ?')) return;
    deleteUser(user).then(() => {
        const uname = (user.email.split('@')[0]).toLowerCase();
        remove(ref(db, `users/${user.uid}`)).catch(() => {});
        remove(ref(db, `usernames/${uname}`)).catch(() => {});
        remove(ref(db, `friendRequests/${user.uid}`)).catch(() => {});
        alert('Compte supprimé.');
    }).catch(() => alert('Action sensible : reconnecte-toi avant.'));
}
el('logoutBtn').onclick = doLogout;
el('deleteAccountBtn').onclick = doDelete;
el('logoutBtn2').onclick = doLogout;
el('deleteAccountBtn2').onclick = doDelete;

/* ================= INITIALISATION ================= */
// Thème appliqué dès le chargement (avant la résolution de l'auth)
applyTheme(localStorage.getItem('joxia-theme') || 'light', false);
try {
    el('soundToggle').checked = localStorage.getItem('joxia-sound') !== 'off';
} catch (e) {}

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        const username = user.email.split('@')[0];
        await ensureProfile(user, username);
        setupPresence(user.uid);
        if (profileListener) { profileListener(); profileListener = null; }
        profileListener = onValue(ref(db, `users/${user.uid}`), snap => {
            profile = snap.val() || {};
            applyTheme(profile.theme || localStorage.getItem('joxia-theme') || 'light', false);
            renderUserButton();
        });
        attachFriendsListeners(user.uid);
    } else {
        profile = null;
        detachListeners();
        renderUserButton();
    }
});
