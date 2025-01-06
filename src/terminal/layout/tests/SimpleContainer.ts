import { App } from "../App.js";
import { TerminalManager } from "../TerminalManager.js";
import { Container } from "../components/Container.js";
import { SGRColor } from "../TerminalBuffer.js";

const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "StyledTextComponent Flex Example",
  direction: "row",
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

app.addChild(container);

const manager = new TerminalManager(app);
manager.initialize();

setInterval(() => {}, 3000);
