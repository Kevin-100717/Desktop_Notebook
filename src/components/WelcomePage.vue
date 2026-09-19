<script setup>
import userIcon from "@/assets/User.svg"
import plusIcon from "@/assets/Plus.svg"
</script>
<template>
    <p id="title">DESKTOP NOTEBOOK</p>
    <div id="user-profile">
        <img :src="avatar_url?avatar_url:userIcon" id="avatar">
        <p id="userName">{{ userName }}</p>
        <div id="calendar" ref="calRef">
            <div id="month-labels" :style="{ gridTemplateColumns: `repeat(${weeks}, ${cellSize + 2}px)` }">
                <span v-for="(m, i) in monthLabels" :key="i" :style="{ gridColumn: m.col }">{{ m.name }}</span>
            </div>
            <div id="grid-wrapper">
                <div id="day-labels" :style="{ gap: '2px' }">
                    <span v-for="(d, i) in ['Mon','','Wed','','Fri','','Sun']" :key="i" :style="{ height: cellSize + 'px', lineHeight: cellSize + 'px' }">{{ d }}</span>
                </div>
                <div id="grid" :style="{ gridTemplateColumns: `repeat(${weeks}, ${cellSize}px)`, gridTemplateRows: `repeat(7, ${cellSize}px)` }">
                    <div
                        v-for="(cell, i) in cells"
                        :key="i"
                        class="cell"
                        :style="{ backgroundColor: cell.color, width: cellSize + 'px', height: cellSize + 'px' }"
                        :title="cell.date"
                    ></div>
                </div>
            </div>
        </div>
    </div>
    <div id="note-panel">
        <div id="control-panel">
            <div class="main-btn">
                <img :src="plusIcon" class="main-btn-icon"/>
                <p>新建笔记</p>
            </div>
            <div class="main-btn">
                <img :src="plusIcon" class="main-btn-icon"/>
                <p>新建便签</p>
            </div>
        </div>
        <div id="note-list">
            <h2>所有笔记</h2><br>
            <div v-for="date_block in notesData">
                <h4>{{ date_block.dat }}</h4>
                <div class="devide-line"></div>
                <div class="note-box" v-for="note in date_block.notes" @click="onNoteClicked(note)">
                    <p class="note-title">{{ note.det.title }}</p>
                    <span class="note-time">{{ note.det.createAt }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';
import emitter from "../utils/emitter";
import NoteEditPage from "../views/NoteEditPage.vue";

const START_TS = 1789305603090;
const LEVELS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const WEEKS = 15;
const GAP = 2;
const DAY_LABEL_W = 20;

// function randLevel() {
//     const r = Math.random();
//     if (r < 0.3) return 0;
//     if (r < 0.55) return 1;
//     if (r < 0.75) return 2;
//     if (r < 0.9) return 3;
//     return 4;
// }
function getLevel(n){
    if (n <= 3){
        return n
    }else{
        return 3
    }
}

function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

var ghKey = null;
export default {
    data() {
        return {
            avatar_url: "",
            userName: "本地用户",
            cells: [],
            monthLabels: [],
            weeks: WEEKS,
            cellSize: 10,
            notesData:[]
        }
    },
    methods: {
        getUserInfo() {
            axios.get("/user", {
                headers: {
                    "Authorization": "Bearer " + ghKey,
                    "Content-Type": "application/json"
                },
                baseURL: "https://api.github.com"
            }).then(res => {
                const result = res.data;
                this.avatar_url = result.avatar_url
                this.userName = result.login;
            })
        },
        calcSize() {
            const w = this.$refs.calRef?.offsetWidth || 520;
            const avail = w - DAY_LABEL_W;
            this.cellSize = Math.min(30, Math.floor((avail - (WEEKS - 1) * GAP) / WEEKS));
        },
        buildCalendar() {
            const start = new Date(START_TS);
            const startDay = start.getDay();
            const offset = startDay === 0 ? 6 : startDay - 1;
            const gridStart = new Date(start);
            gridStart.setDate(gridStart.getDate() - offset);

            const cells = [];
            const monthSet = new Map();
            const totalDays = WEEKS * 7;

            for (let i = 0; i < totalDays; i++) {
                const d = new Date(gridStart);
                d.setDate(d.getDate() + i);
                const ts = d.getTime();
                const inRange = ts >= START_TS;
                var info = this.notesData.filter(item=>item.dat == d.toLocaleDateString())[0]
                const level = inRange ? getLevel(info?info.notes.length:0) : 0;
                cells.push({
                    color: LEVELS[level],
                    date: fmtDate(d)
                });
                if (inRange) {
                    const key = `${d.getFullYear()}-${d.getMonth()}`;
                    if (!monthSet.has(key)) {
                        monthSet.set(key, { name: d.toLocaleString('en', { month: 'short' }), col: Math.floor(i / 7) + 1 });
                    }
                }
            }
            this.cells = cells;
            this.monthLabels = [...monthSet.values()];
        },
        async getNoteList(){
            this.notesData = []
            const notesList = await window.electron.getNoteList()
            console.log(notesList)
            notesList.notes.forEach(item=>{
                var time = new Date()
                time.setTime(item.time)
                var date = time.toLocaleDateString()
                if(this.notesData.filter(element=>element.dat == date).length > 0){
                    this.notesData[
                        this.notesData.indexOf(this.notesData.filter(element=>element.dat == date))
                    ].notes.push(item)
                }else{
                    this.notesData.push({
                        dat:date,
                        notes:[item]
                    })
                }
            })
            console.log(this.notesData)
        },
        onNoteClicked(note){
            console.log(note)
            emitter.emit('add-tab',{ title:note.det.title, component:NoteEditPage, props:{
                noteData:note
            }, closable:true })
        }
    },
    async mounted() {
        // ghKey = await window.electron.getUserInfo()
        // this.getUserInfo()
        this.calcSize()
        await this.getNoteList()
        this.buildCalendar()
    }
}
</script>

<style scoped>
#title {
    font-size: 30px;
    text-align: center;
    margin-top: 50px;
}

