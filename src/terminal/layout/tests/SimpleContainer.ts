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
  id: "MyApp",
});

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

app.addChild(container1);

container1.setOnResizeCallback((size) => {
  container1.setTitle(`Container 1 (${size.width}x${size.height})`);
});

const text1 = new StyledTextComponent({
  text: `
Just a simple text, just a simple text, just a simple text
Just a simple text, just a simple text, just a simple text Just a simple text, just a simple text, just a simple text
Just a simple text, just a simple text, just a simple text Just a simple text, ju

Just a simple text, just a simple text, just 
Just a simple text, jus

Just a simple text, just a simple text, just a simple text Just a simple text, just a simple text
  `,
  id: "Text1",
});
container1.addChild(text1);

const manager = new TerminalManager(app);
manager.initialize();

setInterval(() => {}, 3000);
