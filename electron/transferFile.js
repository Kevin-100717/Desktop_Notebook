const fs = require("fs")
const path = require("path")
const { readNote, createNote, getNoteEntry } = require("./noteFile")
const { readSticky } = require("./labelFile")
const { getRootDir } = require("./configInit")

const NOTE_EXT = [".md",".markdown",".txt"]
const BACKUP_ITEMS = ["config.json","notes","labels","graph.json"]
// 与 src/utils/noteLink.js 的 MARKDOWN_LINK 同源：导出的 .md 不保留「关联笔记」功能，只留标题纯文本
const NOTE_LINK_MD = /\[([^\]\n]*)\]\(\s*dnote:note\/[^)\s]*\s*\)/g

function stripNoteLinks(text){
    const value = String(text == null ? "" : text)
    if(value === "") return value
    return value.replace(NOTE_LINK_MD,"$1")
}

function sanitizeFileName(title){
    const cleaned = String(title == null ? "" : title)
        .replace(/\.(md|markdown|txt)$/i,"")
        .replace(/[\\/:*?"<>|]/g," ")
        .replace(/\s+/g," ")
        .trim()
        .slice(0,80)
    return cleaned || "未命名"
}
function timeLabel(){
    const date = new Date()
    const pad = value=>String(value).padStart(2,"0")
    return ""+date.getFullYear()+pad(date.getMonth()+1)+pad(date.getDate())+"-"+pad(date.getHours())+pad(date.getMinutes())+pad(date.getSeconds())
}
function titleFromContent(content,fallback){
    const lines = String(content == null ? "" : content).split(/\r?\n/).slice(0,10)
    for(const line of lines){
        const matched = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
        if(matched && matched[1].trim()) return sanitizeFileName(matched[1])
    }
    return fallback
}
function importOne(file){
    const ext = path.extname(String(file)).toLowerCase()
    if(!NOTE_EXT.includes(ext)) return { ok:false, name:path.basename(String(file)), reason:"unsupported" }
    let content = ""
    try{
        content = fs.readFileSync(file,{ encoding:'utf-8' })
    }catch{
        return { ok:false, name:path.basename(String(file)), reason:"unreadable" }
    }
    const fallback = sanitizeFileName(path.basename(String(file),ext))
    const entry = createNote(titleFromContent(content,fallback),content)
    return { ok:true, name:path.basename(String(file)), time:entry.time, title:entry.det && entry.det.title }
}
function importNotesFromFiles(files){
    if(!Array.isArray(files)) throw new Error("invalid import files")
    const created = []
    const failed = []
    files.forEach(file=>{
        try{
            const result = importOne(file)
            if(result.ok) created.push({ time:result.time, title:result.title })
            else failed.push(result.name)
        }catch{
            failed.push(path.basename(String(file)))
        }
    })
    if(created.length === 0 && failed.length === 0) throw new Error("nothing to import")
    return { created:created, failed:failed }
}
function importNotesFromFolder(dir){
    if(typeof dir !== "string" || dir.length === 0) throw new Error("invalid folder")
    let entries = []
    try{
        entries = fs.readdirSync(dir,{ withFileTypes:true })
    }catch{
        throw new Error("无法读取所选文件夹")
    }
    const files = entries
        .filter(entry=>entry.isFile() && NOTE_EXT.includes(path.extname(entry.name).toLowerCase()))
        .map(entry=>path.join(dir,entry.name))
        .sort()
    if(files.length === 0) throw new Error("所选文件夹内没有 Markdown 或 txt 文件")
    return importNotesFromFiles(files)
}
async function exportNote(tid,dialog,defaultDir){
    const entry = getNoteEntry(tid)
    const content = readNote(tid)
    const title = entry.det && entry.det.title ? entry.det.title : "未命名"
    const result = await dialog.showSaveDialog({
        title:"导出笔记",
        defaultPath:path.join(String(defaultDir || ""),sanitizeFileName(title)+".md"),
        filters:[{ name:"Markdown 文件", extensions:["md"] }]
    })
    if(result.canceled || !result.filePath) return { canceled:true }
    fs.writeFileSync(result.filePath,stripNoteLinks(content),"utf-8")
    return { canceled:false, filePath:result.filePath }
}
async function exportSticky(tid,dialog,defaultDir){
    const entry = readSticky(tid)
    const result = await dialog.showSaveDialog({
        title:"导出便签",
        defaultPath:path.join(String(defaultDir || ""),sanitizeFileName(entry.title)+".txt"),
        filters:[{ name:"文本文件", extensions:["txt"] }]
    })
    if(result.canceled || !result.filePath) return { canceled:true }
    fs.writeFileSync(result.filePath,entry.content,"utf-8")
    return { canceled:false, filePath:result.filePath }
}
async function backupData(dialog){
    const root = getRootDir()
    const picked = await dialog.showOpenDialog({
        title:"选择备份保存位置（会在该目录下新建带时间戳的文件夹）",
        properties:["openDirectory","createDirectory"]
    })
    if(picked.canceled || picked.filePaths.length === 0) return { canceled:true }
    const target = path.join(picked.filePaths[0],"desktop-notebook-backup-"+timeLabel())
    // 备份目录不能选在数据目录里面：往 notes/ 里再复制一份 notes/ 会越拷越大
    const insideRoot = (()=>{
        const rel = path.relative(root,target)
        return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
    })()
    if(insideRoot) throw new Error("备份位置不能放在数据目录里，换个文件夹再试")
    const items = []
    try{
        fs.mkdirSync(target,{recursive:true})
        BACKUP_ITEMS.forEach(name=>{
            const source = path.join(root,name)
            if(!fs.existsSync(source)) return
            fs.cpSync(source,path.join(target,name),{ recursive:true })
            items.push(name)
        })
    }catch(error){
        // 半份备份比没有更害人，失败就把残缺的目录清掉
        try{ fs.rmSync(target,{ recursive:true, force:true }) }catch{}
        throw error
    }
    return { canceled:false, dir:target, items:items }
}
module.exports = {
    importNotesFromFiles:importNotesFromFiles,
    importNotesFromFolder:importNotesFromFolder,
    exportNote:exportNote,
    exportSticky:exportSticky,
    backupData:backupData,
    sanitizeFileName:sanitizeFileName,
    stripNoteLinks:stripNoteLinks
}
