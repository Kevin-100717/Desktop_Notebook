const { ipcMain } = require("electron")
const { getConfig } = require("./configInit")
const { getNotes,readNote } = require("./noteFile")

var window = null;

function getUserInfo(){
    return getConfig("userKey")
}
function getNoteList(){
    return getNotes()
}
function getNoteContent(event,args){
    return readNote(args)
}

function bindIpc(win){
    window = win;
    ipcMain.handle("get-userinfo",getUserInfo)
    ipcMain.handle("get-notelist",getNoteList)
    ipcMain.handle("get-notecontent",getNoteContent)
}
module.exports = {
    bindIpc:bindIpc
}