const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const { conf_init } = require("./configInit")
const { bindIpc } = require("./ipcHandler")
const { note_init } = require("./noteFile")

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        show:false,
        webPreferences: {
            contextIsolation:true,
            nodeIntegration:false,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    bindIpc(win)
    win.setMenuBarVisibility(false)
    if(app.isPackaged){
        win.loadFile(path.join(__dirname,'../dist/index.html'))
    }else{
        win.loadURL('http://localhost:5173')
    }
    win.on('ready-to-show',()=>win.show())
    let retry = 0
    win.webContents.on('did-fail-load',(_event,errorCode)=>{
        if(errorCode === -3) return
        if(!app.isPackaged && retry < 10){
            retry++
            setTimeout(()=>win.loadURL('http://localhost:5173'),300)
        }else{
            win.show()
        }
    })
}

app.whenReady().then(async () => {
    try{
        const dataDir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath()
        conf_init(dataDir)
        note_init(dataDir)
        createWindow()
    }catch(error){
        dialog.showErrorBox("启动失败",error.message)
        app.quit()
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})