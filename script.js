import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, update, remove, onDisconnect, push, query, limitToLast, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const AVATAR_STYLES = ['adventurer','avataaars','big-ears','big-smile','croodles','dylan','lorelei','micah','notionists','open-peeps','personas'];
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
let chatGlobalUnsub = null;
let chatListUnsub = null;
let chatThreadUnsub = null;
let chatThread = null;           // { type:'global' } | { type:'dm', convId, with, withName, withAvatar }
let globalMessages = [];
let dmMessages = [];
const userCache = {};

/* ================= COMPTEUR EN LIGNE (temps réel) ================= */
onValue(ref(db, 'presence'), snap => {
    const data = snap.val() || {};
    const n = Object.keys(data).length;
    const c = el('onlineCount');
    if (c) c.textContent = n ? `(${n})` : '';
});

/* ================= RECHERCHE ================= */
window.searchGame = function() {
    const input = el('searchInput').value.trim().toLowerCase();
    const grid = el('gamesGrid');
    if (!grid) return;
    grid.classList.toggle('show-all', !!input);
    grid.querySelectorAll('.game-card').forEach(card => {
        const h3 = card.querySelector('h3');
        const title = h3 ? h3.innerText.toLowerCase() : '';
        card.style.display = (!input || title.includes(input)) ? '' : 'none';
    });
    const btn = el('toggleGames');
    if (btn) btn.textContent = input ? 'Réduire ↑' : (showAll ? 'Réduire ↑' : 'Voir tous les jeux →');
};

/* ================= CLASSEMENT (global + par jeu) ================= */
const GAME_LABELS = {
    'Snake': 'Snake', 'Flappy': 'Flappy', 'FLAPPY_BIRD': 'Flappy', 'TETRIS': 'Tetris',
    'BallBlast': 'Ball Blast', 'BRICK_BLAST': 'Brick Blast', '2048': '2048',
    'PACMAN': 'Pac-Man', 'CODEBREAKER': 'Codebreaker', 'CRYPTO': 'Crypto Tycoon',
    'POOL': 'Billard', 'CRYPTO_V2': 'Crypto Tycoon',
};
// Mini-jeux maison à part : CRYPTO = ancienne version (scores archivés, masqués) ;
// CRYPTO_V2 = fortune record jusqu'à 1 000 Md€, trop grande pour la somme « Global ».
const HIDDEN_GAMES = new Set(['CRYPTO']);
const INHOUSE_META = { CRYPTO_V2: { what: 'Fortune record (rangs Bronze → Légende)', money: true, noGlobal: true } };
// Crypto Tycoon : saisons hebdomadaires (même calendrier que le jeu) → seul l'onglet de la saison en cours est affiché.
const CRYPTO_SEASON_EPOCH = Date.UTC(2026, 9, 4, 22, 0, 0);
const cryptoSeason = () => Math.floor((Date.now() - CRYPTO_SEASON_EPOCH) / (7 * 86400000)) + 1;
const isCryptoSeason = k => /^CRYPTO_S\d+$/.test(k);
const isHiddenGame = k => HIDDEN_GAMES.has(k) || (isCryptoSeason(k) && k !== 'CRYPTO_S' + cryptoSeason());
const inhouseMeta = k => INHOUSE_META[k] || (isCryptoSeason(k)
    ? { what: `Fortune de la saison ${k.slice(8)} (tout le monde repart à 10 € chaque lundi)`, money: true, noGlobal: true } : null);
