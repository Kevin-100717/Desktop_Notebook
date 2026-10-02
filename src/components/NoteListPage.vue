<template>
    <div id="note-list-page">
        <div id="note-panel">
            <div id="control-panel">
                <div class="main-btn" @click="createNoteDialog">
                    <i class="icon-plus main-btn-icon"></i>
                    <p>新建笔记</p>
                </div>
                <div class="main-btn" @click="createStickyDialog">
                    <i class="icon-plus main-btn-icon"></i>
                    <p>新建便签</p>
                </div>
                <el-input
                    v-if="viewMode === 'list'"
                    v-model="searchKeyword"
                    class="search-input"
                    placeholder="搜标题或正文"
                    clearable
                    :maxlength="60"
                    @input="onSearchInput"
                    @clear="clearSearch"
                ></el-input>
                <div class="import-row">
                    <button class="mini-btn" :disabled="importing" @click="importNotes('files')">导入</button>
                    <button class="mini-btn" :disabled="importing" @click="importNotes('folder')">导入文件夹</button>
                </div>
            </div>
            <div id="note-list">
                <div class="list-mode-toggle">
                    <button
                        class="list-mode-btn"
                        :class="{ active: viewMode === 'list' }"
                        :title="viewMode === 'list' ? '正在看列表' : '换成按日期排的列表'"
                        @click="switchView('list')"
                    >列表</button>
                    <button
                        class="list-mode-btn"
                        :class="{ active: viewMode === 'calendar' }"
                        :title="viewMode === 'calendar' ? '正在看日历' : '换成日历，看看哪天写得勤'"
                        @click="switchView('calendar')"
                    >日历</button>
                </div>
                <template v-if="isSearching">
                    <h2>搜索结果 <span class="result-count">{{ searchRows.length }}</span></h2><br>
                    <div class="tag-filter">
                        <button
                            class="tag-filter-item"
                            :class="{ active: searchKind === 'all' }"
                            @click="searchKind = 'all'"
                        >全部</button>
                        <button
                            class="tag-filter-item"
                            :class="{ active: searchKind === 'note' }"
                            @click="searchKind = 'note'"
                        >笔记</button>
                        <button
                            class="tag-filter-item"
                            :class="{ active: searchKind === 'sticky' }"
                            @click="searchKind = 'sticky'"
                        >便签</button>
                    </div>
                    <div v-if="searchLoading" class="search-hint">正在找…</div>
                    <div v-else-if="searchRows.length === 0" class="note-empty">
                        <p class="note-empty-title">没找到「{{ searchKeyword.trim() }}」</p>
                        <p class="note-empty-desc">换个词试试，标题和正文都会一起找</p>
                    </div>
                    <div
                        v-for="row in searchRows"
                        :key="row.kind + '-' + row.time"
                        class="note-box"
                        :class="{ 'note-box-sticky': row.kind === 'sticky' }"
                        @click="onResultClicked(row)"
                    >
                        <p class="note-title">
                            <template v-for="(part,index) in highlightParts(row.title, searchKeyword)" :key="'t'+index">
                                <mark v-if="part.hit" class="hit">{{ part.text }}</mark>
                                <template v-else>{{ part.text }}</template>
                            </template>
                        </p>
                        <span class="note-time">{{ formatTime(row.time) }}</span>
                        <span v-if="row.kind === 'sticky'" class="note-kind">便签</span>
                        <span v-else class="note-kind note-kind-plain">{{ fieldLabel(row.field) }}</span>
                        <p v-if="row.field === 'content'" class="note-snippet">
                            <span v-if="row.snippet.prefix" class="snippet-edge">…</span>
                            <template v-for="(part,index) in highlightParts(row.snippet.text, searchKeyword)" :key="'s'+index">
                                <mark v-if="part.hit" class="hit">{{ part.text }}</mark>
                                <template v-else>{{ part.text }}</template>
                            </template>
                            <span v-if="row.snippet.suffix" class="snippet-edge">…</span>
                        </p>
                    </div>
                </template>
                <template v-else-if="viewMode === 'list'">
                <h2>所有笔记</h2><br>
                <div class="tag-filter" v-if="tagOptions.length > 0">
                    <button
                        class="tag-filter-item"
                        :class="{ active: activeTag === '' }"
                        @click="activeTag = ''"
                    >全部 {{ noteCount }}</button>
                    <button
                        v-for="tag in tagOptions"
                        :key="tag"
                        class="tag-filter-item"
                        :class="{ active: activeTag === tag }"
                        @click="activeTag = activeTag === tag ? '' : tag"
                    >
                        <i v-if="colorOf(tag)" class="tag-dot" :style="{ background: colorOf(tag) }"></i>
                        {{ tag }} {{ tagCount(tag) }}
                    </button>
                </div>
                <div v-if="notesData.length === 0" class="note-empty">
                    <div class="note-empty-icon">
                        <i class="icon-plus note-empty-img"></i>
                    </div>
                    <p class="note-empty-title">还没有笔记</p>
                    <p class="note-empty-desc">点一下「新建笔记」，从第一篇开始</p>
                    <button class="note-empty-btn" @click="createNoteDialog">写第一篇</button>
                </div>
                <div v-else-if="filteredNotesData.length === 0" class="note-empty">
                    <p class="note-empty-title">「{{ activeTag }}」下还没有笔记</p>
                    <p class="note-empty-desc">换个标签，或者看看全部</p>
                    <button class="note-empty-btn" @click="activeTag = ''">看全部</button>
                </div>
                <template v-else>
                <div v-for="dateBlock in filteredNotesData" :key="dateBlock.dat">
                    <h4>{{ dateBlock.dat }}</h4>
                    <div class="divider-line"></div>
                    <div
                        class="note-box"
                        :class="{ 'note-box-sticky': item.kind === 'sticky' }"
                        v-for="item in dateBlock.notes"
                        :key="item.kind + '-' + item.time"
                        @click="onItemClicked(item)"
                    >
                        <p class="note-title">{{ item.det.title }}</p>
                        <span class="note-time">{{ item.det.createAt }}</span>
                        <span v-if="item.kind === 'sticky'" class="note-kind">便签</span>
                        <el-dropdown
                            trigger="click"
                            popper-class="card-dropdown"
                            @click.stop
                            @command="onCardCommand($event,item)"
                        >
                            <button class="more-btn" title="更多操作" @click.stop>⋯</button>
                            <template #dropdown>
                                <el-dropdown-menu>
                                    <el-dropdown-item v-if="item.kind === 'note'" command="rename">重命名</el-dropdown-item>
                                    <el-dropdown-item command="export">导出为文件</el-dropdown-item>
                                    <el-dropdown-item command="delete" divided class="menu-danger">删除</el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown>
                        <div class="note-tags" v-if="noteTags(item).length > 0">
                            <span class="note-tag" v-for="tag in noteTags(item)" :key="tag">{{ tag }}</span>
                        </div>
                    </div>
                </div>
                </template>
                </template>
                <template v-else>
                <div class="cal-wrap">
                    <div class="cal-head">
                        <h2 class="cal-title">我的日历</h2>
                        <span class="cal-legend">
                            <span class="cal-legend-text">少</span>
                            <span v-for="level in 5" :key="level" class="cal-swatch" :class="'lv-' + (level - 1)"></span>
                            <span class="cal-legend-text">多</span>
                        </span>
                    </div>
                    <div class="cal-scroll" ref="calScroll">
                        <div class="cal-grid">
                            <div class="cal-month-row">
                                <span class="cal-weekday cal-weekday-head">
                                    <span class="cal-month-label">{{ calendarMonthRow.length ? "Months" : "" }}</span>
                                </span>
                                <div class="cal-month-track" :style="{ width: calTrackWidth() }">
                                    <span
                                        v-for="cell in calendarMonthRow"
                                        :key="cell.key"
                                        class="cal-month-cell"
                                        :style="{ left: calMonthOffset(cell.index) }"
                                    >{{ cell.label }}</span>
                                </div>
                            </div>
                            <div class="cal-row" v-for="row in calendarRows" :key="'row-' + row.weekday">
                                <span class="cal-weekday cal-weekday-sticky">{{ calendarWeekdayName(row.weekday) }}</span>
                                <button
                                    v-for="cell in row.cells"
                                    :key="cell.date"
                                    class="cal-cell"
                                    :class="calCellClass(cell)"
                                    :data-today="cell.date === todayIso ? '1' : null"
                                    :disabled="!cell.selectable"
                                    :title="calCellTitle(cell)"
                                    @click="selectDate(cell)"
                                ></button>
                            </div>
                        </div>
                    </div>
                    <div class="cal-day-section" v-if="selectedDate">
                        <div class="cal-day-head">
                            <h4 class="cal-day-title">{{ selectedDate }}</h4>
                            <span class="cal-day-count">{{ calendarDayItems.length }} 篇</span>
                            <button class="cal-day-clear" title="取消选中" @click="selectedDate = ''">取消</button>
                        </div>
                        <div v-if="calendarDayItems.length === 0" class="note-empty">
                            <p class="note-empty-title">这天没有记录</p>
                            <p class="note-empty-desc">点上面颜色深一点的日子，就能看到当天写了什么</p>
                        </div>
                        <div v-else class="cal-day-list">
                            <div
                                class="note-box"
                                :class="{ 'note-box-sticky': item.kind === 'sticky' }"
                                v-for="item in calendarDayItems"
                                :key="item.kind + '-' + item.time"
                                @click="onItemClicked(item)"
                            >
                                <p class="note-title">{{ item.det.title }}</p>
                                <span class="note-time">{{ item.det.createAt }}</span>
                                <span v-if="item.kind === 'sticky'" class="note-kind">便签</span>
                            </div>
                        </div>
                    </div>
                </div>
                </template>
            </div>
        </div>
        <el-dialog
            v-model="dialogVisible"
            title="新建笔记"
            width="min(420px, 90vw)"
            @closed="resetCreateDialog"
        >
            <span>给这篇起个名字</span>
            <br><br>
            <el-input
                v-model="newNoteTitle"
                placeholder="请输入笔记标题"
                @input="createError = ''"
                @keyup.enter="submitCreateNote"
            ></el-input>
            <p v-if="createError" class="dialog-error">{{ createError }}</p>
            <template #footer>
            <div class="dialog-footer">
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="creating" @click="submitCreateNote">
                创建
                </el-button>
            </div>
            </template>
        </el-dialog>
        <el-dialog
            v-model="stickyDialogVisible"            title="新建便签"
            width="min(420px, 90vw)"
            @closed="resetStickyDialog"
        >
            <span>给这张起个名字</span>
            <br><br>
            <el-input
                v-model="newStickyTitle"
                placeholder="请输入便签标题"
                @input="stickyError = ''"
                @keyup.enter="submitCreateSticky"
            ></el-input>
            <p v-if="stickyError" class="dialog-error">{{ stickyError }}</p>
            <template #footer>
            <div class="dialog-footer">
                <el-button @click="stickyDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="creatingSticky" @click="submitCreateSticky">
                创建
                </el-button>
            </div>
            </template>
        </el-dialog>
        <el-dialog
            v-model="renameDialogVisible"
            title="重命名笔记"
            width="min(420px, 90vw)"
            @closed="resetRenameDialog"
        >
            <span>改成什么名字</span>
            <br><br>
            <el-input
                v-model="renameTitle"
                placeholder="请输入笔记标题"
                @input="renameError = ''"
                @keyup.enter="submitRename"
            ></el-input>
            <p v-if="renameError" class="dialog-error">{{ renameError }}</p>
            <template #footer>
            <div class="dialog-footer">
                <el-button @click="renameDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="renaming" @click="submitRename">
                保存
                </el-button>
            </div>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { ElButton, ElDialog, ElDropdown, ElDropdownItem, ElDropdownMenu, ElInput, ElMessage, ElMessageBox } from "element-plus"
