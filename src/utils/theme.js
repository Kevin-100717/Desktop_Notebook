import emitter from './emitter'
import vditorDarkContent from 'vditor/dist/css/content-theme/dark.css?inline'
import vditorLightContent from 'vditor/dist/css/content-theme/light.css?inline'

export const THEME_LIGHT = 'light'
export const THEME_DARK = 'dark'

const CONTENT_THEME_STYLE_ID = 'vditor-content-theme'
const ACCENT_STYLE_ID = 'app-accent'
const CUSTOM_STYLE_ID = 'app-custom-css'
const COLOR_STYLE_ID = 'app-custom-colors'

export function normalizeAccent(value){
    const hex = typeof value === 'string' ? value.trim() : ''
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex.toLowerCase() : ''
}

// 主题色只改颜色深浅，不动别的观感，所以由一个颜色推出一组配套的变量。
function hexToRgb(hex){
    let full = hex.slice(1)
    if(full.length === 3) full = full.split('').map(ch=>ch + ch).join('')
    return [ parseInt(full.slice(0,2),16), parseInt(full.slice(2,4),16), parseInt(full.slice(4,6),16) ]
}
function rgbaOf(hex,alpha){
    const rgb = hexToRgb(hex)
    return 'rgba(' + rgb.join(',') + ',' + alpha + ')'
}
function mixWithWhite(hex,amount){
    const rgb = hexToRgb(hex)
    const mixed = rgb.map(value=>Math.round(value + (255 - value) * amount))
    return '#' + mixed.map(value=>value.toString(16).padStart(2,'0')).join('')
}
function mixWithBlack(hex,amount){
    const rgb = hexToRgb(hex)
    const mixed = rgb.map(value=>Math.round(value * (1 - amount)))
    return '#' + mixed.map(value=>value.toString(16).padStart(2,'0')).join('')
}
// amount 为正往白里混，为负往黑里混。
function mix(hex,amount){
    return amount >= 0 ? mixWithWhite(hex,amount) : mixWithBlack(hex,-amount)
}
export function applyAccent(value){
    const accent = normalizeAccent(value)
    const root = document.documentElement
    let style = document.getElementById(ACCENT_STYLE_ID)
    if(!style){
        style = document.createElement('style')
        style.id = ACCENT_STYLE_ID
        document.head.appendChild(style)
    }
    if(accent === ''){
        root.style.removeProperty('--accent-custom')
        style.textContent = ''
        return ''
    }
    root.style.setProperty('--accent-custom', accent)
    const dark = currentTheme() === THEME_DARK
    const strong = dark ? mixWithWhite(accent,0.24) : accent
    const soft = rgbaOf(accent, dark ? 0.22 : 0.14)
    const border = rgbaOf(accent, dark ? 0.42 : 0.34)
    const glow = rgbaOf(accent, 0.3)
    const hover = rgbaOf(accent, dark ? 0.32 : 0.2)
    style.textContent = ':root{--accent:' + accent + ';--accent-strong:' + strong +
        ';--accent-soft:' + soft + ';--accent-border:' + border +
        ';--accent-glow:' + glow + ';--accent-hover:' + hover + ';}'
    return accent
}

// 每个部位对应一组 CSS 变量，用户只挑颜色，剩下的搭配由这里算。
const PART_GROUPS = [
    { part:'page',    label:'页面底色', vars:['--bg-1','--surface-2','--scroll-track'] },
    { part:'panel',   label:'面板底色', vars:['--surface-1','--block-1'] },
    { part:'card',    label:'卡片底色', vars:['--block-2'] },
    { part:'text',    label:'正文文字', vars:['--text-1'] },
    { part:'textSoft',label:'次要文字', vars:['--text-2','--unhighlight'] },
    { part:'line',    label:'分隔线',   vars:['--border-1','--border-2'] },
    { part:'accent',  label:'主题色',   vars:['--accent'] },
    { part:'danger',  label:'危险提示', vars:['--danger'] },
    { part:'sticky',  label:'便签颜色', vars:['--sticky-strong'] }
]
export const COLOR_PARTS = PART_GROUPS.map(group=>group.part)

