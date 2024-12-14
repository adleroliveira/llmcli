import { ViewPort } from "./ViewPort.js";
import { VT100Parser } from "./VT100Parser.js";
import { CSISequence, CSICommand } from "./CSISequence.js";
import { Cursor, Erase, EraseMode, SequenceBuilder, Text, } from "./builder/index.js";
import { PositionTranslator } from "./PositionTranslator.js";
import { DebugLogger } from "./DebugLogger.js";
import { VT100Formatter } from "./VT100Formatter.js";
const DEFAULT_TITLE = "Terminal";
const DEFAULT_MAX_BUFFER_LINES = 1000;
export class Window {
    constructor(config) {
        this.translator = new PositionTranslator(config.position ?? { x: 1, y: 1 });
        this.position = config.position;
        this.size = config.size;
        this.title = config.title || DEFAULT_TITLE;
        this.directory = config.directory;
        this.maximize = config.maximize || false;
        this.fullscreen = config.fullscreen || false;
        this.isVisible = true;
        this.stdout = config.stdout;
        this.parser = new VT100Parser({
            support8BitC1: true,
            maxStringLength: 2048,
            strictMode: true,
        });
        // Initialize viewport with a slightly smaller size to account for borders
        this.viewport = new ViewPort({
            dimensions: {
                width: this.size.width - 2,
                height: this.size.height - 2,
            },
            position: { x: 1, y: 1 }, // Viewport now uses relative positions
            maxBufferLines: config.maxBufferLines || DEFAULT_MAX_BUFFER_LINES,
        });
        this.renderFrame();
    }
    renderFrame() {
        // Calculate the padding needed to center the title with spaces
        const spacedTitle = ` ${this.title} `; // Add one space on each side
        const titleLength = spacedTitle.length;
        const availableWidth = this.size.width - 2; // Account for corners
        const leftPadding = Math.floor((availableWidth - titleLength) / 2);
        const rightPadding = availableWidth - leftPadding - titleLength;
        // Create the top border with centered and spaced title
        const topBorder = `┌${"─".repeat(leftPadding)}${spacedTitle}${"─".repeat(rightPadding)}┐`;
        const windowFrame = SequenceBuilder.create()
            .add(Erase.display(EraseMode.All))
            .add(Cursor.moveTo({ column: 1, row: 1 }))
            .add(Text.bold(topBorder))
            .add(Cursor.nextLine());
        // Render side borders
        for (let index = 0; index < this.size.height - 2; index++) {
            windowFrame
                .add(Text.bold(`│${" ".repeat(this.size.width - 2)}│`))
                .add(Cursor.nextLine());
        }
        // Render bottom border
        const { x: row, y: column } = this.translator.toAbsolute({ x: 0, y: 0 });
        windowFrame
            .add(Text.bold(`└${"─".repeat(this.size.width - 2)}┘`))
            .add(Cursor.moveTo({ row, column }));
        const sequenceStr = windowFrame.build();
        // for (const sequence of this.parser.parseString(sequenceStr)) {
        //   DebugLogger.log("", VT100Formatter.format(sequence));
        // }
        this.stdout.write(sequenceStr);
    }
    process(data) {
        let outputStr = "";
        for (const sequence of this.parser.parseString(data)) {
            if (sequence instanceof CSISequence &&
                this.handleWindowOperation(sequence)) {
                // Handle window operations first
                continue;
            }
            // Process sequence through viewport
            const processedSequences = this.viewport.process(sequence);
            // Convert all sequences to strings and concatenate
            for (const processed of processedSequences) {
                DebugLogger.log("", VT100Formatter.format(processed));
                outputStr += processed.toString();
            }
        }
        // Write the final output
        if (outputStr) {
            this.stdout.write(outputStr);
        }
    }
    handleWindowOperation(sequence) {
        // Only handle XTWINOPS commands (CSI ... t)
        if (sequence.command !== CSICommand.XTWINOPS) {
            return false;
        }
        const params = sequence.parameters;
        if (params.length === 0 || params[0].value === null) {
            return false;
        }
        switch (params[0].value) {
            case 1: // De-iconify (restore from minimized)
                this.restore();
                return true;
            case 2: // Minimize
                this.minimize();
                return true;
            case 3: // Move window
                if (params.length >= 3 &&
                    params[1].value !== null &&
                    params[2].value !== null) {
                    this.setPosition({
                        x: params[1].value,
                        y: params[2].value,
                    });
                }
                return true;
            case 4: // Resize window (pixels)
                if (params.length >= 3 &&
                    params[1].value !== null &&
                    params[2].value !== null) {
                    this.setSize({
                        height: params[1].value,
                        width: params[2].value,
                    });
                }
                return true;
            case 8: // Resize window (characters)
                if (params.length >= 3 &&
                    params[1].value !== null &&
                    params[2].value !== null) {
                    this.setSize({
                        height: params[1].value,
                        width: params[2].value,
                    });
                }
                return true;
            case 9: // Maximize/Restore
                if (params.length >= 2 && params[1].value !== null) {
                    switch (params[1].value) {
                        case 0: // Restore
                            this.restore();
                            break;
                        case 1: // Maximize
                            this.toggleMaximize();
                            break;
                        case 2: // Maximize vertically
                            // TODO: Implement partial maximize
                            break;
                        case 3: // Maximize horizontally
                            // TODO: Implement partial maximize
                            break;
                    }
                }
                return true;
            case 10: // Full screen
                if (params.length >= 2 && params[1].value !== null) {
                    switch (params[1].value) {
                        case 0: // Exit full screen
                            if (this.fullscreen) {
                                this.toggleFullscreen();
                            }
                            break;
                        case 1: // Enter full screen
                            if (!this.fullscreen) {
                                this.toggleFullscreen();
                            }
                            break;
                    }
                }
                return true;
            case 11: // Report window state
            case 13: // Report window position
            case 14: // Report window size (pixels)
            case 18: // Report window size (characters)
            case 19: // Report screen size (characters)
            case 20: // Report icon label
            case 21: // Report window title
                // TODO: Implement window reporting
                return true;
        }
        return false;
    }
    // Window state management
    toggleMaximize() {
        this.maximize = !this.maximize;
        if (this.maximize) {
            this.fullscreen = false;
        }
        this.updateViewportSize();
    }
    toggleFullscreen() {
        this.fullscreen = !this.fullscreen;
        if (this.fullscreen) {
            this.maximize = false;
        }
        this.updateViewportSize();
    }
    toggleVisibility() {
        this.isVisible = !this.isVisible;
    }
    minimize() {
        this.isVisible = false;
    }
    restore() {
        this.isVisible = true;
        this.maximize = false;
        this.fullscreen = false;
        this.updateViewportSize();
    }
    // Window properties management
    setPosition(position) {
        this.position = position;
        this.translator.setWindowPosition(position);
        this.renderFrame(); // Re-render frame at new position
    }
    setSize(size) {
        this.size = size;
        this.updateViewportSize();
    }
    setTitle(title) {
        this.title = title;
    }
    setDirectory(directory) {
        this.directory = directory;
    }
    getState() {
        return {
            isMaximized: this.maximize,
            isFullscreen: this.fullscreen,
            isVisible: this.isVisible,
        };
    }
    // Viewport management
    updateViewportSize() {
        // TODO: infor the PTY about the resize
        this.viewport.resize({
            width: this.size.width - 2,
            height: this.size.height - 2,
        });
    }
    getViewport() {
        return this.viewport;
    }
}
