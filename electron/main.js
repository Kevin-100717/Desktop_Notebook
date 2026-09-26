const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage } = require('electron')
const path = require('path')
const { conf_init, getConfig } = require("./configInit")
const { bindIpc } = require("./ipcHandler")
const { note_init } = require("./noteFile")
const { label_init } = require("./labelFile")
const { registerStickyIpc } = require("./stickyWindow")

let mainWindow = null
let tray = null

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
    mainWindow = win

    bindIpc(win)
    win.setMenuBarVisibility(false)
    if(app.isPackaged){
        win.loadFile(path.join(__dirname,'../dist/index.html'))
    }else{
        win.loadURL('http://localhost:5173')
    }
    win.on('ready-to-show',()=>win.show())
    win.on('close',event=>{
        if(app.isQuitting) return
        if(getConfig('closeToTray') !== false){
            event.preventDefault()
            win.hide()
            return
        }
        app.isQuitting = true
        event.preventDefault()
        app.quit()
    })
    win.on('closed',()=>{
        if(mainWindow === win) mainWindow = null
    })
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

const showMainWindow = () => {
    if(!mainWindow || mainWindow.isDestroyed()){
        createWindow()
        return
    }
    if(mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
}

const sendTrayAction = action => {
    showMainWindow()
    if(!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    setTimeout(()=>{
        if(!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()){
            mainWindow.webContents.send('tray-action',action)
        }
    },200)
}

const buildTrayMenu = () => Menu.buildFromTemplate([
    { label:'显示主窗口', click:showMainWindow },
    { type:'separator' },
    { label:'新建笔记', click:()=>sendTrayAction('new-note') },
    { label:'新建便签', click:()=>sendTrayAction('new-sticky') },
    { type:'separator' },
    {
        label:'退出',
        click:()=>{
            app.isQuitting = true
            app.quit()
        }
    }
])

const createTray = () => {
    const image = nativeImage.createFromPath(path.join(__dirname,'tray.png'))
    if(image.isEmpty()) return
    tray = new Tray(image)
    tray.setToolTip('desktop-notebook')
    tray.setContextMenu(buildTrayMenu())
    tray.on('click',()=>showMainWindow())
    tray.on('double-click',()=>showMainWindow())
}

app.whenReady().then(async () => {
    try{
        const dataDir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath()
        conf_init(dataDir)
        note_init(dataDir)
        label_init(dataDir)
        registerStickyIpc(ipcMain)
        createWindow()
        createTray()
    }catch(error){
        dialog.showErrorBox("启动失败",error.message)
        app.isQuitting = true
        app.quit()
        return
    }
    app.on('activate', () => {
        if (mainWindow == null || mainWindow.isDestroyed()) createWindow()
    })
})
app.on('before-quit',()=>{
    app.isQuitting = true
})
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