import emitter from "../utils/emitter"
import NoteEditPage from "./NoteEditPage.vue"

const CAL_CELL = 14
const CAL_COL_GAP = 4
const CAL_COL_STEP = CAL_CELL + CAL_COL_GAP
const CAL_WEEKDAY_W = 46
const CAL_WEEKDAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
function fmtDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default {
    components:{ ElButton, ElDialog, ElDropdown, ElDropdownItem, ElDropdownMenu, ElInput },
    data() {
        return {
            notesData: [],
            allTags: [],
            activeTag: "",
            unsubscribe: null,
            listRequestId: 0,
            dialogVisible:false,
            newNoteTitle:"",
            createError:"",
            creating:false,
            stickyDialogVisible:false,
            newStickyTitle:"",
            stickyError:"",
            creatingSticky:false,
            renameDialogVisible:false,
            renameTarget:null,
            renameTitle:"",
            renameError:"",
            renaming:false,
            deletingNoteTime:null,
            searchKeyword:"",
            searchResults:[],
            searchKind:"all",
            searchLoading:false,
            searchTimer:null,
            searchId:0,
            viewMode:"list",
            selectedDate:"",
            importing:false,
            pinnedTags:[],
            tagColors:{}
        }
    },
    computed:{
        noteCount(){
            return this.notesData.reduce((total,block)=>total + block.notes.length,0)
        },
        isSearching(){
            return this.searchKeyword.trim().length > 0
        },
        searchRows(){
            if(!this.isSearching) return []
            return this.searchResults
                .filter(row=>this.searchKind === "all" || row.kind === this.searchKind)
                .map(row=>Object.assign({},row,{ item:this.findItem(row.kind,row.time) }))
        },
        tagOptions(){
            const pinned = this.pinnedTags.map(item=>String(item).toLowerCase())
            return [...this.allTags].sort((a,b)=>{
                const pa = pinned.includes(a.toLowerCase()) ? 0 : 1
                const pb = pinned.includes(b.toLowerCase()) ? 0 : 1
                if(pa !== pb) return pa - pb
                return 0
            })
        },
        filteredNotesData(){
            if(this.activeTag === "") return this.notesData
            const key = this.activeTag.toLowerCase()
            return this.notesData
                .map(block=>({dat:block.dat,notes:block.notes.filter(note=>note.kind === 'note' && this.noteTags(note).some(tag=>tag.toLowerCase() === key))}))
                .filter(block=>block.notes.length > 0)
        },
        dayCounts(){
            const counts = {}
            for(const block of this.notesData){
                counts[block.dat] = (block.notes || []).length
            }
            return counts
        },
        calendarData(){
            const counts = this.dayCounts
            const today = new Date()
            today.setHours(0,0,0,0)
            const rangeStart = new Date(today.getTime() - 181 * 86400000)
            const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
            const weeks = []
            let cursor = new Date(rangeStart)
            cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7))
            while(cursor.getTime() <= today.getTime()){
                const week = []
                for(let wd = 0; wd < 7; wd++){
                    const iso = fmtDate(cursor)
                    const inRange = cursor.getTime() >= rangeStart.getTime() && cursor.getTime() <= today.getTime()
                    week.push({
                        date:iso,
                        inRange:inRange,
                        future:cursor.getTime() > today.getTime(),
                        selectable:inRange && cursor.getTime() <= today.getTime(),
                        count:counts[iso] || 0
                    })
                    cursor.setDate(cursor.getDate() + 1)
                }
                weeks.push(week)
            }
            const monthRow = []
            let lastMonth = ""
            weeks.forEach((week,index)=>{
                const month = week[0].date.slice(0,7)
                const label = month === lastMonth ? "" : monthNames[Number(month.slice(5,7)) - 1]
                lastMonth = month
                monthRow.push({ key:week[0].date, label:label, index:index })
            })
            const rows = []
            for(let i = 0; i < 7; i++){
                rows.push({ weekday:i, cells:weeks.map(week=>week[i]) })
            }
            return { monthRow, rows }
        },
        todayIso(){
            return fmtDate(new Date())
        },
        calendarMonthRow(){
            return this.calendarData.monthRow
        },
        calendarRows(){
            return this.calendarData.rows
        },
        calendarDayItems(){
            if(!this.selectedDate) return []
            const block = this.notesData.find(item=>item.dat === this.selectedDate)
            return block ? block.notes : []
        }
    },
    methods: {
        colorOf(tag){
            const colors = this.tagColors || {}
            if(colors[tag]) return colors[tag]
            const key = String(tag || "").toLowerCase()
            const found = Object.keys(colors).find(item=>item.toLowerCase() === key)
            return found ? colors[found] : ""
        },
        async loadTagMeta(){
            try{
                const colors = await window.electron.getSetting("tagColors")
                this.tagColors = colors && typeof colors === "object" && !Array.isArray(colors) ? colors : {}
            }catch{
                this.tagColors = {}
            }
            try{
                const pinned = await window.electron.getSetting("pinnedTags")
                this.pinnedTags = Array.isArray(pinned) ? pinned : []
            }catch{
                this.pinnedTags = []
            }
        },
        noteTags(note){
            if(!Array.isArray(note?.tags)) return []
            return note.tags.filter(item=>typeof item === "string" && item.trim().length > 0)
        },
        findItem(kind,time){
            const target = String(time)
            for(const block of this.notesData){
                const found = block.notes.find(item=>item.kind === kind && String(item.time) === target)
                if(found) return found
            }
            return null
        },
        formatTime(time){
            const date = new Date(Number(time))
            if(Number.isNaN(date.getTime())) return ""
            return date.toLocaleString()
        },
        highlightParts(text,keyword){
            const source = String(text == null ? "" : text)
            const terms = String(keyword == null ? "" : keyword).trim().toLowerCase().split(/\s+/).filter(Boolean)
            if(terms.length === 0) return [{ text:source, hit:false }]
            const lowerSource = source.toLowerCase()
            const ranges = []
            for(const term of terms){
                let cursor = 0
                let index = lowerSource.indexOf(term,cursor)
                while(index !== -1){
                    ranges.push([index,index + term.length])
                    cursor = index + term.length
                    index = lowerSource.indexOf(term,cursor)
                }
            }
            ranges.sort((a,b)=>a[0] - b[0])
            const merged = []
            for(const range of ranges){
                const last = merged[merged.length - 1]
                if(last && range[0] <= last[1]) last[1] = Math.max(last[1],range[1])
                else merged.push([range[0],range[1]])
            }
            const parts = []
            let cursor = 0
            for(const range of merged){
                if(range[0] > cursor) parts.push({ text:source.slice(cursor,range[0]), hit:false })
                parts.push({ text:source.slice(range[0],range[1]), hit:true })
                cursor = range[1]
            }
            if(cursor < source.length) parts.push({ text:source.slice(cursor), hit:false })
            if(parts.length === 0) parts.push({ text:source, hit:false })
            return parts
        },
        onSearchInput(){
            if(this.searchTimer) clearTimeout(this.searchTimer)
            const keyword = this.searchKeyword.trim()
            if(keyword.length === 0){
                this.clearSearch()
                return
            }
            this.searchLoading = true
            this.searchTimer = setTimeout(()=>this.runSearch(keyword),220)
        },
        async runSearch(keyword){
            const request = ++this.searchId
            if(this.searchTimer) clearTimeout(this.searchTimer)
            this.searchTimer = null
            try{
                const result = await window.electron.searchContent(keyword)
                if(request !== this.searchId) return
                this.searchResults = Array.isArray(result?.results) ? result.results : []
            }catch{
                if(request === this.searchId) this.searchResults = []
            }finally{
                if(request === this.searchId) this.searchLoading = false
            }
        },
        clearSearch(){
            if(this.searchTimer) clearTimeout(this.searchTimer)
            this.searchTimer = null
            this.searchId++
            this.searchKeyword = ""
            this.searchResults = []
            this.searchKind = "all"
            this.searchLoading = false
        },
        switchView(mode){
            if(mode !== "list" && mode !== "calendar") return
            if(this.viewMode === mode) return
            this.viewMode = mode
            if(mode === "calendar"){
                this.clearSearch()
                this.selectedDate = ""
                this.$nextTick(()=>this.scrollToToday())
            }
        },
        selectDate(cell){
            if(!cell || !cell.selectable) return
            this.selectedDate = this.selectedDate === cell.date ? "" : cell.date
        },
        calCellLevel(cell){
            if(!cell.inRange || cell.future || cell.count === 0) return 0
            if(cell.count <= 1) return 1
            if(cell.count <= 3) return 2
            if(cell.count <= 6) return 3
            return 4
        },
        calCellClass(cell){
            return "lv-" + this.calCellLevel(cell)
        },
        calCellTitle(cell){
            if(!cell.inRange || cell.future) return cell.date
            return cell.date + (cell.count > 0 ? " · " + cell.count + " notes" : "")
        },
        calendarWeekdayName(wd){
            return CAL_WEEKDAY_NAMES[wd] || ""
        },
        calTrackWidth(){
            return this.calendarMonthRow.length * CAL_COL_STEP + "px"
        },
        calMonthOffset(index){
            return index * CAL_COL_STEP + "px"
        },
        scrollToToday(){
            const wrap = this.$refs.calScroll
            if(!wrap) return
            const todayEl = wrap.querySelector('[data-today]')
            if(!todayEl) return
            const target = todayEl.offsetLeft + todayEl.offsetWidth - wrap.clientWidth
            wrap.scrollLeft = Math.max(0, target)
        },
        async onResultClicked(row){
            if(row.kind === 'sticky'){
                window.electron.openSticky(row.time).catch(()=>ElMessage.error("这张便签没能打开"))
                return
            }
            if(row.item){
                this.onNoteClicked(row.item)
                this.jumpToRow(row)
                return
            }
            await this.getNoteList()
            const found = this.findItem('note',row.time)
            if(found){
                this.onNoteClicked(found)
                this.jumpToRow(row)
            }else ElMessage.error("这篇已经不在了")
        },
        jumpToRow(row){
            const term = String(row.jumpTerm || '').trim()
            if(term === '') return
            // 点开的笔记是新挂进来的，监听要等它渲染完才在，早一步发就丢了
            this.$nextTick(()=>emitter.emit('note-jump',{ tid:row.time, term:term }))
        },
        fieldLabel(field){
            if(field === 'title') return "标题里有"
            if(field === 'tag') return "标签里有"
            return "正文里有"
        },
        async importNotes(mode){
            if(this.importing) return
            this.importing = true
            try{
                const result = await window.electron.importNotes(mode)
                if(result?.canceled) return
                const created = Array.isArray(result?.created) ? result.created.length : 0
                const failed = Array.isArray(result?.failed) ? result.failed.length : 0
                await this.getNoteList()
                if(created > 0) ElMessage.success("已导入 " + created + " 篇笔记")
                if(failed > 0) ElMessage.warning(failed + " 个文件没能导入")
                if(created === 0 && failed === 0) ElMessage.info("没找到可以导入的内容")
            }catch(error){
                ElMessage.error(typeof error === "string" ? error : "没导进去，再试一次")
            }finally{
                this.importing = false
            }
        },
        async exportItem(item){
            try{
                const result = await window.electron.exportContent(item.kind,item.time)
                if(result?.canceled) return
                ElMessage.success("已导出到 " + result.filePath)
            }catch{
                ElMessage.error("没导出成功，再试一次")
            }
        },
        tagCount(tag){
            const key = tag.toLowerCase()
            return this.notesData.reduce((total,block)=>total + block.notes.filter(note=>note.kind === 'note' && this.noteTags(note).some(item=>item.toLowerCase() === key)).length,0)
        },
        async getNoteList() {
            const request = ++this.listRequestId
            try {
                const notesList = await window.electron.getNoteList()
                let stickyList = null
                try {
                    stickyList = await window.electron.getStickyList()
                } catch {
                    stickyList = null
                }
                if(request !== this.listRequestId) return false
                this.applyNoteList(notesList, stickyList)
                return true
            } catch {
                if(request !== this.listRequestId) return false
                this.notesData = []
                this.allTags = []
                this.activeTag = ""
                emitter.emit('notes-list-updated', this.notesData)
                return true
            }
        },
        applyNoteList(notesList, stickyList){
            this.notesData = [...this.groupNotes(notesList, stickyList).entries()]
                .sort((a,b) => b[0].localeCompare(a[0]))
                .map(([dat,notes]) => ({dat,notes}))
            const tags = Array.isArray(notesList.tags)
                ? notesList.tags.filter(item=>typeof item === "string" && item.trim().length > 0)
                : []
            this.allTags = tags
            if(this.activeTag !== "" && !tags.some(item=>item.toLowerCase() === this.activeTag.toLowerCase())){
                this.activeTag = ""
            }
            emitter.emit('notes-list-updated', this.notesData)
        },
        groupNotes(notesList, stickyList){
            const notes = [
                ...notesList.notes.map(item => ({...item,kind:'note'})),
                ...(Array.isArray(stickyList?.sticky) ? stickyList.sticky : []).map(item => ({...item,kind:'sticky'}))
            ]
                .filter(item => item?.det && item.time != null)
                .sort((a,b) => Number(b.time) - Number(a.time))
            const groups = new Map()
            notes.forEach(item => {
                const date = fmtDate(new Date(item.time))
                if(!groups.has(date)) groups.set(date, [])
                groups.get(date).push(item)
            })
            return groups
        },
        onNoteClicked(note) {
            emitter.emit('add-tab', {
                title: note.det.title,
                component: NoteEditPage,
                props: { noteData: note },
                closable: true
            })
        },
        onItemClicked(item) {
            if(item.kind === 'sticky'){
                window.electron.openSticky(item.time).catch(()=>{
                    ElMessage.error("这张便签没能打开")
                })
                return
            }
            this.onNoteClicked(item)
        },
        createNoteDialog(){
            this.newNoteTitle = ""
            this.createError = ""
            this.dialogVisible = true
        },
        resetCreateDialog(){
            this.newNoteTitle = ""
            this.createError = ""
        },
        async submitCreateNote(){
            if(this.creating) return
            const title = typeof this.newNoteTitle === "string" ? this.newNoteTitle.trim() : ""
            if(!title){
                this.createError = "名字不能空着"
                return
            }
            this.creating = true
            try{
                const note = await window.electron.createNote(title)
                this.dialogVisible = false
                this.resetCreateDialog()
                await this.getNoteList()
                if(note?.det) this.onNoteClicked(note)
            }catch{
                this.createError = "没建成，再点一次试试"
            }finally{
                this.creating = false
            }
        },
        async confirmDeleteItem(item){
            if(this.deletingNoteTime != null) return
            const isSticky = item.kind === 'sticky'
            this.deletingNoteTime = item.time
            try{
                await ElMessageBox.confirm(
                    `确定删除“${item.det.title}”吗？删除后会移入回收站，可以随时还原。`,
                    isSticky ? "删除便签" : "删除笔记",
                    {
                        type:"warning",
                        confirmButtonText:"移入回收站",
                        cancelButtonText:"取消",
                        confirmButtonClass:"el-button--danger"
                    }
                )
            }catch{
                this.deletingNoteTime = null
                return
            }
            await this.doDeleteItem(item, isSticky)
        },
        async doDeleteItem(item, isSticky){
            try{
                if(isSticky){
                    await window.electron.deleteSticky(item.time)
                }else{
                    await window.electron.deleteNote(item.time)
                    emitter.emit("note-deleted", item.time)
                }
                await this.getNoteList()
                ElMessage.success(isSticky ? "已移到回收站" : "已移到回收站")
            }catch{
                ElMessage.error("删除失败，请重试")
            }finally{
                this.deletingNoteTime = null
            }
        },
        onCardCommand(command,item){
            if(command === 'rename'){
                this.startRename(item)
                return
            }
            if(command === 'export'){
                this.exportItem(item)
                return
            }
            if(command === 'delete') this.confirmDeleteItem(item)
        },
        startRename(item){
            this.renameTarget = item
            this.renameTitle = item.det.title
            this.renameError = ""
            this.renameDialogVisible = true
        },
        resetRenameDialog(){
            this.renameTarget = null
            this.renameTitle = ""
            this.renameError = ""
        },
        async submitRename(){
            if(this.renaming || !this.renameTarget) return
            const title = typeof this.renameTitle === "string" ? this.renameTitle.trim() : ""
            if(!title){
                this.renameError = "名字不能空着"
                return
            }
            this.renaming = true
            try{
                const result = await window.electron.renameNote(this.renameTarget.time, title)
                this.renameDialogVisible = false
                this.resetRenameDialog()
                await this.getNoteList()
                if(result?.time != null) emitter.emit("note-renamed",{tid:result.time,title:result.title})
                ElMessage.success("改好啦")
            }catch{
                this.renameError = "重命名失败，请重试"
            }finally{
                this.renaming = false
            }
        },
        createStickyDialog(){
            this.newStickyTitle = ""
            this.stickyError = ""
            this.stickyDialogVisible = true
        },
        resetStickyDialog(){
            this.newStickyTitle = ""
            this.stickyError = ""
        },
        async submitCreateSticky(){
            if(this.creatingSticky) return
            const title = typeof this.newStickyTitle === "string" ? this.newStickyTitle.trim() : ""
            if(!title){
                this.stickyError = "便签标题不能为空"
                return
            }
            this.creatingSticky = true
            try{
                const sticky = await window.electron.createSticky(title)
                this.stickyDialogVisible = false
                this.resetStickyDialog()
                await this.getNoteList()
                if(sticky?.time != null) window.electron.openSticky(sticky.time)
            }catch{
                this.stickyError = "没建成，再点一次试试"
            }finally{
                this.creatingSticky = false
            }
        }
    },
    mounted() {
        this.unsubscribe = window.electron.onNoteUpdated(note => {
            if(note.deleted) emitter.emit("note-deleted", note.tid)
            if(note.stickyDeleted) window.electron.closeSticky(note.tid)
            if(note.list || note.sticky) this.getNoteList()
        })
        this.onCreateNote = ()=>this.createNoteDialog()
        this.onCreateSticky = ()=>this.createStickyDialog()
        emitter.on('request-create-note', this.onCreateNote)
        emitter.on('request-create-sticky', this.onCreateSticky)
        this.offSetting = window.electron.onSettingUpdated(setting=>{
            if(!setting || typeof setting.key !== "string") return
            if(setting.key === "tagColors" || setting.key === "pinnedTags") this.loadTagMeta()
        })
        this.getNoteList()
        this.loadTagMeta()
    },
    activated() {
        this.getNoteList()
        this.loadTagMeta()
    },
    beforeUnmount() {
        if(this.unsubscribe) this.unsubscribe()
        if(this.offSetting) this.offSetting()
        if(this.searchTimer) clearTimeout(this.searchTimer)
        if(this.onCreateNote) emitter.off('request-create-note', this.onCreateNote)
        if(this.onCreateSticky) emitter.off('request-create-sticky', this.onCreateSticky)
    }
}
</script>

