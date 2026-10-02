const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT'])

function isSkipped(node){
    if(SKIP_TAGS.has(node.nodeName)) return true
    let parent = node.parentElement
    while(parent != null){
        if(SKIP_TAGS.has(parent.nodeName)) return true
        if(parent.classList && parent.classList.contains('find-hide')) return true
        parent = parent.parentElement
    }
    return false
}

// 把一个容器里的文字按顺序拼成一整条，并记住每段文字来自哪个 DOM 节点。
// 这样就能用「纯文本下标」去找位置，再换算回页面上的位置，不用关心原来的排版。
export function buildTextIndex(root){
    const parts = []
    let text = ""
    if(root == null || typeof root.querySelectorAll !== 'function') return { text:"", parts:[] }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
    let node = walker.nextNode()
    while(node != null){
        const value = node.nodeValue
        if(value != null && value.length > 0 && !isSkipped(node)){
            parts.push({ node, start:text.length, length:value.length })
            text += value
        }
        node = walker.nextNode()
    }
    return { text, parts }
}

function locate(index, offset){
    const parts = index.parts
    let low = 0
    let high = parts.length - 1
    while(low <= high){
        const mid = (low + high) >> 1
        const part = parts[mid]
        if(offset < part.start) high = mid - 1
        else if(offset >= part.start + part.length) low = mid + 1
        else return { node:part.node, offset:offset - part.start }
    }
    const last = parts[parts.length - 1]
    if(last != null) return { node:last.node, offset:last.length }
    return null
}

// 在整条文字里找出所有命中位置。中文按字符、英文忽略大小写。
export function findMatches(index, term){
    const matches = []
    const needle = String(term == null ? '' : term).trim()
    if(needle === '' || index == null || index.text.length === 0) return matches
    const haystack = index.text.toLowerCase()
    const key = needle.toLowerCase()
    let cursor = 0
    while(cursor <= haystack.length - key.length){
        const at = haystack.indexOf(key,cursor)
        if(at === -1) break
        matches.push({ start:at, end:at + key.length })
        cursor = at + key.length
    }
    return matches
}

// 把「纯文本下标」换算成页面坐标，用来滚动和高亮。
export function rectOf(index, start, end){
    if(index == null || index.parts.length === 0) return null
    const from = locate(index,start)
    const to = locate(index,Math.max(start,end - 1))
    if(from == null || to == null) return null
    const range = document.createRange()
    try{
        range.setStart(from.node,from.offset)
        range.setEnd(to.node,to.offset + 1)
    }catch{
        return null
    }
    const rect = range.getBoundingClientRect()
    if(rect == null || (rect.width === 0 && rect.height === 0)) return null
    return { left:rect.left, top:rect.top, width:rect.width, height:rect.height }
}

export function scrollRectIntoView(container,rect,padding){
    if(container == null || rect == null) return
    const gap = padding == null ? 90 : padding
    const box = container.getBoundingClientRect()
    const above = rect.top - box.top
    const below = rect.top + rect.height - box.bottom
    if(above < gap) container.scrollTop -= (gap - above)
    else if(below > -gap) container.scrollTop += (below + gap)
}