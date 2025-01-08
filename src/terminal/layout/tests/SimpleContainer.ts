import { App } from "../App.js";
import { StyledTextComponent } from "../components/StyledTextComponent.js";
import { TerminalManager } from "../TerminalManager.js";
import { FlexContainer } from "../components/FlexContainer.js";
import { Container } from "../components/Container.js";
import { SGRColor } from "../TerminalBuffer.js";

const app = new App({
  width: 61, //process.stdout.columns,
  height: 16, //process.stdout.rows,
  title: "StyledTextComponent Flex Example",
  direction: "column",
  gap: 0,
  id: "MyApp",
});
const flexContainer1 = new FlexContainer({
  direction: "row",
  gap: 0,
  id: "FlexBox",
});

app.addChild(flexContainer1);

const container1 = new Container({
  borderStyle: "single",
  titleStyle: {
    color: SGRColor.BrightYellow,
    bold: true,
  },
  id: "LeftBox",
  title: "Container 1",
  flexGrow: 1,
});
container1.setOnResizeCallback((size) => {
  container1.setTitle(`Container 1 (${size.width}x${size.height})`);
});
const text1 = new StyledTextComponent({
  text: `Just a simple text, just a simple text, just a simple text`,
  id: "Text1",
});
container1.addChild(text1);

const container2 = new Container({
  borderStyle: "single",
  titleStyle: {
    color: SGRColor.BrightCyan,
    bold: true,
  },
  title: "Container 2",
  id: "RightBox",
});

flexContainer1.addChild(container1);
flexContainer1.addChild(container2);

const manager = new TerminalManager(app);
manager.initialize();

setInterval(() => {}, 3000);
