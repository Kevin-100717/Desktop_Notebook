const { contextBridge,ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld('electron',{
    getUserInfo:()=>ipcRenderer.invoke("get-userinfo"),
    getNoteList:()=>ipcRenderer.invoke("get-notelist"),
    getNoteContent:(tid)=>ipcRenderer.invoke("get-notecontent",tid)
})