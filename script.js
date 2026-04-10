import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
        e.preventDefault(); // Bloque le comportement par défaut
        
        if (!auth.currentUser) {
            // Pas connecté -> On ouvre la modal
            alert("Veuillez vous connecter pour jouer et enregistrer votre score !");
            modal.style.display = "flex";
        } else {
            // Connecté -> Redirection avec le pseudo
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
   ==========================================================================

   ETAPE 1 : SUR LE HUB (script.js)
   ---------------------------------
   Copie-colle ce bloc pour chaque nouveau jeu ajouté dans le HTML :

   const NOM_VARIABLE = document.getElementById("ID_DU_LIEN_HTML");
   if (NOM_VARIABLE) {
       NOM_VARIABLE.onclick = (e) => {
           e.preventDefault(); 
           if (!auth.currentUser) {
               alert("Connecte-toi pour jouer !");
               document.getElementById("authModal").style.display = "flex";
           } else {
               // Extrait le pseudo de l'email (ex: test@joxia.fr -> test)
               const name = auth.currentUser.email.split('@')[0];
               const url = "URL_DE_TON_NOUVEAU_JEU"; 
               
               // TRANSMISSION : On envoie le pseudo dans l'URL du jeu
               window.location.href = `${url}?player=${encodeURIComponent(name)}`;
           }
       };
   }

   ETAPE 2 : DANS LE CODE DU NOUVEAU JEU (Indispensable !)
   ------------------------------------------------------
   Pour que le compte "reste" sur le jeu, demande à Gemini d'ajouter ceci 
   dans le script de ton NOUVEAU jeu :

   // 1. Récupérer le pseudo envoyé par le Hub
   const urlParams = new URLSearchParams(window.location.search);
   const currentPlayer = urlParams.get('player');

   // 2. Vérifier si le joueur est connecté
   if (!currentPlayer) {
       alert("Accès refusé. Passe par le Hub Phoenix Assembly !");
       window.location.href = "https://joxia.netlify.app/"; // Retour au Hub
   }
   
   // 3. Utiliser 'currentPlayer' pour enregistrer les scores dans Firebase
   ========================================================================== */