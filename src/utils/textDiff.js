// 版本对比：按行找出哪里改了、哪里加了、哪里删了。
// 用最长公共子序列走一遍，短文档算得很准；文档特别长时退化成逐行对比，
// 免得在页面上卡住。
const MAX_LINES = 4000

function splitLines(text){
    const value = String(text == null ? "" : text).replace(/\r\n/g,"\n")
    return value.length === 0 ? [""] : value.split("\n")
}

function sameRow(left,right){
    if(left === right) return "same"
    if(left.trim() === right.trim()) return "trim"
    return "diff"
}

// 返回 { rows:[{kind,left,right,leftNo,rightNo}], added, removed, changed }
export function diffLines(oldText,newText){
    const left = splitLines(oldText)
    const right = splitLines(newText)
    const rows = []
    let added = 0
    let removed = 0
    let changed = 0
    if(left.length > MAX_LINES || right.length > MAX_LINES){
        const span = Math.max(left.length,right.length)
        for(let i = 0; i < span; i++){
            const a = left[i]
            const b = right[i]
            if(a == null){
                rows.push({ kind:"add", left:-1, right:i + 1, text:String(b) })
            }else if(b == null){
                rows.push({ kind:"del", left:i + 1, right:-1, text:String(a) })
            }else if(sameRow(a,b) === "same"){
                rows.push({ kind:"same", left:i + 1, right:i + 1, text:String(a) })
            }else{
                rows.push({ kind:"del", left:i + 1, right:-1, text:String(a) })
                rows.push({ kind:"add", left:-1, right:i + 1, text:String(b) })
            }
        }
        added = rows.filter(row=>row.kind === "add").length
        removed = rows.filter(row=>row.kind === "del").length
        return { rows:rows, added:added, removed:removed, changed:0 }
    }
    const n = left.length
    const m = right.length
    const table = new Uint32Array((n + 1) * (m + 1))
    const at = (i,j)=>i * (m + 1) + j
    for(let i = n - 1; i >= 0; i--){
        for(let j = m - 1; j >= 0; j--){
            if(sameRow(left[i],right[j]) === "same") table[at(i,j)] = table[at(i + 1,j + 1)] + 1
            else{
                const down = table[at(i + 1,j)]
                const side = table[at(i,j + 1)]
                table[at(i,j)] = down >= side ? down : side
            }
        }
    }
    let i = 0
    let j = 0
    while(i < n && j < m){
        if(sameRow(left[i],right[j]) === "same"){
            rows.push({ kind:"same", left:i + 1, right:j + 1, text:String(left[i]) })
            i++
            j++
            continue
        }
        const down = table[at(i + 1,j)]
        const side = table[at(i,j + 1)]
        if(down >= side){
            rows.push({ kind:"del", left:i + 1, right:-1, text:String(left[i]) })
            i++
        }else{
            rows.push({ kind:"add", left:-1, right:j + 1, text:String(right[j]) })
            j++
        }
    }
    while(i < n){
        rows.push({ kind:"del", left:i + 1, right:-1, text:String(left[i]) })
        i++
    }
    while(j < m){
        rows.push({ kind:"add", left:-1, right:j + 1, text:String(right[j]) })
        j++
    }
    rows.forEach(row=>{
        if(row.kind === "add") added++
        else if(row.kind === "del") removed++
        else if(row.kind === "trim") changed++
    })
    return { rows:rows, added:added, removed:removed, changed:changed }
}

// 把相邻的一删一加并成一行，左右并排看更清楚。
export function pairRows(rows){
    const out = []
    let index = 0
    while(index < rows.length){
        const row = rows[index]
        if(row.kind === "del"){
            const next = rows[index + 1]
            if(next && next.kind === "add"){
                out.push({ left:row, right:next, pair:true })
                index += 2
                continue
            }
            out.push({ left:row, right:null, pair:false })
            index++
            continue
        }
        if(row.kind === "add"){
            out.push({ left:null, right:row, pair:false })
            index++
            continue
        }
        out.push({ left:row, right:row, pair:false })
        index++
    }
    return out
}