function isHex(value){
    return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export function normalizeCustomColors(value){
    const result = {}
    if(!value || typeof value !== 'object' || Array.isArray(value)) return result
    PART_GROUPS.forEach(group=>{
        if(isHex(value[group.part])) result[group.part] = value[group.part].trim().toLowerCase()
    })
    return result
}

// 从用户挑的几个颜色推出一整套变量，深浅底色下都能用。
let appliedColors = null            // 记住上次的自选配色，切明暗时按新底色重算一遍
export function applyCustomColors(value){
    const colors = normalizeCustomColors(value)
    appliedColors = colors
    let style = document.getElementById(COLOR_STYLE_ID)
    if(!style){
        style = document.createElement('style')
        style.id = COLOR_STYLE_ID
        document.head.appendChild(style)
    }
    const dark = currentTheme() === THEME_DARK
    const lines = []
    // 主题色要连带推出一整套（强/浅/边框/光晕），交给 applyAccent 处理。
    if(colors.accent != null) applyAccent(colors.accent)
    PART_GROUPS.forEach(group=>{
        const base = colors[group.part]
        if(base == null || group.part === 'accent') return
        group.vars.forEach(name=>{
            // 文字和分隔线按背景深浅微调，免得挑出来的颜色看不清
            if(name === '--text-1' || name === '--text-2' || name === '--unhighlight'){
                const deep = base.length === 4 ? mixWithBlack(base,0.3) : base
                lines.push(name + ':' + (deep))
                return
            }
            if(name === '--border-2'){
                lines.push(name + ':' + mix(base,dark ? 0.12 : -0.16))
                return
            }
            if(name === '--surface-2' || name === '--block-1'){
                lines.push(name + ':' + mix(base,dark ? 0.06 : -0.05))
                return
            }
            lines.push(name + ':' + base)
        })
    })
    if(colors.danger != null) lines.push('--danger-soft:' + rgbaOf(colors.danger,dark ? 0.2 : 0.13))
    if(colors.sticky != null){
        lines.push('--sticky-soft:' + rgbaOf(colors.sticky,dark ? 0.18 : 0.26))
        lines.push('--sticky-soft-hover:' + rgbaOf(colors.sticky,dark ? 0.26 : 0.36))
        lines.push('--sticky-border:' + rgbaOf(colors.sticky,dark ? 0.42 : 0.5))
    }
    style.textContent = lines.length === 0 ? '' : ':root{' + lines.join(';') + ';}'
    // 一个部位都没选时把这段变量清掉，让 index.html 里的默认值重新生效
    // （root 上的内联样式是主题色的 --accent-custom，不能整段抹掉）
    return style.textContent.length
}

// 自己写的样式单独放一个 style 标签，出错也只影响这一段。
export function applyCustomCss(value){
    const text = typeof value === 'string' ? value : ''
    let style = document.getElementById(CUSTOM_STYLE_ID)
    if(!style){
        style = document.createElement('style')
        style.id = CUSTOM_STYLE_ID
        document.head.appendChild(style)
    }
    style.textContent = text
    return text.length
}

export function clearCustomCss(){
    const style = document.getElementById(CUSTOM_STYLE_ID)
    if(style) style.textContent = ''
}

export function normalizeTheme(value){
    return value === THEME_LIGHT ? THEME_LIGHT : THEME_DARK
}

export function currentTheme(){
    return document.documentElement.getAttribute('data-theme') === THEME_LIGHT ? THEME_LIGHT : THEME_DARK
}

function applyContentTheme(theme){
    const css = theme === THEME_LIGHT ? vditorLightContent : vditorDarkContent
    let style = document.getElementById(CONTENT_THEME_STYLE_ID)
    if(!style){
        style = document.createElement('style')
        style.id = CONTENT_THEME_STYLE_ID
        document.head.appendChild(style)
    }
    if(style.textContent !== css) style.textContent = css
}

export function applyTheme(value){
    const theme = normalizeTheme(value)
    const dark = theme === THEME_DARK
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.classList.toggle('dark', dark)
    applyContentTheme(theme)
    // 主题色和自选配色都要跟着明暗重算，深色下要调亮一点才看得清
    if(appliedColors && Object.keys(appliedColors).length > 0) applyCustomColors(appliedColors)
    const accent = root.style.getPropertyValue('--accent-custom')
    applyAccent(accent.trim())
    emitter.emit('theme-changed', theme)
    return theme
}

export async function initTheme(){
    let accent = ''
    let css = ''
    let colors = ''
    try{
        accent = await window.electron.getSetting('accentColor')
    }catch{}
    try{
        css = await window.electron.getSetting('customCss')
    }catch{}
    try{
        colors = await window.electron.getSetting('customColors')
    }catch{}
    if(css) applyCustomCss(css)
    if(accent) applyAccent(accent)
    // 主题色要在切明暗之前先落到 root 上，applyTheme 才会读得到
    if(colors) applyCustomColors(colors)
    try{
        return applyTheme(await window.electron.getSetting('theme'))
    }catch{
        return applyTheme(THEME_DARK)
    }
}

export function watchTheme(callback){
    if(!window.electron?.onSettingUpdated) return () => {}
    return window.electron.onSettingUpdated(setting=>{
        const key = setting?.key
        if(key === 'accentColor'){
            applyAccent(setting.value)
            return
        }
        if(key === 'customCss'){
            applyCustomCss(setting.value)
            emitter.emit('custom-css-changed', setting.value)
            return
        }
        if(key === 'customColors'){
            applyCustomColors(setting.value)
            emitter.emit('custom-colors-changed', setting.value)
            return
        }
        if(key !== 'theme') return
        const theme = applyTheme(setting.value)
        if(typeof callback === 'function') callback(theme)
    })
}
