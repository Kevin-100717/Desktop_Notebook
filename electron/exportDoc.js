const fs = require("fs")
const os = require("os")
const path = require("path")
const { readNote, getNoteEntry, getNoteContentPath } = require("./noteFile")
const { sanitizeFileName } = require("./transferFile")

const MIME_BY_EXT = {
    png:"image/png",
    jpg:"image/jpeg",
    jpeg:"image/jpeg",
    gif:"image/gif",
    webp:"image/webp",
    bmp:"image/bmp"
}

const DOC_CSS = `
*{box-sizing:border-box}
body{
    margin:0;
    padding:48px 24px 96px;
    font-family:-apple-system,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;
    font-size:16px;
    line-height:1.8;
    color:#1f2328;
    background:#ffffff;
    -webkit-print-color-adjust:exact;
}
article{max-width:760px;margin:0 auto}
h1,h2,h3,h4,h5,h6{line-height:1.4;margin:1.6em 0 0.6em;font-weight:600}
h1{font-size:1.9em;margin-top:0}
h2{font-size:1.5em;padding-bottom:0.3em;border-bottom:1px solid #e6e8eb}
h3{font-size:1.25em}
p{margin:0.9em 0}
a{color:#2f6feb;text-decoration:none}
a:hover{text-decoration:underline}
ul,ol{padding-left:1.6em;margin:0.9em 0}
li{margin:0.3em 0}
blockquote{
    margin:1em 0;padding:0.4em 1em;
    color:#5b6570;border-left:4px solid #d8dde3;background:#f6f8fa;
}
code{
    padding:0.15em 0.4em;
    font-family:"Cascadia Code",Consolas,monospace;
    font-size:0.9em;
    background:#f2f4f7;border-radius:4px;
}
pre{
    margin:1em 0;padding:14px 16px;overflow-x:auto;
    background:#f6f8fa;border:1px solid #e6e8eb;border-radius:6px;
}
pre code{padding:0;background:transparent;font-size:0.88em;line-height:1.6}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:0.94em}
th,td{border:1px solid #e6e8eb;padding:8px 10px;text-align:left}
th{background:#f6f8fa;font-weight:600}
img{max-width:100%;height:auto;border-radius:4px}
hr{border:0;border-top:1px solid #e6e8eb;margin:2em 0}
input[type=checkbox]{margin-right:6px}
.doc-meta{max-width:760px;margin:0 auto 32px;color:#8b949e;font-size:13px}
@media print{
    body{padding:0}
    h2{page-break-after:avoid}
    pre,img,table{page-break-inside:avoid}
}
`

