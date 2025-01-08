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

const flexContainer1 = new FlexContainer({
  direction: "row",
  gap: 0,
  flexGrow: 1,
  align: "stretch",
});
const flexContainer2 = new FlexContainer({
  direction: "row",
  gap: 0,
  flexGrow: 1,
  align: "stretch",
});

app.addChild(flexContainer1);
app.addChild(flexContainer2);

const container1 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightYellow,
    bold: true,
  },
  title: "Container 1",
  flexGrow: 1,
});
container1.setOnResizeCallback((size) => {
  container1.setTitle(`Container 1 (${size.width}x${size.height})`);
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
const text2 = new StyledTextComponent({
  text: `<bg cyan><fg black>Hello, I am a black text with a bright cyan background inside Container 2<fg></bg>`,
});
container2.addChild(text2);

const container3 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightMagenta,
    bold: true,
  },
  title: "Container 3",
  flexGrow: 1,
});
const text3 = new StyledTextComponent({
  text: `<bg magenta><fg black>Hello, I am a black text with a bright magenta background inside Container 3<fg></bg>`,
});
container3.addChild(text3);

const container4 = new Container({
  borderStyle: "rounded",
  titleStyle: {
    color: SGRColor.BrightRed,
    bold: true,
  },
  title: "Container 4",
  flexGrow: 1,
});
const text4 = new StyledTextComponent({
  text: `<bg red><fg black>Hello, I am a black text with a bright magenta background inside Container 4<fg></bg>`,
});
container4.addChild(text4);

flexContainer1.addChild(container1);
flexContainer1.addChild(container2);

flexContainer2.addChild(container3);
flexContainer2.addChild(container4);

const manager = new TerminalManager(app);
manager.initialize();

// setTimeout(() => {
//   app.resize(100, 24);
// }, 5000);
setInterval(() => {}, 3000);