#user-profile {
    width: 700px;
    margin: 50px auto;
    position: relative;
}

#avatar {
    width: 150px;
    border-radius: 50%;
    border: 3px solid #646363;
}

#userName {
    width: 130px;
    padding: 10px;
    text-align: center;
}

#calendar {
    position: absolute;
    top: -20px;
    left: 190px;
    right: 0;
    font-size: 10px;
    color: #9ca3af;
}

#month-labels {
    display: grid;
    margin-left: 20px;
    margin-bottom: 4px;
    height: 14px;
}

#month-labels span {
    font-size: 10px;
}

#grid-wrapper {
    display: flex;
    gap: 4px;
}

#day-labels {
    display: flex;
    flex-direction: column;
    width: 16px;
    position: relative;
    left: -10px;
}

#day-labels span {
    font-size: 10px;
}

#grid {
    display: grid;
    grid-auto-flow: column;
    gap: 2px;
}

.cell {
    border-radius: 2px;
}

#note-panel{
    width: 700px;
    margin: 100px auto;
    position: relative;
}

.main-btn-icon{
    width: 20px;
}
#control-panel{
    width: 30%;
    border-right: 1px solid #646363;
}
.main-btn{
    border: 1px solid #646363;
    border-radius: 10px;
    padding: 10px;
    text-align: center;
    width: 80%;
    user-select: none;
    cursor: pointer;
    margin: 10px 0;
    transition:all 0.1s ease-in-out;
}
.main-btn p{
    display: inline;
    position: relative;
    top: -3px;
    padding: 10px;
}
.main-btn:hover{
    background-color: #fbff005a;
    border: 1px solid #fcd20086;
}
#note-list{
    position: absolute;
    top: 0px;
    left: 35%;
    width: 65%;
}
.devide-line{
    border-bottom: 1px solid #9ca3af;
    width: 100%;
    padding: 0 10px;
    margin: 5px 0;
}
.note-box{
    margin: 10px 0;
    padding: 10px;
    width: 100%;
    border: 1px solid #737475;
    border-radius: 10px;
    transition: all 0.1s ease-in-out;
    user-select: none;
    cursor: pointer;
}
.note-box:hover{
    background-color: #353535;
}
.note-title{
    font-size: 20px;
}
.note-time{
    font-size: 12px;
    float: right;
    position: relative;
    top: -20px;
    font-family: var(--font-en);
}
</style>