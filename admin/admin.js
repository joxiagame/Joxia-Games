/* ============================================================
   JOXIA · Panneau d'administration
   Les droits sont vérifiés côté serveur par les règles Firebase
   (admins/{uid} === true). Cette page n'est qu'une interface :
   un non-admin qui l'ouvrirait ne pourrait rien supprimer.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, remove, update, query, limitToLast, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

const GAME_LABELS = {
    'Snake': 'Snake', 'Flappy': 'Flappy', 'FLAPPY_BIRD': 'Flappy', 'TETRIS': 'Tetris',
    'BallBlast': 'Ball Blast', 'BRICK_BLAST': 'Brick Blast', '2048': '2048',
    'PACMAN': 'Pac-Man', 'CODEBREAKER': 'Codebreaker', 'CRYPTO': 'Crypto Tycoon', 'POOL': 'Billard',
};
const CHAT_LIMIT = 300;

/* ---------------- utilitaires ---------------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function avatarUrl(avatar, size = 72) {
    const a = avatar || {};
    let u = `https://api.dicebear.com/9.x/${a.style || 'adventurer'}/svg?seed=${encodeURIComponent(a.seed || 'joxia')}`;
    if (a.bg && a.bg !== 'transparent') u += `&backgroundColor=${a.bg}`;
    return u + `&size=${size}`;
}
const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = ts => ts ? new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
function timeAgo(ts) {
    if (!ts) return 'jamais';
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`;
    return fmtDate(ts);
}
function toast(msg, err = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
}
function show(view) {
    ['loginView', 'deniedView', 'loadingView', 'app'].forEach(v => $(v).classList.toggle('hidden', v !== view));
}

/* ---------------- état ---------------- */
const state = {
    me: null, users: {}, presence: {}, banned: {}, admins: {}, games: {}, messages: [],
    tab: 'dash', chatFilter: '', accSearch: '', accSort: 'lastSeen', drawerUid: null,
};
let unsubs = [];

const nameOf = uid => { const u = state.users[uid]; return u ? (u.displayName || u.username || uid) : uid; };
const isOnline = uid => !!state.presence[uid];
const isBanned = uid => !!state.banned[uid];
const isAdmin = uid => state.admins[uid] === true;
const msgCount = uid => state.messages.reduce((n, m) => n + (m.from === uid ? 1 : 0), 0);

// Meilleur score de l'utilisateur dans chaque jeu (les jeux enregistrent le pseudo).
function scoresFor(uid) {
    const u = state.users[uid] || {};
    const names = new Set([u.username, u.displayName].filter(Boolean).map(s => String(s).toLowerCase()));
    const byGame = {}; let total = 0;
    for (const [game, node] of Object.entries(state.games || {})) {
        const sc = node && node.scores; if (!sc) continue;
        let best = 0;
        for (const e of Object.values(sc)) {
            if (!e) continue;
            const hit = (e.uid && e.uid === uid) || (e.name && names.has(String(e.name).toLowerCase()));
            if (hit) best = Math.max(best, Number(e.score) || 0);
        }
        if (best > 0) { byGame[game] = best; total += best; }
    }
    return { byGame, total };
}

/* ---------------- authentification ---------------- */
onAuthStateChanged(auth, async user => {
    unsubs.forEach(u => u()); unsubs = [];
    closeDrawer();
    if (!user) { show('loginView'); return; }
    show('loadingView');
    let ok = false;
    try { ok = (await get(ref(db, `admins/${user.uid}`))).val() === true; } catch (e) { ok = false; }
    if (!ok) {
        $('deniedName').textContent = user.email ? user.email.split('@')[0] : user.uid;
        show('deniedView');
        return;
    }
    state.me = user;
    $('adminName').textContent = '@' + (user.email ? user.email.split('@')[0] : '');
    show('app');
    attach();
});

$('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pseudo = $('loginPseudo').value.trim().toLowerCase();
    const pass = $('loginPass').value;
    $('loginMsg').textContent = '';
    $('loginBtn').disabled = true;
    try {
        await signInWithEmailAndPassword(auth, pseudo + '@joxia.fr', pass);
    } catch (err) {
        const bad = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'];
        $('loginMsg').textContent = bad.includes(err.code) ? 'Pseudo ou mot de passe incorrect.'
            : err.code === 'auth/too-many-requests' ? 'Trop de tentatives. Réessaie plus tard.'
            : 'Connexion impossible.';
    } finally { $('loginBtn').disabled = false; }
});
$('logoutBtn').onclick = () => signOut(auth);
$('deniedLogout').onclick = () => signOut(auth);

