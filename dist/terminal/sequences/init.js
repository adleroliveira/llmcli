import { Mode, Window, Cursor, Text, SequenceBuilder, } from "../builder/index.js";
import { SGRColor } from "../CSISequence.js";
const initSequence = SequenceBuilder.create()
    .add(Mode.setBracketedPaste())
    .add(Window.setIconNameAndWindowTitle("santoliv@Zartharus: ~/dev/llmcli"))
    .add(Text.colorize("santoliv@Zartharus", SGRColor.BrightWhite))
    .add(Text.plain(":"))
    .add(Text.formatted("~/dev/llmcli", { bold: true, color: SGRColor.BrightBlue }))
    .add(Text.plain("$ "))
    .add(Cursor.show())
    .build();
export const init = initSequence;
