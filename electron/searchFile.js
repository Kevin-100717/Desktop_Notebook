const fs = require("fs")
const { getNotes, getNoteContentPathByEntry } = require("./noteFile")
const { getStickies, getStickyContentPathByEntry } = require("./labelFile")
const { match: matchPinyin } = require("pinyin-match")

const SNIPPET_RADIUS = 42
const MAX_RESULTS = 200
const MAX_BACKLINKS = 100
const PINYIN_CONTENT_LIMIT = 800
const PINYIN_TERM = /^[a-z]{2,}$/
const DAY = 86400000
const HALF_YEAR_DAYS = 183
const SCORE_TITLE_EXACT = 1200
const SCORE_TITLE_PREFIX = 900
const SCORE_TITLE_PARTIAL = 600
const SCORE_TAG = 420
const SCORE_CONTENT = 200
const SCORE_BODY_BONUS = 40
const TIME_DECAY = 200
const contentCache = new Map()

function normalizeKeyword(value){
    if(typeof value !== "string") throw new Error("invalid keyword")
    return value.trim().slice(0,100)
}
function cacheKey(file){
    try{
        const stat = fs.statSync(file)
        return file+"|"+stat.mtimeMs+"|"+stat.size
    }catch{
        return file+"|0|0"
    }
}
function readCached(file){
    const key = cacheKey(file)
    const cached = contentCache.get(file)
    if(cached != null && cached.key === key) return cached.content
    let content = ""
    try{
        content = fs.readFileSync(file,{ encoding:'utf-8' })
    }catch(error){
        // 读失败（被占用等）不能当空内容缓存起来，否则后面一直是空的
        if(!error || error.code !== "ENOENT") return ""
    }
    contentCache.set(file,{ key:key, content:content })
    return content
}
function pruneCache(liveFiles){
    if(contentCache.size <= liveFiles.size * 2) return
    for(const file of contentCache.keys()){
        if(!liveFiles.has(file)) contentCache.delete(file)
    }
}
function collapse(text){
    return String(text).replace(/\r/g,"").replace(/[#*`>\[\]()!_|-]{1,}/g," ").replace(/\s+/g," ").trim()
}
function isPinyinTerm(term){
    return PINYIN_TERM.test(term)
}
function escapeRegExp(value){
    return String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")
}
// 在文本里定位一个关键词。直接子串优先；纯字母关键词再交给 pinyin-match（支持拼音全拼/首字母）。
// 返回 { start, end }（原文下标）或 null。limit 用于限制参与拼音转换的文本长度，避免大文件反复转换。
function locateTermInRaw(text,term,limit){
    const source = String(text == null ? "" : text)
    const at = source.toLowerCase().indexOf(term)
    if(at !== -1) return { start:at, end:at+term.length }
    if(!isPinyinTerm(term)) return null
    const snippet = limit != null && source.length > limit ? source.slice(0,limit) : source
    const range = matchPinyin(snippet,term)
    if(range) return { start:range[0], end:range[1]+1 }
    return null
}
function buildSnippet(flat,locs){
    const starts = []
    const ends = []
    for(const loc of locs){
        starts.push(loc.start)
        ends.push(loc.end)
    }
    const minStart = Math.min.apply(null,starts)
    const maxEnd = Math.max.apply(null,ends)
    const start = Math.max(0,minStart-SNIPPET_RADIUS)
    const end = Math.min(flat.length,maxEnd+SNIPPET_RADIUS)
    return {
        text:flat.slice(start,end),
        matchStart:minStart-start,
        matchEnd:maxEnd-start,
        prefix:start > 0,
        suffix:end < flat.length
    }
}
// 相关度：标题命中权重最高，标签其次，正文最低；再按距今多久轻微衰减。
// 时间越久扣得越多，但最多只扣 TIME_DECAY，不会让老笔记被挤出结果。
function recencyBonus(time){
    const at = Number(time)
    if(!Number.isFinite(at)) return 0
    const days = (Date.now() - at) / DAY
    if(days <= 0) return TIME_DECAY
    if(days >= HALF_YEAR_DAYS) return 0
    return Math.round(TIME_DECAY * (1 - days / HALF_YEAR_DAYS))
}
function countMatches(text,term){
    const haystack = text.toLowerCase()
    const needle = term.toLowerCase()
    if(needle === "") return 0
    let cursor = 0
    let total = 0
    let at = haystack.indexOf(needle,cursor)
    while(at !== -1 && total < 5){
        total++
        cursor = at + needle.length
        at = haystack.indexOf(needle,cursor)
    }
    return total
}
function scoreCandidate(titleScore,tagHits,bodyHits){
    let score = titleScore
    if(tagHits > 0) score += SCORE_TAG
    if(bodyHits > 0){
        score += SCORE_CONTENT
        score += Math.min(SCORE_BODY_BONUS, (bodyHits - 1) * 20)
    }
    return score
}
function matchOne(candidate,terms){
    const title = String(candidate.title || "")
    const tags = Array.isArray(candidate.tags) ? candidate.tags : []
    const flat = candidate._flat != null ? candidate._flat : (candidate._flat = collapse(candidate.content || ""))
    let titleScore = 0
    let tagHits = 0
    let bodyHits = 0
    let jumpTerm = ""
    const contentLocs = []
    for(const term of terms){
        const tl = locateTermInRaw(title,term,null)
        if(tl){
            const hits = countMatches(title,term)
            if(term === title.trim().toLowerCase()) titleScore = Math.max(titleScore,SCORE_TITLE_EXACT)
            else if(tl.start === 0) titleScore = Math.max(titleScore,SCORE_TITLE_PREFIX)
            else titleScore = Math.max(titleScore,SCORE_TITLE_PARTIAL + hits * 5)
            if(jumpTerm === "") jumpTerm = term
            continue
        }
        let matchedTag = false
        for(const tag of tags){
            if(String(tag).toLowerCase().indexOf(term) !== -1){
                matchedTag = true
                break
            }
        }
        if(matchedTag){
            tagHits++
            if(jumpTerm === "") jumpTerm = term
            continue
        }
        const cl = locateTermInRaw(flat,term,PINYIN_CONTENT_LIMIT)
        if(cl){
            contentLocs.push(cl)
            bodyHits++
            if(jumpTerm === "") jumpTerm = term
            continue
        }
        return null
    }
    const field = titleScore > 0 ? "title" : (tagHits > 0 ? "tag" : "content")
    const score = scoreCandidate(titleScore,tagHits,bodyHits) + recencyBonus(candidate.time)
    let snippet
    if(contentLocs.length > 0){
        snippet = buildSnippet(flat,contentLocs)
    }else{
        snippet = {
            text:flat.slice(0,140),
            matchStart:-1,
            matchEnd:-1,
            prefix:false,
            suffix:false
        }
    }
    return {
        kind:candidate.kind,
        time:candidate.time,
        title:title,
        field:field,
        score:score,
        jumpTerm:jumpTerm,
        snippet:snippet
    }
}
function collectCandidates(liveFiles){
    const candidates = []
    getNotes().notes.forEach(note=>{
        let content = ""
        try{
            const file = getNoteContentPathByEntry(note)
            liveFiles.add(file)
            content = readCached(file)
        }catch{
            content = ""
        }
        candidates.push({
            kind:"note",
            time:note.time,
            title:note.det && note.det.title,
            tags:Array.isArray(note.tags) ? note.tags : [],
            content:content
        })
    })
    getStickies().sticky.forEach(sticky=>{
        let content = ""
        try{
            const file = getStickyContentPathByEntry(sticky)
            liveFiles.add(file)
            content = readCached(file)
        }catch{
            content = ""
        }
        candidates.push({
            kind:"sticky",
            time:sticky.time,
            title:sticky.det && sticky.det.title,
            tags:Array.isArray(sticky.tags) ? sticky.tags : [],
            content:content
        })
    })
    return candidates
}
function searchAll(data){
    const keyword = normalizeKeyword(data)
    if(!keyword) return { keyword:keyword, terms:[], results:[], truncated:false }
    const terms = keyword.split(/\s+/).filter(Boolean).map(term=>term.toLowerCase())
    const liveFiles = new Set()
    const candidates = collectCandidates(liveFiles)
    pruneCache(liveFiles)
    const results = []
    // 先全量打分再截断：边扫边截会把先扫到的（通常是旧的）留下，把高分的挤掉
    for(const candidate of candidates){
        const hit = matchOne(candidate,terms)
        if(hit) results.push(hit)
    }
    results.sort((a,b)=>{
        if(b.score !== a.score) return b.score - a.score
        return Number(b.time) - Number(a.time)
    })
    const truncated = results.length > MAX_RESULTS
    return { keyword:keyword, terms:terms, results:results.slice(0,MAX_RESULTS), truncated:truncated }
}
// 反向链接：哪些笔记/便签的正文里引用了 dnote:note/<tid>
function getNoteBacklinks(tid){
    const target = String(tid == null ? "" : tid)
    if(target === "") return { tid:target, results:[] }
    const needle = "dnote:note/" + target
    const linkRe = new RegExp(escapeRegExp(needle), "g")
    const results = []
    const seen = new Set()
    const consider = (kind,entry)=>{
        const key = kind + "|" + entry.time
        if(seen.has(key)) return
        if(kind === "note" && String(entry.time) === target) return
        let content = ""
        try{
            const file = kind === "note" ? getNoteContentPathByEntry(entry) : getStickyContentPathByEntry(entry)
            content = readCached(file)
        }catch{
            return
        }
        if(content.indexOf(needle) === -1) return
        seen.add(key)
        let count = 0
        let match = linkRe.exec(content)
        while(match !== null){
            count++
            match = linkRe.exec(content)
        }
        const flat = collapse(content)
        const at = flat.toLowerCase().indexOf(needle)
        let snippet = null
        if(at !== -1) snippet = buildSnippet(flat,[{ start:at, end:at+needle.length }])
        results.push({
            kind:kind,
            time:entry.time,
            title:String((entry.det || {}).title || ""),
            count:count,
            snippet:snippet
        })
    }
    getNotes().notes.forEach(entry=>consider("note",entry))
    getStickies().sticky.forEach(entry=>consider("sticky",entry))
    results.sort((a,b)=>Number(b.time) - Number(a.time))
    return { tid:target, results:results.slice(0,MAX_BACKLINKS) }
}
function clearSearchCache(){
    contentCache.clear()
}
module.exports = {
    searchAll:searchAll,
    getNoteBacklinks:getNoteBacklinks,
    clearSearchCache:clearSearchCache
}