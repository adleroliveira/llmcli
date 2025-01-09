import { App } from "../App.js";
import { TerminalManager } from "../TerminalManager.js";
import { Container } from "../components/Container.js";
import { SGRColor } from "../TerminalBuffer.js";
import { StyledTextComponent } from "../components/StyledTextComponent.js";

const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "StyledTextComponent Flex Example",
  direction: "column",
});

const container1 = new Container({
  borderStyle: "double",
  titleStyle: {
    color: SGRColor.BrightYellow,
    bold: true,
  },
  title: "Container 1",
  align: "start",
  flexGrow: 1,
});

const text1 = new StyledTextComponent({
  text: `<bg yellow><fg black>Hello, I am a black text with a bright yellow background inside Container 1  Hello, I am a black text with a bright yellow background inside Container 1</fg></bg>`,
});
container1.addChild(text1);

app.addChild(container1);

const manager = new TerminalManager(app);
manager.initialize();

setInterval(() => {}, 3000);