/* ---------------- données en direct ---------------- */
function attach() {
    const watch = (path, key) => unsubs.push(onValue(ref(db, path),
        s => { state[key] = s.val() || {}; renderAll(); },
        () => toast(`Lecture refusée : ${path}`, true)));
    watch('users', 'users');
    watch('presence', 'presence');
    watch('banned', 'banned');
    watch('admins', 'admins');
    watch('games', 'games');
    unsubs.push(onValue(query(ref(db, 'globalChat/messages'), limitToLast(CHAT_LIMIT)), s => {
        const arr = [];
        s.forEach(c => { arr.push(Object.assign({ id: c.key }, c.val())); });
        state.messages = arr;
        renderAll();
    }, () => toast('Lecture du chat refusée', true)));
}

let raf = 0;
function renderAll() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
        $('chatCount').textContent = state.messages.length;
        $('accCount').textContent = Object.keys(state.users).length;
        if (state.tab === 'dash') renderDash();
        if (state.tab === 'chat') renderChat();
        if (state.tab === 'accounts') renderAccounts();
        if (state.drawerUid) renderDrawer(state.drawerUid);
    });
}

/* ---------------- onglets ---------------- */
document.querySelectorAll('.tab').forEach(btn => btn.onclick = () => {
    state.tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    ['dash', 'chat', 'accounts'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== state.tab));
    renderAll();
});
$('chatSearch').oninput = e => { state.chatFilter = e.target.value; renderChat(); };
$('accSearch').oninput = e => { state.accSearch = e.target.value; renderAccounts(); };
$('accSort').onchange = e => { state.accSort = e.target.value; renderAccounts(); };

/* ---------------- tableau de bord ---------------- */
function userRow(uid, sub) {
    const u = state.users[uid] || {};
    return `<li data-uid="${esc(uid)}">
        <img class="av" src="${avatarUrl(u.avatar, 48)}" alt="" loading="lazy">
        <div class="who"><b>${esc(nameOf(uid))}${badges(uid)}</b><span>${sub}</span></div>
    </li>`;
}
function badges(uid) {
    return (isAdmin(uid) ? '<span class="badge admin">ADMIN</span>' : '') + (isBanned(uid) ? '<span class="badge ban">BANNI</span>' : '');
}
function renderDash() {
    const uids = Object.keys(state.users);
    const online = Object.keys(state.presence).filter(k => state.presence[k]);
    const scoreEntries = Object.values(state.games || {}).reduce((n, g) => n + (g && g.scores ? Object.keys(g.scores).length : 0), 0);
    $('stats').innerHTML = [
        ['accent', uids.length, 'Comptes'],
        ['ok', online.length, 'En ligne'],
        ['', state.messages.length, `Messages chat (${CHAT_LIMIT} derniers)`],
        ['bad', Object.keys(state.banned).length, 'Bannis du chat'],
        ['', scoreEntries, 'Scores enregistrés'],
    ].map(([cls, n, label]) => `<div class="stat ${cls}"><b>${n}</b><span>${label}</span></div>`).join('');

    $('onlineList').innerHTML = online.length
        ? online.map(uid => userRow(uid, '<i class="dot on"></i>en ligne')).join('')
        : '<li class="empty">Personne en ligne</li>';
    const recent = uids.sort((a, b) => (state.users[b].createdAt || 0) - (state.users[a].createdAt || 0)).slice(0, 8);
    $('recentList').innerHTML = recent.length
        ? recent.map(uid => userRow(uid, 'inscrit le ' + fmtDate(state.users[uid].createdAt))).join('')
        : '<li class="empty">Aucun compte</li>';
}
['onlineList', 'recentList'].forEach(id => $(id).onclick = e => {
    const li = e.target.closest('li[data-uid]'); if (li) openDrawer(li.dataset.uid);
});

