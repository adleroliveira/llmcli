// import { ViewPort } from "./ViewPort";
// import { Window } from "./Window";

// interface RendererConfig {
//   stdout: NodeJS.WriteStream;
//   clearScreen?: boolean;
// }

// export class Renderer {
//   private stdout: NodeJS.WriteStream;
//   private clearScreen: boolean;
//   private lastRender: string[][] | null;

//   constructor(config: RendererConfig) {
//     this.stdout = config.stdout;
//     this.clearScreen = config.clearScreen ?? true;
//     this.lastRender = null;
//   }

//   private getCursorPosition(x: number, y: number): string {
//     return `\x1b[${y + 1};${x + 1}H`;
//   }

//   private clearTerminal(): void {
//     this.stdout.write("\x1b[2J"); // Clear screen
//     this.stdout.write("\x1b[H"); // Move cursor to home position
//   }

//   private drawBorder(window: Window): void {
//     const size = window.getSize();
//     const pos = window.getPosition() ?? { x: 0, y: 0 };
//     const title = window.getTitle();

//     // Draw top border with title
//     this.stdout.write(this.getCursorPosition(pos.x, pos.y));
//     this.stdout.write("┌" + "─".repeat(size.width - 2) + "┐");

//     // Draw title if present
//     if (title) {
//       const titleStart = Math.floor((size.width - title.length) / 2);
//       this.stdout.write(this.getCursorPosition(pos.x + titleStart, pos.y));
//       this.stdout.write(` ${title} `);
//     }

//     // Draw side borders
//     for (let i = 1; i < size.height - 1; i++) {
//       this.stdout.write(this.getCursorPosition(pos.x, pos.y + i));
//       this.stdout.write("│");
//       this.stdout.write(
//         this.getCursorPosition(pos.x + size.width - 1, pos.y + i)
//       );
//       this.stdout.write("│");
//     }

//     // Draw bottom border
//     this.stdout.write(this.getCursorPosition(pos.x, pos.y + size.height - 1));
//     this.stdout.write("└" + "─".repeat(size.width - 2) + "┘");
//   }

//   private renderContent(viewport: ViewPort): void {
//     const content = viewport.getVisibleContent();
//     const position = viewport.getPosition();

//     content.forEach((line, y) => {
//       // Only render if line has changed from last render
//       if (!this.lastRender || !this.arraysEqual(line, this.lastRender[y])) {
//         this.stdout.write(this.getCursorPosition(position.x, position.y + y));
//         this.stdout.write(line.join(""));
//       }
//     });

//     // Store current render for future comparison
//     this.lastRender = content;

//     // Position cursor
//     const cursor = viewport.getCursor();
//     this.stdout.write(
//       this.getCursorPosition(
//         position.x + cursor.x,
//         position.y + cursor.y - viewport.getScrollPosition()
//       )
//     );
//   }

//   private arraysEqual(a: string[], b: string[]): boolean {
//     return a.length === b.length && a.every((val, idx) => val === b[idx]);
//   }

//   public render(window: Window): void {
//     if (!window.getState().isVisible) {
//       return;
//     }

//     if (this.clearScreen) {
//       this.clearTerminal();
//     }

//     this.drawBorder(window);
//     this.renderContent(window.getViewport());
//   }

//   public hideCursor(): void {
//     this.stdout.write("\x1b[?25l");
//   }

//   public showCursor(): void {
//     this.stdout.write("\x1b[?25h");
//   }

//   public setAlternateScreen(enable: boolean): void {
//     this.stdout.write(enable ? "\x1b[?1049h" : "\x1b[?1049l");
//   }
// }
