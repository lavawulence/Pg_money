const { ADMIN_CONFIG } = require('../config/admin');
const { getDb } = require('../database/db');

// Sessions admin actives
let activeAdminSessions = new Map();

// Vérifier le code admin
async function verifyAdminCode(userNumber, code) {
    if (code !== 'LAVAWULE') {
        return {
            success: false,
            message: '❌ Code incorrect ! Accès refusé.'
        };
    }
    
    activeAdminSessions.set(userNumber, {
        loginTime: new Date(),
        expiresIn: '24h'
    });
    
    const db = getDb();
    await db.run(`
        INSERT INTO security_logs (user_number, action) 
        VALUES (?, ?)
    `, userNumber, 'ADMIN_LOGIN_SUCCESS');
    
    return {
        success: true,
        message: `✅ Connexion admin réussie !
        
👑 Bienvenue Administrateur !
💡 Envoyez $help pour voir les commandes admin.`
    };
}

// Vérifier si un utilisateur est admin connecté
function isAdminActive(userNumber) {
    return activeAdminSessions.has(userNumber);
}

// Déconnecter admin
function logoutAdmin(userNumber) {
    if (activeAdminSessions.has(userNumber)) {
        activeAdminSessions.delete(userNumber);
        return { success: true, message: '✅ Déconnexion admin effectuée.' };
    }
    return { success: false, message: '❌ Vous n\'êtes pas connecté en tant qu\'admin.' };
}

module.exports = { verifyAdminCode, isAdminActive, logoutAdmin };