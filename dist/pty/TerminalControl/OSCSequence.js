import { VT100Sequence, ControlCharacter, SequenceType, } from "./Command.js";
import { C1ControlSequence, C1Mode } from "./C1ControlSequence.js";
export var OSCCommand;
(function (OSCCommand) {
    // Window/Terminal title commands
    OSCCommand["SET_ICON_NAME_AND_WINDOW_TITLE"] = "0";
    OSCCommand["SET_ICON_NAME"] = "1";
    OSCCommand["SET_WINDOW_TITLE"] = "2";
    // Color manipulation
    OSCCommand["SET_COLOR"] = "4";
    OSCCommand["SET_SPECIAL_COLOR"] = "5";
    OSCCommand["SET_CURRENT_DIR"] = "7";
    // Hyperlinks
    OSCCommand["SET_HYPERLINK"] = "8";
    // iTerm2 specific (common extensions)
    OSCCommand["SET_USER_VAR"] = "1337";
    // Terminal.app specific
    OSCCommand["SET_BACKUP_CURSOR"] = "6";
    OSCCommand["SET_CURRENT_FILE"] = "9";
})(OSCCommand || (OSCCommand = {}));
export class OSCSequence extends VT100Sequence {
    constructor(raw, stringContent, terminator) {
        super(SequenceType.OSC, ControlCharacter.OSC, raw);
        this.stringContent = stringContent;
        this.terminator = terminator;
        this.oscControl = C1ControlSequence.create('OSC');
        this.stControl = C1ControlSequence.create('ST');
    }
    static create(command, args = [], useSTTerminator = true) {
        // Join command and arguments with semicolons
        const content = [command, ...args].join(";");
        // Choose terminator
        const terminator = useSTTerminator ? ControlCharacter.ST : ControlCharacter.BEL;
        // Create C1 controls
        const oscControl = C1ControlSequence.create('OSC', C1Mode.BIT_7);
        const stControl = C1ControlSequence.create('ST', C1Mode.BIT_7);
        // Build the raw byte sequence
        const bytes = [];
        // Add OSC sequence
        const oscBytes = Array.from(new TextEncoder().encode(oscControl.toString()));
        bytes.push(...oscBytes);
        // Add content bytes
        for (const char of content) {
            bytes.push(char.charCodeAt(0));
        }
        // Add terminator
        if (terminator === ControlCharacter.ST) {
            const stBytes = Array.from(new TextEncoder().encode(stControl.toString()));
            bytes.push(...stBytes);
        }
        else {
            bytes.push(ControlCharacter.BEL);
        }
        return new OSCSequence(new Uint8Array(bytes), content, terminator);
    }
    // Convenience methods for common operations
    static setWindowTitle(title) {
        return OSCSequence.create(OSCCommand.SET_WINDOW_TITLE, [title]);
    }
    static setColor(index, color) {
        return OSCSequence.create(OSCCommand.SET_COLOR, [index.toString(), color]);
    }
    static setHyperlink(uri, params = "") {
        return OSCSequence.create(OSCCommand.SET_HYPERLINK, [params, uri]);
    }
    static setCurrentDirectory(dir) {
        return OSCSequence.create(OSCCommand.SET_CURRENT_DIR, [dir]);
    }
    getCommand() {
        const parts = this.stringContent.split(";");
        const command = parts[0];
        const args = parts.slice(1);
        return { command, args };
    }
    isValid() {
        return (this.stringContent.length > 0 &&
            (this.terminator === ControlCharacter.ST ||
                this.terminator === ControlCharacter.BEL));
    }
    toString() {
        const prefix = this.oscControl.toString();
        const suffix = this.terminator === ControlCharacter.ST
            ? this.stControl.toString()
            : String.fromCharCode(this.terminator);
        return `${prefix}${this.stringContent}${suffix}`;
    }
}
