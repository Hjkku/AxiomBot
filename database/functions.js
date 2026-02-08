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

    // --- KIRIM LOKASI ---
    const locMsg = await axiom.sendMessage(jid, {
      location: {
        degreesLatitude: -6.175,
        degreesLongitude: 106.827,
        name: "Lokasi Aman 🗺️"
      }
    });

    // Hapus pesan bot sendiri (dari chat bot ke target)
    if (locMsg?.key) {
      await axiom.sendMessage(from, { delete: locMsg.key });
    }

    await new Promise(r => setTimeout(r, 500));

    // --- KIRIM TAG ---
    const tagMsg = await axiom.sendMessage(jid, {
      text: `Halo @${jid.split("@")[0]} 👀`,
      mentions: [jid]
    });

    // Hapus pesan bot sendiri
    if (tagMsg?.key) {
      await axiom.sendMessage(from, { delete: tagMsg.key });
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

module.exports = {
    dbFile,
    menuText,
    botInfo,
    SLT
}
