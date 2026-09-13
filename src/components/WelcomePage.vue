<template>
    <p id="title">DESKTOP NOTEBOOK</p>
    <div id="user-profile">
        <img :src="avatar_url" id="avatar">
        <p id="userName">{{ userName }}</p>
        <div id="calendar" ref="calRef">
            <div id="month-labels" :style="{ gridTemplateColumns: `repeat(${weeks}, ${cellSize + 2}px)` }">
                <span v-for="(m, i) in monthLabels" :key="i" :style="{ gridColumn: m.col }">{{ m.name }}</span>
            </div>
            <div id="grid-wrapper">
                <div id="day-labels" :style="{ gap: '2px' }">
                    <span v-for="(d, i) in ['Mon','','Wed','','Fri','','']" :key="i" :style="{ height: cellSize + 'px', lineHeight: cellSize + 'px' }">{{ d }}</span>
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
</template>

<script>
import axios from 'axios';

const START_TS = 1789305603090;
const LEVELS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const WEEKS = 30;
const GAP = 2;
const DAY_LABEL_W = 20;

function randLevel() {
    const r = Math.random();
    if (r < 0.3) return 0;
    if (r < 0.55) return 1;
    if (r < 0.75) return 2;
    if (r < 0.9) return 3;
    return 4;
}

function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

var ghKey = null;
export default {
    data() {
        return {
            avatar_url: "",
            userName: "",
            cells: [],
            monthLabels: [],
            weeks: WEEKS,
            cellSize: 10
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
            this.cellSize = Math.min(15, Math.floor((avail - (WEEKS - 1) * GAP) / WEEKS));
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
                const level = inRange ? randLevel() : 0;
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
        }
    },
    async mounted() {
        ghKey = await window.electron.getUserInfo()
        this.getUserInfo()
        this.calcSize()
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
    top: 30px;
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
    gap: 2px;
}

.cell {
    border-radius: 2px;
}
</style>