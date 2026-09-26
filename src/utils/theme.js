import emitter from './emitter'
import vditorDarkContent from 'vditor/dist/css/content-theme/dark.css?inline'
import vditorLightContent from 'vditor/dist/css/content-theme/light.css?inline'

export const THEME_LIGHT = 'light'
export const THEME_DARK = 'dark'

const CONTENT_THEME_STYLE_ID = 'vditor-content-theme'

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
    emitter.emit('theme-changed', theme)
    return theme
}

export async function initTheme(){
    try{
        return applyTheme(await window.electron.getSetting('theme'))
    }catch{
        return applyTheme(THEME_DARK)
    }
}

export function watchTheme(callback){
    if(!window.electron?.onSettingUpdated) return () => {}
    return window.electron.onSettingUpdated(setting=>{
        if(setting?.key !== 'theme') return
        const theme = applyTheme(setting.value)
        if(typeof callback === 'function') callback(theme)
    })
}
