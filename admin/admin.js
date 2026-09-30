/* ============================================================
   JOXIA · Panneau d'administration
   Les droits sont vérifiés côté serveur par les règles Firebase
   (admins/{uid} === true). Cette page n'est qu'une interface :
   un non-admin qui l'ouvrirait ne pourrait ni lire ni sanctionner.
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

// Clés des scores (games/<clé>/scores) -> nom affiché
const SCORE_LABELS = {
    'Snake': 'Snake', 'Flappy': 'Flappy', 'FLAPPY_BIRD': 'Flappy', 'TETRIS': 'Tetris',
    'BallBlast': 'Ball Blast', 'BRICK_BLAST': 'Brick Blast', '2048': '2048',
    'PACMAN': 'Pac-Man', 'CODEBREAKER': 'Codebreaker', 'CRYPTO': 'Crypto Tycoon', 'POOL': 'Billard',
};
// Identifiants envoyés par tracker.js (?game=...) -> nom affiché
const PLAY_LABELS = {
    SNAKE: 'Snake', FLAPPY: 'Flappy', TETRIS: 'Tetris', BALLBLAST: 'Ball Blast', BRICKBLAST: 'Brick Blast',
    '2048': '2048', PACMAN: 'Pac-Man', POOL: 'Billard', CODEBREAKER: 'Codebreaker', CRYPTO: 'Crypto Tycoon',
    SHAPEZ: 'Shapez', MINDUSTRY: 'Mindustry', SURVIVOR: 'Survivor', SANDSPIEL: 'Sandspiel', INFINITECRAFT: 'Infinite Craft',
    // jeux leereilly/games — lot 1
    HEXGL: 'HexGL', ADARKROOM: 'A Dark Room', '3DCITY': '3d.city', TOWERDEFENSE: 'Tower Defense', HEXTRIS: 'Hextris',
    POND: 'The Pond', DRAKONAS: 'Drakonas', RAGINGGARDENS: 'Raging Gardens', PARTICLECLICKER: 'Particle Clicker', DRUNKENVIKING: 'Drunken Viking',
};
const gameName = id => PLAY_LABELS[id] || id;
const CHAT_LIMIT = 300;
const PERMANENT = 9999999999999; // « définitif »

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
const fmtUntil = until => until >= 9e12 ? 'définitivement' : "jusqu'au " + new Date(until).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
function timeAgo(ts) {
    if (!ts) return 'jamais';
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`;
    return fmtDate(ts);
}
// Durée lisible à partir de secondes : « 42 min », « 3 h 05 », « 2 j 4 h »
function fmtDur(sec) {
    sec = Math.floor(sec || 0);
    if (sec < 60) return sec > 0 ? '< 1 min' : '0 min';
    const m = Math.floor(sec / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (h < 1) return `${m} min`;
    if (d < 1) return `${h} h ${String(m % 60).padStart(2, '0')}`;
    return `${d} j ${h % 24} h`;
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
    me: null, users: {}, presence: {}, banned: {}, suspensions: {}, admins: {}, games: {},
    playing: {}, playtime: {}, usernames: null, messages: [],
    tab: 'dash', chatFilter: '', accSearch: '', accSort: 'lastSeen', accFilter: 'all', drawerUid: null,
};
let unsubs = [], clock = null;

const nameOf = uid => { const u = state.users[uid]; return u ? (u.displayName || u.username || uid) : uid; };
const usernameOf = uid => (state.users[uid] && state.users[uid].username) || '';
const isOnline = uid => !!state.presence[uid];
const isAdmin = uid => state.admins[uid] === true;
// Fiche orpheline : profil users/{uid} sans compte de connexion derrière.
// Le compte réel est celui vers lequel pointe l'index usernames/{pseudo} ;
// une fiche sans pseudo, ou dont le pseudo pointe vers un autre uid, est un reste
// (compte supprimé dont le profil a survécu, ou fiche recréée par onDisconnect).
// Tant que l'index n'est pas chargé, on ne marque rien (sinon tout serait orphelin).
const isOrphan = uid => {
    if (!state.usernames || isAdmin(uid) || (state.me && uid === state.me.uid)) return false;
    const pseudo = String((state.users[uid] || {}).username || '').toLowerCase();
    // Pseudo absent de l'index : cas inconnu (vieux compte) → on ne touche à rien.
    return !pseudo || (pseudo in state.usernames && state.usernames[pseudo] !== uid);
};
const realUids = () => Object.keys(state.users).filter(uid => !isOrphan(uid));
const banOf = uid => { const b = state.banned[uid]; return b && (!b.until || b.until > Date.now()) ? b : null; };
const suspOf = uid => { const s = state.suspensions[uid]; return s && s.until > Date.now() ? s : null; };
const playingOf = uid => state.playing[uid] || null;
const ptOf = uid => state.playtime[uid] || {};
const msgCount = uid => state.messages.reduce((n, m) => n + (m.from === uid ? 1 : 0), 0);

// Meilleur score de l'utilisateur dans chaque jeu (les jeux enregistrent le pseudo).
function scoresFor(uid) {
    const u = state.users[uid] || {};
    const names = isOrphan(uid) ? new Set() : new Set([u.username, u.displayName].filter(Boolean).map(s => String(s).toLowerCase()));
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
    clearInterval(clock);
    closeDrawer(); closeModal();
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
    clock = setInterval(renderAll, 30000); // rafraîchit « depuis X min »
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
    watch('suspensions', 'suspensions');
    watch('admins', 'admins');
    watch('games', 'games');
    watch('playing', 'playing');
    watch('playtime', 'playtime');
    unsubs.push(onValue(ref(db, 'usernames'), s => { state.usernames = s.val() || {}; renderAll(); },
        () => { state.usernames = null; toast('Lecture refusée : usernames (détection des fiches orphelines désactivée)', true); }));
    unsubs.push(onValue(query(ref(db, 'globalChat/messages'), limitToLast(CHAT_LIMIT)), s => {
        const arr = [];
        s.forEach(c => { arr.push(Object.assign({ id: c.key }, c.val())); });
        state.messages = arr;
        renderAll();
    }, () => toast('Lecture du salon refusée', true)));
}

let raf = 0;
function renderAll() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
        $('chatCount').textContent = state.messages.length;
        $('accCount').textContent = realUids().length;
        $('playCount').textContent = Object.keys(state.playing).length;
        if (state.tab === 'dash') renderDash();
        if (state.tab === 'games') renderGames();
        if (state.tab === 'chat') renderChat();
        if (state.tab === 'accounts') renderAccounts();
        if (state.drawerUid) renderDrawer(state.drawerUid);
    });
}

/* ---------------- onglets ---------------- */
document.querySelectorAll('.tab').forEach(btn => btn.onclick = () => {
    state.tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    ['dash', 'games', 'chat', 'accounts'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== state.tab));
    renderAll();
});
$('chatSearch').oninput = e => { state.chatFilter = e.target.value; renderChat(); };
$('accSearch').oninput = e => { state.accSearch = e.target.value; renderAccounts(); };
$('accSort').onchange = e => { state.accSort = e.target.value; renderAccounts(); };
$('accFilter').onchange = e => { state.accFilter = e.target.value; renderAccounts(); };

