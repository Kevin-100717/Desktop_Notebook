<template>
    <div id="note-page">
        <div id="tab-bar">
            <div
                v-for="(tab, i) in tabs"
                :key="tab.id"
                class="tab-item"
                :class="{ active: activeTab === i }"
                @click="activeTab = i"
            >
                <span class="tab-title">{{ tab.title }}</span>
                <span v-if="tab.closable" class="tab-close" @click.stop="closeTab(i)">×</span>
            </div>
        </div>
        <div id="tab-content">
            <component
                :is="tabs[activeTab].component"
                v-bind="tabs[activeTab].props"
            />
        </div>
    </div>
</template>

<script>
import { markRaw } from 'vue';
import emitter from '../utils/emitter';
import WelcomePage from '../components/WelcomePage.vue';

let tabId = 0;

function createWelcomeTab() {
    return { id: tabId++, title: 'Welcome', component: markRaw(WelcomePage), props: {}, closable: false };
}

export default {
    data() {
        return {
            tabs: [createWelcomeTab()],
            activeTab: 0
        }
    },
    methods: {
        addTab({ title = 'New Tab', component = null, props = {}, closable = true } = {}) {
            this.tabs.push({
                id: tabId++,
                title,
                component,
                props,
                closable
            });
            this.activeTab = this.tabs.length - 1;
        },
        closeTab(i) {
            this.tabs.splice(i, 1);
            if (this.activeTab >= this.tabs.length) {
                this.activeTab = Math.max(0, this.tabs.length - 1);
            }
        }
    },
    mounted() {
        emitter.on('add-tab', this.addTab);
    },
    beforeUnmount() {
        emitter.off('add-tab', this.addTab);
    }
}
</script>

<style scoped>
#note-page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

#tab-bar {
    display: flex;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    background: #1a1b1e;
    border-bottom: 1px solid #494949;
}

.tab-item {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 0 12px;
    height: 36px;
    font-size: 13px;
    color: #9ca3af;
    cursor: pointer;
    border-right: 1px solid #494949;
    user-select: none;
    transition: background 0.15s, color 0.15s;
}

.tab-item:hover {
    background: #2e303a;
    color: #f3f4f6;
}

.tab-item.active {
    background: #16171d;
    color: #f3f4f6;
    border-bottom: 2px solid var(--highlight-1, #c084fc);
}

.tab-title {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    font-size: 15px;
    line-height: 1;
    color: #9ca3af;
    transition: background 0.15s, color 0.15s;
}

.tab-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #f3f4f6;
}

#tab-content {
    flex: 1;
    overflow: auto;
}

#tab-content::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

#tab-content::-webkit-scrollbar-track {
    background: #16171d;
}

#tab-content::-webkit-scrollbar-thumb {
    background: #3a3b3e;
    border-radius: 3px;
}

#tab-content::-webkit-scrollbar-thumb:hover {
    background: #4a4b4e;
}

#tab-content::-webkit-scrollbar-corner {
    background: #16171d;
}
</style>