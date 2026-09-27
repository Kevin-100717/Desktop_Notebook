const fs = require("fs")
const path = require("path")
var note_list = null
var dataDir = ""
var notesDir = ""
var legacyNotesDir = ""
var listPath = ""
var trashDir = ""
var watchCallback = null
const watchedFiles = new Map()
const watchTimers = new Map()
let listWatched = false
let listTimer = null
const first_new_template = `
Vditor 是一款**所见即所得**编辑器，支持 *Markdown*。

* 不熟悉 Markdown 可使用工具栏或快捷键进行排版
* 熟悉 Markdown 可直接排版，也可切换为分屏预览

更多细节和用法请参考 [Vditor - 浏览器端的 Markdown 编辑器](https://ld246.com/article/1549638745630)，同时也欢迎向我们提出建议或报告问题，谢谢 ❤️

## 教程

这是一篇讲解如何正确使用 **Markdown** 的排版示例，学会这个很有必要，能让你的文章有更佳清晰的排版。

> 引用文本：Markdown is a text formatting syntax inspired

## 语法指导

### 普通内容

这段内容展示了在内容里面一些排版格式，比如：

- **加粗** - \`**加粗**\`
- *倾斜* - \`*倾斜*\`
- ~~删除线~~ - \`~~删除线~~\`
- \`Code 标记\` - \`\` \`Code 标记\` \`\`
- [超级链接](https://ld246.com) - \`[超级链接](https://ld246.com)\`
- [username@gmail.com](mailto:username@gmail.com) - \`[username@gmail.com](mailto:username@gmail.com)\`

### 提及用户

@Vanessa 通过 \`@User\` 可以在内容中提及用户，被提及的用户将会收到系统通知。

> NOTE:
>
> 1. @用户名之后需要有一个空格
> 2. 新手没有艾特的功能权限

### 表情符号 Emoji

支持大部分标准的表情符号，可使用输入法直接输入，也可手动输入字符格式。通过输入 \`:\` 触发自动完成，可在个人设置中[设置常用表情](https://ld246.com/settings/function)。

#### 一些表情例子

😄 😆 😵 😭 😰 😅  😢 😤 😍 😌
👍 👎 💯 👏 🔔 🎁 ❓ 💣 ❤️ ☕️ 🌀 🙇 💋 🙏 💢

### 大标题 - Heading 3

你可以选择使用 H1 至 H6，使用 ##(N) 打头。建议帖子或回帖中的顶级标题使用 Heading 3，不要使用 1 或 2，因为 1 是系统站点级，2 是帖子标题级。

> NOTE: 别忘了 # 后面需要有空格！

#### Heading 4

##### Heading 5

###### Heading 6

### 图片

\`\`\`
![alt 文本](http://image-path.png)
![alt 文本](http://image-path.png "图片 Title 值")
\`\`\`

支持复制粘贴直接上传。

### 代码块

#### 普通

\`\`\`
*emphasize*    **strong**
_emphasize_    __strong__
var a = 1
\`\`\`

#### 语法高亮支持

如果在 \`\`\` 后面跟随语言名称，可以有语法高亮的效果哦，比如:

##### 演示 Go 代码高亮

\`\`\`go
package main

import "fmt"

func main() {
	fmt.Println("Hello, 世界")
}
\`\`\`

##### 演示 Java 高亮

\`\`\`java
public class HelloWorld {

    public static void main(String[] args) {
        System.out.println("Hello World!");
    }

}
\`\`\`

> Tip: 语言名称支持下面这些: \`ruby\`, \`python\`, \`js\`, \`html\`, \`erb\`, \`css\`, \`coffee\`, \`bash\`, \`json\`, \`yml\`, \`xml\` ...

### 有序、无序、任务列表

#### 无序列表

- Java
  - Spring
    - IoC
    - AOP
- Go
  - gofmt
  - Wide
- Node.js
  - Koa
  - Express

#### 有序列表

1. Node.js
   1. Express
   2. Koa
   3. Sails
2. Go
   1. gofmt
   2. Wide
3. Java
   1. Latke
   2. IDEA

#### 任务列表

- [X] 发布 Sym
- [X] 发布 Solo
- [ ] 预约牙医

### 表格

如果需要展示数据什么的，可以选择使用表格。

| header 1 | header 2 |
| -------- | -------- |
| cell 1   | cell 2   |
| cell 3   | cell 4   |
| cell 5   | cell 6   |

### 隐藏细节

<details>
<summary>这里是摘要部分。</summary>
这里是细节部分。
</details>

### 段落

空行可以将内容进行分段，便于阅读。（这是第一段）

使用空行在 Markdown 排版中相当重要。（这是第二段）

### 链接引用

[链接文本][链接标识]

[链接标识]: https://b3log.org
\`\`\`
[链接文本][链接标识]

[链接标识]: https://b3log.org
\`\`\`

### 数学公式

多行公式块：

$$
\frac{1}{
  \Bigl(\sqrt{\phi \sqrt{5}}-\phi\Bigr) e^{
  \frac25 \pi}} = 1+\frac{e^{-2\pi}} {1+\frac{e^{-4\pi}} {
    1+\frac{e^{-6\pi}}
    {1+\frac{e^{-8\pi}}{1+\cdots}}
  }
}
$$

行内公式：

公式 $a^2 + b^2 = \color{red}c^2$ 是行内。

### 脑图

\`\`\`mindmap
- 教程
- 语法指导
  - 普通内容
  - 提及用户
  - 表情符号 Emoji
    - 一些表情例子
  - 大标题 - Heading 3
    - Heading 4
      - Heading 5
        - Heading 6
  - 图片
  - 代码块
    - 普通
    - 语法高亮支持
      - 演示 Go 代码高亮
      - 演示 Java 高亮
  - 有序、无序、任务列表
    - 无序列表
    - 有序列表
    - 任务列表
  - 表格
  - 隐藏细节
  - 段落
  - 链接引用
  - 数学公式
  - 脑图
  - 流程图
  - 时序图
  - 甘特图
  - 图表
  - 五线谱
  - Graphviz
  - 多媒体
  - 脚注
- 快捷键
\`\`\`

### 流程图

\`\`\`mermaid
graph TB
    c1-->a2
    subgraph one
    a1-->a2
    end
    subgraph two
    b1-->b2
    end
    subgraph three
    c1-->c2
    end
\`\`\`

### 时序图

\`\`\`mermaid
sequenceDiagram
    Alice->>John: Hello John, how are you?
    loop Every minute
        John-->>Alice: Great!
    end
\`\`\`

### 甘特图

\`\`\`mermaid
gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    A task           :a1, 2019-01-01, 30d
    Another task     :after a1  , 20d
    section Another
    Task in sec      :2019-01-12  , 12d
    another task      : 24d
\`\`\`

### 图表

\`\`\`echarts
{
  "title": { "text": "最近 30 天" },
  "tooltip": { "trigger": "axis", "axisPointer": { "lineStyle": { "width": 0 } } },
  "legend": { "data": ["帖子", "用户", "回帖"] },
  "xAxis": [{
      "type": "category",
      "boundaryGap": false,
      "data": ["2019-05-08","2019-05-09","2019-05-10","2019-05-11","2019-05-12","2019-05-13","2019-05-14","2019-05-15","2019-05-16","2019-05-17","2019-05-18","2019-05-19","2019-05-20","2019-05-21","2019-05-22","2019-05-23","2019-05-24","2019-05-25","2019-05-26","2019-05-27","2019-05-28","2019-05-29","2019-05-30","2019-05-31","2019-06-01","2019-06-02","2019-06-03","2019-06-04","2019-06-05","2019-06-06","2019-06-07"],
      "axisTick": { "show": false },
      "axisLine": { "show": false }
  }],
  "yAxis": [{ "type": "value", "axisTick": { "show": false }, "axisLine": { "show": false }, "splitLine": { "lineStyle": { "color": "rgba(0, 0, 0, .38)", "type": "dashed" } } }],
  "series": [
    {
      "name": "帖子", "type": "line", "smooth": true, "itemStyle": { "color": "#d23f31" }, "areaStyle": { "normal": {} }, "z": 3,
      "data": ["18","14","22","9","7","18","10","12","13","16","6","9","15","15","12","15","8","14","9","10","29","22","14","22","9","10","15","9","9","15","0"]
    },
    {
      "name": "用户", "type": "line", "smooth": true, "itemStyle": { "color": "#f1e05a" }, "areaStyle": { "normal": {} }, "z": 2,
      "data": ["31","33","30","23","16","29","23","37","41","29","16","13","39","23","38","136","89","35","22","50","57","47","36","59","14","23","46","44","51","43","0"]
    },
    {
      "name": "回帖", "type": "line", "smooth": true, "itemStyle": { "color": "#4285f4" }, "areaStyle": { "normal": {} }, "z": 1,
      "data": ["35","42","73","15","43","58","55","35","46","87","36","15","44","76","130","73","50","20","21","54","48","73","60","89","26","27","70","63","55","37","0"]
    }
  ]
}
\`\`\`

### 五线谱

\`\`\`abc
X: 24
T: Clouds Thicken
C: Paul Rosen
S: Copyright 2005, Paul Rosen
M: 6/8
L: 1/8
Q: 3/8=116
R: Creepy Jig
K: Em
|:"Em"EEE E2G|"C7"_B2A G2F|"Em"EEE E2G|\
"C7"_B2A "B7"=B3|"Em"EEE E2G|
"C7"_B2A G2F|"Em"GFE "D (Bm7)"F2D|\
1"Em"E3-E3:|2"Em"E3-E2B|:"Em"e2e gfe|
"G"g2ab3|"Em"gfeg2e|"D"fedB2A|"Em"e2e gfe|\
"G"g2ab3|"Em"gfe"D"f2d|"Em"e3-e3:|
\`\`\`

### Graphviz

\`\`\`graphviz
digraph finite_state_machine {
    rankdir=LR;
    size="8,5"
    node [shape = doublecircle]; S;
    node [shape = point ]; qi

    node [shape = circle];
    qi -> S;
    S  -> q1 [ label = "a" ];
    S  -> S  [ label = "a" ];
    q1 -> S  [ label = "a" ];
    q1 -> q2 [ label = "ddb" ];
    q2 -> q1 [ label = "b" ];
    q2 -> q2 [ label = "b" ];
}
\`\`\`

### Flowchart

\`\`\`flowchart
st=>start: Start
op=>operation: Your Operation
cond=>condition: Yes or No?
e=>end

st->op->cond
cond(yes)->e
cond(no)->op
\`\`\`

### 多媒体

支持 v.qq.com，youtube.com，youku.com，coub.com，facebook.com/video，dailymotion.com，.mp4，.m4v，.ogg，.ogv，.webm，.mp3，.wav 链接解析

https://v.qq.com/x/cover/zf2z0xpqcculhcz/y0016tj0qvh.html

### 脚注

这里是一个脚注引用[^1]，这里是另一个脚注引用[^bignote]。

[^1]: 第一个脚注定义。

[^bignote]: 脚注定义可使用多段内容。

       缩进对齐的段落包含在这个脚注定义内。
    
       \`\`\`
       可以使用代码块。
       \`\`\`
       还有其他行级排版语法，比如**加粗**和[链接](https://b3log.org)。

\`\`\`
这里是一个脚注引用[^1]，这里是另一个脚注引用[^bignote]。
[^1]: 第一个脚注定义。
[^bignote]: 脚注定义可使用多段内容。

    缩进对齐的段落包含在这个脚注定义内。

\`\`\`
    可以使用代码块。
    \`\`\`
    
    还有其他行级排版语法，比如**加粗**和[链接](https://b3log.org)。
\`\`\`

## 快捷键

我们的编辑器支持很多快捷键，具体请参考 [键盘快捷键](https://ld246.com/article/1474030007391)（或者按 "\`?\` "😼）

`
function note_init(root=process.cwd()){
    dataDir = path.resolve(root)
    fs.mkdirSync(dataDir,{recursive:true})
    notesDir = path.join(dataDir,"notes")
    legacyNotesDir = path.resolve(process.cwd(),"notes")
    listPath = path.join(notesDir,"list.json")
    trashDir = path.join(notesDir,".trash")
    const legacyNotes = legacyNotesDir
    if(!fs.existsSync(notesDir) && legacyNotes !== notesDir && fs.existsSync(legacyNotes)){
        fs.cpSync(legacyNotes,notesDir,{recursive:true})
    }
    if(!fs.existsSync(notesDir)){
        fs.mkdirSync(notesDir,{recursive:true})
    }
    let created=false
    if(!fs.existsSync(listPath)){
        fs.writeFileSync(listPath,"{\"notes\":[],\"trash\":[]}")
        created=true
    }
    note_list = readNoteList()
    if(created) createNewNote(true)
}
function readNoteList(){
    let raw = null
    try{
        raw = fs.readFileSync(listPath,"utf-8")
    }catch(error){
        raw = null
    }
    let data = null
    try{
        data = raw != null ? JSON.parse(raw) : null
    }catch(error){
        data = null
    }
    if(data == null || typeof data !== "object" || !Array.isArray(data.notes)){
        backupBrokenList()
        data = { notes:[], trash:[], tags:[] }
    }
    data.notes = data.notes.filter(item=>item && item.time != null && typeof item.file === "string" && item.file.length > 0)
    if(!Array.isArray(data.trash)) data.trash = []
    data.trash = data.trash.filter(item=>item && item.time != null && typeof item.file === "string" && item.file.length > 0)
    data.notes.forEach(note=>{
        note.tags = Array.isArray(note.tags)
            ? note.tags.filter(item=>typeof item === "string" && item.trim().length > 0)
            : []
        note.det = normalizeDet(note.det,"未命名笔记")
    })
    data.trash.forEach(item=>{
        item.tags = Array.isArray(item.tags)
            ? item.tags.filter(tag=>typeof tag === "string" && tag.trim().length > 0)
            : []
        item.det = normalizeDet(item.det,"未命名笔记")
        if(!Number.isFinite(item.deletedAt)) item.deletedAt = 0
    })
    data.tags = collectTagsFrom(data.notes)   // 老数据没有 tags 字段时按笔记重算，标签栏不会空掉
    return data
}
function normalizeDet(det,fallback){
    const base = det != null && typeof det === "object" ? det : {}
    if(typeof base.title !== "string" || base.title.length === 0) base.title = fallback
    if(typeof base.createAt !== "string") base.createAt = ""
    return base
}
function backupBrokenList(){
    try{
        if(!fs.existsSync(listPath)) return
        const backup = listPath + ".broken-" + Date.now()
        fs.copyFileSync(listPath,backup)
        console.warn("[noteFile] notes/list.json 解析失败，已备份为 " + path.basename(backup) + " 并重建空列表")
    }catch(error){}
}
function writeAtomic(file,content){
    const tempPath = file+".tmp-"+process.pid+"-"+Date.now()
    try{
        fs.writeFileSync(tempPath,content,"utf-8")
        fs.renameSync(tempPath,file)
    }catch(error){
        try{fs.unlinkSync(tempPath)}catch{}
        throw error
    }
}
function updateFileList(data){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list.notes.push(data)
    writeList()

}
function collectTags(){
    return collectTagsFrom(note_list.notes)
}
function collectTagsFrom(notes){
    const seen = new Set()
    const tags = []
    ;(Array.isArray(notes) ? notes : []).forEach(note=>{
        if(!note || !Array.isArray(note.tags)) return
        note.tags.forEach(tag=>{
            const key = String(tag).trim().toLowerCase()
            if(!key || seen.has(key)) return
            seen.add(key)
            tags.push(String(tag).trim())
        })
    })
    return tags
}
function writeList(){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list.tags = collectTags()
    writeAtomic(listPath,JSON.stringify(note_list))
}
function normalizeTitle(tit){
    if(typeof tit !== "string") throw new Error("invalid note title")
    const title = tit.trim()
    if(!title) throw new Error("empty note title")
    return title
}
function createNewNote(first=false,tit="笔记样例"){
    const title = normalizeTitle(tit)
    note_list = readNoteList()
    var t = new Date().getTime()
    const timeTaken = time=>note_list.notes.some(item=>String(item.time)===String(time)) || note_list.trash.some(item=>String(item.time)===String(time))
    while(timeTaken(t)) t++
    const fp = path.join(notesDir,String(t))
    fs.mkdirSync(fp,{recursive:true})
    const f = path.join(fp,"note"+t+"-"+Math.round(Math.random()*100000))
    writeAtomic(f+".md",first?
        first_new_template:
        "# "+title+"\n"
    )
    const det = {
        title:title,
        createAt:new Date().toLocaleString()
    }
    writeAtomic(f+".json",JSON.stringify(det))
    const entry = {
        time:t,
        file:path.relative(dataDir,f),
        det:det,
        tags:[]
    }
    updateFileList(entry)
    return entry
}
function createNote(title,content){
    const entry = createNewNote(false,title)
    if(typeof content === "string" && content.length > 0){
        saveNote({ tid:entry.time, content:content })
    }
    return entry
}
function stopWatchFiles(files){
    files.forEach(file=>{
        clearTimeout(watchTimers.get(file))
        watchTimers.delete(file)
        fs.unwatchFile(file)
        watchedFiles.delete(file)
    })
}
function moveFile(from,to){
    try{
        fs.renameSync(from,to)
    }catch(error){
        if(error && error.code === "EXDEV"){
            fs.copyFileSync(from,to)
            fs.unlinkSync(from)
            return
        }
        throw error
    }
}
function moveToTrash(t){
    note_list = readNoteList()
    const index = note_list.notes.findIndex(item=>String(item.time)===String(t))
    if(index === -1) throw new Error("note is not found")
    const note = note_list.notes[index]
    const mdFile = getNoteFile(note,".md")
    const jsonFile = getNoteFile(note,".json")
    const base = path.basename(mdFile,".md")
    const targetDir = path.join(trashDir,String(note.time))
    stopWatchFiles([mdFile,jsonFile])
    fs.mkdirSync(targetDir,{recursive:true})
    moveFile(mdFile,path.join(targetDir,base+".md"))
    moveFile(jsonFile,path.join(targetDir,base+".json"))
    try{fs.rmdirSync(path.dirname(mdFile))}catch{}
    note_list.notes.splice(index,1)
    note_list.trash.push({
        time:note.time,
        file:path.relative(dataDir,path.join(targetDir,base)),
        det:note.det,
        tags:Array.isArray(note.tags)?note.tags:[],
        deletedAt:Date.now()
    })
    writeList()
    return "success"
}
function deleteNote(t){
    return moveToTrash(t)
}
function getTrash(){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list = readNoteList()
    note_list.trash = note_list.trash.filter(item=>{
        try{
            return fs.existsSync(getNoteFile(item,".md"))
        }catch{
            return false
        }
    })
    return note_list.trash.slice().sort((a,b)=>b.deletedAt-a.deletedAt)
}
function getTrashEntry(t){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list = readNoteList()
    const entry = note_list.trash.find(item=>String(item.time)===String(t))
    if(!entry) throw new Error("trash item is not found")
    return entry
}
function restoreNote(t){
    note_list = readNoteList()
    const index = note_list.trash.findIndex(item=>String(item.time)===String(t))
    if(index === -1) throw new Error("trash item is not found")
    const entry = note_list.trash[index]
    const mdFile = getNoteFile(entry,".md")
    const jsonFile = getNoteFile(entry,".json")
    const base = path.basename(mdFile,".md")
    const targetDir = path.join(notesDir,String(entry.time))
    fs.mkdirSync(targetDir,{recursive:true})
    moveFile(mdFile,path.join(targetDir,base+".md"))
    moveFile(jsonFile,path.join(targetDir,base+".json"))
    note_list.notes.push({
        time:entry.time,
        file:path.relative(dataDir,path.join(targetDir,base)),
        det:entry.det,
        tags:Array.isArray(entry.tags)?entry.tags:[]
    })
    note_list.trash.splice(index,1)
    writeList()
    syncWatchers()
    return { time:entry.time, title:entry.det && entry.det.title }
}
function purgeNote(t){
    note_list = readNoteList()
    const index = note_list.trash.findIndex(item=>String(item.time)===String(t))
    if(index === -1) throw new Error("trash item is not found")
    const entry = note_list.trash[index]
    let noteDir = ""
    try{
        const mdFile = getNoteFile(entry,".md")
        stopWatchFiles([mdFile,getNoteFile(entry,".json")])
        noteDir = path.dirname(mdFile)
    }catch{}
    note_list.trash.splice(index,1)
    writeList()
    if(noteDir){
        try{fs.rmSync(noteDir,{recursive:true,force:true})}catch{}
    }
    return "success"
}
function emptyTrash(){
    note_list = readNoteList()
    const count = note_list.trash.length
    note_list.trash = []
    writeList()
    try{fs.rmSync(trashDir,{recursive:true,force:true})}catch{}
    return { removed:count }
}
function renameNote(data){
    if(!data) throw new Error("invalid rename payload")
    const title = normalizeTitle(data.title)
    const entry = getNoteEntry(data.tid)
    const detFile = getNoteFile(entry,".json")
    let det = {}
    try{
        const parsed = JSON.parse(fs.readFileSync(detFile,{ encoding:'utf-8' }))
        if(parsed && typeof parsed === "object") det = parsed
    }catch{}
    det.title = title
    writeAtomic(detFile,JSON.stringify(det))
    note_list = readNoteList()
    const index = note_list.notes.findIndex(item=>String(item.time)===String(data.tid))
    if(index !== -1){
        note_list.notes[index].det = Object.assign({},note_list.notes[index].det,det)
        writeList()
    }
    return { time:entry.time, title:title }
}
function dedupeTags(tags){
    const result = []
    const seen = new Set()
    tags.forEach(item=>{
        const tag = String(item).trim()
        if(!tag) return
        const key = tag.toLowerCase()
        if(seen.has(key)) return
        seen.add(key)
        result.push(tag)
    })
    return result
}
function normalizeTagName(value){
    if(typeof value !== "string") throw new Error("invalid tag")
    const tag = value.trim()
    if(!tag) throw new Error("tag is empty")
    if(tag.length > 24) throw new Error("tag is too long")
    return tag
}
function normalizeTags(tags){
    if(!Array.isArray(tags)) throw new Error("invalid tags")
    tags.forEach(item=>{
        if(typeof item !== "string") throw new Error("invalid tag")
        if(item.trim().length > 24) throw new Error("tag is too long")
    })
    const result = dedupeTags(tags)
    if(result.length > 3) throw new Error("too many tags")
    return result
}
function getTags(){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list = readNoteList()
    return note_list.tags
}
function setNoteTags(tid,tags){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list = readNoteList()
    const index = note_list.notes.findIndex(item=>String(item.time) === String(tid))
    if(index === -1) throw new Error("note is not found")
    const normalized = normalizeTags(tags)
    note_list.notes[index].tags = normalized
    writeList()
    return { tags: normalized, allTags: note_list.tags }
}
function renameTag(data){
    if(!data) throw new Error("invalid tag payload")
    const from = normalizeTagName(data.from)
    const to = normalizeTagName(data.to)
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list = readNoteList()
    if(from.toLowerCase() === to.toLowerCase()){
        return { changed:0, allTags:note_list.tags }
    }
    const key = from.toLowerCase()
    let changed = 0
    note_list.notes.forEach(note=>{
        if(!Array.isArray(note.tags)) return
        if(!note.tags.some(tag=>String(tag).trim().toLowerCase() === key)) return
        note.tags = dedupeTags(note.tags.map(tag=>String(tag).trim().toLowerCase() === key ? to : tag))
        changed++
    })
    if(changed > 0) writeList()
    return { changed:changed, allTags:note_list.tags }
}
function removeTag(data){
    if(!data) throw new Error("invalid tag payload")
    const target = normalizeTagName(data.tag)
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list = readNoteList()
    const key = target.toLowerCase()
    let changed = 0
    note_list.notes.forEach(note=>{
        if(!Array.isArray(note.tags)) return
        if(!note.tags.some(tag=>String(tag).trim().toLowerCase() === key)) return
        const rest = note.tags.filter(tag=>String(tag).trim().toLowerCase() !== key)
        note.tags = dedupeTags(rest)
        changed++
    })
    if(changed > 0) writeList()
    return { changed:changed, allTags:note_list.tags }
}
function getNoteEntry(t){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list = readNoteList()
    const note = note_list.notes.find(item=>String(item.time) == String(t))
    if(!note){
        throw new Error("note is not found")
    }
    return note
}
function getNoteFile(note,suffix=".md"){
    if(!note || typeof note.file !== "string" || note.file.length === 0){
        throw new Error("invalid note path")
    }
    let candidate = note.file
    if(path.isAbsolute(candidate)){
        const legacyRelative = path.relative(legacyNotesDir,candidate)
        if(legacyRelative && !legacyRelative.startsWith("..") && !path.isAbsolute(legacyRelative)){
            candidate = path.join(notesDir,legacyRelative)
        }
    }else{
        candidate = path.resolve(dataDir,candidate)
    }
    const file = path.resolve(candidate+suffix)
    const relative = path.relative(notesDir,file)
    if(relative.startsWith("..") || path.isAbsolute(relative)){
        throw new Error("invalid note path")
    }
    return file
}
function getNotes(){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list = readNoteList()
    syncWatchers()
    return { notes:note_list.notes, tags:note_list.tags }
}
function getNoteContentPath(t){
    return getNoteFile(getNoteEntry(t))
}
function getNoteContentPathByEntry(entry){
    return getNoteFile(entry)
}
function readNote(t){
    return fs.readFileSync(getNoteFile(getNoteEntry(t)),{ encoding:'utf-8' })
}
function saveNote(data){
    if(!data || typeof data.content !== "string") throw new Error("invalid note content")
    const file = getNoteFile(getNoteEntry(data.tid))
    writeAtomic(file,data.content)
    return "success"
}
function syncWatchers(){
    if(!watchCallback) return
    if(!listWatched){
        fs.watchFile(listPath,{persistent:true,interval:200},()=>{
            clearTimeout(listTimer)
            listTimer = setTimeout(()=>{
                try{
                    note_list = readNoteList()
                    syncWatchers()
                    watchCallback({list:true})
                }catch{}
            },100)
        })
        listWatched = true
    }
    const current = new Map()
    note_list.notes.forEach(note=>{
        let file
        try{
            file = getNoteFile(note)
        }catch{
            return
        }
        current.set(file,note)
        const watched = watchedFiles.get(file)
        if(watched != null && watched != note.time){
            clearTimeout(watchTimers.get(file))
            watchTimers.delete(file)
            fs.unwatchFile(file)
            watchedFiles.delete(file)
        }
        if(watchedFiles.has(file)) return
        fs.watchFile(file,{persistent:true,interval:200},()=>{
            clearTimeout(watchTimers.get(file))
            watchTimers.set(file,setTimeout(()=>{
                try{
                    const content = fs.readFileSync(file,{ encoding:'utf-8' })
                    watchCallback({tid:note.time,content})
                }catch{}
            },100))
        })
        watchedFiles.set(file,note.time)
    })
    for(const file of watchedFiles.keys()){
        if(!current.has(file)){
            clearTimeout(watchTimers.get(file))
            watchTimers.delete(file)
            fs.unwatchFile(file)
            watchedFiles.delete(file)
        }
    }
}
function watchNotes(callback){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    watchCallback = callback
    syncWatchers()
}
module.exports = {
    note_init:note_init,
    getNotes:getNotes,
    readNote:readNote,
    getNoteContentPath:getNoteContentPath,
    getNoteContentPathByEntry:getNoteContentPathByEntry,
    saveNote:saveNote,
    createNote:createNote,
    deleteNote:deleteNote,
    renameNote:renameNote,
    getTrash:getTrash,
    restoreNote:restoreNote,
    purgeNote:purgeNote,
    emptyTrash:emptyTrash,
    getTags:getTags,
    setNoteTags:setNoteTags,
    renameTag:renameTag,
    removeTag:removeTag,
    watchNotes:watchNotes
}