/* ---------------- éléments communs ---------------- */
function badges(uid) {
    const s = suspOf(uid), b = banOf(uid);
    return (isAdmin(uid) ? '<span class="badge admin">ADMIN</span>' : '')
        + (isOrphan(uid) ? '<span class="badge orphan" title="Profil sans compte de connexion (reste d\'un compte supprimé)">ORPHELIN</span>' : '')
        + (s ? '<span class="badge susp">SUSPENDU</span>' : '')
        + (b ? '<span class="badge ban">BANNI DU SALON</span>' : '');
}
function statusLine(uid) {
    const p = playingOf(uid);
    if (p) return `<i class="dot on"></i>🎮 ${esc(gameName(p.game))} · depuis ${fmtDur((Date.now() - (p.since || Date.now())) / 1000)}`;
    if (isOnline(uid)) return '<i class="dot on"></i>en ligne sur le hub';
    return '<i class="dot"></i>vu ' + timeAgo((state.users[uid] || {}).lastSeen);
}
function userRow(uid, sub) {
    const u = state.users[uid] || {};
    return `<li data-uid="${esc(uid)}">
        <img class="av" src="${avatarUrl(u.avatar, 48)}" alt="" loading="lazy">
        <div class="who"><b>${esc(nameOf(uid))}${badges(uid)}</b><span>${sub}</span></div>
    </li>`;
}
function openRow(e) { const li = e.target.closest('li[data-uid]'); if (li) openDrawer(li.dataset.uid); }
['onlineList', 'recentList', 'playingList'].forEach(id => $(id).onclick = openRow);

