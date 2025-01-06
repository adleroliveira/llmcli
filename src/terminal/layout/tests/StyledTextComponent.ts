import { App } from "../App.js";
import { StyledTextComponent } from "../components/StyledTextComponent.js";
import { TerminalManager } from "../TerminalManager.js";

const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "StyledTextComponent Example",
});

const text1 = new StyledTextComponent({
  text: `Hello <bg yellow>Hello</bg> Hello <bg magenta>Hello</bg> Hello <i>Hello</i> Hello <fg green><s>Hello</s></fg> Hello Hello <fg brightgreen>Hello</fg> <bg brightyellow><fg black>Hello</fg></bg> Hello`,
});

app.addChild(text1);

const manager = new TerminalManager(app);
manager.initialize();
// setTimeout(() => {
//   app.resize(50, 24);
// }, 5000);
setInterval(() => {}, 3000);
