const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
var note_list = null
var dataDir = ""
var notesDir = ""
var legacyNotesDir = ""
var listPath = ""
var trashDir = ""
const watchCallbacks = new Set()   // 托盘与 IPC 各注册一份，单槽会被后注册的覆盖掉
const watchedFiles = new Map()
const watchTimers = new Map()
let listWatched = false
let listTimer = null
const IMAGE_MIME_EXT = {
    "image/png":"png",
    "image/jpeg":"jpg",
    "image/jpg":"jpg",
    "image/gif":"gif",
    "image/webp":"webp",
    "image/bmp":"bmp"
}
const MAX_IMAGE_BYTES = 12*1024*1024
const HISTORY_LIMIT = 30
const HISTORY_STAMP = /^\d{13}-\d{1,6}$/
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
    // 只有老目录里确实有索引才搬：cwd 是启动器给的，随便搬会把无关目录的 notes 复制进来
    const legacyLooksValid = fs.existsSync(path.join(legacyNotes,"list.json"))
    if(!fs.existsSync(notesDir) && legacyNotes !== notesDir && legacyLooksValid && fs.existsSync(legacyNotes)){
        fs.cpSync(legacyNotes,notesDir,{recursive:true})
    }
    if(!fs.existsSync(notesDir)){
        fs.mkdirSync(notesDir,{recursive:true})
    }
    let created=false
    if(!fs.existsSync(listPath)){
        // 索引不见了但笔记文件还在（被清理/占用导致没读到）时绝不能播种空列表：
        // 下一次保存会把整份索引覆盖成空的，所有笔记都变成孤儿文件
        if(notesDirHasData()) throw new Error("notes/list.json 不见了，但 notes/ 里还有笔记文件；先别启动，把索引找回来再用")
        fs.writeFileSync(listPath,"{\"notes\":[],\"trash\":[]}")
        created=true
    }
    note_list = readNoteList()
    if(created) createNewNote(true)
}
// notes/ 里除索引自己以外还有东西，就说明索引本该存在
function notesDirHasData(){
    try{
        return fs.readdirSync(notesDir).some(name=>name !== ".trash" && name !== "list.json" && !name.startsWith("list.json."))
    }catch{
        return false
    }
}
function readNoteList(){
    let raw = null
    try{
        raw = fs.readFileSync(listPath,"utf-8")
    }catch(error){
        // 只有「文件不存在且没有别的笔记」才算空列表；读失败或索引丢了都要报出去，
        // 当成空的后面随便一次保存就把整份索引覆盖没了
        if(!error || error.code !== "ENOENT") throw error
        if(notesDirHasData()) throw new Error("notes/list.json 不见了，但 notes/ 里还有笔记文件；把索引找回来再用")
        raw = null
    }
    let data = null
    try{
        data = raw != null ? JSON.parse(raw) : null
    }catch(error){
        // 可能是外部程序正在写，读到半截字节：再读一次，字节变了就抛出去让调用方重试，
        // 不能当成损坏重建空列表（那会把真实索引顶掉）
        let again = null
        try{
            again = fs.readFileSync(listPath,"utf-8")
        }catch{}
        if(again !== raw) throw new Error("notes/list.json 正在被写入，稍后再试")
        backupBrokenList()
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
        const dir = path.dirname(listPath), base = path.basename(listPath)
        // 一直读不出来时只备一次，别每次读都复制一份堆满目录
        if(fs.readdirSync(dir).some(name=>name.startsWith(base+".broken-"))) return
        const backup = listPath + ".broken-" + Date.now()
        fs.copyFileSync(listPath,backup)
        console.warn("[noteFile] notes/list.json 解析失败，已备份为 " + path.basename(backup) + " 并重建空列表")
    }catch(error){}
}
function writeAtomic(file,content){
    const tempPath = file+".tmp-"+process.pid+"-"+Date.now()
    try{
        fs.writeFileSync(tempPath,content,"utf-8")
        retryRename(tempPath,file)   // Windows 上目标可能瞬时被占用，rename 要带重试
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
const LOCK_CODES = new Set(["EPERM","EBUSY","EACCES"])
function retryRename(from,to){
    // Windows 上目录里刚被读取/显示的文件（如图片、刚解除监听的 .md）可能
    // 瞬时被占用，renameSync 会丢 EPERM/EBUSY，稍等片刻重试即可
    let attempts = 0
    for(;;){
        try{
            fs.renameSync(from,to)
            return
        }catch(error){
            if(!LOCK_CODES.has(error && error.code)) throw error
            attempts++
            if(attempts > 8) throw error
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,40)
        }
    }
}
const pendingRemoves = new Map()                 // 复制兜底后清源目录的延时任务，避免抛错把状态弄成半删
function scheduleRemoveLater(target){
    if(pendingRemoves.has(target)) return
    const state = { tries:0 }
    pendingRemoves.set(target,state)
    const attempt = ()=>{
        try{
            fs.rmSync(target,{ recursive:true, force:true })
            pendingRemoves.delete(target)
            return
        }catch(error){
            if(!error || !LOCK_CODES.has(error.code) || state.tries++ >= 200){ // 至少再拖够 60s
                pendingRemoves.delete(target)
                return
            }
            setTimeout(attempt,300)
        }
    }
    setTimeout(attempt,300)
}
function rmSource(target){
    // 「复制进回收站」已经成功，源目录删除是尽力而为：删得掉最好，删不掉（文件仍被
    // 打开且不允许 unlink，如编辑器正显示着图片）就延时重试，绝不抛错——绝不因为
    // 这里失败让 list.json 没机会更新，从而出现「笔记还在列表、文件却没了」的幽灵态。
    try{
        fs.rmSync(target,{ recursive:true, force:true })
    }catch(error){
        if(error && LOCK_CODES.has(error && error.code)) scheduleRemoveLater(target)
    }
}
function moveFile(from,to){
    try{
        retryRename(from,to)
    }catch(error){
        if(error && error.code === "EXDEV"){
            fs.copyFileSync(from,to)
            rmSource(from)
            return
        }
        throw error
    }
}
function moveDir(from,to){                       // 整目录搬家，assets 与 .history 必须跟着笔记走
    try{
        retryRename(from,to)
    }catch(error){
        if(!error || !(error.code === "EXDEV" || LOCK_CODES.has(error.code))) throw error
        // Windows：只要目录下有一个文件仍被占用（如笔记正开着、图片经 dnote-img:// 显示中），
        // renameSync 就会一直 EPERM。改走「复制进回收站 + 尽力删除源目录」——复制只要读权限，
        // 占用不再成为阻碍，数据照样安全搬走；源目录删不掉就延时重试，绝不影响回收站写名单。
        fs.cpSync(from,to,{ recursive:true })
        rmSource(from)
    }
}
function isNoteDir(dir,tid){
    if(!dir) return false
    const target = path.resolve(dir)
    if(target === path.resolve(notesDir) || target === path.resolve(trashDir)) return false
    return path.basename(target) === String(tid)
}
// time 会拼进回收站/笔记目录名，索引被改坏时 ".." 能把删除操作带出数据目录
function timeKey(t){
    const key = String(t)
    if(!/^[0-9A-Za-z_-]+$/.test(key)) throw new Error("invalid note id")
    return key
}
function moveToTrash(t){
    note_list = readNoteList()
    const index = note_list.notes.findIndex(item=>String(item.time)===String(t))
    if(index === -1) throw new Error("note is not found")
    const note = note_list.notes[index]
    const mdFile = getNoteFile(note,".md")
    const jsonFile = getNoteFile(note,".json")
    const base = path.basename(mdFile,".md")
    const targetDir = path.join(trashDir,timeKey(note.time))
    const noteDir = path.dirname(mdFile)
    stopWatchFiles([mdFile,jsonFile])
    const dedicated = isNoteDir(noteDir,note.time)
    if(dedicated){
        // 源目录先确认还在：已经没了就别把回收站里的同名副本删掉再搬（那样会两手空空）
        if(!fs.existsSync(noteDir)) throw new Error("note files are missing")
        fs.mkdirSync(trashDir,{recursive:true})
        try{ fs.rmSync(targetDir,{ recursive:true, force:true }) }catch{}
        moveDir(noteDir,targetDir)            // 整目录进回收站，assets 与 .history 不留在原地
    }else{
        if(!fs.existsSync(mdFile)) throw new Error("note files are missing")
        fs.mkdirSync(targetDir,{recursive:true})
        moveFile(mdFile,path.join(targetDir,base+".md"))
        moveFile(jsonFile,path.join(targetDir,base+".json"))
        try{fs.rmdirSync(noteDir)}catch{}
    }
    note_list.notes.splice(index,1)
    note_list.trash.push({
        time:note.time,
        file:path.relative(dataDir,path.join(targetDir,base)),
        det:note.det,
        tags:Array.isArray(note.tags)?note.tags:[],
        deletedAt:Date.now()
    })
    try{
        writeList()
    }catch(error){
        // 索引没写成要把文件原样搬回去，否则文件躺在回收站、索引却还当它在用
        try{
            if(dedicated) moveDir(targetDir,noteDir)
            else{
                moveFile(path.join(targetDir,base+".md"),mdFile)
                moveFile(path.join(targetDir,base+".json"),jsonFile)
            }
            note_list.trash.pop()
            note_list.notes.splice(index,0,note)
        }catch{}
        throw error
    }
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
    const targetDir = path.join(notesDir,timeKey(entry.time))
    const sourceDir = path.dirname(mdFile)
    let movedWholeDir = false
    if(isNoteDir(sourceDir,entry.time) && fs.existsSync(path.join(targetDir,base+".md")) === false){
        try{ fs.rmSync(targetDir,{ recursive:true, force:true }) }catch{}
        moveDir(sourceDir,targetDir)          // 连 assets 与 .history 一起搬回
        movedWholeDir = true
    }else{
        if(!fs.existsSync(mdFile)) throw new Error("trash item files are missing")
        fs.mkdirSync(targetDir,{recursive:true})
        moveFile(mdFile,path.join(targetDir,base+".md"))
        moveFile(jsonFile,path.join(targetDir,base+".json"))
        if(isNoteDir(sourceDir,entry.time)){
            ["assets",".history"].forEach(name=>{
                const from = path.join(sourceDir,name)
                if(!fs.existsSync(from)) return
                try{ moveDir(from,path.join(targetDir,name)) }catch{}
            })
            try{fs.rmdirSync(sourceDir)}catch{}
        }
    }
    note_list.notes.push({
        time:entry.time,
        file:path.relative(dataDir,path.join(targetDir,base)),
        det:entry.det,
        tags:Array.isArray(entry.tags)?entry.tags:[]
    })
    note_list.trash.splice(index,1)
    try{
        writeList()
    }catch(error){
        // 索引没写成要搬回回收站，不然文件在 notes/ 里、索引还当它在回收站
        try{
            if(movedWholeDir){
                moveDir(targetDir,sourceDir)
            }else{
                moveFile(path.join(targetDir,base+".md"),mdFile)
                moveFile(path.join(targetDir,base+".json"),jsonFile)
            }
            note_list.notes.pop()
            note_list.trash.splice(index,0,entry)
        }catch{}
        throw error
    }
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
        // 只删这条回收站条目自己的目录：路径异常时宁可不删，也不能连锅端
        const dir = path.dirname(mdFile)
        if(isNoteDir(dir,entry.time)) noteDir = dir
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
    let raw = null
    try{
        raw = fs.readFileSync(detFile,{ encoding:'utf-8' })
    }catch(error){
        // 文件不在才算新的，读失败要报出去，免得把 createAt 之类字段冲掉
        if(!error || error.code !== "ENOENT") throw error
    }
    if(raw != null){
        try{
            const parsed = JSON.parse(raw)
            if(parsed && typeof parsed === "object") det = parsed
        }catch{
            try{
                const backup = detFile + ".broken-" + Date.now()
                fs.copyFileSync(detFile,backup)
            }catch{}
        }
    }
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
function getNoteDir(entry){
    return path.dirname(getNoteFile(entry,""))
}
const IMAGE_MAGIC = {
    "image/png":[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],
    "image/jpeg":[0xff,0xd8,0xff],
    "image/gif":[0x47,0x49,0x46,0x38],
    "image/bmp":[0x42,0x4d]
}
function matchImageMagic(buffer,mime){
    if(mime === "image/webp"){
        return buffer.length >= 12
            && buffer.slice(0,4).toString("ascii") === "RIFF"
            && buffer.slice(8,12).toString("ascii") === "WEBP"
    }
    const magic = IMAGE_MAGIC[mime]
    if(!magic) return false
    return magic.every((byte,index)=>buffer[index] === byte)
}
function saveNoteImage(data){
    if(!data || data.tid == null) throw new Error("invalid image payload")
    const mime = typeof data.mime === "string" ? data.mime.trim().toLowerCase() : ""
    const ext = IMAGE_MIME_EXT[mime]
    if(!ext) throw new Error("unsupported image type: " + mime)
    if(typeof data.base64 !== "string" || data.base64.length === 0) throw new Error("invalid image data")
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64.replace(/\s+/g,""))) throw new Error("invalid image data")
    const buffer = Buffer.from(data.base64,"base64")
    if(buffer.length === 0) throw new Error("invalid image data")
    if(buffer.length > MAX_IMAGE_BYTES) throw new Error("image is larger than 12MB")
    if(!matchImageMagic(buffer,mime)) throw new Error("image content does not match " + mime)
    const dir = path.join(getNoteDir(getNoteEntry(data.tid)),"assets")
    fs.mkdirSync(dir,{recursive:true})
    const name = crypto.createHash("sha1").update(buffer).digest("hex").slice(0,16)+"."+ext
    const file = path.join(dir,name)
    if(!fs.existsSync(file)) writeAtomic(file,buffer)   // 原子写：写一半崩了不会留下半张图被反复复用
    return { name:name, path:"./assets/"+name, size:buffer.length, mime:mime }
}
const ASSET_NAME_PATTERN = /^[0-9a-f]{16}\.(?:png|jpe?g|gif|webp|bmp)$/
function collectAssetRefs(content){
    if(typeof content !== "string") return new Set()
    const out = new Set()
    const re = /(?:\.\/)?assets\/([0-9a-f]{16}\.(?:png|jpe?g|gif|webp|bmp))/g
    let match = re.exec(content)
    while(match !== null){
        out.add(match[1])
        match = re.exec(content)
    }
    return out
}
function garbageCollectAssets(entry,content){
    // 保存后清理失效图片：正文不再引用的哈希图片立即删除（与历史版本无关）
    const assets = path.join(getNoteDir(entry),"assets")
    if(!fs.existsSync(assets)) return
    const keep = collectAssetRefs(content)
    for(const name of fs.readdirSync(assets)){
        if(!ASSET_NAME_PATTERN.test(name)) continue
        if(keep.has(name)) continue
        try{ fs.unlinkSync(path.join(assets,name)) }catch{}
    }
}
function getHistoryDir(entry){
    return path.join(getNoteDir(entry),".history")
}
function historyStamps(dir){
    try{
        return fs.readdirSync(dir)
            .filter(name=>name.endsWith(".md") && HISTORY_STAMP.test(name.slice(0,-3)))
            .sort()
    }catch{
        return []
    }
}
function pushHistory(entry,content){
    if(typeof content !== "string") return
    try{
        const dir = getHistoryDir(entry)
        fs.mkdirSync(dir,{recursive:true})
        const stamp = Date.now()+"-"+String(Math.round(Math.random()*100000))
        writeAtomic(path.join(dir,stamp+".md"),content)   // 半截快照会被历史面板当成可还原版本
        const files = historyStamps(dir)
        while(files.length > HISTORY_LIMIT){
            try{ fs.unlinkSync(path.join(dir,files.shift())) }catch{}
        }
    }catch{}
}
function historyFile(entry,stamp){
    if(!HISTORY_STAMP.test(String(stamp))) throw new Error("invalid history stamp")
    return path.join(getHistoryDir(entry),String(stamp)+".md")
}
function getNoteHistory(t){
    const entry = getNoteEntry(t)
    const dir = getHistoryDir(entry)
    const items = historyStamps(dir).reverse().map(name=>{
        let size = 0
        try{ size = fs.statSync(path.join(dir,name)).size }catch{}
        return { stamp:name.slice(0,-3), time:Number(name.slice(0,13)) || 0, size:size }
    })
    return { items:items, limit:HISTORY_LIMIT }
}
function readNoteHistory(data){
    if(!data || data.tid == null) throw new Error("invalid history payload")
    const entry = getNoteEntry(data.tid)
    const file = historyFile(entry,data.stamp)
    if(!fs.existsSync(file)) throw new Error("history is not found")
    return fs.readFileSync(file,{ encoding:'utf-8' })
}
function restoreNoteHistory(data){
    if(!data || data.tid == null) throw new Error("invalid history payload")
    const entry = getNoteEntry(data.tid)
    const file = historyFile(entry,data.stamp)
    if(!fs.existsSync(file)) throw new Error("history is not found")
    const snapshot = fs.readFileSync(file,{ encoding:'utf-8' })
    const target = getNoteFile(entry)
    const current = fs.readFileSync(target,{ encoding:'utf-8' })
    if(current === snapshot) return "success"
    pushHistory(entry,current)
    writeAtomic(target,snapshot)
    return "success"
}
function saveNote(data){
    if(!data || typeof data.content !== "string") throw new Error("invalid note content")
    const entry = getNoteEntry(data.tid)
    const file = getNoteFile(entry)
    let previous = null
    try{
        previous = fs.readFileSync(file,{ encoding:'utf-8' })
    }catch(error){
        // 读不出来就不留历史直接覆盖是危险的，先报出去
        if(!error || error.code !== "ENOENT") throw error
    }
    if(previous != null && previous !== data.content) pushHistory(entry,previous)
    writeAtomic(file,data.content)
    garbageCollectAssets(entry,data.content)
    return "success"
}
function notifyWatchers(payload){
    watchCallbacks.forEach(callback=>{
        try{ callback(payload) }catch{}
    })
}
function syncWatchers(){
    if(watchCallbacks.size === 0) return
    ensureListWatcher()
    const current = new Map()
    note_list.notes.forEach(note=>{
        let file
        try{
            file = getNoteFile(note)
        }catch{
            return
        }
        current.set(file,note)
        syncNoteWatcher(file,note)
    })
    pruneWatchers(current)
}
function ensureListWatcher(){
    if(listWatched) return
    fs.watchFile(listPath,{persistent:true,interval:200},()=>{
        clearTimeout(listTimer)
        listTimer = setTimeout(()=>{
            try{
                note_list = readNoteList()
                syncWatchers()
                notifyWatchers({list:true})
            }catch{}
        },100)
    })
    listWatched = true
}
function syncNoteWatcher(file,note){
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
                notifyWatchers({tid:note.time,content})
            }catch{}
        },100))
    })
    watchedFiles.set(file,note.time)
}
function pruneWatchers(current){
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
    watchCallbacks.add(callback)
    syncWatchers()
}
module.exports = {
    note_init:note_init,
    getNotes:getNotes,
    readNote:readNote,
    getNoteContentPath:getNoteContentPath,
    getNoteEntry:getNoteEntry,
    getNoteContentPathByEntry:getNoteContentPathByEntry,
    saveNote:saveNote,
    saveNoteImage:saveNoteImage,
    getNoteHistory:getNoteHistory,
    readNoteHistory:readNoteHistory,
    restoreNoteHistory:restoreNoteHistory,
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