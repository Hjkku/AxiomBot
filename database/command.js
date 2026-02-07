const fun = require("./functions")

async function commandHandler(axiom, msg, from, text) {

    const cmd = text.toLowerCase()

    // ----- PING -----
    if (cmd === "ping") {
        return axiom.sendMessage(from, { text: "pong!" })
    }

    // ----- MENU -----
    if (cmd === "menu" || cmd === "!menu") {
        return axiom.sendMessage(from, { text: fun.menuText() })
    }

    // ----- OWNER -----
    if (cmd === "botinfo" || cmd === "!botinfo") {
        return axiom.sendMessage(from, { text: fun.botInfo() })
    }

    // ----- BULLDOZER ----- //
    async function commandHandler(axiom, msg, from, text) {
    if (text.startsWith("bulldozer")) {
        const args = text.split(" ").slice(1).join("")
        const result = await fun.bulldozer(args)
        return axiom.sendMessage(from, { text: result })
    }}

}

module.exports = commandHandler