const fmtEuro = v => { const a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + ' Md€' : a >= 1e6 ? (v / 1e6).toFixed(2) + ' M€' : a >= 1e4 ? (v / 1e3).toFixed(1) + ' K€' : Math.round(v).toLocaleString('fr-FR') + ' €'; };
// Jeux tiers : ce que mesure leur score (envoyé par window.joxiaScore de tracker.js).
// asc = le plus petit gagne ; ms = temps en millisecondes ; time = classé au temps de jeu (ranktime).
const SCORE_META = {
    HEXTRIS: { what: 'Meilleur score', unit: 'pts' },
    POND: { what: 'Barres de niveau remplies', unit: 'niv.' },
    DRAKONAS: { what: 'Score total des missions', unit: 'pts' },
    RAGINGGARDENS: { what: 'Carottes récoltées en une partie', unit: '🥕' },
    DRUNKENVIKING: { what: 'Jours terminés', unit: 'jours' },
    TOWERDEFENSE: { what: 'Points gagnés en une partie', unit: 'pts' },
    SURVIVOR: { what: 'Ennemis éliminés en une partie', unit: 'élim.' },
    HEXGL: { what: 'Meilleur temps de course (le plus rapide gagne)', asc: true, ms: true },
    PARTICLECLICKER: { what: 'Réputation du labo', unit: 'réput.' },
    ADARKROOM: { what: 'Score officiel du jeu', unit: 'pts' },
    '3DCITY': { what: 'Population de la ville', unit: 'hab.' },
    SHAPEZ: { what: 'Niveaux terminés', unit: 'niv.' },
    MINDUSTRY: { what: 'Meilleure vague atteinte', unit: 'vagues' },
    INFINITECRAFT: { what: 'Éléments découverts', unit: 'éléments' },
    SANDSPIEL: { what: 'Bac à sable sans score : classé au temps passé à créer', time: true },
};
const fmtScore = (g, v) => {
    const m = SCORE_META[g];
    if (m && m.ms) {  // 83456 → 1:23.45
        const min = Math.floor(v / 60000), s = Math.floor(v / 1000) % 60, cs = Math.floor(v / 10) % 100;
        return `${min}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
    }
    return Number(v).toLocaleString('fr-FR') + (m && m.unit ? ' ' + m.unit : '');
};
const lbTabs = el('lbTabs');
const lbContent = el('leaderboardContent');
let lbData = null;
let lbActive = '__global__';

const gameLabel = key => GAME_LABELS[key] || (isCryptoSeason(key) ? `Crypto · Saison ${key.slice(8)}` : null) || (CATALOG[key] && CATALOG[key].name) || key;

async function loadLeaderboard() {
    lbContent.innerHTML = '<p class="empty">Chargement des scores…</p>';
    try {
        const [gamesSnap, usersSnap, usernamesSnap, timeSnap] = await Promise.all([
            get(ref(db, 'games')), get(ref(db, 'users')), get(ref(db, 'usernames')),
            // temps de jeu public (ranktime/{JEU}/{uid}) : absent si les règles ne l'ouvrent pas encore
            get(ref(db, 'ranktime')).catch(() => null),
        ]);
        const games = gamesSnap.val() || {};
        const users = usersSnap.val() || {};
        const usernames = usernamesSnap.val() || {};

        // 1) Meilleur score par (jeu, identité) — identité = uid résolue uniquement.
        //    Les scores sans compte lié (legacy/test) sont ignorés → classement remis à zéro.
        const perGame = {};
        const gameOrder = [];
        for (const gameKey in games) {
            if (isHiddenGame(gameKey)) continue;
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
                const asc = SCORE_META[gameKey] && SCORE_META[gameKey].asc;
                if (!(identity in best) || (asc ? score < best[identity] : score > best[identity])) best[identity] = score;
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

        // 3) Classement global (somme des meilleurs scores des mini-jeux maison ;
        //    les jeux tiers ont des échelles trop différentes : temps, population…)
        const globalMap = {};
        for (const g of gameOrder) {
            if (SCORE_META[g] || (inhouseMeta(g) && inhouseMeta(g).noGlobal)) continue;
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
                .sort((a, b) => (SCORE_META[g] && SCORE_META[g].asc) ? a.score - b.score : b.score - a.score);
        }

        // 5) Temps de jeu (tous les jeux, y compris les jeux tiers sans score).
        //    Seuls les comptes existants comptent (un compte supprimé disparaît du classement).
        const ranktime = (timeSnap && timeSnap.val()) || {};
        const timeTotal = {};
        const timeList = {};
        for (const g in ranktime) {
            const rows = [];
            for (const id in ranktime[g] || {}) {
                const sec = Number(ranktime[g][id]) || 0;
                if (sec < 1 || !users[id]) continue;
                rows.push(Object.assign({ identity: id, seconds: sec }, info(id)));
                timeTotal[id] = (timeTotal[id] || 0) + sec;
            }
            timeList[g] = rows.sort((a, b) => b.seconds - a.seconds);
        }
        timeList.__all__ = Object.keys(timeTotal)
            .map(id => Object.assign({ identity: id, seconds: timeTotal[id] }, info(id)))
            .sort((a, b) => b.seconds - a.seconds);

        lbData = { globList, perGameList, games: gameOrder, timeList, timeReady: !!timeSnap };
        buildLbTabs();
        renderLeaderboard();
    } catch (e) {
        lbContent.innerHTML = '<p class="empty">Impossible de charger le classement.</p>';
    }
}

// Onglets : sélecteur « Scores / Temps de jeu », puis une rangée de jeux qui défile.
// Scores = mini-jeux maison + jeux tiers (window.joxiaScore). Temps = ranktime, clé « t:<ID> ».
function buildLbTabs() {
    const timeMode = lbActive.indexOf('t:') === 0;
    const scoreTabs = [{ key: '__global__', label: 'Global' }].concat(
        (lbData ? lbData.games : []).filter(g => !SCORE_META[g]).map(g => ({ key: g, label: gameLabel(g) })),
        EXTERNAL_GAMES.filter(g => SCORE_META[g.id]).map(g => ({ key: g.id, label: g.name }))
    );
    const timeTabs = [{ key: 't:__all__', label: 'Tous les jeux' }].concat(
        EXTERNAL_GAMES.map(g => ({ key: 't:' + g.id, label: g.name }))
    );
    const tab = t => `<button class="lb-tab${t.key === lbActive ? ' active' : ''}" data-game="${t.key}" role="tab" aria-selected="${t.key === lbActive}">${escapeHtml(t.label)}</button>`;
    lbTabs.innerHTML =
        `<div class="lb-mode" role="group" aria-label="Type de classement">
            <button class="lb-mode-btn${timeMode ? '' : ' active'}" data-game="__global__" aria-pressed="${!timeMode}">🏆 Scores</button>
            <button class="lb-mode-btn${timeMode ? ' active' : ''}" data-game="t:__all__" aria-pressed="${timeMode}">⏱ Temps de jeu</button>
        </div>
        <div class="lb-row-tabs">${(timeMode ? timeTabs : scoreTabs).map(tab).join('')}</div>`;
    lbTabs.querySelectorAll('.lb-mode-btn').forEach(b => b.onclick = () => {
        if (b.classList.contains('active')) return;
        lbActive = b.dataset.game;
        buildLbTabs();
        renderLeaderboard();
    });
    const act = lbTabs.querySelector('.lb-tab.active');
    if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
    lbTabs.querySelectorAll('.lb-tab').forEach(b => b.onclick = () => {
        lbActive = b.dataset.game;
        buildLbTabs();
        renderLeaderboard();
    });
}

const medal = i => {
    if (i < 3) {
        const c = ['#FFC24B', '#C9D1D9', '#E8A063'][i];
        return `<span class="lb-medal" style="background:${c}">${i + 1}</span>`;
    }
    return String(i + 1);
};

function lbRow(item, i, scoreKey) {
    const isMe = currentUser && item.identity === currentUser.uid;
    const avatar = item.avatar
        ? `<img class="lb-avatar" src="${avatarUrl(item.avatar, 40)}" alt="">`
        : `<span class="lb-avatar ghost"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>`;
    const you = isMe ? '<em class="lb-you">toi</em>' : '';
    return `<div class="lb-row${isMe ? ' me' : ''}${i < 3 ? ' top' : ''}">
        <span class="lb-rank">${medal(i)}</span>
        ${avatar}
        <span class="lb-name">${escapeHtml(item.name)} ${you}</span>
        <span class="lb-score">${scoreKey === 'seconds' ? fmtPlayed(item.seconds) : scoreKey === 'score' && SCORE_META[lbActive] ? fmtScore(lbActive, item.score) : scoreKey === 'score' && inhouseMeta(lbActive) && inhouseMeta(lbActive).money ? fmtEuro(item.score) : item[scoreKey]}</span>
    </div>`;
}

function renderLeaderboard() {
    if (!lbData) return;
    if (lbActive.indexOf('t:') === 0) {
        const id = lbActive.slice(2);
        const rows = (lbData.timeList[id] || []).map((it, i) => lbRow(it, i, 'seconds'));
        const name = id === '__all__' ? 'Joxia' : ((CATALOG[id] && CATALOG[id].name) || id);
        lbContent.innerHTML = rows.length ? rows.join('')
            : lbData.timeReady
                ? `<p class="empty">Personne n'a encore de temps de jeu sur ${escapeHtml(name)}. Lance une partie (connecté) pour ouvrir le classement !</p>`
                : '<p class="empty">Le classement du temps de jeu n\'est pas encore activé (règles Firebase « ranktime » à déployer).</p>';
        return;
    }
    const meta = SCORE_META[lbActive];
    const list = lbActive === '__global__'
        ? lbData.globList.map((it, i) => lbRow(it, i, 'total'))
        : meta && meta.time
            ? (lbData.timeList[lbActive] || []).map((it, i) => lbRow(it, i, 'seconds'))
            : (lbData.perGameList[lbActive] || []).map((it, i) => lbRow(it, i, 'score'));
    const hint = lbActive === '__global__'
        ? '<p class="lb-hint">Somme des meilleurs scores des mini-jeux Joxia</p>'
        : meta ? `<p class="lb-hint">${escapeHtml(meta.what)}</p>`
        : inhouseMeta(lbActive) ? `<p class="lb-hint">${escapeHtml(inhouseMeta(lbActive).what)}</p>` : '';
    lbContent.innerHTML = hint + (list.length
        ? list.join('')
        : '<p class="empty">Aucun score pour l\'instant. Joue (connecté) pour apparaître ici !</p>');
}

