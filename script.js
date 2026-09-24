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

/* ================= CLASSEMENT (global + par jeu) ================= */
const GAME_LABELS = {
    'Snake': '🐍 Snake', 'Flappy': '🐤 Flappy', 'TETRIS': '🧱 Tetris',
    'BallBlast': '🔵 Ball Blast', 'BRICK_BLAST': '🧨 Brick Blast', '2048': '🔢 2048',
    'PACMAN': '🟡 Pac-Man', 'CODEBREAKER': '🔐 Codebreaker', 'CRYPTO': '💎 Crypto Tycoon',
};
const lbTabs = el('lbTabs');
const lbContent = el('leaderboardContent');
let lbData = null;
let lbActive = '__global__';

const gameLabel = key => GAME_LABELS[key] || key;

async function loadLeaderboard() {
    lbContent.innerHTML = '<p class="empty">Chargement des scores…</p>';
    try {
        const [gamesSnap, usersSnap, usernamesSnap] = await Promise.all([
            get(ref(db, 'games')), get(ref(db, 'users')), get(ref(db, 'usernames')),
        ]);
        const games = gamesSnap.val() || {};
        const users = usersSnap.val() || {};
        const usernames = usernamesSnap.val() || {};

        // 1) Meilleur score par (jeu, identité) — identité = uid résolue uniquement.
        //    Les scores sans compte lié (legacy/test) sont ignorés → classement remis à zéro.
        const perGame = {};
        const gameOrder = [];
        for (const gameKey in games) {
            const scores = (games[gameKey] && games[gameKey].scores) || {};
            const best = {};
            for (const k in scores) {
                const e = scores[k] || {};
                const score = parseInt(e.score, 10) || 0;
                if (score <= 0) continue;
                const rawName = (e.name || '').trim();
                let identity = null;
                if (e.uid) identity = e.uid;
                else if (rawName) identity = usernames[rawName.toLowerCase()] || null;
                if (!identity) continue;
                if (!(identity in best) || score > best[identity]) best[identity] = score;
            }
            perGame[gameKey] = best;
            gameOrder.push(gameKey);
        }

        // 2) Identité -> { name, avatar } (résolution profil)
        const info = identity => {
            if (identity.indexOf('name:') === 0) return { name: identity.slice(5), avatar: null };
            const p = users[identity] || {};
            return { name: p.displayName || p.username || 'Joueur', avatar: p.avatar || null };
        };

        // 3) Classement global (somme des meilleurs scores par jeu)
        const globalMap = {};
        for (const g of gameOrder) {
            for (const id in perGame[g]) {
                if (!globalMap[id]) globalMap[id] = { identity: id, total: 0 };
                globalMap[id].total += perGame[g][id];
            }
        }
        const globList = Object.values(globalMap)
            .map(x => Object.assign({}, x, info(x.identity)))
            .sort((a, b) => b.total - a.total);

        // 4) Classements par jeu
        const perGameList = {};
        for (const g of gameOrder) {
            perGameList[g] = Object.keys(perGame[g])
                .map(id => Object.assign({ identity: id, score: perGame[g][id] }, info(id)))
                .sort((a, b) => b.score - a.score);
        }

        lbData = { globList, perGameList, games: gameOrder };
        buildLbTabs();
        renderLeaderboard();
    } catch (e) {
        lbContent.innerHTML = '<p class="empty">Impossible de charger le classement.</p>';
    }
}

function buildLbTabs() {
    const tabs = [{ key: '__global__', label: '🌍 Global' }].concat(
        (lbData ? lbData.games : []).map(g => ({ key: g, label: gameLabel(g) }))
    );
    lbTabs.innerHTML = tabs.map(t =>
        `<button class="lb-tab${t.key === lbActive ? ' active' : ''}" data-game="${t.key}" role="tab" aria-selected="${t.key === lbActive}">${t.label}</button>`
    ).join('');
    lbTabs.querySelectorAll('.lb-tab').forEach(b => b.onclick = () => {
        lbActive = b.dataset.game;
        buildLbTabs();
        renderLeaderboard();
    });
}

const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);

function lbRow(item, i, scoreKey) {
    const isMe = currentUser && item.identity === currentUser.uid;
    const avatar = item.avatar
        ? `<img class="lb-avatar" src="${avatarUrl(item.avatar, 40)}" alt="">`
        : `<span class="lb-avatar ghost">👤</span>`;
    const you = isMe ? '<em class="lb-you">toi</em>' : '';
    return `<div class="lb-row${isMe ? ' me' : ''}${i < 3 ? ' top' : ''}">
        <span class="lb-rank">${medal(i)}</span>
        ${avatar}
        <span class="lb-name">${escapeHtml(item.name)} ${you}</span>
        <span class="lb-score">${item[scoreKey]}</span>
    </div>`;
}

function renderLeaderboard() {
    if (!lbData) return;
    const list = lbActive === '__global__'
        ? lbData.globList.map((it, i) => lbRow(it, i, 'total'))
        : lbData.perGameList[lbActive].map((it, i) => lbRow(it, i, 'score'));
    lbContent.innerHTML = list.length
        ? list.join('')
        : '<p class="empty">Aucun score pour l\'instant. Joue pour apparaître ici !</p>';
}

const rankBtn = el('rankBtn');
if (rankBtn) {
    rankBtn.onclick = () => {
        openModal('leaderboardModal');
        lbActive = '__global__';
        buildLbTabs();
        loadLeaderboard();
    };
}

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
const authSub = el('authSub');
const switchText = el('switchText');
const toggleAuthMode = el('toggleAuthMode');
const confirmBtn = el('confirmBtn');
const authMsg = el('authMsg');
const usernameInput = el('usernameInput');
const passwordInput = el('passwordInput');
const confirmInput = el('confirmInput');
const confirmWrap = el('confirmWrap');
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

