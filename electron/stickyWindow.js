const { app, BrowserWindow } = require("electron")
const path = require("path")
const { registerWindow } = require("./ipcHandler")

const stickyWindows = new Map()

function loadStickyContent(win,tid){
    const hash = "/sticky/" + encodeURIComponent(String(tid))
    if(app.isPackaged){
        win.loadFile(path.join(__dirname,"../dist/index.html"),{ hash:hash })
    }else{
        win.loadURL("http://localhost:5173/#" + hash)
    }
}
function focusStickyWindow(tid){
    const key = String(tid)
    const exist = stickyWindows.get(key)
    if(!exist || exist.isDestroyed()) return false
    if(exist.isMinimized()) exist.restore()
    exist.show()
    exist.focus()
    return true
}
function closeStickyWindow(tid){
    const key = String(tid)
    const win = stickyWindows.get(key)
    if(win && !win.isDestroyed()) win.close()
    stickyWindows.delete(key)
}
function openStickyWindow(tid){
    if(tid == null) throw new Error("invalid sticky id")
    const key = String(tid)
    if(focusStickyWindow(key)) return "success"
    const win = new BrowserWindow({
        width: 272,
        height: 330,
        minWidth: 220,
        minHeight: 180,
        title:"便签",
        frame:false,
        resizable:true,
        movable:true,
        minimizable:false,
        maximizable:false,
        fullscreenable:false,
        alwaysOnTop:true,
        skipTaskbar:true,
        backgroundColor:"#ffe98a",
        show:false,
        webPreferences:{
            contextIsolation:true,
            nodeIntegration:false,
            preload: path.join(__dirname,"preload.js")
        }
    })
    stickyWindows.set(key,win)
    registerWindow(win)
    const index = stickyWindows.size % 6
    win.setPosition(140 + index*30,110 + index*30)
    win.setAlwaysOnTop(true,"floating")
    win.setMenuBarVisibility(false)
    win.once("ready-to-show",()=>{
        win.show()
        win.focus()
    })
    win.on("closed",()=>{
        if(stickyWindows.get(key) === win) stickyWindows.delete(key)
    })
    loadStickyContent(win,key)
    return "success"
}
function readTid(args){
    if(args != null && typeof args === "object") return args.tid
    return args
}
function registerStickyIpc(ipcMain){
    ipcMain.handle("open-sticky",(event,args)=>{
        return openStickyWindow(readTid(args))
    })
    ipcMain.handle("close-sticky",(event,args)=>{
        return closeStickyWindow(readTid(args))
    })
}
module.exports = {
    openStickyWindow:openStickyWindow,
    focusStickyWindow:focusStickyWindow,
    closeStickyWindow:closeStickyWindow,
    registerStickyIpc:registerStickyIpc
}