// Recopie le temps déjà joué (playtime privé du joueur) dans le classement public
// ranktime, pour que les parties d'avant l'ouverture du classement comptent.
// Les règles n'autorisent qu'une valeur ≤ playtime (+120 s) : pas de triche possible.
async function syncRankTime(uid) {
    try {
        const games = (await get(ref(db, `playtime/${uid}/games`))).val() || {};
        for (const g in games) {
            const sec = Math.floor(Number(games[g] && games[g].seconds) || 0);
            if (sec < 1 || !/^[A-Z0-9_]{1,32}$/.test(g)) continue;
            const r = ref(db, `ranktime/${g}/${uid}`);
            const cur = Number((await get(r)).val()) || 0;
            if (cur < sec) await set(r, sec).catch(() => {});
        }
    } catch (e) { /* règles pas encore déployées : sans effet */ }
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
        const sync = () => { fsBtn.title = isFs() ? 'Quitter le plein écran' : 'Plein écran'; };
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
    el('togglePw').innerHTML = show
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
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
    const presenceRef = ref(db, `presence/${uid}`);
    presenceUnsub = onValue(connectedRef, snap => {
        if (snap.val() === true) {
            onDisconnect(onlineRef).remove();
            onDisconnect(lastSeenRef).set(Date.now());
            onDisconnect(presenceRef).remove();
            set(onlineRef, true);
            set(presenceRef, true);
        }
    });
}

function renderUserButton() {
    const connect = el('spConnect');
    const userBox = el('spUser');
    if (currentUser && profile) {
        const name = profile.displayName || profile.username || 'Joueur';
        el('spName').textContent = name;
        el('spAvatar').src = avatarUrl(profile.avatar, 96);
        el('spDot').className = 'sp-dot ' + (profile.online ? 'on' : 'off');
        connect.style.display = 'none';
        userBox.style.display = 'block';
        loadSidebarLevel();
    } else {
        connect.style.display = 'flex';
        userBox.style.display = 'none';
    }
}

/* Niveau & XP de la sidebar (somme des meilleurs scores par jeu) */
async function loadSidebarLevel() {
    if (!currentUser) return;
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
        const total = Object.values(best).reduce((a, b) => a + b, 0);
        const level = 1 + Math.floor(total / 1000);
        el('spLevel').textContent = 'Niveau ' + level;
        el('spXpFill').style.width = Math.min(100, (total % 1000) / 1000 * 100) + '%';
    } catch (e) {
        el('spLevel').textContent = 'Niveau 1';
        el('spXpFill').style.width = '0%';
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
    // Re-génère aussi les vignettes pour qu'elles suivent le seed + fond actuels
    document.querySelectorAll('.avatar-opt').forEach(b => {
        b.classList.toggle('active', b.dataset.style === avatarDraft.style);
        const img = b.querySelector('img');
        if (img) img.src = avatarUrl({ style: b.dataset.style, seed: avatarDraft.seed || 'X', bg: avatarDraft.bg }, 80);
    });
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
    [chatGlobalUnsub, chatListUnsub, chatThreadUnsub].forEach(f => { if (f) f(); });
    chatGlobalUnsub = chatListUnsub = chatThreadUnsub = null;
    chatThread = null;
    if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
}

