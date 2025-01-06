import { App } from "../App.js";
import { StyledTextComponent } from "../components/StyledTextComponent.js";
import { TerminalManager } from "../TerminalManager.js";
import { FlexContainer } from "../components/FlexContainer.js";
import { Container } from "../components/Container.js";
import { SGRColor } from "../TerminalBuffer.js";

const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "StyledTextComponent Flex Example",
  direction: "column",
  gap: 0,
});

const container1 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightYellow,
    bold: true,
  },
  title: "Container 1",
  flexGrow: 1,
});
const text1 = new StyledTextComponent({
  text: `<bg yellow><fg black>Hello, I am a black text with a bright yellow background inside Container 1<fg></bg>`,
});
container1.addChild(text1);

const container2 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightCyan,
    bold: true,
  },
  title: "Container 2",
  flexGrow: 1,
});

const container3 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightMagenta,
    bold: true,
  },
  title: "Container 2",
  flexGrow: 1,
});

const container4 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightRed,
    bold: true,
  },
  title: "Container 2",
  flexGrow: 1,
});

app.addChild(container1);
app.addChild(container2);

app.addChild(container3);
app.addChild(container4);

const manager = new TerminalManager(app);
manager.initialize();

// setTimeout(() => {
//   app.resize(100, 24);
// }, 5000);
setInterval(() => {}, 3000);
