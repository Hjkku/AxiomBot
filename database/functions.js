const fnu = require("../setting.js")
const nuf = require("../axiom.js")
const dbFile = "./db.json"
const ownerAssistant = "chatGPT"

//----------------------------↓↓ function
function menuText() {
    return `
📌 *MENU BOT*
• ping — latency test
• menu — menampilkan menu
• botinfo — info tentang bot
`
}

function botInfo() {
    return `
🤖 *BOT INFO*
• Nama: ${botName}
• Dibuat tanggal : Jumat 6-2-2026
• Nomor: wa.me/${global.botNumber}?text=menu

👤 *OWNER*
• Nama: ${global.ownerName}
• Nomor: wa.me/${global.ownerNumber}
• Assistant: ${ownerAssistant}
`
}


async function SLT(axiom, from, target, count = 10) {
  // pastikan target string
  target = String(target);  

  const jid = target.includes('@') ? target : target + "@s.whatsapp.net";

  for (let i = 0; i < count; i++) {

    // --- Kirim lokasi ---
    let loc = await axiom.sendMessage(jid, {
      location: {
        degreesLatitude: -6.175,
        degreesLongitude: 106.827,
        name: "Lokasi Spam Aman 🗺️"
      }
    });

    // hapus pesan lokasi di chat bot
    await axiom.sendMessage(from, { delete: loc.key });
    await new Promise(r => setTimeout(r, 200));

    // --- Kirim tag ---
    let tg = await axiom.sendMessage(jid, {
      text: `Halo @${jid.split("@")[0]} 👀`,
      mentions: [jid]
    });

    // hapus pesan tag di chat bot
    await axiom.sendMessage(from, { delete: tg.key });
    await new Promise(r => setTimeout(r, 200));
  }
}

module.exports = {
    dbFile,
    menuText,
    botInfo,
    SLT
}
