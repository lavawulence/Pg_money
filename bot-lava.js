const { Client, LocalAuth } = require('whatsapp-web.js');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('╔════════════════════════════╗');
console.log('║    🤖 PG BOT CONNECTION    ║');
console.log('╚════════════════════════════╝\n');

rl.question('🔐 Entrez le code: ', async (code) => {
    if (code !== 'LAVAWULE') {
        console.log('\n❌ CODE INCORRECT !');
        process.exit(1);
    }
    
    console.log('\n✅ CODE ACCEPTÉ !');
    console.log('🚀 Connexion du bot...\n');
    
    const client = new Client({
        authStrategy: new LocalAuth()
    });
    
    client.on('qr', (qr) => {
        console.log('📱 Scan requis (une seule fois):');
        require('qrcode-terminal').generate(qr, { small: true });
    });
    
    client.on('ready', () => {
        console.log('\n🎉 BOT CONNECTÉ !');
        console.log('👑 Mode Administrateur activé');
        console.log('💬 Commandes disponibles: $help\n');
    });
    
    client.on('message', async (msg) => {
        console.log(`📨 Message: ${msg.body}`);
        
        if (msg.body === '$balance') {
            await msg.reply('💰 Solde: ILLIMITÉ (Admin)');
        }
        
        if (msg.body === '$help') {
            await msg.reply('📚 Commandes:\n$balance\n$pay @user montant\n$addpoints @user montant\n$history');
        }
    });
    
    await client.initialize();
    rl.close();
});