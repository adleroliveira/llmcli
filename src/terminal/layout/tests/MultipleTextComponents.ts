import { App } from "../App.js";
import { StyledTextComponent } from "../components/StyledTextComponent.js";
import { TerminalManager } from "../TerminalManager.js";
import { FlexContainer } from "../components/FlexContainer.js";

const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "StyledTextComponent Flex Example",
  gap: 3,
  direction: "column",
});

const text1 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

const text2 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

const text3 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

app.addChild(text1);
app.addChild(text2);
app.addChild(text3);

const manager = new TerminalManager(app);
manager.initialize();

setInterval(() => {}, 3000);
