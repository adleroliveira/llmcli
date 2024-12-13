import {
  VT100Sequence,
  ControlCharacter,
  SequenceType,
  StringSequence,
} from "./Command.js";
import { C1ControlSequence, C1Mode } from "./C1ControlSequence.js";

export enum OSCCommand {
  // Window/Terminal title commands
  SET_ICON_NAME_AND_WINDOW_TITLE = "0",
  SET_ICON_NAME = "1",
  SET_WINDOW_TITLE = "2",

  // Color manipulation
  SET_COLOR = "4",
  SET_SPECIAL_COLOR = "5",
  SET_CURRENT_DIR = "7",

  // Hyperlinks
  SET_HYPERLINK = "8",

  // iTerm2 specific (common extensions)
  SET_USER_VAR = "1337",

  // Terminal.app specific
  SET_BACKUP_CURSOR = "6",
  SET_CURRENT_FILE = "9",
}

export class OSCSequence extends VT100Sequence implements StringSequence {
  private readonly oscControl: C1ControlSequence;
  private readonly stControl: C1ControlSequence;

  constructor(
    raw: Uint8Array,
    public readonly stringContent: string,
    public readonly terminator: ControlCharacter.ST | ControlCharacter.BEL
  ) {
    super(SequenceType.OSC, ControlCharacter.OSC, raw);
    this.oscControl = C1ControlSequence.create('OSC');
    this.stControl = C1ControlSequence.create('ST');
  }

  static create(
    command: OSCCommand,
    args: string[] = [],
    useSTTerminator: boolean = true
  ): OSCSequence {
    // Join command and arguments with semicolons
    const content = [command, ...args].join(";");

    // Choose terminator
    const terminator = useSTTerminator ? ControlCharacter.ST : ControlCharacter.BEL;

    // Create C1 controls
    const oscControl = C1ControlSequence.create('OSC', C1Mode.BIT_7);
    const stControl = C1ControlSequence.create('ST', C1Mode.BIT_7);

    // Build the raw byte sequence
    const bytes: number[] = [];

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
    } else {
      bytes.push(ControlCharacter.BEL);
    }

    return new OSCSequence(
      new Uint8Array(bytes),
      content,
      terminator
    );
  }

  // Convenience methods for common operations
  static setWindowTitle(title: string): OSCSequence {
    return OSCSequence.create(OSCCommand.SET_WINDOW_TITLE, [title]);
  }

  static setColor(index: number, color: string): OSCSequence {
    return OSCSequence.create(OSCCommand.SET_COLOR, [index.toString(), color]);
  }

  static setHyperlink(uri: string, params: string = ""): OSCSequence {
    return OSCSequence.create(OSCCommand.SET_HYPERLINK, [params, uri]);
  }

  static setCurrentDirectory(dir: string): OSCSequence {
    return OSCSequence.create(OSCCommand.SET_CURRENT_DIR, [dir]);
  }

  getCommand(): { command: OSCCommand | string, args: string[] } {
    const parts = this.stringContent.split(";");
    const command = parts[0] as OSCCommand;
    const args = parts.slice(1);
    return { command, args };
  }

  isValid(): boolean {
    return (
      this.stringContent.length > 0 &&
      (this.terminator === ControlCharacter.ST ||
        this.terminator === ControlCharacter.BEL)
    );
  }

  toString(): string {
    const prefix = this.oscControl.toString();
    const suffix = this.terminator === ControlCharacter.ST
      ? this.stControl.toString()
      : String.fromCharCode(this.terminator);

    return `${prefix}${this.stringContent}${suffix}`;
  }
}