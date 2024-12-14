import { VT100Sequence } from "./Command.js";
import { CSISequence } from "./CSISequence.js";
import { TextSequence } from "./TextSequence.js";
import { TerminalController } from "./TerminalController.js";

export interface PromptState {
  hasDisplayBeenCleared: boolean;
  lastPrompt: string;
  decoratedPrompt: string;
}

export class PromptStateManager {
  private terminalController: TerminalController;
  private promptDecorator: string = "";
  private state: PromptState = {
    hasDisplayBeenCleared: false,
    lastPrompt: "",
    decoratedPrompt: "",
  };

  constructor(terminalController: TerminalController, decorator?: string) {
    this.terminalController = terminalController;
    if (decorator) {
      this.setPromptDecorator(decorator);
    }
  }

  public getState(): PromptState {
    return { ...this.state };
  }

  public processSequence(sequence: VT100Sequence): VT100Sequence {
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

  public reset(): void {
    this.state = {
      hasDisplayBeenCleared: false,
      lastPrompt: "",
      decoratedPrompt: "",
    };
  }

  public setPromptDecorator(decorator: string): void {
    this.promptDecorator = `${decorator.trim()} `;
  }

  getDecorator(): string {
    return this.promptDecorator;
  }
}
