import { reactive } from 'vue'

const uiState = reactive({
    focus:false
})

export function useUiState(){
    return {
        uiState,
        toggleFocus(value){
            uiState.focus = typeof value === "boolean" ? value : !uiState.focus
        },
        exitFocus(){
            uiState.focus = false
        }
    }
}

export default uiState