function escapeHtml(value){
    return String(value == null ? "" : value)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
}
function buildStandaloneHtml(title,body,meta){
    return [
        "<!DOCTYPE html>",
        '<html lang="zh-CN">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        "<title>"+escapeHtml(title)+"</title>",
        "<style>"+DOC_CSS+"</style>",
        "</head>",
        "<body>",
        meta ? '<p class="doc-meta">'+escapeHtml(meta)+"</p>" : "",
        "<article>"+String(body == null ? "" : body)+"</article>",
        "</body>",
        "</html>"
    ].join("")
}
const ASSET_TAIL = /(?:assets\/|^dnote-img:\/\/asset\/[^/]+\/)([0-9a-f]{16}\.(?:png|jpg|jpeg|gif|webp|bmp))$/i
// 与 src/utils/noteLink.js 的 HTML_LINK 同源：导出不保留「关联笔记」功能，只留标题纯文本
const NOTE_LINK_HTML = /<a\b[^>]*href=["']dnote:note\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi
function stripNoteLinks(html){
    const value = String(html == null ? "" : html)
    if(value === "") return value
    return value.replace(NOTE_LINK_HTML,"$1")
}
// 导出的网页会被拿去双击打开：正文里混进来的脚本和事件属性要清掉（正常排版不受影响）
function sanitizeBody(html){
    let value = String(html == null ? "" : html)
    if(value === "") return value
    value = value.replace(/<script\b[\s\S]*?<\/script\s*>/gi,"")
    value = value.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"")
    return value
}
function inlineImages(html,noteDir){
    return String(html == null ? "" : html).replace(/(<img[^>]*\ssrc=")([^"]+)(")/gi,(all,head,src,tail)=>{
        const value = String(src).trim()
        if(value === "" || /^data:/i.test(value)) return all
        // 只认「assets/<哈希名>」结尾的本地图片：相对路径、file:// 绝对路径、
        // 调试模式的 http://localhost:5173/assets/... 与 dnote-img:// 协议地址都能命中
        const match = value.split(/[?#]/)[0].match(ASSET_TAIL)
        if(!match) return all
        const name = match[1].toLowerCase()
        const target = path.join(noteDir,"assets",name)
        const relative = path.relative(path.resolve(noteDir,"assets"),path.resolve(target))
        if(relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return all
        const mime = MIME_BY_EXT[path.extname(target).slice(1).toLowerCase()]
        if(!mime || !fs.existsSync(target)) return all
        try{
            const base64 = fs.readFileSync(target).toString("base64")
            return head+"data:"+mime+";base64,"+base64+tail
        }catch{
            return all
        }
    })
}
function noteContext(data){
    if(!data || data.tid == null) throw new Error("invalid export payload")
    const entry = getNoteEntry(data.tid)
    const title = entry.det && entry.det.title ? entry.det.title : "未命名"
    const file = getNoteContentPath(data.tid)
    return { entry, title, file, dir:path.dirname(file) }
}
function resolveBody(data,dir){
    const html = typeof data.html === "string" && data.html.length > 0 ? data.html : "<pre>"+escapeHtml(readNote(data.tid))+"</pre>"
    return sanitizeBody(stripNoteLinks(inlineImages(html,dir)))
}
function metaText(entry){
    const created = entry.det && typeof entry.det.createAt === "string" ? entry.det.createAt : ""
    return created === "" ? "由 Desktop Notebook 导出" : "创建于 "+created+" · 由 Desktop Notebook 导出"
}
function tempFile(html){
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),"desktop-notebook-export-"))
    const file = path.join(dir,"export.html")
    fs.writeFileSync(file,html,"utf-8")
    return { dir, file }
}
async function exportNoteHtml(data,dialog,defaultDir){
    const info = noteContext(data)
    const html = buildStandaloneHtml(info.title,resolveBody(data,info.dir),metaText(info.entry))
    const result = await dialog.showSaveDialog({
        title:"导出为单文件网页",
        defaultPath:path.join(String(defaultDir || ""),sanitizeFileName(info.title)+".html"),
        filters:[{ name:"网页文件", extensions:["html"] }]
    })
    if(result.canceled || !result.filePath) return { canceled:true }
    fs.writeFileSync(result.filePath,html,"utf-8")
    return { canceled:false, filePath:result.filePath, kind:"html" }
}
async function exportNotePdf(data,dialog,defaultDir,renderPdf){
    const info = noteContext(data)
    const result = await dialog.showSaveDialog({
        title:"导出为 PDF",
        defaultPath:path.join(String(defaultDir || ""),sanitizeFileName(info.title)+".pdf"),
        filters:[{ name:"PDF 文件", extensions:["pdf"] }]
    })
    if(result.canceled || !result.filePath) return { canceled:true }
    if(typeof renderPdf !== "function") throw new Error("pdf renderer is not available")
    const html = buildStandaloneHtml(info.title,resolveBody(data,info.dir),metaText(info.entry))
    const buffer = await renderPdf(html)
    fs.writeFileSync(result.filePath,buffer)
    return { canceled:false, filePath:result.filePath, kind:"pdf" }
}
async function exportNoteDoc(data,format,dialog,defaultDir,renderPdf){
    if(format === "pdf") return exportNotePdf(data,dialog,defaultDir,renderPdf)
    if(format === "html") return exportNoteHtml(data,dialog,defaultDir)
    throw new Error("invalid export format: " + String(format))
}
module.exports = {
    exportNoteDoc:exportNoteDoc,
    buildStandaloneHtml:buildStandaloneHtml,
    inlineImages:inlineImages,
    stripNoteLinks:stripNoteLinks,
    writeTempHtml:tempFile
}
