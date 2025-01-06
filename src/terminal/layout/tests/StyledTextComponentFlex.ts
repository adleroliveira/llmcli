import { App } from "../App.js";
import { StyledTextComponent } from "../components/StyledTextComponent.js";
import { TerminalManager } from "../TerminalManager.js";
import { FlexContainer } from "../components/FlexContainer.js";

const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "StyledTextComponent Flex Example",
});

const rootFlex = new FlexContainer({
  direction: "row",
});

const text1 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

rootFlex.addChild(text1);

app.addChild(rootFlex);

const manager = new TerminalManager(app);
manager.initialize();

setTimeout(() => {
  app.resize(80, 24);
}, 5000);

setInterval(() => {}, 3000);
