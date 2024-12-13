import { CSISequence } from "./CSISequence.js";
import { TextSequence } from "./TextSequence.js";
export class PromptStateManager {
    constructor(terminalController, decorator) {
        this.promptDecorator = "";
        this.state = {
            hasDisplayBeenCleared: false,
            lastPrompt: "",
            decoratedPrompt: "",
        };
        this.terminalController = terminalController;
        if (decorator) {
            this.setPromptDecorator(decorator);
        }
    }
    getState() {
        return { ...this.state };
    }
    processSequence(sequence) {
        if (sequence instanceof CSISequence && sequence.command === "ED") {
            this.state.hasDisplayBeenCleared = true;
            return sequence;
        }
        if (sequence instanceof TextSequence) {
            const text = sequence.toString();
            const currentLineState = this.terminalController.getState().lineBuffer;
            if (currentLineState.prompt && this.state.hasDisplayBeenCleared) {
                const decoratedText = `${this.promptDecorator}${text}`;
                this.state.hasDisplayBeenCleared = false;
                return TextSequence.fromStr(decoratedText);
            }
        }
        this.state.hasDisplayBeenCleared = false;
        return sequence;
    }
    reset() {
        this.state = {
            hasDisplayBeenCleared: false,
            lastPrompt: "",
            decoratedPrompt: "",
        };
    }
    setPromptDecorator(decorator) {
        this.promptDecorator = `${decorator.trim()} `;
    }
    getDecorator() {
        return this.promptDecorator;
    }
}