function setAuthMode(signup) {
    isSignUpMode = signup;
    authTitle.innerText = signup ? 'Inscription' : 'Connexion';
    authSub.innerText = signup ? 'Choisis un pseudo et un mot de passe.' : 'Content de te revoir !';
    switchText.innerText = signup ? 'Déjà un compte ?' : 'Pas de compte ?';
    toggleAuthMode.innerText = signup ? 'Se connecter' : "S'inscrire";
    confirmBtn.innerText = signup ? "S'INSCRIRE" : 'SE CONNECTER';
    confirmWrap.style.display = signup ? 'block' : 'none';
    authMsg.textContent = ''; authMsg.className = 'form-msg';
}
toggleAuthMode.onclick = (e) => { e.preventDefault(); setAuthMode(!isSignUpMode); };

function showAuthMsg(text, ok) {
    authMsg.textContent = text;
    authMsg.className = 'form-msg ' + (ok ? 'ok' : 'bad');
}

const AUTH_ERRORS = {
    'auth/email-already-in-use': 'Ce pseudo est déjà pris.',
    'auth/invalid-email': 'Pseudo invalide (a-z, 0-9, . _ -).',
    'auth/weak-password': 'Mot de passe trop court (6 caractères min.).',
    'auth/wrong-password': 'Pseudo ou mot de passe incorrect.',
    'auth/user-not-found': "Aucun compte avec ce pseudo. Inscris-toi !",
    'auth/invalid-credential': 'Pseudo ou mot de passe incorrect.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie dans un instant.',
};
const authError = code => AUTH_ERRORS[code] || 'Erreur inattendue. Réessaie.';

confirmBtn.onclick = async () => {
    const pseudo = usernameInput.value.trim().toLowerCase();
    const pass = passwordInput.value;
    authMsg.className = 'form-msg';
    if (!/^[a-z0-9._-]{3,20}$/.test(pseudo)) return showAuthMsg('Pseudo invalide : 3–20 caractères (a-z, 0-9, . _ -).');
    if (pass.length < 6) return showAuthMsg('Mot de passe : 6 caractères minimum.');
    if (isSignUpMode && pass !== confirmInput.value) return showAuthMsg('Les mots de passe ne correspondent pas.');
    const email = pseudo + '@joxia.fr';
    try {
        if (isSignUpMode) {
            const taken = await get(ref(db, `usernames/${pseudo}`));
            if (taken.exists()) return showAuthMsg('Ce pseudo est déjà pris.');
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await ensureProfile(cred.user, pseudo);
            closeModal('authModal');
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
            closeModal('authModal');
        }
    } catch (e) { showAuthMsg(authError(e.code)); }
};

// Afficher / masquer le mot de passe
el('togglePw').onclick = () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    el('togglePw').textContent = show ? '🙈' : '👁';
    el('togglePw').setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
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
        theme: 'dark',
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
    loadMyStats();
    openModal('profileModal');
}

async function saveProfile() {
    if (!currentUser) return;
    const fallback = (profile && profile.username) || currentUser.email.split('@')[0];
    const displayName = el('displayNameInput').value.trim() || fallback;
    await update(ref(db, `users/${currentUser.uid}`), { displayName, avatar: avatarDraft });
    closeModal('profileModal');
}

/* ================= MES STATS (profil) ================= */
async function loadMyStats() {
    const box = el('profileStats');
    if (!box || !currentUser) return;
    box.innerHTML = '<p class="empty">Chargement de tes stats…</p>';
    try {
        const [gamesSnap, usernamesSnap] = await Promise.all([
            get(ref(db, 'games')), get(ref(db, 'usernames')),
        ]);
        const games = gamesSnap.val() || {};
        const usernames = usernamesSnap.val() || {};
        const myUid = currentUser.uid;
        const best = {};
        for (const g in games) {
            const scores = (games[g] && games[g].scores) || {};
            for (const k in scores) {
                const e = scores[k] || {};
                const uid = e.uid || usernames[(e.name || '').trim().toLowerCase()];
                if (uid !== myUid) continue;
                const s = parseInt(e.score, 10) || 0;
                if (!(g in best) || s > best[g]) best[g] = s;
            }
        }
        const rows = Object.entries(best);
        const total = rows.reduce((a, [, v]) => a + v, 0);
        box.innerHTML = `
            <div class="stat-total"><b>${total.toLocaleString('fr-FR')}</b><span>points au total</span></div>
            ${rows.length
                ? `<div class="stat-list">${rows.map(([g, s]) =>
                    `<div class="stat-row"><span>${gameLabel(g)}</span><b>${s.toLocaleString('fr-FR')}</b></div>`).join('')}</div>`
                : '<p class="empty">Joue à un jeu pour gagner tes premiers points !</p>'}
        `;
    } catch (e) {
        box.innerHTML = '<p class="empty">Stats indisponibles.</p>';
    }
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
    el('themeColorMeta').content = theme === 'dark' ? '#0f0f23' : '#f4f2ff';
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
applyTheme(localStorage.getItem('joxia-theme') || 'dark', false);
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
            applyTheme(profile.theme || localStorage.getItem('joxia-theme') || 'dark', false);
            renderUserButton();
        });
        attachFriendsListeners(user.uid);
    } else {
        profile = null;
        detachListeners();
        renderUserButton();
    }
});
