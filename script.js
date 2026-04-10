import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURATION FIREBASE JOXIAHUB ---
const firebaseConfig = {
  apiKey: "AIzaSyBZKJ0WUYEssy-qwVnUv-8B1lLY6v1VoXw",
  authDomain: "joxiahub.firebaseapp.com",
  databaseURL: "https://joxiahub-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "joxiahub",
  storageBucket: "joxiahub.firebasestorage.app",
  messagingSenderId: "294856376500",
  appId: "1:294856376500:web:cae8275d4807dc72e497e1",
  measurementId: "G-VMNMP67SY9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- RECHERCHE ---
window.searchGame = function() {
    let input = document.getElementById('searchInput').value.toLowerCase();
    let cards = document.getElementsByClassName('game-card');
    for (let card of cards) {
        let title = card.querySelector('h3').innerText.toLowerCase();
        card.style.display = title.includes(input) ? "block" : "none";
    }
}

// --- CLASSEMENT GLOBAL ---
const rankBtn = document.getElementById("rankBtn");
const rankModal = document.getElementById("leaderboardModal");
const rankContent = document.getElementById("leaderboardContent");

if (rankBtn) {
    rankBtn.onclick = () => {
        rankModal.style.display = "flex";
        rankContent.innerHTML = "<p>Recherche des scores...</p>";
        const scoresRef = ref(db, 'games');
        onValue(scoresRef, (snapshot) => {
            if (snapshot.exists()) {
                const allGames = snapshot.val();
                let totals = {};
                for (let game in allGames) {
                    const gameScores = allGames[game].scores;
                    if (gameScores) {
                        Object.values(gameScores).forEach(p => {
                            const name = p.name ? p.name.toUpperCase().trim() : "ANONYME";
                            totals[name] = (totals[name] || 0) + parseInt(p.score || 0);
                        });
                    }
                }
                const sorted = Object.entries(totals).map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);
                rankContent.innerHTML = `<table style="width: 100%; text-align: left;">
                    <tr style="color: var(--neon); border-bottom: 2px solid var(--neon);"><th>#</th><th>JOUEUR</th><th style="text-align: right;">PTS</th></tr>
                    ${sorted.slice(0, 10).map((p, i) => `<tr><td>${i+1}</td><td>${p.name}</td><td style="text-align: right; color: var(--neon); font-weight: bold;">${p.score}</td></tr>`).join('')}
                </table>`;
            } else { rankContent.innerHTML = "<p>Aucun score trouvé.</p>"; }
        });
    };
}
document.getElementById("closeRank").onclick = () => rankModal.style.display = "none";

// --- AUTHENTIFICATION ---
const modal = document.getElementById("authModal");
const loginBtn = document.querySelector(".login-btn");
const userMenu = document.getElementById("userMenu");
const authTitle = document.getElementById("authTitle");
const switchText = document.getElementById("switchText");
const toggleAuthMode = document.getElementById("toggleAuthMode");
const confirmBtn = document.getElementById("confirmBtn");
let isSignUpMode = false;

loginBtn.onclick = (e) => {
    e.stopPropagation();
    if (!auth.currentUser) modal.style.display = "flex";
    else userMenu.style.display = userMenu.style.display === "none" ? "flex" : "none";
};

window.onclick = () => { userMenu.style.display = "none"; };
document.querySelector(".close-btn").onclick = () => modal.style.display = "none";

toggleAuthMode.onclick = (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    authTitle.innerText = isSignUpMode ? "Inscription" : "Connexion";
    switchText.innerText = isSignUpMode ? "Déjà un compte ?" : "Pas de compte ?";
    toggleAuthMode.innerText = isSignUpMode ? "Se connecter" : "S'inscrire";
};

confirmBtn.onclick = async () => {
    const pseudo = document.getElementById("usernameInput").value.trim();
    const pass = document.getElementById("passwordInput").value.trim();
    if(!pseudo || !pass) return alert("Veuillez remplir tous les champs !");
    const email = pseudo + "@joxia.fr";
    try {
        if (isSignUpMode) {
            await createUserWithEmailAndPassword(auth, email, pass);
            alert("Compte créé avec succès !");
        } else { await signInWithEmailAndPassword(auth, email, pass); }
        modal.style.display = "none";
    } catch (e) { alert("Erreur : Pseudo déjà pris ou mot de passe incorrect."); }
};

document.getElementById("logoutBtn").onclick = () => signOut(auth);

document.getElementById("deleteAccountBtn").onclick = async () => {
    const user = auth.currentUser;
    if (user && confirm("⚠️ SUPPRIMER DÉFINITIVEMENT TON COMPTE ?")) {
        try { await deleteUser(user); alert("Compte supprimé."); }
        catch (error) { alert("Action sensible : reconnectez-vous avant."); }
    }
};

// --- LOGIQUE DE CLIC SUR LES JEUX ---
const snakeLink = document.getElementById("snakeLink");
if (snakeLink) {
    snakeLink.onclick = (e) => {
        e.preventDefault(); 
        
        if (!auth.currentUser) {
            alert("Veuillez vous connecter pour jouer et enregistrer votre score !");
            modal.style.display = "flex";
        } else {
            const name = auth.currentUser.email.split('@')[0];
            const url = "https://joxiagame.github.io/Snake-Joxia/";
            window.location.href = `${url}?player=${encodeURIComponent(name)}`;
        }
    };
}

// --- GESTION DE L'ÉTAT ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const name = user.email.split('@')[0];
        loginBtn.innerText = "🎮 " + name.toUpperCase();
    } else {
        loginBtn.innerText = "SE CONNECTER";
    }
});

/* ==========================================================================
   MODELE D'AJOUT DE NOUVEAU JEU (POUR GARDER LE COMPTE ACTIF)
   ========================================================================== */