/* ---------------- modération du chat ---------------- */
function msgItem(m, compact = false) {
    const own = m.from && state.users[m.from];
    const author = m.from ? `<b data-action="user" data-uid="${esc(m.from)}">${esc(m.name || nameOf(m.from))}</b>` : `<b>${esc(m.name || '?')}</b>`;
    const canBan = m.from && !isAdmin(m.from) && m.from !== state.me.uid;
    return `<li class="msg${isBanned(m.from) ? ' from-banned' : ''}">
        ${compact ? '' : `<img class="av" src="${avatarUrl(m.avatar || (own && own.avatar), 48)}" alt="" loading="lazy">`}
        <div class="msg__body">
            <div class="msg__head">${author}${m.from ? badges(m.from) : ''}<time>${fmtTime(m.ts)}</time></div>
            <div class="msg__text">${esc(m.text)}</div>
        </div>
        <div class="msg__actions">
            ${canBan && !compact ? `<button class="icon-btn danger" data-action="${isBanned(m.from) ? 'unban' : 'ban'}" data-uid="${esc(m.from)}" title="${isBanned(m.from) ? 'Débannir' : 'Bannir du chat'}" aria-label="${isBanned(m.from) ? 'Débannir' : 'Bannir du chat'}">${isBanned(m.from) ? '↺' : '🚫'}</button>` : ''}
            <button class="icon-btn danger" data-action="del" data-id="${esc(m.id)}" title="Supprimer le message" aria-label="Supprimer le message">🗑</button>
        </div>
    </li>`;
}
function renderChat() {
    const q = state.chatFilter.trim().toLowerCase();
    const msgs = [...state.messages].reverse()
        .filter(m => !q || (m.name || '').toLowerCase().includes(q) || (m.text || '').toLowerCase().includes(q));
    $('chatInfo').textContent = `${msgs.length} message(s)`;
    $('msgList').innerHTML = msgs.length ? msgs.map(m => msgItem(m)).join('') : '<li class="empty-state">Aucun message</li>';
}

/* ---------------- comptes ---------------- */
function renderAccounts() {
    const q = state.accSearch.trim().toLowerCase();
    let list = Object.keys(state.users).map(uid => ({ uid, u: state.users[uid], sc: scoresFor(uid) }))
        .filter(a => !q || (a.u.username || '').toLowerCase().includes(q) || (a.u.displayName || '').toLowerCase().includes(q));
    const sorters = {
        lastSeen: (a, b) => (isOnline(b.uid) - isOnline(a.uid)) || ((b.u.lastSeen || 0) - (a.u.lastSeen || 0)),
        created: (a, b) => (b.u.createdAt || 0) - (a.u.createdAt || 0),
        score: (a, b) => b.sc.total - a.sc.total,
        name: (a, b) => nameOf(a.uid).localeCompare(nameOf(b.uid), 'fr'),
    };
    list.sort(sorters[state.accSort] || sorters.lastSeen);
    $('accList').innerHTML = list.length ? list.map(({ uid, u, sc }) => `
        <li class="acc" data-uid="${esc(uid)}">
            <img class="av" src="${avatarUrl(u.avatar, 48)}" alt="" loading="lazy">
            <div class="who">
                <b>${esc(nameOf(uid))}${badges(uid)}</b>
                <span>${isOnline(uid) ? '<i class="dot on"></i>en ligne' : '<i class="dot"></i>vu ' + timeAgo(u.lastSeen)}</span>
            </div>
            <div class="acc__meta">
                <div><b>${sc.total}</b>score</div>
                <div class="hide-sm"><b>${msgCount(uid)}</b>msgs</div>
                <div class="hide-sm"><b>${Object.keys(u.friends || {}).length}</b>amis</div>
            </div>
        </li>`).join('') : '<li class="empty-state">Aucun compte trouvé</li>';
}
$('accList').onclick = e => { const li = e.target.closest('li[data-uid]'); if (li) openDrawer(li.dataset.uid); };

/* ---------------- fiche compte ---------------- */
function openDrawer(uid) {
    state.drawerUid = uid;
    $('drawer').classList.remove('hidden');
    $('drawerBackdrop').classList.remove('hidden');
    renderDrawer(uid);
}
function closeDrawer() {
    state.drawerUid = null;
    $('drawer').classList.add('hidden');
    $('drawerBackdrop').classList.add('hidden');
}
$('drawerBackdrop').onclick = closeDrawer;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

