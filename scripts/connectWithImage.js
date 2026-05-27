const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { SECRET_CODE, IMAGES } = require('../src/config/secret');

async function connectAndSetImage() {
    console.log('🔐 Système de connexion sécurisé');
    console.log('📷 Importation de l\'image du bot...\n');
    
    // Vérifier l'image
    const imagePath = path.join(__dirname, '..', IMAGES.botAvatar);
    
    if (!fs.existsSync(imagePath)) {
        console.error('❌ Image non trouvée!');
        console.log(`📁 Placez votre image dans: ${imagePath}`);
        console.log('💡 Assurez-vous que le dossier public/images existe');
        process.exit(1);
    }
    
    console.log('✅ Image trouvée:', imagePath);
    console.log('🔑 Code de connexion: LAVAWULE');
    console.log('🤖 Initialisation du bot...\n');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        
        if (qr) {
            console.log('📱 CODE DE CONNEXION: LAVAWULE');
            console.log('🎯 Scannez ce QR code avec WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log('\n✅ Bot connecté avec succès!');
            console.log('🔐 Code LAVAWULE validé');
            
            try {
                // Lire et importer l'image
                const imageBuffer = fs.readFileSync(imagePath);
                
                // Définir la photo de profil
                await sock.updateProfilePicture(sock.user.id, imageBuffer);
                console.log('✅ Image du bot importée avec succès!');
                
                // Définir le nom
                await sock.updateProfileName('🤖 PG Bot | LAVAWULE');
                console.log('✅ Nom du bot configuré');
                
                console.log('\n🎉 Configuration terminée!');
                console.log('📱 Votre bot est prêt à l\'emploi');
                console.log('💬 Commandes disponibles: $help');
                
            } catch (error) {
                console.error('❌ Erreur lors de l\'import:', error.message);
            }
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
}

// Vérifier le code au démarrage
console.log('🔐 Entrez le code de connexion:');
process.stdin.once('data', (input) => {
    const code = input.toString().trim().toUpperCase();
    
    if (code === SECRET_CODE) {
        console.log('✅ Code validé! Connexion en cours...\n');
        connectAndSetImage();
    } else {
        console.error('❌ Code invalide! Accès refusé.');
        process.exit(1);
    }
});