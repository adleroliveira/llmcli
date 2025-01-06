import { App } from "../App.js";
import { StyledTextComponent } from "../components/StyledTextComponent.js";
import { TerminalManager } from "../TerminalManager.js";
import { FlexContainer } from "../components/FlexContainer.js";

const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "StyledTextComponent Flex Example",
});

const flexContainer = new FlexContainer({
  direction: "row",
  // align: "stretch",
  flexGrow: 1,
  gap: 2,
});

app.addChild(flexContainer);

const text1 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

const text2 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

flexContainer.addChild(text1);
flexContainer.addChild(text2);

const manager = new TerminalManager(app);
manager.initialize();

setInterval(() => {}, 3000);
