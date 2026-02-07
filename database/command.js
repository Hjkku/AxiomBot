const fun = require("./functions")

async function commandHandler(axiom, msg, from, text) {

    const parts = text.split(" ")
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    // ----- PING -----
    if (cmd === "ping") {
        return axiom.sendMessage(from, { text: "pong!" })
    }

    // ----- MENU -----
    if (cmd === "menu" || cmd === "!menu") {
        return axiom.sendMessage(from, { text: fun.menuText() })
    }

    // ----- SPAM (SPM) -----
    if (cmd === "spm" || cmd === "!spm") {

        if (!args[0]) {
            return axiom.sendMessage(from, { text: "Contoh:\n!spm 628xxxx 5" })
        }

        // Format JID
        let nomor = args[0].replace(/[^0-9]/g, "")  // buang simbol
        let target = nomor + "@s.whatsapp.net"

        let jumlah = parseInt(args[1]) || 5

        await fun.SLT(axiom, target, jumlah)
        return axiom.sendMessage(from, { text: "✔️ Spam lokasi + tag terkirim." })
    }
}

module.exports = commandHandler