const { ipcMain } = require("electron")
const { getConfig } = require("./configInit")
const { getNotes,readNote, saveNote, watchNotes } = require("./noteFile")

const windows = new Set()
let initialized = false

function getUserInfo(){
    return getConfig("userKey")
}
function getNoteList(){
    return getNotes()
}
function getNoteContent(event,args){
    return readNote(args)
}
function saveNoteData(event,args){
    return saveNote(args)
}
function sendNoteUpdate(note){
    windows.forEach(win=>{
        if(!win.isDestroyed() && !win.webContents.isDestroyed()){
            win.webContents.send("note-updated",note)
        }
    })
}
function bindIpc(win){
    windows.add(win)
    win.once("closed",()=>windows.delete(win))
    if(initialized) return
    initialized = true
    ipcMain.handle("get-userinfo",getUserInfo)
    ipcMain.handle("get-notelist",getNoteList)
    ipcMain.handle("get-notecontent",getNoteContent)
    ipcMain.handle("save-content",saveNoteData)
    watchNotes(sendNoteUpdate)
}
module.exports = {
    bindIpc:bindIpc
}