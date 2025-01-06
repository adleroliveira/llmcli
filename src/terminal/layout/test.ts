import { App } from "./App.js";
import { FlexContainer } from "./components/FlexContainer.js";
import { Container } from "./components/Container.js";
import { StyledTextComponent } from "./components/StyledTextComponent.js";
import { TerminalManager } from "./TerminalManager.js";
import { SGRColor } from "./TerminalBuffer.js";
import { DebugLogger } from "../DebugLogger.js";

DebugLogger.initialize({
  logFile: "pty-debug.log",
  appendToFile: true,
  flushInterval: 2000, // 2 seconds
  maxBufferSize: 16384, // 16KB
});

// Initialize renderer and screen
const app = new App({
  width: process.stdout.columns,
  height: process.stdout.rows,
  title: "Terminal Layout Test",
});

function setupLayout() {
  // Create the root flex container (horizontal)
  const rootFlex = new FlexContainer({
    direction: "row",
    justify: "space-between",
    gap: 2,
  });

  app.addChild(rootFlex);

  const text1 = new StyledTextComponent({
    text: `Hello Hello Hello Hello Hello Hello Hello Hello Hello`,
  });

  // Create left container
  const leftContainer = new Container({
    title: "Left Container",
    borderStyle: "single",
    titleStyle: {
      color: SGRColor.Yellow,
      bold: true,
    },
  });

  // leftContainer.addChild(text1);
  rootFlex.addChild(leftContainer);

  const text2 = new StyledTextComponent({
    text: `Hello2 Hello2 Hello2 Hello2 Hello2 Hello2 Hello2 Hello2 Hello2`,
  });

  // Create two containers for the right side
  const rightTopContainer = new Container({
    title: "Right Container",
    borderStyle: "single",
    titleStyle: {
      color: SGRColor.Magenta,
      bold: true,
    },
  });
  rightTopContainer.addChild(text2);
  rootFlex.addChild(rightTopContainer);
}

// Setup initial layout
setupLayout();

const manager = new TerminalManager(app, {
  useAlternateBuffer: true,
});

// Start the application
manager.initialize();

// Keep the process alive
setInterval(() => {
  // textComponent.setText(textComponent.getText() + "More Text ");
  // No-op to keep the event loop running
}, 3000);
