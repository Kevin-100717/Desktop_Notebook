const { contextBridge,ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld('electron',{
    getUserInfo:()=>ipcRenderer.invoke("get-userinfo"),
    getNoteList:()=>ipcRenderer.invoke("get-notelist"),
    getNoteContent:(tid)=>ipcRenderer.invoke("get-notecontent",tid),
    saveNote:(tid,content)=>ipcRenderer.invoke("save-content",{tid:tid,content:content}),
    onNoteUpdated:(callback)=>{
        const listener=(_event,note)=>callback(note)
        ipcRenderer.on("note-updated",listener)
        return ()=>ipcRenderer.removeListener("note-updated",listener)
    }
})