/* ============================================================
   JOXIA · traceur de temps de jeu + blocage des comptes suspendus
   À inclure dans chaque jeu (une seule ligne) :
     <script type="module" src="https://joxiagame.github.io/Joxia-Games/tracker.js?game=SNAKE"></script>
   Réutilise la connexion du hub (même domaine). Si le joueur n'est pas
   connecté, rien n'est enregistré. Seul le temps où l'onglet est visible compte.
   Données : playing/{uid} (jeu en cours) et playtime/{uid} (cumuls).
   Tendances (lecture publique, carrousel du hub) : live/{JEU}/{uid} (en jeu
   maintenant) et stats/{JEU}/d/{AAAAMMJJ} (secondes jouées ce jour-là, UTC).
   Ces écritures sont séparées : si les règles les refusent, le reste marche.
   ============================================================ */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, update, remove, onValue, onDisconnect, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCPecKQH6DURfYitjY4bXMeW0URLrcNnsI",
    authDomain: "joxiahub-2928b.firebaseapp.com",
    projectId: "joxiahub-2928b",
    storageBucket: "joxiahub-2928b.firebasestorage.app",
    messagingSenderId: "303698595695",
    appId: "1:303698595695:web:5c99c2cb2a9ea88e36a29a",
    databaseURL: "https://joxiahub-2928b-default-rtdb.europe-west1.firebasedatabase.app"
};
const HUB = 'https://joxiagame.github.io/Joxia-Games/';
const GAME = (new URL(import.meta.url).searchParams.get('game') || 'UNKNOWN').replace(/[.#$[\]/]/g, '_');
const FLUSH_MS = 15000;
const dayKey = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');  // AAAAMMJJ (UTC)

// L'app « [DEFAULT] » partage la session enregistrée par le hub sur ce domaine.
const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let uid = null, pending = 0, lastTick = 0, timer = null, suspUnsub = null, suspTimer = null, blocked = false;
let visible = document.visibilityState === 'visible';

// Cumule le temps visible écoulé depuis le dernier passage.
function tick() {
    const now = Date.now();
    if (visible && lastTick && !blocked) pending += now - lastTick;
    lastTick = now;
}
function flush() {
    tick();
    const s = Math.floor(pending / 1000);
    if (!uid || s < 1) return;
    pending -= s * 1000;
    update(ref(db), {
        [`playtime/${uid}/games/${GAME}/seconds`]: increment(s),
        [`playtime/${uid}/games/${GAME}/last`]: serverTimestamp(),
        [`playtime/${uid}/total`]: increment(s),
        [`playtime/${uid}/lastGame`]: GAME,
        [`playtime/${uid}/lastAt`]: serverTimestamp(),
    }).catch(() => {});
    // agrégat public anonyme pour les tendances (plafonné, comme le vérifient les règles)
    update(ref(db), { [`stats/${GAME}/d/${dayKey()}`]: increment(Math.min(s, 120)) }).catch(() => {});
}
function setPlaying(on) {
    if (!uid) return;
    const r = ref(db, `playing/${uid}`), l = ref(db, `live/${GAME}/${uid}`);
    if (on && !blocked) {
        set(r, { game: GAME, since: serverTimestamp() }).catch(() => {});
        onDisconnect(r).remove().catch(() => {});
        set(l, serverTimestamp()).then(() => onDisconnect(l).remove()).catch(() => {});
    } else {
        remove(r).catch(() => {});
        remove(l).catch(() => {});
    }
}

/* ---------- blocage d'un compte suspendu ---------- */
function showBlock(s) {
    let o = document.getElementById('joxia-suspended');
    if (!s) { if (o) o.remove(); return; }
    if (!o) {
        o = document.createElement('div');
        o.id = 'joxia-suspended';
        o.setAttribute('role', 'alertdialog');
        o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(20,14,8,.86);font-family:system-ui,-apple-system,sans-serif';
        (document.body || document.documentElement).appendChild(o);
    }
    const until = s.until >= 9e12 ? 'définitivement'
        : "jusqu'au " + new Date(s.until).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const reason = s.reason ? String(s.reason).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '';
    o.innerHTML = `<div style="max-width:360px;width:100%;background:#fff;color:#20180F;border-radius:18px;padding:26px 22px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35)">
        <div style="font-size:40px">⛔</div>
        <h2 style="margin:8px 0 6px;font-size:20px">Compte suspendu</h2>
        <p style="margin:0 0 8px;color:#5C5344">Ton compte est suspendu ${until}.</p>
        ${reason ? `<p style="margin:0 0 12px;color:#5C5344">Motif : ${reason}</p>` : ''}
        <a href="${HUB}" style="display:inline-block;margin-top:6px;background:#FF6A2A;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:12px">Retour au hub</a>
    </div>`;
}
function watchSuspension() {
    suspUnsub = onValue(ref(db, `suspensions/${uid}`), snap => {
        clearTimeout(suspTimer);
        const s = snap.val();
        const active = !!(s && s.until > Date.now());
        if (active) { flush(); setPlaying(false); }
        blocked = active;
        showBlock(active ? s : null);
        if (!active) { lastTick = Date.now(); if (visible) setPlaying(true); }
        // la suspension se lève automatiquement à l'échéance
        if (active && s.until < 9e12) suspTimer = setTimeout(() => { blocked = false; showBlock(null); lastTick = Date.now(); if (visible) setPlaying(true); }, Math.min(s.until - Date.now(), 2 ** 31 - 1));
    }, () => {});
}

/* ---------- cycle de vie ---------- */
onAuthStateChanged(auth, user => {
    if (uid) { flush(); setPlaying(false); }
    if (suspUnsub) { suspUnsub(); suspUnsub = null; }
    clearInterval(timer); clearTimeout(suspTimer);
    blocked = false; showBlock(null);
    uid = user ? user.uid : null;
    if (!uid) return;
    update(ref(db), { [`playtime/${uid}/games/${GAME}/sessions`]: increment(1) }).catch(() => {});
    update(ref(db), { [`stats/${GAME}/plays`]: increment(1) }).catch(() => {});
    pending = 0; lastTick = Date.now();
    if (visible) setPlaying(true);
    timer = setInterval(flush, FLUSH_MS);
    watchSuspension();
});

document.addEventListener('visibilitychange', () => {
    tick();
    visible = document.visibilityState === 'visible';
    if (!visible) flush();
    setPlaying(visible);
});
window.addEventListener('pagehide', () => { flush(); setPlaying(false); });
