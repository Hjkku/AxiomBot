const fun = require("./functions")

async function commandHandler(axiom, msg, from, text) {

    const cmd = text.toLowerCase()
    const args = text.split(" ").slice(1) // ambil args

    // ----- PING -----
    if (cmd === "ping") {
        return axiom.sendMessage(from, { text: "pong!" })
    }

    // ----- MENU -----
    if (cmd === "menu" || cmd === "!menu") {
        return axiom.sendMessage(from, { text: fun.menuText() })
    }

    // ----- SPAM -----
    if (cmd === "spm") {
        if (!args[0]) return axiom.sendMessage(from, { text: "Contoh:\n!spm 628xxxx 5" })

        let target = args[0]
        let jumlah = parseInt(args[1]) || 5

        await fun.SLT(axiom, target, jumlah)  // pastikan SLT ada di functions.js
        return axiom.sendMessage(from, { text: "✔️ Spam lokasi + tag terkirim." })
    }

    // ----- DEFAULT -----
    else {
        return axiom.sendMessage(from, { text: "Command tidak dikenal." })
    }
}

module.exports = commandHandler