/* ---------------- tableau de bord ---------------- */
function renderDash() {
    const uids = realUids();
    const orphans = Object.keys(state.users).length - uids.length;
    const online = Object.keys(state.presence).filter(k => state.presence[k]);
    const totalPlay = Object.values(state.playtime).reduce((n, p) => n + (Number(p && p.total) || 0), 0);
    const suspended = Object.keys(state.suspensions).filter(suspOf).length;
    const banned = Object.keys(state.banned).filter(banOf).length;
    $('stats').innerHTML = [
        ['accent', uids.length, 'Comptes'],
        ['ok', online.length, 'En ligne'],
        ['ok', Object.keys(state.playing).length, 'En jeu'],
        ['', fmtDur(totalPlay), 'Temps de jeu cumulé'],
        ['bad', suspended, 'Comptes suspendus'],
        ['bad', banned, 'Bannis du salon'],
        ...(orphans ? [['', orphans, 'Fiches orphelines']] : []),
    ].map(([cls, n, label]) => `<div class="stat ${cls}"><b>${n}</b><span>${label}</span></div>`).join('');

    $('onlineList').innerHTML = online.length
        ? online.map(uid => userRow(uid, statusLine(uid))).join('')
        : '<li class="empty">Personne en ligne</li>';
    const recent = uids.sort((a, b) => (state.users[b].createdAt || 0) - (state.users[a].createdAt || 0)).slice(0, 8);
    $('recentList').innerHTML = recent.length
        ? recent.map(uid => userRow(uid, 'inscrit le ' + fmtDate(state.users[uid].createdAt))).join('')
        : '<li class="empty">Aucun compte</li>';
}

/* ---------------- jeux ---------------- */
function renderGames() {
    const now = Object.keys(state.playing);
    $('playingList').innerHTML = now.length
        ? now.map(uid => userRow(uid, statusLine(uid))).join('')
        : '<li class="empty">Personne ne joue en ce moment</li>';

    // agrégat : temps total, nombre de joueurs et de parties par jeu
    const agg = {};
    for (const p of Object.values(state.playtime)) {
        for (const [g, v] of Object.entries((p && p.games) || {})) {
            const a = agg[g] || (agg[g] = { sec: 0, players: 0, sessions: 0 });
            const sec = Number(v.seconds) || 0;
            a.sec += sec; a.sessions += Number(v.sessions) || 0;
            if (sec > 0 || v.sessions) a.players++;
        }
    }
    const rows = Object.entries(agg).sort((a, b) => b[1].sec - a[1].sec);
    const max = rows.length ? Math.max(1, rows[0][1].sec) : 1;
    $('topGames').innerHTML = rows.length ? rows.map(([g, a]) => `
        <li><span>${esc(gameName(g))}</span><b>${fmtDur(a.sec)}</b>
            <div class="bar"><i style="width:${Math.max(3, Math.round(a.sec / max * 100))}%"></i></div>
            <span class="sub">${a.players} joueur${a.players > 1 ? 's' : ''} · ${a.sessions} partie${a.sessions > 1 ? 's' : ''}</span></li>`).join('')
        : '<li class="muted small">Aucune donnée pour l\'instant. Les temps apparaîtront dès que des joueurs connectés lanceront un jeu.</li>';
}

