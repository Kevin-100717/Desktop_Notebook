const HREF_PREFIX = "dnote:note/"
const HREF_PATTERN = /^dnote:note\/([^/?#\s]+)$/
// 与 electron/exportDoc.js、electron/transferFile.js 里的导出清理正则保持同源（见下方注释）
const MARKDOWN_LINK = /\[([^\]\n]*)\]\(\s*dnote:note\/[^)\s]*\s*\)/g
const HTML_LINK = /<a\b[^>]*href=["']dnote:note\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi

export function isNoteLinkHref(href){
    return noteLinkTid(href) !== ""
}
export function noteLinkTid(href){
    const value = String(href == null ? "" : href).trim()
    if(value === "") return ""
    const match = value.match(HREF_PATTERN)
    return match ? match[1] : ""
}
export function buildNoteHref(tid){
    const value = String(tid == null ? "" : tid).trim()
    if(value === "") return ""
    return HREF_PREFIX + encodeURIComponent(value)
}
export function escapeLinkText(text){
    return String(text == null ? "" : text)
        .replace(/[\r\n]+/g," ")
        .replace(/\\/g,"\\\\")
        .replace(/\[/g,"\\[")
        .replace(/\]/g,"\\]")
}
// 标题会经 insertValue 走 innerHTML 插进编辑器，不转义就能执行脚本
function escapeHtml(text){
    return String(text == null ? "" : text)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
}
export function buildNoteMarkdown(tid,title){
    const href = buildNoteHref(tid)
    if(href === "") return ""
    // 尖括号会让 markdown 解析成真标签（编辑器按 HTML 插入），其余字符保持原样
    const text = escapeLinkText(title).replace(/</g,"&lt;").replace(/>/g,"&gt;")
    return "[" + text + "](" + href + ")"
}
export function buildNoteSnippet(tid,title,mode){
    if(mode === "wysiwyg") return '<a href="' + buildNoteHref(tid) + '">' + escapeHtml(escapeLinkText(title)) + "</a>"
    return buildNoteMarkdown(tid,title)
}
export function collectNoteLinkTids(text){
    const value = String(text == null ? "" : text)
    const out = []
    const pattern = /dnote:note\/([^)\s"'>]+)/g
    let match = pattern.exec(value)
    while(match !== null){
        const tid = match[1]
        if(tid !== "" && !out.includes(tid)) out.push(tid)
        match = pattern.exec(value)
    }
    return out
}
export function stripNoteLinksFromMarkdown(text){
    const value = String(text == null ? "" : text)
    if(value === "") return value
    return value.replace(MARKDOWN_LINK,"$1")
}
export function stripNoteLinksFromHtml(html){
    const value = String(html == null ? "" : html)
    if(value === "") return value
    return value.replace(HTML_LINK,"$1")
}