function renderRequests(requests) {
    const list = el('requestsList');
    const entries = requests ? Object.entries(requests) : [];
    const badge = el('navFriendsBadge');
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
            <button class="mini-btn fmsg" data-uid="${uid}" title="Envoyer un message"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3 20l1-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg></button>
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
        row.querySelector('.mini-btn.fmsg').onclick = () => startDM(uid);
        row.querySelector('.ghost-btn.danger').onclick = () => removeFriend(uid);
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

/* ================= CHAT (DM entre amis + salon communautaire) ================= */
function convId(a, b) { return [a, b].sort().join('_'); }

// Ouvre (ou crée) une conversation privée avec un ami depuis la liste d'amis
function startDM(uid) {
    if (!currentUser) return;
    const cid = convId(currentUser.uid, uid);
    if (!chatGlobalUnsub) attachChatListeners(currentUser.uid);
    openThread('dm', cid, uid);
    closeModal('friendsModal');
    openModal('chatModal');
}

async function getUser(uid) {
    if (!uid) return null;
    if (userCache[uid]) return userCache[uid];
    const snap = await get(ref(db, `users/${uid}`));
    const p = snap.val();
    if (p) userCache[uid] = p;
    return p;
}

function fmtTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Snapshot « expéditeur » réutilisé pour chaque message envoyé
function senderSnapshot() {
    const name = (profile && (profile.displayName || profile.username)) || (currentUser ? currentUser.email.split('@')[0] : '?');
    return {
        from: currentUser.uid,
        name: name,
        avatar: (profile && profile.avatar) || { style: 'adventurer', seed: name },
    };
}

function openChat() {
    if (!currentUser) {
        alert('Connecte-toi pour discuter !');
        openModal('authModal');
        return;
    }
    if (!chatGlobalUnsub) attachChatListeners(currentUser.uid);
    if (!chatThread) openThread('global');
    openModal('chatModal');
    const input = el('chatInput'); if (input) input.focus();
}

function attachChatListeners(uid) {
    if (chatGlobalUnsub) chatGlobalUnsub();
    if (chatListUnsub) chatListUnsub();
    // Salon communautaire — 100 derniers messages en temps réel
    chatGlobalUnsub = onValue(query(ref(db, 'globalChat/messages'), limitToLast(100)), snap => {
        globalMessages = snapToMessages(snap);
        if (chatThread && chatThread.type === 'global') renderMessages();
    });
    // Liste des conversations privées (index côté utilisateur)
    chatListUnsub = onValue(ref(db, `userChats/${uid}`), snap => renderChatList(snap.val() || {}));
}

function snapToMessages(snap) {
    const v = snap.val() || {};
    return Object.entries(v).map(([key, m]) => Object.assign({ key }, m));
}

let chatListCache = {};

function renderChatList(list) {
    const box = el('chatList');
    if (!box) return;
    chatListCache = list || {};
    const entries = Object.entries(chatListCache).sort((a, b) => (b[1].lastTs || 0) - (a[1].lastTs || 0));
    const unreadTotal = entries.reduce((s, [, c]) => s + (c.unread || 0), 0);
    const badge = el('navChatBadge');
    if (badge) { badge.textContent = unreadTotal; badge.style.display = unreadTotal ? 'inline-block' : 'none'; }

    const globalActive = chatThread && chatThread.type === 'global';
    const html = [`
        <button class="chat-item${globalActive ? ' active' : ''}" data-type="global">
            <span class="chat-item__ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
            <span class="chat-item__meta"><b>Communauté</b><span>Salon public</span></span>
        </button>`];
    entries.forEach(([cid, c]) => {
        const active = chatThread && chatThread.type === 'dm' && chatThread.convId === cid;
        html.push(`
            <button class="chat-item${active ? ' active' : ''}" data-conv="${cid}">
                <span class="chat-item__avatar"><img src="${avatarUrl(c.withAvatar || { style: 'adventurer', seed: c.withName || 'x' }, 64)}" alt=""></span>
                <span class="chat-item__meta"><b>${escapeHtml(c.withName || 'Ami')}</b><span>${escapeHtml(c.lastText || 'Commence la discussion')}</span></span>
                ${c.unread ? `<em class="chat-item__badge">${c.unread}</em>` : ''}
            </button>`);
    });
    box.innerHTML = html.join('');
    box.querySelector('[data-type="global"]').onclick = () => openThread('global');
    box.querySelectorAll('.chat-item[data-conv]').forEach(b => {
        b.onclick = () => openThread('dm', b.dataset.conv, chatListCache[b.dataset.conv] && chatListCache[b.dataset.conv].with);
    });
}

async function openThread(type, convId, withUid) {
    if (!currentUser) return;
    if (chatThreadUnsub) { chatThreadUnsub(); chatThreadUnsub = null; }
    chatThread = { type, convId };
    const title = el('chatTitle');
    const sub = el('chatSubtitle');

    if (type === 'global') {
        title.textContent = 'Communauté Joxia';
        sub.innerHTML = '<i class="dot on"></i> Salon public — sois sympa';
        renderMessages();
    } else {
        const friend = (await getUser(withUid)) || {};
        const name = friend.displayName || friend.username || 'Ami';
        chatThread.with = friend;
        chatThread.otherUid = withUid;
        chatThread.withName = name;
        chatThread.withAvatar = friend.avatar || { style: 'adventurer', seed: name };
        title.textContent = name;
        sub.innerHTML = `<i class="dot ${friend.online ? 'on' : 'off'}"></i> ${friend.online ? 'En ligne' : 'Hors ligne'}`;
        dmMessages = [];
        update(ref(db, `userChats/${currentUser.uid}/${convId}/unread`), 0).catch(() => {});
        chatThreadUnsub = onValue(query(ref(db, `chats/${convId}/messages`), limitToLast(100)), snap => {
            dmMessages = snapToMessages(snap);
            if (chatThread && chatThread.type === 'dm' && chatThread.convId === convId) renderMessages();
        });
    }
    renderChatList(chatListCache);
    const layout = el('chatLayout'); if (layout) layout.classList.add('open');
    const input = el('chatInput'); if (input) input.focus();
}

function renderMessages() {
    const box = el('chatMessages');
    if (!box) return;
    const list = chatThread && chatThread.type === 'global' ? globalMessages : dmMessages;
    if (!list.length) {
        box.innerHTML = '<p class="chat-empty">Aucun message. Dis bonjour !</p>';
        return;
    }
    box.innerHTML = list.map(m => {
        const mine = m.from === currentUser.uid;
        return `<div class="msg${mine ? ' mine' : ''}">
            ${mine ? '' : `<img class="msg__avatar" src="${avatarUrl(m.avatar || { style: 'adventurer', seed: m.name || 'x' }, 48)}" alt="">`}
            <div class="msg__body">
                ${m.name ? `<span class="msg__name">${escapeHtml(m.name)}</span>` : ''}
                <span class="msg__text">${escapeHtml(m.text)}</span>
                <span class="msg__time">${fmtTime(m.ts)}</span>
            </div>
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
    if (!currentUser || !chatThread) return;
    const input = el('chatInput');
    const text = input.value.trim();
    if (!text) return;
    const s = senderSnapshot();
    const msg = Object.assign({}, s, { text, ts: Date.now() });

    if (chatThread.type === 'global') {
        try {
            await push(ref(db, 'globalChat/messages'), msg);
        } catch (e) {
            const ban = await get(ref(db, `banned/${currentUser.uid}`)).catch(() => null);
            alert(ban && ban.exists() ? 'Tu as été banni du chat par un administrateur.' : 'Message non envoyé. Réessaie.');
            return;
        }
    } else {
        const cid = chatThread.convId;
        const otherUid = chatThread.otherUid;
        await push(ref(db, `chats/${cid}/messages`), msg);
        const updates = {};
        updates[`userChats/${currentUser.uid}/${cid}`] = {
            with: otherUid, withName: chatThread.withName, withAvatar: chatThread.withAvatar,
            lastText: text, lastTs: msg.ts, unread: 0,
        };
        updates[`userChats/${otherUid}/${cid}`] = {
            with: currentUser.uid, withName: s.name, withAvatar: s.avatar,
            lastText: text, lastTs: msg.ts, unread: increment(1),
        };
        await update(ref(db), updates);
    }
    input.value = '';
    input.focus();
}

const chatSendBtn = el('chatSendBtn');
if (chatSendBtn) chatSendBtn.onclick = sendMessage;
const chatInputEl = el('chatInput');
if (chatInputEl) chatInputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
const chatBackBtn = el('chatBackBtn');
if (chatBackBtn) chatBackBtn.onclick = () => {
    const layout = el('chatLayout'); if (layout) layout.classList.remove('open');
};

/* ================= PARAMÈTRES (thème / sons) ================= */
function applyTheme(theme, saveProfile = true) {
    if (theme !== 'dark' && theme !== 'light') theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
    el('darkToggle').checked = theme === 'dark';
    el('themeColorMeta').content = theme === 'dark' ? '#050812' : '#FFF7EC';
    try { localStorage.setItem('joxia-theme-v2', theme); } catch (e) {}
    if (saveProfile && currentUser) {
        update(ref(db, `users/${currentUser.uid}/theme`), theme).catch(() => {});
    }
}

/* ================= JEUX (rendu dynamique + ouverture centralisée) ================= */
const GAMES = [
    { id: 'SNAKE', desc: 'Le classique : mange, grandis et évite ta propre queue.', name: 'Snake Joxia',       image: 'Snake.png',          tags: ['Arcade', 'Rétro'],       url: 'https://joxiagame.github.io/Snake-Joxia/' },
    { id: 'FLAPPY', desc: 'Tape pour voler entre les tuyaux, le plus loin possible.', name: 'Flappy Joxia',      image: 'Flappy Bird.png',    tags: ['Arcade', 'Réflexes'],    url: 'https://joxiagame.github.io/Flappy-Bird-Joxia/', isNew: true },
    { id: 'TETRIS', desc: 'Empile les blocs et fais tomber les lignes.', name: 'Tetris Joxia',      image: 'Tetris.png',         tags: ['Puzzle', 'Briques'],     url: 'https://joxiagame.github.io/Tetris-Joxia/' },
    { id: 'BALLBLAST', desc: "Tire sur les boules avant qu'elles ne t'écrasent.", name: 'Ball Blast Joxia',  image: 'Ball Blast.png',     tags: ['Action', 'Tir'],         url: 'https://joxiagame.github.io/Ball-Blast-joxia/' },
    { id: 'BRICKBLAST', desc: 'Casse toutes les briques avec ta balle.', name: 'Brick Blast Joxia', image: 'Brick Blast.png',    tags: ['Arcade', 'Casse-briques'], url: 'https://joxiagame.github.io/Breakout-Joxia/', isNew: true },
    { id: '2048', desc: "Fusionne les tuiles jusqu'à atteindre 2048.", name: '2048 Joxia',        image: '2048.png',           tags: ['Puzzle', 'Chiffres'],    url: 'https://joxiagame.github.io/2048-joxia/', isNew: true },
    { id: 'PACMAN', desc: 'Mange les pac-gommes sans croiser les fantômes.', name: 'Pac-Man Joxia',     image: 'Pac-Man.png',        tags: ['Arcade', 'Labyrinthe'],  url: 'https://joxiagame.github.io/Pacman-Joxia/', isNew: true },
    { id: 'CODEBREAKER', desc: "Trouve le code secret en un minimum d'essais.", name: 'Codebreaker Joxia', image: 'Codebreaker.webp',   tags: ['Puzzle', 'Décodage'],    url: 'https://joxiagame.github.io/Codebreaker-Joxia/', isNew: true },
    { id: 'CRYPTO', desc: 'Achète, revends et deviens le roi du trading.', name: 'Crypto Tycoon Joxia', image: 'Crypto Tycoon.png', tags: ['Stratégie', 'Trading'], url: 'https://joxiagame.github.io/Crypto-Tycoon-Joxia/', isNew: true },
    { id: 'POOL', desc: 'Billard 8-ball : empoche tes billes, puis la noire.', name: 'Billard Joxia',       image: 'Billard.png',        tags: ['Sport', '8-ball'],       url: 'https://joxiagame.github.io/Pool-Joxia/', isNew: true },
];

let showAll = false;

function renderGames() {
    const grid = el('gamesGrid');
    if (!grid) return;
    grid.innerHTML = GAMES.map((g, i) => `
        <article class="game-card${i >= 5 ? ' extra' : ''}">
            <div class="game-card__cover">
                <img src="${g.image}?v=2" alt="${g.name}" loading="lazy" decoding="async">
                ${g.isNew ? '<span class="cover-badge">NOUVEAU</span>' : ''}
            </div>
            <div class="game-card__content">
                <div class="game-card__header">
                    <span class="game-icon">${g.name.charAt(0)}</span>
                    <div>
                        <h3>${g.name}</h3>
                        <span class="game-status"><i class="dot on"></i> Jouable en ligne</span>
                    </div>
                </div>
                <div class="game-card__tags">${g.tags.map(t => `<span>${t}</span>`).join('')}</div>
                <button class="game-card__play${i === 0 ? ' primary' : ''}" data-url="${g.url}"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="flex-shrink:0"><path d="M8 5v14l11-7z"/></svg> Jouer</button>
            </div>
        </article>`).join('');
    grid.querySelectorAll('.game-card__play').forEach(b => {
        b.onclick = () => openGame(b.dataset.url);
    });
}

const toggleGames = el('toggleGames');
if (toggleGames) {
    toggleGames.onclick = () => {
        showAll = !showAll;
        const grid = el('gamesGrid');
        if (grid) grid.classList.toggle('show-all', showAll);
        toggleGames.textContent = showAll ? 'Réduire ↑' : 'Voir tous les jeux →';
    };
}

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

renderGames();

/* ================= TENDANCES (carrousel en direct) =================
   Classement = temps joué sur 7 jours (stats/{ID}/d/{AAAAMMJJ}, écrit par tracker.js)
   + joueurs en jeu maintenant (live/{ID}/{uid}), chaque joueur présent pesant 30 min.
   Sans données (règles pas encore publiées, plateforme calme) : sélection « À la une ». */
const EXTERNAL_GAMES = [
    { id: 'INFINITECRAFT', name: 'Infinite Craft', image: 'infinite-craft.png', tags: ['Alchimie', 'Découverte'], url: 'https://joxiagame.github.io/infinite-craft-joxia/', desc: "Combine l'eau, le feu, le vent et la terre pour créer des milliers d'éléments." },
    { id: 'HEXGL', name: 'HexGL', image: 'hexgl.png', tags: ['Course', '3D'], url: 'https://joxiagame.github.io/hexgl-joxia/', desc: 'Course futuriste en 3D, à pleine vitesse.' },
    { id: 'SHAPEZ', name: 'Shapez.io', image: 'shapez.png', tags: ['Automatisation', 'Usine'], url: 'https://joxiagame.github.io/Shapez-joxia/', desc: 'Construis une usine géante qui assemble des formes à l’infini.' },
    { id: 'ADARKROOM', name: 'A Dark Room', image: 'a-dark-room.png', tags: ['Aventure', 'Incrémental'], url: 'https://joxiagame.github.io/a-dark-room-joxia/', desc: 'Rallume le feu… et découvre ce qui t’attend dehors.' },
    { id: 'MINDUSTRY', name: 'Mindustry', image: 'mindustry.png', tags: ['Tycoon', 'Tower Defense'], url: 'https://joxiagame.github.io/Mindustry-joxia/', desc: 'Automatise ta base et défends-la contre les vagues ennemies.' },
    { id: '3DCITY', name: '3d.city', image: '3d-city.png', tags: ['Gestion', 'Ville'], url: 'https://joxiagame.github.io/3d-city-joxia/', desc: 'Bâtis et gère ta propre ville en 3D.' },
    { id: 'SURVIVOR', name: 'Survivor', image: 'survivor.png', tags: ['Roguelite', 'Survie'], url: 'https://joxiagame.github.io/survivor-joxia/', desc: 'Survis aux hordes et deviens toujours plus puissant.' },
    { id: 'SANDSPIEL', name: 'Sandspiel', image: 'sandspiel.png', tags: ['Bac à sable', 'Physique'], url: 'https://joxiagame.github.io/sandspiel-joxia/', desc: 'Fais couler du sable, de l’eau, du feu… et observe.' },
    { id: 'TOWERDEFENSE', name: 'Tower Defense', image: 'tower-defense.png', tags: ['Stratégie', 'Tower Defense'], url: 'https://joxiagame.github.io/tower-defense-joxia/', desc: 'Place tes tours et repousse les vagues d’ennemis.' },
    { id: 'HEXTRIS', name: 'Hextris', image: 'hextris.png', tags: ['Puzzle', 'Réflexes'], url: 'https://joxiagame.github.io/hextris-joxia/', desc: 'Tourne l’hexagone et aligne les couleurs.' },
    { id: 'POND', name: 'The Pond', image: 'pond.png', tags: ['Arcade', 'Survie'], url: 'https://joxiagame.github.io/pond-joxia/', desc: 'Nage, mange et grandis dans un étang néon.' },
    { id: 'DRAKONAS', name: 'Drakonas', image: 'drakonas.png', tags: ['Action', 'Avions'], url: 'https://joxiagame.github.io/drakonas-joxia/', desc: 'Pilote ton avion de chasse et abats tout ce qui bouge.' },
    { id: 'RAGINGGARDENS', name: 'Raging Gardens', image: 'raging-gardens.png', tags: ['Arcade', 'Action'], url: 'https://joxiagame.github.io/raging-gardens-joxia/', desc: 'Un lapin ninja, des carottes… et des flatulences tactiques.' },
    { id: 'PARTICLECLICKER', name: 'Particle Clicker', image: 'particle-clicker.png', tags: ['Clicker', 'Science'], url: 'https://joxiagame.github.io/particle-clicker-joxia/', desc: 'Dirige ton labo de physique, clic après clic.' },
    { id: 'DRUNKENVIKING', name: 'Drunken Viking', image: 'drunken-viking.png', tags: ['Arcade', 'Pixel art'], url: 'https://joxiagame.github.io/drunken-viking-joxia/', desc: 'Un viking éméché, un labyrinthe à traverser.' },
];
const CATALOG = {};
GAMES.forEach(g => { CATALOG[g.id] = Object.assign({ internal: true }, g); });
EXTERNAL_GAMES.forEach(g => { CATALOG[g.id] = g; });
const TREND_DEFAULT = ['HEXGL', 'INFINITECRAFT', 'SHAPEZ', 'ADARKROOM', 'SNAKE', 'TETRIS', 'MINDUSTRY', '3DCITY'];
const TREND_MAX = 8, TREND_DAYS = 7, TREND_AUTOPLAY = 7000;

const trend = { live: null, stats: null, order: [], index: 0, timer: null, pausedUntil: 0, hadData: false, loaded: { live: false, stats: false } };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fmtPlayed(sec) {
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (h >= 1) return `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}`;
    return `${Math.max(1, m)} min`;
}
function trendScores() {
    const days = [];
    for (let i = 0; i < TREND_DAYS; i++) days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10).replace(/-/g, ''));
    const stale = Date.now() - 12 * 3600e3;  // présence oubliée (onDisconnect raté) : ignorée
    return Object.keys(CATALOG).map(id => {
        const d = (trend.stats && trend.stats[id] && trend.stats[id].d) || {};
        const week = days.reduce((n, k) => n + (Number(d[k]) || 0), 0);
        const live = Object.values((trend.live && trend.live[id]) || {}).filter(t => typeof t !== 'number' || t > stale).length;
        const plays = Number(trend.stats && trend.stats[id] && trend.stats[id].plays) || 0;
        return { id, week, live, plays, score: week + live * 1800 };
    });
}
function trendRanking() {
    const scored = trendScores().filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    const ranked = scored.slice(0, TREND_MAX);
    const hasData = ranked.length > 0;
    // compléter avec la sélection par défaut pour garder un carrousel bien rempli
    const target = hasData ? Math.max(5, ranked.length) : TREND_MAX;
    for (const id of TREND_DEFAULT) {
        if (ranked.length >= target) break;
        if (!ranked.some(x => x.id === id)) ranked.push({ id, week: 0, live: 0, plays: 0, score: 0 });
    }
    return { list: ranked, hasData };
}
function slideStats(x) {
    const out = [];
    if (!x.live && !x.week && !x.plays) {
        // pas encore de chiffres pour ce jeu : infos réelles plutôt que des statistiques inventées
        const g = CATALOG[x.id] || {};
        return (g.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join('') + '<span>🎮 Gratuit · sans installation</span>';
    }
    if (x.live) out.push(`<span class="is-live">${x.live} joueur${x.live > 1 ? 's' : ''} en ce moment</span>`);
    if (x.week) out.push(`<span>⏱ ${fmtPlayed(x.week)} jouées cette semaine</span>`);
    if (x.plays) out.push(`<span>▶ ${x.plays.toLocaleString('fr-FR')} partie${x.plays > 1 ? 's' : ''}</span>`);
    return out.join('');
}
function imgSrc(g) { return g.internal ? `${encodeURI(g.image)}?v=2` : encodeURI(g.image); }

function renderTrending() {
    const track = el('trendTrack'), thumbs = el('trendThumbs');
    if (!track) return;
    const { list, hasData } = trendRanking();
    el('trendLabel').textContent = hasData ? 'Tendances du moment' : 'À la une';
    el('trendLive').hidden = !hasData;
    const ids = list.map(x => x.id);
    const sameOrder = ids.join() === trend.order.join();
    if (sameOrder) {
        // même classement : on ne met à jour que les chiffres (pas de saut visuel)
        list.forEach((x, i) => {
            const st = track.children[i] && track.children[i].querySelector('.trend-stats');
            if (st) st.innerHTML = slideStats(x);
            const dot = thumbs.children[i] && thumbs.children[i].querySelector('.tdot');
            if (dot) dot.hidden = !x.live;
        });
        return;
    }
    const currentId = trend.order[trend.index];
    trend.order = ids;
    const n = list.length;
    track.innerHTML = list.map((x, i) => {
        const g = CATALOG[x.id];
        return `<li class="trend-slide" role="group" aria-roledescription="diapositive" aria-label="${i + 1} sur ${n} : ${escapeHtml(g.name)}">
            <img class="trend-bg" src="${imgSrc(g)}" alt="" ${i ? 'loading="lazy"' : ''} decoding="async">
            <div class="trend-info">
                ${hasData && x.score ? `<span class="trend-rank">🔥 N°${i + 1} des tendances</span>` : '<span class="trend-rank">⭐ À découvrir</span>'}
                <h3>${escapeHtml(g.name)}</h3>
                <p class="trend-desc">${escapeHtml(g.desc || '')}</p>
                <div class="trend-stats">${slideStats(x)}</div>
                <button class="trend-play" type="button" data-id="${x.id}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                    Jouer à ${escapeHtml(g.name)}
                </button>
            </div>
            <div class="trend-art"><img src="${imgSrc(g)}" alt="${escapeHtml(g.name)}" ${i ? 'loading="lazy"' : ''} decoding="async"></div>
        </li>`;
    }).join('');
    thumbs.innerHTML = list.map((x, i) => {
        const g = CATALOG[x.id];
        return `<button class="trend-thumb" type="button" role="tab" aria-selected="false" data-i="${i}" aria-label="${escapeHtml(g.name)}">
            <img src="${imgSrc(g)}" alt="" loading="lazy" decoding="async"><b>${i + 1}</b> ${escapeHtml(g.name)}<i class="tdot" ${x.live ? '' : 'hidden'}></i>
        </button>`;
    }).join('');
    track.querySelectorAll('.trend-play').forEach(b => { b.onclick = () => playFromTrend(b.dataset.id); });
    thumbs.querySelectorAll('.trend-thumb').forEach(b => { b.onclick = () => { trendGo(+b.dataset.i); trendPause(12000); }; });
    // garde à l'écran le jeu qu'on regardait, même s'il change de rang ;
    // à l'arrivée des premières vraies données, on repart du N°1
    const keep = trend.hadData ? Math.max(0, ids.indexOf(currentId)) : 0;
    trend.hadData = hasData && trend.loaded.live && trend.loaded.stats;
    trendGo(keep, true);
}
function playFromTrend(id) {
    const g = CATALOG[id];
    if (!g) return;
    if (g.internal) openGame(g.url);          // jeux maison : connexion + pseudo/avatar transmis
    else window.location.href = g.url;       // jeux tiers : sauvegarde locale, lien direct
}
function trendGo(i, instant) {
    const track = el('trendTrack'), n = trend.order.length;
    if (!track || !n) return;
    trend.index = (i + n) % n;
    track.scrollTo({ left: trend.index * track.clientWidth, behavior: instant || reduceMotion ? 'auto' : 'smooth' });
    trendSync();
}
function trendSync() {
    const thumbs = el('trendThumbs');
    if (!thumbs) return;
    [...thumbs.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === trend.index)));
    const cur = thumbs.children[trend.index];
    if (cur) thumbs.scrollTo({ left: cur.offsetLeft - thumbs.clientWidth / 2 + cur.offsetWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
}
function trendPause(ms) { trend.pausedUntil = Date.now() + ms; }

(function initTrending() {
    const track = el('trendTrack');
    if (!track) return;
    const box = el('trending');
    el('trendPrev').onclick = () => { trendGo(trend.index - 1); trendPause(12000); };
    el('trendNext').onclick = () => { trendGo(trend.index + 1); trendPause(12000); };
    // l'index suit le défilement manuel (doigt, trackpad)
    let raf = 0;
    track.addEventListener('scroll', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
            if (i !== trend.index) { trend.index = i; trendSync(); }
        });
    }, { passive: true });
    track.addEventListener('pointerdown', () => trendPause(12000), { passive: true });
    track.tabIndex = 0;
    track.setAttribute('aria-label', 'Jeux tendance (flèches gauche/droite pour naviguer)');
    box.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); trendGo(trend.index + 1); trendPause(15000); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); trendGo(trend.index - 1); trendPause(15000); }
    });
    // lecture auto : en pause au survol, au focus clavier et onglet caché ; désactivée si mouvement réduit
    let hover = false;
    box.addEventListener('mouseenter', () => { hover = true; });
    box.addEventListener('mouseleave', () => { hover = false; });
    if (!reduceMotion) {
        trend.timer = setInterval(() => {
            if (hover || document.hidden || box.contains(document.activeElement) || Date.now() < trend.pausedUntil) return;
            trendGo(trend.index + 1);
        }, TREND_AUTOPLAY);
    }
    window.addEventListener('resize', () => trendGo(trend.index, true));
    renderTrending();  // sélection par défaut tout de suite, puis données en direct
    onValue(ref(db, 'live'), snap => { trend.live = snap.val() || {}; trend.loaded.live = true; renderTrending(); },
        () => { trend.loaded.live = true; renderTrending(); });
    onValue(ref(db, 'stats'), snap => { trend.stats = snap.val() || {}; trend.loaded.stats = true; renderTrending(); },
        () => { trend.loaded.stats = true; renderTrending(); });
})();

/* ================= NAVIGATION SIDEBAR + PROFIL ================= */
const spConnect = el('spConnect');
if (spConnect) spConnect.onclick = () => openModal('authModal');

const navActions = {
    home: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    games: () => { const g = el('games'); if (g) g.scrollIntoView({ behavior: 'smooth' }); },
    leaderboard: () => { openModal('leaderboardModal'); lbActive = '__global__'; buildLbTabs(); loadLeaderboard(); },
    friends: () => openModal('friendsModal'),
    messages: () => openChat(),
    settings: () => openModal('settingsModal'),
};
document.querySelectorAll('.nav-item[data-nav]').forEach(btn => {
    const key = btn.dataset.nav;
    const action = navActions[key];
    btn.onclick = () => {
        document.querySelectorAll('.nav-item[data-nav]').forEach(b => b.classList.toggle('active', b === btn));
        if (action) action();
    };
});

const spUser = el('spUser');
if (spUser) spUser.onclick = () => openProfileModal();

el('saveProfileBtn').onclick = saveProfile;
el('avatarRandomBtn').onclick = () => {
    avatarDraft.style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    avatarDraft.seed = Math.random().toString(36).slice(2, 8);
    refreshAvatarPreview();
};
el('addFriendBtn').onclick = addFriendByName;
el('darkToggle').onchange = (e) => applyTheme(e.target.checked ? 'dark' : 'light');
el('soundToggle').onchange = (e) => { try { localStorage.setItem('joxia-sound', e.target.checked ? 'on' : 'off'); } catch (err) {} };

function doLogout() { signOut(auth); }
async function doDelete() {
    const user = auth.currentUser;
    if (!user || !confirm('SUPPRIMER DÉFINITIVEMENT TON COMPTE ?')) return;
    // Firebase n'autorise la suppression qu'après une connexion récente (~5 min).
    // On le vérifie AVANT d'effacer quoi que ce soit : sinon les données partent
    // mais le compte reste, ou l'inverse (fiche orpheline dans la base).
    const lastLogin = Date.parse(user.metadata.lastSignInTime || '') || 0;
    if (Date.now() - lastLogin > 4 * 60 * 1000) {
        alert('Pour ta sécurité, reconnecte-toi puis relance la suppression dans les 4 minutes.');
        return signOut(auth);
    }
    const uid = user.uid;
    const uname = (user.email.split('@')[0]).toLowerCase();
    // 1) Couper la présence : sinon les onDisconnect réécrivent users/{uid}/lastSeen
    //    après l'effacement et recréent une fiche fantôme.
    if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
    detachListeners();
    await Promise.all(['online', 'lastSeen'].map(k => onDisconnect(ref(db, `users/${uid}/${k}`)).cancel())
        .concat(onDisconnect(ref(db, `presence/${uid}`)).cancel())).catch(() => {});
    // 2) Effacer les données (les règles exigent d'être encore connecté).
    //    Si le profil ne part pas, on n'efface pas le compte : pas de fiche orpheline.
    try {
        await Promise.all([
            remove(ref(db, `users/${uid}`)),
            remove(ref(db, `usernames/${uname}`)),
        ]);
    } catch (e) {
        alert('Suppression impossible pour le moment. Réessaie.');
        return location.reload();
    }
    await Promise.all([
        remove(ref(db, `friendRequests/${uid}`)),
        remove(ref(db, `presence/${uid}`)),
    ].map(p => p.catch(() => {})));
    // 3) Supprimer le compte de connexion.
    try {
        await deleteUser(user);
        alert('Compte supprimé.');
    } catch (e) {
        alert('Action sensible : reconnecte-toi puis recommence la suppression.');
        signOut(auth);
    }
}
el('logoutBtn2').onclick = doLogout;
el('deleteAccountBtn2').onclick = doDelete;

/* ================= INITIALISATION ================= */
// Thème appliqué dès le chargement (avant la résolution de l'auth)
applyTheme(localStorage.getItem('joxia-theme-v2') || 'light', false);
try {
    el('soundToggle').checked = localStorage.getItem('joxia-sound') !== 'off';
} catch (e) {}

/* ================= SUSPENSION DE COMPTE (décidée par un admin) ================= */
let suspensionUnsub = null, suspensionTimer = null;
function showSuspension(s) {
    let o = document.getElementById('suspendedOverlay');
    if (!s) { if (o) o.remove(); return; }
    if (!o) {
        o = document.createElement('div');
        o.id = 'suspendedOverlay';
        o.setAttribute('role', 'alertdialog');
        o.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:20px;background:rgba(20,14,8,.78);backdrop-filter:blur(6px)';
        document.body.appendChild(o);
    }
    const until = s.until >= 9e12 ? 'définitivement'
        : "jusqu'au " + new Date(s.until).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    o.innerHTML = `<div style="max-width:380px;width:100%;background:var(--surface,#fff);color:var(--text,#20180F);border-radius:18px;padding:28px 24px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.3)">
        <div style="font-size:42px">⛔</div>
        <h2 style="margin:8px 0 6px;font-size:21px">Compte suspendu</h2>
        <p style="margin:0 0 8px;color:var(--text-2,#5C5344)">Ton compte est suspendu ${until}.</p>
        ${s.reason ? `<p style="margin:0 0 14px;color:var(--text-2,#5C5344)">Motif : ${escapeHtml(s.reason)}</p>` : ''}
        <button id="suspendedLogout" style="border:0;background:#FF6A2A;color:#fff;font:inherit;font-weight:700;padding:11px 20px;border-radius:12px;cursor:pointer">Se déconnecter</button>
    </div>`;
    o.querySelector('#suspendedLogout').onclick = () => signOut(auth);
}
function watchSuspension(uid) {
    unwatchSuspension();
    suspensionUnsub = onValue(ref(db, `suspensions/${uid}`), snap => {
        clearTimeout(suspensionTimer);
        const s = snap.val();
        const active = !!(s && s.until > Date.now());
        showSuspension(active ? s : null);
        if (active && s.until < 9e12) suspensionTimer = setTimeout(() => showSuspension(null), Math.min(s.until - Date.now(), 2 ** 31 - 1));
    }, () => {});
}
function unwatchSuspension() {
    if (suspensionUnsub) { suspensionUnsub(); suspensionUnsub = null; }
    clearTimeout(suspensionTimer);
    showSuspension(null);
}

/* ================= ACCÈS ADMIN (lien vers admin/) =================
   Simple raccourci d'interface : les droits restent vérifiés côté
   serveur par les règles Firebase (admins/{uid} === true). */
let adminUnsub = null;
function watchAdmin(uid) {
    unwatchAdmin();
    adminUnsub = onValue(ref(db, `admins/${uid}`),
        snap => { el('navAdmin').style.display = snap.val() === true ? '' : 'none'; },
        () => { el('navAdmin').style.display = 'none'; });
}
function unwatchAdmin() {
    if (adminUnsub) { adminUnsub(); adminUnsub = null; }
    el('navAdmin').style.display = 'none';
}

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        const username = user.email.split('@')[0];
        watchSuspension(user.uid);
        watchAdmin(user.uid);
        await ensureProfile(user, username);
        setupPresence(user.uid);
        if (profileListener) { profileListener(); profileListener = null; }
        profileListener = onValue(ref(db, `users/${user.uid}`), snap => {
            profile = snap.val() || {};
            applyTheme(localStorage.getItem('joxia-theme-v2') || 'light', false);
            renderUserButton();
        });
        attachFriendsListeners(user.uid);
        attachChatListeners(user.uid);
        syncRankTime(user.uid);
    } else {
        profile = null;
        unwatchSuspension();
        unwatchAdmin();
        detachListeners();
        renderUserButton();
    }
});

/* ================= NOTIF DISCORD (relance douce, 1× par semaine) ================= */
const discordToast = el('discordToast');
if (discordToast) {
    const DISCORD_TOAST_KEY = 'joxia-discord-toast-dismissed';
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const closeToast = () => discordToast.classList.remove('show');
    discordToast.querySelector('.discord-toast__close').onclick = () => {
        try { localStorage.setItem(DISCORD_TOAST_KEY, String(Date.now())); } catch (e) {}
        closeToast();
    };
    let lastDismiss = 0;
    try { lastDismiss = parseInt(localStorage.getItem(DISCORD_TOAST_KEY), 10) || 0; } catch (e) {}
    if (Date.now() - lastDismiss > WEEK) {
        setTimeout(() => discordToast.classList.add('show'), 3500);
    }
}
