import { App } from "../App.js";
import { TerminalManager } from "../TerminalManager.js";
import { Container } from "../components/Container.js";
import { SGRColor } from "../TerminalBuffer.js";
import { FlexContainer } from "../components/FlexContainer.js";
import { StyledTextComponent } from "../components/StyledTextComponent.js";

const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "StyledTextComponent Flex Example",
});

const container = new Container({
  borderStyle: "double",
  titleStyle: {
    color: SGRColor.BrightYellow,
    bold: true,
  },
  title: "This is my simple container",
  flexGrow: 1,
});

const container_in1 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightBlue,
    bold: true,
  },
  margin: 1,
  title: "Internal Container 1",
});

const container_in2 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightMagenta,
    bold: true,
  },
  margin: 1,
  title: "Internal Container 2",
});

app.addChild(container);

const flexContainer = new FlexContainer({
  direction: "row",
  align: "stretch",
  flexGrow: 1,
  gap: 0,
});

container.addChild(flexContainer);

const text1 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

const text2 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

flexContainer.addChild(container_in1);
flexContainer.addChild(container_in2);
container_in1.addChild(text1);
container_in2.addChild(text2);

const manager = new TerminalManager(app);
manager.initialize();

setInterval(() => {}, 3000);
