const { ipcMain, shell } = require("electron")
const { existsSync, mkdirSync } = require("fs")
const path = require("path")
const { getConfig, setConfig, getRootDir } = require("./configInit")
const { getNotes,readNote, saveNote, createNote, deleteNote, getTags, setNoteTags, watchNotes } = require("./noteFile")
const { getStickies,readSticky, saveSticky, createSticky, deleteSticky, watchSticky } = require("./labelFile")

const windows = new Set()
let initialized = false

function getUserInfo(){
    return getConfig("userKey")
}
function getSetting(event,key){
    return getConfig(key)
}
function setSetting(event,args){
    if(!args || typeof args.key !== "string" || args.key.length === 0){
        throw new Error("invalid setting key")
    }
    if(args.key === "theme" && args.value !== "light" && args.value !== "dark"){
        throw new Error("invalid theme value")
    }
    if(args.key === "closeToTray" && typeof args.value !== "boolean"){
        throw new Error("invalid closeToTray value")
    }
    setConfig(args.key,args.value)
    sendSettingUpdate({key:args.key,value:args.value})
    return "success"
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
function createNoteData(event,title){
    return createNote(title)
}
function deleteNoteData(event,tid){
    const result = deleteNote(tid)
    sendNoteUpdate({deleted:true,tid:tid})
    return result
}
function getNoteTags(){
    return getTags()
}
function setNoteTagsData(event,args){
    if(!args) throw new Error("invalid tag payload")
    return setNoteTags(args.tid,args.tags)
}
function getStickyList(){
    return getStickies()
}
function getStickyData(event,tid){
    return readSticky(tid)
}
function saveStickyData(event,args){
    if(!args) throw new Error("invalid sticky payload")
    return saveSticky(args)
}
function createStickyData(event,title){
    return createSticky(title)
}
function deleteStickyData(event,tid){
    const result = deleteSticky(tid)
    sendNoteUpdate({stickyDeleted:true,tid:tid})
    return result
}
function openDataFolder(event,args){
    const key = args != null && typeof args === "object" ? args.key : args
    if(key !== "notes" && key !== "labels") throw new Error("invalid folder key")
    const dir = path.join(getRootDir(),key)
    if(!existsSync(dir)) mkdirSync(dir,{recursive:true})
    return shell.openPath(dir)
}
function sendNoteUpdate(note){
    windows.forEach(win=>{
        if(!win.isDestroyed() && !win.webContents.isDestroyed()){
            win.webContents.send("note-updated",note)
        }
    })
}
function sendSettingUpdate(setting){
    windows.forEach(win=>{
        if(!win.isDestroyed() && !win.webContents.isDestroyed()){
            win.webContents.send("setting-updated",setting)
        }
    })
}
function bindIpc(win){
    registerWindow(win)
    if(initialized) return
    initialized = true
    ipcMain.handle("get-userinfo",getUserInfo)
    ipcMain.handle("get-setting",getSetting)
    ipcMain.handle("set-setting",setSetting)
    ipcMain.handle("get-notelist",getNoteList)
    ipcMain.handle("get-notecontent",getNoteContent)
    ipcMain.handle("save-content",saveNoteData)
    ipcMain.handle("create-note",createNoteData)
    ipcMain.handle("delete-note",deleteNoteData)
    ipcMain.handle("get-tags",getNoteTags)
    ipcMain.handle("set-note-tags",setNoteTagsData)
    ipcMain.handle("get-stickylist",getStickyList)
    ipcMain.handle("get-sticky",getStickyData)
    ipcMain.handle("save-sticky",saveStickyData)
    ipcMain.handle("create-sticky",createStickyData)
    ipcMain.handle("delete-sticky",deleteStickyData)
    ipcMain.handle("open-data-folder",openDataFolder)
    watchNotes(sendNoteUpdate)
    watchSticky(sendNoteUpdate)
}
function registerWindow(win){
    windows.add(win)
    win.once("closed",()=>windows.delete(win))
}
module.exports = {
    bindIpc:bindIpc,
    registerWindow:registerWindow
}