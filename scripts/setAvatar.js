const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

async function setBotAvatar() {
    console.log('🖼️ Configuration de la photo du bot...');
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        
        if (qr) {
            console.log('📱 Scannez ce QR code avec votre WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log('✅ Bot connecté!');
            
            try {
                // Chemin de votre image
                const imagePath = path.join(__dirname, '../public/bot-avatar.jpg');
                
                if (!fs.existsSync(imagePath)) {
                    console.error('❌ Image non trouvée dans public/bot-avatar.jpg');
                    console.log('💡 Placez votre image à cet emplacement');
                    process.exit(1);
                }
                
                const imageBuffer = fs.readFileSync(imagePath);
                
                // Changer la photo de profil
                await sock.updateProfilePicture(sock.user.id, imageBuffer);
                console.log('✅ Photo de profil mise à jour!');
                
                // Changer le nom (optionnel)
                await sock.updateProfileName('🤖 PG Bot | Banque');
                console.log('✅ Nom du bot mis à jour!');
                
                console.log('\n🎉 Succès! Votre bot a maintenant sa photo');
                process.exit(0);
                
            } catch (error) {
                console.error('❌ Erreur:', error.message);
                process.exit(1);
            }
        }
    });
}

setBotAvatar();