/* ---------------- modération du salon ---------------- */
function msgItem(m, compact = false) {
    const own = m.from && state.users[m.from];
    const author = m.from ? `<b data-action="user" data-uid="${esc(m.from)}">${esc(m.name || nameOf(m.from))}</b>` : `<b>${esc(m.name || '?')}</b>`;
    const canBan = m.from && !isAdmin(m.from) && m.from !== state.me.uid;
    const banned = m.from && banOf(m.from);
    return `<li class="msg${banned ? ' from-banned' : ''}">
        ${compact ? '' : `<img class="av" src="${avatarUrl(m.avatar || (own && own.avatar), 48)}" alt="" loading="lazy">`}
        <div class="msg__body">
            <div class="msg__head">${author}${m.from ? badges(m.from) : ''}<time>${fmtTime(m.ts)}</time></div>
            <div class="msg__text">${esc(m.text)}</div>
        </div>
        <div class="msg__actions">
            ${canBan && !compact ? `<button class="icon-btn danger" data-action="${banned ? 'unban' : 'ban'}" data-uid="${esc(m.from)}" title="${banned ? 'Débannir du salon' : 'Bannir du salon'}" aria-label="${banned ? 'Débannir du salon' : 'Bannir du salon'}">${banned ? '↺' : '🚫'}</button>` : ''}
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
    const filters = {
        all: uid => !isOrphan(uid), online: uid => isOnline(uid), playing: uid => !!playingOf(uid),
        suspended: uid => !!suspOf(uid), banned: uid => !!banOf(uid), orphan: uid => isOrphan(uid),
    };
    const keep = filters[state.accFilter] || filters.all;
    let list = Object.keys(state.users).filter(keep).map(uid => ({ uid, u: state.users[uid], sc: scoresFor(uid), pt: Number(ptOf(uid).total) || 0 }))
        .filter(a => !q || (a.u.username || '').toLowerCase().includes(q) || (a.u.displayName || '').toLowerCase().includes(q));
    const sorters = {
        lastSeen: (a, b) => (!!playingOf(b.uid) - !!playingOf(a.uid)) || (isOnline(b.uid) - isOnline(a.uid)) || ((b.u.lastSeen || 0) - (a.u.lastSeen || 0)),
        playtime: (a, b) => b.pt - a.pt,
        created: (a, b) => (b.u.createdAt || 0) - (a.u.createdAt || 0),
        score: (a, b) => b.sc.total - a.sc.total,
        name: (a, b) => nameOf(a.uid).localeCompare(nameOf(b.uid), 'fr'),
    };
    list.sort(sorters[state.accSort] || sorters.lastSeen);
    const nOrphans = Object.keys(state.users).filter(isOrphan).length;
    $('orphanBar').classList.toggle('hidden', !nOrphans);
    $('orphanInfo').textContent = `${nOrphans} fiche(s) orpheline(s) : profils restés dans la base après la suppression d'un compte.`
        + (state.accFilter === 'orphan' ? '' : ' Filtre « Fiches orphelines » pour les voir.');
    $('accList').innerHTML = list.length ? list.map(({ uid, u, sc, pt }) => `
        <li class="acc${isOrphan(uid) ? ' is-orphan' : ''}" data-uid="${esc(uid)}">
            <img class="av" src="${avatarUrl(u.avatar, 48)}" alt="" loading="lazy">
            <div class="who">
                <b>${esc(nameOf(uid))}${badges(uid)}</b>
                <span>${statusLine(uid)}</span>
            </div>
            <div class="acc__meta">
                <div><b>${fmtDur(pt)}</b>jeu</div>
                <div class="hide-sm"><b>${sc.total}</b>score</div>
                <div class="hide-sm"><b>${msgCount(uid)}</b>msgs</div>
            </div>
        </li>`).join('') : '<li class="empty-state">Aucun compte trouvé</li>';
}
$('accList').onclick = openRow;

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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('modal').classList.contains('hidden')) closeModal(); else closeDrawer(); } });