<style scoped>
#note-list-page{
    width: 100%;
    height: 100%;
    overflow: auto;
    color: var(--text-1);
}
#note-panel{
    width: min(650px, calc(100% - 32px));
    margin: clamp(24px, 6vh, 60px) auto;
    position: relative;
    display: grid;
    grid-template-columns: minmax(120px, 30%) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
}
.icon-plus{
    display: block;
    flex-shrink: 0;
    background-color: currentColor;
    -webkit-mask-image: var(--icon-plus);
    mask-image: var(--icon-plus);
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
}
.main-btn-icon{
    width: 21px;
    height: 21px;
    color: var(--text-1);
    transition: color 0.15s var(--ease);
}
#control-panel{
    width: auto;
    padding-right: 20px;
    border-right: 1px solid var(--border-1);
}
.main-btn{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-sizing: border-box;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    padding: 14px 10px;
    text-align: center;
    width: 80%;
    user-select: none;
    cursor: pointer;
    margin: 10px 0;
    background: var(--block-1);
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.main-btn p{
    margin: 0;
    font-size: 14px;
}
.main-btn:hover{
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.main-btn:hover .main-btn-icon{
    color: var(--accent-strong);
}
#note-list{
    position: static;
    width: auto;
    min-width: 0;
}
.search-input{
    margin: 14px 0 0;
}
:deep(.search-input .el-input__wrapper){
    padding: 1px 10px;
    background: var(--block-1);
    box-shadow: none;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    transition: border-color 0.15s var(--ease);
}
:deep(.search-input .el-input__wrapper:hover){
    border-color: var(--border-2);
}
:deep(.search-input .el-input__wrapper.is-focus){
    border-color: var(--accent-border);
}
:deep(.search-input .el-input__inner){
    font-size: 13px;
    color: var(--text-1);
}
.import-row{
    display: flex;
    gap: 8px;
    margin-top: 10px;
}
.mini-btn{
    flex: 1;
    height: 28px;
    padding: 0 6px;
    font-size: 12px;
    color: var(--text-2);
    background: transparent;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s var(--ease), border-color 0.15s var(--ease), background 0.15s var(--ease);
}
.mini-btn:hover:not(:disabled){
    color: var(--accent-strong);
    border-color: var(--accent-border);
    background: var(--accent-soft);
}
.mini-btn:disabled{
    opacity: 0.5;
    cursor: default;
}
.result-count{
    font-size: 14px;
    font-weight: 400;
    color: var(--text-2);
    font-family: var(--font-en);
}
.search-hint{
    padding: 14px 0;
    font-size: 13px;
    color: var(--text-2);
}
.note-snippet{
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-2);
    word-break: break-word;
}
.snippet-edge{
    color: var(--text-2);
}
.note-kind-plain{
    color: var(--text-2);
    background: var(--block-2);
}
.hit{
    padding: 0 1px;
    color: var(--on-accent);
    background: var(--highlight-1);
    border-radius: 3px;
}
#note-list h2{
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.3px;
}
.tag-filter{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 14px;
}
.tag-filter-item{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s var(--ease), color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.tag-filter-item:hover{
    color: var(--accent-strong);
    border-color: var(--accent-border);
    background: var(--accent-soft);
}
.tag-filter-item.active{
    color: var(--on-accent);
    background: var(--accent-strong);
    border-color: var(--accent-strong);
}
.tag-dot{
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
}
.note-tags{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    padding-right: 4px;
}
.note-tag{
    padding: 2px 9px;
    font-size: 12px;
    line-height: 18px;
    color: var(--accent-strong);
    background: var(--accent-soft);
    border: 1px solid var(--accent-border);
    border-radius: 999px;
    white-space: nowrap;
}
#note-list h4{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
    font-family: var(--font-en);
}
#note-list h4::before{
    content: "";
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent-strong);
}
.divider-line{
    height: 1px;
    width: 100%;
    margin: 8px 0 4px;
    background: linear-gradient(90deg, var(--border-2), transparent);
}
.note-box{
    box-sizing: border-box;
    position: relative;
    margin: 8px 0;
    padding: 12px 78px 12px 18px;
    width: 100%;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    background: var(--block-1);
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
    user-select: none;
    cursor: pointer;
}
.note-box::before{
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: var(--radius-1) 0 0 var(--radius-1);
    background: var(--accent-strong);
    opacity: 0;
    transition: opacity 0.15s var(--ease);
}
.note-box:hover{
    background: var(--block-2);
    border-color: var(--border-2);
}
.note-box:hover::before{
    opacity: 1;
}
.note-box-sticky{
    background: var(--sticky-soft);
    border-color: var(--sticky-border);
}
.note-box-sticky::before{
    background: var(--sticky-strong);
    opacity: 1;
}
.note-box-sticky:hover{
    background: var(--sticky-soft-hover);
    border-color: var(--sticky-border);
}
.note-kind{
    display: inline-block;
    margin-top: 8px;
    padding: 2px 9px;
    font-size: 12px;
    line-height: 18px;
    color: var(--on-accent);
    background: var(--sticky-strong);
    border-radius: 999px;
}
.note-title{
    font-size: 18px;
    font-weight: 500;
    margin: 0 0 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.note-time{
    display: block;
    font-size: 13px;
    color: var(--text-2);
    font-family: var(--font-en);
}
.note-box .el-dropdown{
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: block;
}
.more-btn{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 18px;
    line-height: 1;
    color: var(--text-2);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-1);
    cursor: pointer;
    opacity: 0.6;
    transition: background 0.15s var(--ease), color 0.15s var(--ease), border-color 0.15s var(--ease), opacity 0.15s var(--ease);
}
.note-box:hover .more-btn{
    opacity: 1;
}
.more-btn:hover{
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.dialog-error{
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--danger);
}
.note-empty{
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: clamp(24px, 8vh, 60px) 16px;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-2);
    background: var(--block-1);
}
.note-empty-icon{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 66px;
    height: 66px;
    margin-bottom: 18px;
    border-radius: var(--radius-1);
    background: var(--highlight-1);
}
.note-empty-img{
    width: 26px;
    height: 26px;
    color: var(--on-accent);
}
.note-empty-title{
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
}
.note-empty-desc{
    margin: 0 0 20px;
    max-width: 340px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-2);
}
.note-empty-btn{
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 500;
    color: var(--on-accent);
    background: var(--highlight-1);
    border: none;
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
.note-empty-btn:hover{
    background: var(--accent-strong);
}
.dialog-footer{
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
.list-mode-toggle{
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
}
.list-mode-btn{
    height: 28px;
    padding: 0 16px;
    font-size: 12px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s var(--ease), color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.list-mode-btn:hover{
    color: var(--accent-strong);
    border-color: var(--accent-border);
    background: var(--accent-soft);
}
.list-mode-btn.active{
    color: var(--on-accent);
    background: var(--accent-strong);
    border-color: var(--accent-strong);
}
.cal-wrap{
    --cal-weekday-w: 46px;
    --cal-cell: 14px;
    --cal-gap: 4px;
    min-width: 0;
}
.cal-head{
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}
.cal-title{
    font-size: 20px;
}
.cal-legend{
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
}
.cal-legend-text{
    font-size: 11px;
    color: var(--text-2);
}
.cal-swatch{
    width: 11px;
    height: 11px;
    border-radius: 2px;
}
.cal-swatch.lv-0{ background: var(--cal-0); }
.cal-swatch.lv-1{ background: var(--cal-1); }
.cal-swatch.lv-2{ background: var(--cal-2); }
.cal-swatch.lv-3{ background: var(--cal-3); }
.cal-swatch.lv-4{ background: var(--cal-4); }
.cal-scroll{
    overflow-x: auto;
    margin-bottom: 18px;
    padding-bottom: 6px;
}
.cal-grid{
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: max-content;
}
.cal-month-row{
    position: sticky;
    top: 0;
    z-index: 3;
    display: flex;
    gap: 4px;
    padding: 2px 0 4px;
    background: var(--bg-1);
}
.cal-weekday-head{
    width: var(--cal-weekday-w);
    flex-shrink: 0;
    font-size: 11px;
    text-align: left;
    color: var(--text-2);
}
.cal-month-label{
    display: block;
    font-size: 10px;
    line-height: 16px;
    color: var(--text-3, var(--text-2));
    opacity: 0.75;
}
.cal-month-track{
    position: relative;
    flex-shrink: 0;
    height: 16px;
}
.cal-month-cell{
    position: absolute;
    top: 0;
    white-space: nowrap;
    font-size: 11px;
    line-height: 16px;
    font-family: var(--font-en);
    color: var(--text-2);
    pointer-events: none;
}
.cal-month-cell:empty{
    display: none;
}
.cal-row{
    display: flex;
    align-items: center;
    gap: 4px;
}
.cal-weekday{
    position: sticky;
    left: 0;
    z-index: 2;
    width: var(--cal-weekday-w);
    flex-shrink: 0;
    font-size: 11px;
    font-family: var(--font-en);
    text-align: left;
    color: var(--text-2);
    background: var(--bg-1);
}
.cal-weekday-head{
    position: sticky;
    left: 0;
    z-index: 4;
    background: var(--bg-1);
}
.cal-cell{
    position: relative;
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 1px solid var(--border-1);
    border-radius: 3px;
    background: var(--cal-0);
    cursor: pointer;
    transition: transform 0.1s var(--ease), border-color 0.15s var(--ease);
}
.cal-cell.lv-1{ background: var(--cal-1); border-color: transparent; }
.cal-cell.lv-2{ background: var(--cal-2); border-color: transparent; }
.cal-cell.lv-3{ background: var(--cal-3); border-color: transparent; }
.cal-cell.lv-4{ background: var(--cal-4); border-color: transparent; }
.cal-cell:disabled{
    cursor: default;
    opacity: 0.45;
}
.cal-cell:not(:disabled):hover{
    transform: scale(1.4);
    border-color: var(--accent-border);
    z-index: 2;
}
.cal-day-section{
    margin-top: 8px;
    padding-top: 14px;
    border-top: 1px solid var(--border-1);
}
.cal-day-head{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}
.cal-day-title{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
    font-family: var(--font-en);
}
.cal-day-title::before{
    content: "";
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent-strong);
}
.cal-day-count{
    font-size: 12px;
    color: var(--text-2);
    font-family: var(--font-en);
}
.cal-day-clear{
    margin-left: auto;
    height: 26px;
    padding: 0 12px;
    font-size: 12px;
    color: var(--text-2);
    background: transparent;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.cal-day-clear:hover{
    color: var(--accent-strong);
    border-color: var(--accent-border);
}
.cal-day-list{
    display: flex;
    flex-direction: column;
}
@media (max-width: 560px){
    #note-panel{
        grid-template-columns: 1fr;
        margin: 24px auto;
    }
    #control-panel{
        display: flex;
        gap: 12px;
        width: 100%;
        padding: 0 0 16px;
        border-right: none;
        border-bottom: 1px solid var(--border-1);
    }
    .main-btn{
        flex: 1;
        width: auto;
        margin: 0;
    }
    #note-list{
        width: 100%;
    }
}
</style>
