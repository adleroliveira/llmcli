import { TerminalParser } from "./TerminalParser.js";
describe("TerminalParser", () => {
    let parser;
    beforeEach(() => {
        parser = new TerminalParser();
    });
    // Helper function to convert generator to array
    const parse = (input) => {
        return Array.from(parser.parse(input));
    };
    const removeDebug = (input) => {
        const { debug, ...rest } = input;
        return rest;
    };
    describe("Basic Parsing", () => {
        test("handles simple text", () => {
            const input = "Hello, World!";
            const commands = parse(input);
            expect(commands).toHaveLength(1);
            expect(removeDebug(commands[0])).toEqual({
                type: "TEXT",
                action: "print",
                params: [],
                text: "Hello, World!",
                raw: "Hello, World!",
            });
        });
        test("handles control characters", () => {
            const input = "Hello\r\nWorld";
            const commands = parse(input);
            expect(commands).toHaveLength(4);
            expect(commands.map(removeDebug)).toEqual([
                {
                    type: "TEXT",
                    action: "print",
                    params: [],
                    text: "Hello",
                    raw: "Hello",
                },
                {
                    type: "CONTROL",
                    action: "carriageReturn",
                    params: [],
                    raw: "\r",
                },
                {
                    type: "CONTROL",
                    action: "lineFeed",
                    params: [],
                    raw: "\n",
                },
                {
                    type: "TEXT",
                    action: "print",
                    params: [],
                    text: "World",
                    raw: "World",
                },
            ]);
        });
        // Additional test to explicitly verify CRLF handling
        test("handles CRLF sequence correctly", () => {
            const input = "Line1\r\nLine2\r\nLine3";
            const commands = parse(input);
            expect(commands).toHaveLength(7); // Changed from 8 to 7
            expect(commands.map((cmd) => ({ type: cmd.type, action: cmd.action }))).toEqual([
                { type: "TEXT", action: "print" },
                { type: "CONTROL", action: "carriageReturn" },
                { type: "CONTROL", action: "lineFeed" },
                { type: "TEXT", action: "print" },
                { type: "CONTROL", action: "carriageReturn" },
                { type: "CONTROL", action: "lineFeed" },
                { type: "TEXT", action: "print" },
            ]);
        });
    });
    describe("SGR Commands", () => {
        test("handles basic style command", () => {
            const input = "\x1B[1m";
            const commands = parse(input);
            expect(commands).toHaveLength(1);
            expect(removeDebug(commands[0])).toEqual({
                type: "SGR",
                action: "style",
                params: [1],
                raw: "\x1B[1m",
            });
        });
        test("handles multiple style parameters", () => {
            const input = "\x1B[1;31;42m";
            const commands = parse(input);
            expect(commands).toHaveLength(1);
            expect(removeDebug(commands[0])).toEqual({
                type: "SGR",
                action: "style",
                params: [1, 31, 42],
                raw: "\x1B[1;31;42m",
            });
        });
        test("uses default parameter [0] for empty SGR", () => {
            const input = "\x1B[m";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "SGR",
                action: "style",
                params: [0],
                raw: "\x1B[m",
            });
        });
    });
    describe("Cursor Commands", () => {
        test("handles cursor up", () => {
            const input = "\x1B[A";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "CURSOR",
                action: "up",
                params: [1],
                raw: "\x1B[A",
            });
        });
        test("handles cursor position", () => {
            const input = "\x1B[5;10H";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "CURSOR",
                action: "position",
                params: [5, 10],
                raw: "\x1B[5;10H",
            });
        });
    });
    describe("Clear Commands", () => {
        test("handles clear screen", () => {
            const input = "\x1B[2J";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "CLEAR",
                action: "screen",
                params: [2],
                raw: "\x1B[2J",
            });
        });
        test("handles clear line", () => {
            const input = "\x1B[K";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "CLEAR",
                action: "line",
                params: [0],
                raw: "\x1B[K",
            });
        });
    });
    describe("Private Mode Commands", () => {
        test("handles set cursor keys mode", () => {
            const input = "\x1B[?1h";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "PRIVATE_MODE",
                action: "setCursorKeys",
                params: [1],
                private: true,
                raw: "\x1B[?1h",
            });
        });
        test("handles reset cursor keys mode", () => {
            const input = "\x1B[?1l";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "PRIVATE_MODE",
                action: "resetCursorKeys",
                params: [1],
                private: true,
                raw: "\x1B[?1l",
            });
        });
        test("handles bracketed paste mode", () => {
            const input = "\x1B[?2004h";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "PRIVATE_MODE",
                action: "setBracketedPaste",
                params: [2004],
                private: true,
                raw: "\x1B[?2004h",
            });
        });
    });
    describe("OSC Commands", () => {
        test("handles window title", () => {
            const input = "\x1B]0;Window Title\x07";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "OSC",
                action: "osc",
                params: [0],
                text: "Window Title",
                raw: "\x1B]0;Window Title\x07",
            });
        });
    });
    describe("Complex Sequences", () => {
        test("handles multiple commands", () => {
            const input = "\x1B[1m\x1B[31mHello\x1B[0m";
            const commands = parse(input);
            expect(commands).toEqual([
                {
                    type: "SGR",
                    action: "style",
                    params: [1],
                    raw: "\x1B[1m",
                },
                {
                    type: "SGR",
                    action: "style",
                    params: [31],
                    raw: "\x1B[31m",
                },
                {
                    type: "TEXT",
                    action: "print",
                    params: [],
                    text: "Hello",
                    raw: "Hello",
                },
                {
                    type: "SGR",
                    action: "style",
                    params: [0],
                    raw: "\x1B[0m",
                },
            ]);
        });
        test("handles complex prompt sequence", () => {
            const input = "\x1B[1m\x1B[7m%\x1B[m\x1B[1m\x1B[m Zartharus% \x1B[K\x1B[?1h=\x1B[?2004h";
            const commands = parse(input);
            // DebugLogger.log("", commands);
            expect(commands.map((cmd) => cmd.type)).toEqual([
                "SGR",
                "SGR",
                "TEXT",
                "SGR",
                "SGR",
                "SGR",
                "TEXT",
                "CLEAR",
                "PRIVATE_MODE",
                "PRIVATE_MODE",
            ]);
        });
    });
    describe("Edge Cases", () => {
        test("handles empty input", () => {
            const input = "";
            const commands = parse(input);
            expect(commands).toHaveLength(0);
        });
        test("handles incomplete sequences", () => {
            const input = "\x1B";
            const commands = parse(input);
            expect(commands).toHaveLength(0); // Now buffers incomplete sequence
        });
        test("handles unknown command characters", () => {
            const input = "\x1B[Z";
            const commands = parse(input);
            expect(removeDebug(commands[0])).toEqual({
                type: "UNKNOWN",
                action: "unknown_Z",
                params: [],
                raw: "\x1B[Z",
            });
        });
        test("handles split SGR command across chunks", () => {
            const chunk1 = "\x1B[1";
            const chunk2 = ";31m";
            const commands1 = parse(chunk1);
            expect(commands1).toHaveLength(0); // Should buffer incomplete command
            const commands2 = parse(chunk2);
            expect(commands2).toHaveLength(1);
            expect(removeDebug(commands2[0])).toEqual({
                type: "SGR",
                action: "style",
                params: [1, 31],
                raw: "\x1B[1;31m",
            });
        });
        test("handles split command followed by complete command", () => {
            const chunk1 = "\x1B[1";
            const chunk2 = "mHello";
            const commands1 = parse(chunk1);
            expect(commands1).toHaveLength(0);
            const commands2 = parse(chunk2);
            expect(commands2).toHaveLength(2);
            expect(removeDebug(commands2[0])).toEqual({
                type: "SGR",
                action: "style",
                params: [1],
                raw: "\x1B[1m",
            });
            expect(removeDebug(commands2[1])).toEqual({
                type: "TEXT",
                action: "print",
                params: [],
                text: "Hello",
                raw: "Hello",
            });
        });
    });
});