function renderDrawer(uid) {
    const u = state.users[uid] || {};
    const sc = scoresFor(uid);
    const pt = ptOf(uid);
    const perGame = Object.entries(pt.games || {}).sort((a, b) => (Number(b[1].seconds) || 0) - (Number(a[1].seconds) || 0));
    const friends = Object.keys(u.friends || {});
    const lastMsgs = state.messages.filter(m => m.from === uid).slice(-5).reverse();
    const protectedAcc = (state.me && uid === state.me.uid) || isAdmin(uid);
    const s = suspOf(uid), b = banOf(uid);
    const pseudo = usernameOf(uid);
    $('drawer').innerHTML = `
        <div class="drawer__head">
            <img class="av av--lg" src="${avatarUrl(u.avatar, 96)}" alt="">
            <div><h2>${esc(nameOf(uid))}</h2>${badges(uid)}</div>
            <button class="icon-btn drawer__close" data-action="close" aria-label="Fermer">✕</button>
        </div>
        <dl class="kv">
            <dt>Pseudo</dt><dd>@${esc(pseudo || '—')}</dd>
            <dt>Statut</dt><dd>${statusLine(uid)}</dd>
            <dt>Inscrit le</dt><dd>${fmtDate(u.createdAt)}</dd>
            <dt>Amis</dt><dd>${friends.length}</dd>
            <dt>Messages</dt><dd>${msgCount(uid)} <span class="muted small">(sur les ${CHAT_LIMIT} derniers)</span></dd>
            <dt>Compte</dt><dd>${s ? `<span class="badge susp">SUSPENDU</span> ${fmtUntil(s.until)}${s.reason ? ` · ${esc(s.reason)}` : ''}` : 'Actif'}</dd>
            <dt>Salon</dt><dd>${b ? `<span class="badge ban">BANNI</span> ${b.until ? fmtUntil(b.until) : 'définitivement'}${b.reason ? ` · ${esc(b.reason)}` : ''}` : 'Autorisé'}</dd>
        </dl>

        <div class="section-title">Temps de jeu · ${fmtDur(pt.total)} au total</div>
        ${pt.lastGame ? `<p class="muted small" style="margin-bottom:8px">Dernier jeu : <b>${esc(gameName(pt.lastGame))}</b> · ${timeAgo(pt.lastAt)}</p>` : ''}
        ${perGame.length ? `<div class="playtime">${perGame.map(([g, v]) => `
            <div><span>${esc(gameName(g))}</span><b>${fmtDur(v.seconds)}</b>
            <span class="sub">${Number(v.sessions) || 0} partie(s) · dernière ${timeAgo(v.last)}</span></div>`).join('')}</div>`
            : '<p class="muted small">Aucune partie enregistrée depuis la mise en place du suivi.</p>'}

        <div class="section-title">Meilleurs scores</div>
        ${Object.keys(sc.byGame).length
            ? `<div class="scores">${Object.entries(sc.byGame).map(([g, v]) => `<div><span>${esc(SCORE_LABELS[g] || g)}</span><b>${v}</b></div>`).join('')}</div>`
            : '<p class="muted small">Aucun score enregistré.</p>'}

        <div class="section-title">Amis</div>
        ${friends.length ? `<div class="chips">${friends.map(f => `<span class="chip">${esc(nameOf(f))}</span>`).join('')}</div>` : '<p class="muted small">Aucun ami.</p>'}

        <div class="section-title">Derniers messages dans le salon</div>
        ${lastMsgs.length ? `<ul class="msg-list">${lastMsgs.map(m => msgItem(m, true)).join('')}</ul>` : '<p class="muted small">Aucun message récent.</p>'}

        <div class="section-title">Actions</div>
        <div class="actions">
            ${isOrphan(uid) ? `<p class="muted small">Cette fiche n'a plus de compte de connexion${pseudo ? ` : le vrai compte @${esc(pseudo)} est une autre fiche` : ''}. Elle peut être supprimée sans risque.</p>
            <button class="btn btn--danger" data-action="purgeOrphan" data-uid="${esc(uid)}">🧹 Supprimer cette fiche orpheline</button>` : ''}
            ${protectedAcc ? '<p class="muted small">Sanctions indisponibles sur un compte administrateur.</p>' : `
            ${s ? `<button class="btn btn--ghost" data-action="unsuspend" data-uid="${esc(uid)}">▶ Lever la suspension</button>`
                : `<button class="btn btn--danger" data-action="suspend" data-uid="${esc(uid)}">⏸ Suspendre le compte…</button>`}
            ${b ? `<button class="btn btn--ghost" data-action="unban" data-uid="${esc(uid)}">↺ Débannir du salon</button>`
                : `<button class="btn btn--ghost" data-action="ban" data-uid="${esc(uid)}">🚫 Bannir du salon…</button>`}`}
            <button class="btn btn--ghost" data-action="purge" data-uid="${esc(uid)}">🗑 Supprimer tous ses messages du salon</button>
            ${protectedAcc || !pseudo ? '' : `
            <p class="muted small">Suppression définitive du compte : à lancer sur ton PC, dans le dossier <b>joxia-admin</b>.</p>
            <div class="cmd"><code>node delete-user.js ${esc(pseudo)} --yes</code><button data-action="copy" data-text="node delete-user.js ${esc(pseudo)} --yes">Copier</button></div>`}
            <p class="muted small">Les messages privés entre joueurs restent confidentiels et ne sont pas accessibles ici.</p>
        </div>`;
}

