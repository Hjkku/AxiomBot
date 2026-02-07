const fs = require('fs')
const chalk = require('chalk')

//Settings
global.ownerNumber = "6285854949441"
global.ownerName = "Rangga"
global.botName = "Axiom"
global.botNumber = "6285804127821"
global.versisc = "1.0"
global.simbol = "ネ"
global.zz = "`"
global.linkGc = ""
global.idGc = ""
global.linkSaluran = "https://whatsapp.com/channel/0029Vb7Kqkn9sBI2KKptwH2S"
global.idSaluran = ""
global.namaSaluran = "AX-devs"

// >~~~~~~~~ Setting Message ~~~~~~~~~< //
global.msg = {
wait: "Memproses . . .", 
owner: "Fitur ini khusus untuk owner!", 
premium: "Fitur ini khusus member Axiom+", 
group: "Fitur ini untuk dalam grup!", 
admin: "Fitur ini untuk admin grup!", 
botadmin: "Fitur ini hanya untuk bot menjadi admin"
}
//Thumbnail
global.imgthumb = "https://img1.pixhost.to/images/6151/605839325_imgtmp.jpg"
let file = require.resolve(__filename)
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(chalk.redBright(`Update ${__filename}`))
delete require.cache[file]
require(file)
})