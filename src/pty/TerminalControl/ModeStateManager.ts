import { VT100Sequence } from "./Command.js";
import { CSISequence } from "./CSISequence.js";
import {
  SimpleEscapeSequence,
  SimpleEscapeCommand,
} from "./SimpleEscapeSequence.js";

export interface ModeState {
  applicationCursor: boolean;
  applicationKeypad: boolean;
  wrap: boolean;
  insert: boolean;
  originMode: boolean;
  autoWrap: boolean;
  bracketedPaste: boolean;
  mouseTracking: boolean;
}

export class ModeStateManager {
  private state: ModeState = {
    applicationCursor: false,
    applicationKeypad: false,
    wrap: true,
    insert: false,
    originMode: false,
    autoWrap: true,
    bracketedPaste: false,
    mouseTracking: false,
  };

  // Mode parameter mappings
  private readonly MODE_PARAMS = {
    DECCKM: 1, // Application Cursor Keys
    DECNKM: 66, // Application Keypad
    DECOM: 6, // Origin Mode
    DECAWM: 7, // Auto Wrap Mode
    DECARM: 8, // Auto Repeat Mode
    IRM: 4, // Insert Mode
    BRACKETED_PASTE: 2004,
    MOUSE_REPORT: 1000,
  };

  // Get current mode state
  public getState(): ModeState {
    return { ...this.state };
  }

  public processSequence(sequence: VT100Sequence): void {
    // Handle Simple Escape Sequences
    if (sequence instanceof SimpleEscapeSequence) {
      const command = sequence.getCommandType();
      switch (command) {
        case SimpleEscapeCommand.DECPAM:
          this.state.applicationKeypad = true;
          return;
        case SimpleEscapeCommand.DECPNM:
          this.state.applicationKeypad = false;
          return;
      }
      return;
    }

    if (
      !(sequence instanceof CSISequence) ||
      !CSISequence.isModeCommand(sequence)
    ) {
      return;
    }

    const isSetMode = sequence.finalByte === 0x68; // 'h'
    const parameters = sequence.parameters;
    const isPrivateMode = parameters[0]?.private ?? false;

    for (const param of parameters) {
      if (!param.value) continue;

      switch (param.value) {
        // Private modes (requires ? parameter)
        case this.MODE_PARAMS.DECCKM:
          if (isPrivateMode) {
            this.state.applicationCursor = isSetMode;
          }
          break;

        case this.MODE_PARAMS.DECNKM:
          if (isPrivateMode) {
            this.state.applicationKeypad = isSetMode;
          }
          break;

        case this.MODE_PARAMS.DECOM:
          if (isPrivateMode) {
            this.state.originMode = isSetMode;
          }
          break;

        case this.MODE_PARAMS.DECAWM:
          if (isPrivateMode) {
            this.state.autoWrap = isSetMode;
          }
          break;

        case this.MODE_PARAMS.BRACKETED_PASTE:
          if (isPrivateMode) {
            this.state.bracketedPaste = isSetMode;
          }
          break;

        case this.MODE_PARAMS.MOUSE_REPORT:
          if (isPrivateMode) {
            this.state.mouseTracking = isSetMode;
          }
          break;

        // Non-private modes
        case this.MODE_PARAMS.IRM:
          if (!isPrivateMode) {
            this.state.insert = isSetMode;
          }
          break;

        // The wrap state is affected by both autoWrap and the current wrap mode
        default:
          break;
      }

      // Update wrap state based on autoWrap
      this.state.wrap = this.state.autoWrap;
    }
  }

  // Helper method to reset all modes to their default values
  public reset(): void {
    this.state = {
      applicationCursor: false,
      applicationKeypad: false,
      wrap: true,
      insert: false,
      originMode: false,
      autoWrap: true,
      bracketedPaste: false,
      mouseTracking: false,
    };
  }

  public setup(): VT100Sequence {
    const ris1 = SimpleEscapeSequence.create(SimpleEscapeCommand.RIS);
    return ris1;
  }
}