/* ---------------- sanctions à durée ---------------- */
const PRESETS = [['1 h', 3600e3], ['6 h', 6 * 3600e3], ['24 h', 86400e3], ['3 jours', 3 * 86400e3],
    ['7 jours', 7 * 86400e3], ['30 jours', 30 * 86400e3], ['Définitif', 'perm'], ['Date précise', 'custom']];
let modalCtx = null, modalChoice = 86400e3;

function openSanction(kind, uid) {
    const name = nameOf(uid);
    modalCtx = { kind, uid };
    modalChoice = 86400e3;
    $('modalTitle').textContent = kind === 'suspend' ? `Suspendre le compte de ${name}` : `Bannir ${name} du salon`;
    $('modalText').textContent = kind === 'suspend'
        ? "Il ne pourra plus jouer, discuter ni ajouter d'amis : un écran de blocage s'affiche dans le hub et dans les jeux. La suspension se lève toute seule à la fin."
        : "Il ne pourra plus écrire dans le salon principal. Le bannissement se lève tout seul à la fin.";
    $('modalOk').textContent = kind === 'suspend' ? 'Suspendre' : 'Bannir';
    $('modalReason').value = '';
    $('modalMsg').textContent = '';
    $('customWrap').classList.add('hidden');
    const soon = new Date(Date.now() + 86400e3 - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
    $('customUntil').value = soon;
    renderDurations();
    $('modal').classList.remove('hidden');
}
function renderDurations() {
    $('durations').innerHTML = PRESETS.map(([label, v]) =>
        `<button type="button" role="radio" aria-checked="${v === modalChoice}" data-v="${v}">${label}</button>`).join('');
}
$('durations').onclick = e => {
    const btn = e.target.closest('button[data-v]'); if (!btn) return;
    const v = btn.dataset.v;
    modalChoice = (v === 'perm' || v === 'custom') ? v : Number(v);
    $('customWrap').classList.toggle('hidden', modalChoice !== 'custom');
    renderDurations();
};
function closeModal() { modalCtx = null; $('modal').classList.add('hidden'); }
$('modalCancel').onclick = closeModal;
$('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };

$('modalForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!modalCtx) return;
    let until;
    if (modalChoice === 'perm') until = PERMANENT;
    else if (modalChoice === 'custom') {
        until = new Date($('customUntil').value).getTime();
        if (!until || until <= Date.now()) { $('modalMsg').textContent = 'Choisis une date dans le futur.'; return; }
    } else until = Date.now() + modalChoice;
    const { kind, uid } = modalCtx;
    const name = nameOf(uid);
    const reason = $('modalReason').value.trim().slice(0, 200);
    const data = { until, reason, by: state.me.uid, at: Date.now(), name };
    $('modalOk').disabled = true;
    try {
        await set(ref(db, `${kind === 'suspend' ? 'suspensions' : 'banned'}/${uid}`), data);
        toast(kind === 'suspend' ? `Compte de ${name} suspendu ${fmtUntil(until)}` : `${name} banni du salon ${fmtUntil(until)}`);
        closeModal();
    } catch (err) { $('modalMsg').textContent = 'Action refusée par le serveur.'; }
    finally { $('modalOk').disabled = false; }
});

/* ---------------- actions (délégation) ---------------- */
document.addEventListener('click', async e => {
    const b = e.target.closest('[data-action]');
    if (!b || !state.me) return;
    const { action, id, uid } = b.dataset;
    if (action === 'close') return closeDrawer();
    if (action === 'user') return openDrawer(uid);
    if (action === 'del') return deleteMessage(id);
    if (action === 'ban') return openSanction('ban', uid);
    if (action === 'suspend') return openSanction('suspend', uid);
    if (action === 'unban') return lift('banned', uid, `${nameOf(uid)} est débanni du salon`);
    if (action === 'unsuspend') return lift('suspensions', uid, `Suspension de ${nameOf(uid)} levée`);
    if (action === 'purge') return purgeMessages(uid);
    if (action === 'purgeOrphan') return purgeOrphans([uid]);
    if (action === 'purgeOrphans') return purgeOrphans(Object.keys(state.users).filter(isOrphan));
    if (action === 'copy') {
        try { await navigator.clipboard.writeText(b.dataset.text); toast('Commande copiée'); }
        catch (err) { toast('Copie impossible : sélectionne le texte', true); }
    }
});

async function lift(node, uid, msg) {
    try { await remove(ref(db, `${node}/${uid}`)); toast(msg); }
    catch (err) { toast('Action refusée par le serveur', true); }
}

async function deleteMessage(id) {
    if (!confirm('Supprimer ce message ?')) return;
    try { await remove(ref(db, `globalChat/messages/${id}`)); toast('Message supprimé'); }
    catch (err) { toast('Action refusée par le serveur', true); }
}

async function purgeMessages(uid) {
    const name = nameOf(uid);
    if (!confirm(`Supprimer TOUS les messages de ${name} dans le salon ?`)) return;
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

// Supprime les restes d'un compte qui n'existe plus (profil, présence, temps de jeu).
// Revérifie isOrphan au dernier moment : jamais un compte réel ni un admin.
async function purgeOrphans(uids) {
    uids = uids.filter(isOrphan);
    if (!uids.length) return toast('Aucune fiche orpheline');
    if (!confirm(`Supprimer ${uids.length} fiche(s) orpheline(s) ? Les comptes réels ne sont pas touchés.`)) return;
    let ok = 0;
    for (const uid of uids) {
        const updates = {};
        ['users', 'presence', 'playing', 'playtime'].forEach(n => { updates[`${n}/${uid}`] = null; });
        try { await update(ref(db), updates); ok++; } catch (err) { /* refusé par les règles */ }
    }
    if (uids.includes(state.drawerUid)) closeDrawer();
    if (ok === uids.length) toast(`${ok} fiche(s) orpheline(s) supprimée(s)`);
    else toast(`${uids.length - ok} suppression(s) refusée(s) par le serveur : les règles doivent autoriser les admins à écrire dans users/, presence/, playing/ et playtime/`, true);
}
