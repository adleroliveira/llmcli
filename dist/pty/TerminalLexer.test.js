import { TerminalLexer } from "./TerminalLexer.js";
import { DebugLogger } from "./DebugLogger.js";
DebugLogger.initialize();
describe("TerminalLexer", () => {
    let lexer;
    beforeEach(() => {
        lexer = new TerminalLexer();
    });
    // Helper function to convert generator to array
    const tokenize = (input) => {
        return Array.from(lexer.tokenize(input));
    };
    // Helper function to reconstruct original input
    const reconstruct = (tokens) => {
        return tokens.map((token) => token.raw).join("");
    };
    // Helper to verify reconstruction
    const verifyReconstruction = (input) => {
        const tokens = tokenize(input);
        const reconstructed = reconstruct(tokens);
        expect(reconstructed).toBe(input);
    };
    describe("Basic Tokenization", () => {
        test("handles simple text", () => {
            const input = "Hello, World!";
            const tokens = tokenize(input);
            expect(tokens).toHaveLength(1);
            expect(tokens[0]).toEqual({
                type: "TEXT",
                value: "Hello, World!",
                position: 0,
                raw: "Hello, World!",
            });
            verifyReconstruction(input);
        });
        test("handles control characters", () => {
            const input = "Hello\r\nWorld";
            const tokens = tokenize(input);
            expect(tokens).toHaveLength(4);
            expect(tokens.map((t) => t.type)).toEqual([
                "TEXT",
                "CONTROL",
                "CONTROL",
                "TEXT",
            ]);
            // Optional: Add more specific assertions
            expect(tokens).toEqual([
                {
                    type: "TEXT",
                    value: "Hello",
                    position: 0,
                    raw: "Hello",
                },
                {
                    type: "CONTROL",
                    value: "\r",
                    position: 5,
                    raw: "\r",
                },
                {
                    type: "CONTROL",
                    value: "\n",
                    position: 6,
                    raw: "\n",
                },
                {
                    type: "TEXT",
                    value: "World",
                    position: 7,
                    raw: "World",
                },
            ]);
            verifyReconstruction(input);
        });
    });
    describe("ANSI Escape Sequences", () => {
        test("handles basic SGR sequence", () => {
            const input = "\x1B[1m";
            const tokens = tokenize(input);
            expect(tokens).toHaveLength(4);
            expect(tokens.map((t) => t.type)).toEqual([
                "ESC",
                "CSI",
                "PARAMETER",
                "COMMAND",
            ]);
            verifyReconstruction(input);
        });
        test("handles multiple parameters", () => {
            const input = "\x1B[1;31;42m";
            const tokens = tokenize(input);
            expect(tokens.map((t) => t.type)).toEqual([
                "ESC",
                "CSI",
                "PARAMETER",
                "PARAMETER_SEP",
                "PARAMETER",
                "PARAMETER_SEP",
                "PARAMETER",
                "COMMAND",
            ]);
            verifyReconstruction(input);
        });
        test("handles private sequences", () => {
            const input = "\x1B[?1h";
            const tokens = tokenize(input);
            expect(tokens.map((t) => t.type)).toEqual([
                "ESC",
                "CSI",
                "QUESTION",
                "PARAMETER",
                "COMMAND",
            ]);
            verifyReconstruction(input);
        });
    });
    describe("OSC Sequences", () => {
        test("handles OSC with BEL terminator", () => {
            const input = "\x1B]0;Window Title\x07";
            const tokens = tokenize(input);
            expect(tokens.map((t) => t.type)).toEqual(["ESC", "OSC", "STRING", "ST"]);
            verifyReconstruction(input);
        });
        test("handles OSC with ESC\\ terminator", () => {
            const input = "\x1B]0;Window Title\x1B\\";
            const tokens = tokenize(input);
            expect(tokens.map((t) => t.type)).toEqual(["ESC", "OSC", "STRING", "ST"]);
            verifyReconstruction(input);
        });
    });
    describe("Complex Sequences", () => {
        test("handles multiple style changes", () => {
            const input = "\x1B[1m\x1B[31mHello\x1B[0m";
            const tokens = tokenize(input);
            verifyReconstruction(input);
        });
        test("handles your original complex example", () => {
            const input = "\x1B[1m\x1B[7m%\x1B[m\x1B[1m\x1B[m                                                                                                                                                                                                                \r \r\r\x1B[m\x1B[m\x1B[m\x1B[JZartharus% \x1B[K\x1B[?1h=\x1B[?2004h";
            const tokens = tokenize(input);
            verifyReconstruction(input);
        });
    });
    describe("Edge Cases", () => {
        test("handles empty input", () => {
            const input = "";
            const tokens = tokenize(input);
            expect(tokens).toHaveLength(0);
            verifyReconstruction(input);
        });
        test("handles incomplete escape sequences", () => {
            const lexer = new TerminalLexer();
            const input = "\x1B";
            // First chunk should emit no tokens
            const tokens1 = Array.from(lexer.tokenize(input));
            expect(tokens1).toHaveLength(0);
            // Second chunk with completion of sequence should emit all tokens
            const tokens2 = Array.from(lexer.tokenize("[1m"));
            expect(tokens2).toHaveLength(4); // ESC, CSI, PARAMETER, and COMMAND tokens
            expect(tokens2[0]).toEqual({
                type: "ESC",
                value: "\x1B",
                position: 0,
                raw: "\x1B",
            });
            expect(tokens2[1]).toEqual({
                type: "CSI",
                value: "[",
                position: 1,
                raw: "[",
            });
            expect(tokens2[2]).toEqual({
                type: "PARAMETER",
                value: "1",
                position: 2,
                raw: "1",
            });
            expect(tokens2[3]).toEqual({
                type: "COMMAND",
                value: "m",
                position: 3,
                raw: "m",
            });
        });
        test("handles mixed content types", () => {
            const input = "Hello\x1B[1mWorld\r\n\x1B[0m";
            const tokens = tokenize(input);
            verifyReconstruction(input);
        });
    });
    describe("Position Tracking", () => {
        test("maintains correct positions", () => {
            const input = "A\x1B[1mB";
            const tokens = tokenize(input);
            expect(tokens[0].position).toBe(0); // 'A'
            expect(tokens[1].position).toBe(1); // ESC
            expect(tokens[2].position).toBe(2); // '['
            expect(tokens[3].position).toBe(3); // '1'
            expect(tokens[4].position).toBe(4); // 'm'
            expect(tokens[5].position).toBe(5); // 'B'
        });
    });
    test("handles complex prompt sequence", () => {
        const input = "[m[m[m[JZartharus% [K[?1h=[?2004h";
        verifyReconstruction(input);
    });
});
describe("TerminalLexer Edge Cases", () => {
    let lexer;
    beforeEach(() => {
        lexer = new TerminalLexer();
    });
    const tokenize = (input) => {
        return Array.from(lexer.tokenize(input));
    };
    const reconstruct = (tokens) => {
        return tokens.map((token) => token.raw).join("");
    };
    const verifyReconstruction = (input) => {
        const tokens = tokenize(input);
        const reconstructed = reconstruct(tokens);
        expect(reconstructed).toBe(input);
    };
    describe("Problematic Sequences from Debug", () => {
        test("handles sequence with ?1l", () => {
            const input = "\u001b[?1l";
            const tokens = tokenize(input);
            expect(tokens.map((t) => t.type)).toEqual([
                "ESC",
                "CSI",
                "QUESTION",
                "PARAMETER",
                "COMMAND",
            ]);
            expect(tokens.map((t) => t.raw).join("")).toBe(input);
            verifyReconstruction(input);
        });
        test("handles sequence with > character", () => {
            const input = "\u001b>";
            const tokens = tokenize(input);
            expect(tokens.map((t) => t.type)).toEqual(["COMMAND"]);
            verifyReconstruction(input);
        });
        test("handles sequence ?2004l", () => {
            const input = "\u001b[?2004l";
            const tokens = tokenize(input);
            expect(tokens.map((t) => t.type)).toEqual([
                "ESC",
                "CSI",
                "QUESTION",
                "PARAMETER",
                "COMMAND",
            ]);
            verifyReconstruction(input);
        });
        test("handles combined problematic sequence", () => {
            const input = "\u001b[?1l\u001b>\u001b[?2004l";
            const tokens = tokenize(input);
            // Count total tokens
            expect(tokens.length).toBe(11);
            // Verify sequence boundaries
            expect(tokens.map((t) => t.raw).join("")).toBe(input);
            verifyReconstruction(input);
        });
    });
    describe("Token Position Verification", () => {
        test("maintains correct positions in problematic sequence", () => {
            const input = "\u001b[?1l\u001b>\u001b[?2004l";
            const tokens = tokenize(input);
            let currentPos = 0;
            for (const token of tokens) {
                expect(token.position).toBe(currentPos);
                currentPos += token.raw.length;
            }
        });
    });
    describe("Sequence Boundary Tests", () => {
        test("handles consecutive escape sequences correctly", () => {
            const input = "\u001b[?1l\u001b[?1l";
            const tokens = tokenize(input);
            // Should be two identical sequences
            const firstSequence = tokens.slice(0, 5);
            const secondSequence = tokens.slice(5);
            expect(firstSequence.map((t) => t.raw).join("")).toBe("\u001b[?1l");
            expect(secondSequence.map((t) => t.raw).join("")).toBe("\u001b[?1l");
        });
        test("handles escape sequence immediately after text", () => {
            const input = "test\u001b[?1l";
            const tokens = tokenize(input);
            expect(tokens[0].type).toBe("TEXT");
            expect(tokens[0].raw).toBe("test");
            expect(tokens
                .slice(1)
                .map((t) => t.raw)
                .join("")).toBe("\u001b[?1l");
        });
    });
    describe("Reconstruction Verification", () => {
        test("preserves characters in problematic sequences", () => {
            const sequences = [
                "\u001b[?1l",
                "\u001b>",
                "\u001b[?2004l",
                "\u001b[?1l\u001b>\u001b[?2004l",
            ];
            for (const sequence of sequences) {
                const tokens = tokenize(sequence);
                const rebuilt = reconstruct(tokens);
                // Check character by character
                for (let i = 0; i < sequence.length; i++) {
                    expect(rebuilt.charCodeAt(i)).toBe(sequence.charCodeAt(i));
                }
            }
        });
    });
});