function renderDrawer(uid) {
    const u = state.users[uid] || {};
    const sc = scoresFor(uid);
    const friends = Object.keys(u.friends || {});
    const lastMsgs = state.messages.filter(m => m.from === uid).slice(-5).reverse();
    const self = state.me && uid === state.me.uid;
    const ban = isBanned(uid);
    const banInfo = ban && state.banned[uid] && state.banned[uid].at ? ` (depuis le ${fmtDate(state.banned[uid].at)})` : '';
    $('drawer').innerHTML = `
        <div class="drawer__head">
            <img class="av av--lg" src="${avatarUrl(u.avatar, 96)}" alt="">
            <div><h2>${esc(nameOf(uid))}</h2>${badges(uid)}</div>
            <button class="icon-btn drawer__close" data-action="close" aria-label="Fermer">✕</button>
        </div>
        <dl class="kv">
            <dt>Pseudo</dt><dd>@${esc(u.username || '—')}</dd>
            <dt>Statut</dt><dd>${isOnline(uid) ? '<i class="dot on"></i>En ligne' : 'Hors ligne · vu ' + timeAgo(u.lastSeen)}</dd>
            <dt>Inscrit le</dt><dd>${fmtDate(u.createdAt)}</dd>
            <dt>Amis</dt><dd>${friends.length}</dd>
            <dt>Messages</dt><dd>${msgCount(uid)} <span class="muted small">(sur les ${CHAT_LIMIT} derniers)</span></dd>
            <dt>Chat</dt><dd>${ban ? '<span class="badge ban">BANNI</span>' + banInfo : 'Autorisé'}</dd>
            <dt>UID</dt><dd class="small muted">${esc(uid)}</dd>
        </dl>

        <div class="section-title">Meilleurs scores</div>
        ${Object.keys(sc.byGame).length
            ? `<div class="scores">${Object.entries(sc.byGame).map(([g, v]) => `<div><span>${esc(GAME_LABELS[g] || g)}</span><b>${v}</b></div>`).join('')}</div>`
            : '<p class="muted small">Aucun score enregistré.</p>'}

        <div class="section-title">Amis</div>
        ${friends.length ? `<div class="chips">${friends.map(f => `<span class="chip">${esc(nameOf(f))}</span>`).join('')}</div>` : '<p class="muted small">Aucun ami.</p>'}

        <div class="section-title">Derniers messages dans le chat</div>
        ${lastMsgs.length ? `<ul class="msg-list">${lastMsgs.map(m => msgItem(m, true)).join('')}</ul>` : '<p class="muted small">Aucun message récent.</p>'}

        <div class="section-title">Actions</div>
        <div class="actions">
            ${self || isAdmin(uid) ? '<p class="muted small">Actions de modération indisponibles sur un compte admin.</p>' : `
            <button class="btn ${ban ? 'btn--ghost' : 'btn--danger'}" data-action="${ban ? 'unban' : 'ban'}" data-uid="${esc(uid)}">${ban ? '↺ Débannir du chat' : '🚫 Bannir du chat'}</button>`}
            <button class="btn btn--ghost" data-action="purge" data-uid="${esc(uid)}">🗑 Supprimer tous ses messages du chat</button>
            <p class="muted small">Les messages privés entre joueurs restent confidentiels et ne sont pas accessibles ici.</p>
        </div>`;
}

/* ---------------- actions (délégation) ---------------- */
document.addEventListener('click', async e => {
    const b = e.target.closest('[data-action]');
    if (!b || !state.me) return;
    const { action, id, uid } = b.dataset;
    if (action === 'close') return closeDrawer();
    if (action === 'user') return openDrawer(uid);
    if (action === 'del') return deleteMessage(id);
    if (action === 'ban') return setBan(uid, true);
    if (action === 'unban') return setBan(uid, false);
    if (action === 'purge') return purgeMessages(uid);
});

async function deleteMessage(id) {
    if (!confirm('Supprimer ce message ?')) return;
    try { await remove(ref(db, `globalChat/messages/${id}`)); toast('Message supprimé'); }
    catch (err) { toast('Action refusée par le serveur', true); }
}

async function setBan(uid, on) {
    const name = nameOf(uid);
    if (on && !confirm(`Bannir ${name} du chat ? Il ne pourra plus envoyer de messages.`)) return;
    try {
        if (on) await set(ref(db, `banned/${uid}`), { at: Date.now(), by: state.me.uid, name });
        else await remove(ref(db, `banned/${uid}`));
        toast(on ? `${name} est banni du chat` : `${name} est débanni`);
    } catch (err) { toast('Action refusée par le serveur', true); }
}

async function purgeMessages(uid) {
    const name = nameOf(uid);
    if (!confirm(`Supprimer TOUS les messages de ${name} dans le chat ?`)) return;
    try {
        const snap = await get(query(ref(db, 'globalChat/messages'), orderByChild('from'), equalTo(uid)));
        const updates = {};
        snap.forEach(c => { updates[`globalChat/messages/${c.key}`] = null; });
        const n = Object.keys(updates).length;
        if (!n) return toast('Aucun message à supprimer');
        await update(ref(db), updates);
        toast(`${n} message(s) supprimé(s)`);
    } catch (err) { toast('Action refusée par le serveur', true); }
}
