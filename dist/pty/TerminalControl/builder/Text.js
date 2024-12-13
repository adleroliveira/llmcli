import { CSISequence, CSICommand, SGRAttribute, SGRColor, TextFormatter } from '../CSISequence.js';
import { TextSequence } from '../TextSequence.js';
export class Text {
    // Simple text without formatting
    static plain(text) {
        return {
            toSequence: () => TextSequence.fromStr(text)
        };
    }
    // Formatted text with automatic reset
    static formatted(text, style) {
        return {
            toSequence: () => {
                const sequences = [];
                // Apply formatting
                sequences.push(...Text.createFormatting(style));
                // Add the text
                sequences.push(TextSequence.fromStr(text));
                // Reset all attributes
                sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.Reset]));
                // Create a custom sequence that combines all the above
                return {
                    toString: () => sequences.map(seq => seq.toString()).join(''),
                    type: sequences[0].type,
                    controlChar: sequences[0].controlChar,
                    raw: new Uint8Array([]),
                    isValid: () => true
                };
            }
        };
    }
    // Multiple formatted text segments
    static segments(segments) {
        return {
            toSequence: () => {
                const sequences = [];
                for (const segment of segments) {
                    if (segment.style) {
                        sequences.push(...Text.createFormatting(segment.style));
                    }
                    sequences.push(TextSequence.fromStr(segment.text));
                    if (segment.style) {
                        sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.Reset]));
                    }
                }
                return {
                    toString: () => sequences.map(seq => seq.toString()).join(''),
                    type: sequences[0].type,
                    controlChar: sequences[0].controlChar,
                    raw: new Uint8Array([]),
                    isValid: () => true
                };
            }
        };
    }
    // Convenience methods for common text styles
    static bold(text) {
        return Text.formatted(text, { bold: true });
    }
    static italic(text) {
        return Text.formatted(text, { italic: true });
    }
    static underline(text) {
        return Text.formatted(text, { underline: true });
    }
    static colorize(text, color) {
        return Text.formatted(text, { color });
    }
    // Helper method to create formatting sequences
    static createFormatting(style) {
        const sequences = [];
        // Apply attributes
        if (style.bold)
            sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.Bold]));
        if (style.dim)
            sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.Dim]));
        if (style.italic)
            sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.Italic]));
        if (style.underline)
            sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.Underline]));
        if (style.blink)
            sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.BlinkSlow]));
        if (style.inverse)
            sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.Inverse]));
        if (style.hidden)
            sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.Hidden]));
        if (style.strikethrough)
            sequences.push(CSISequence.create(CSICommand.SGR, [SGRAttribute.StrikeThrough]));
        // Apply colors
        if (style.color !== undefined) {
            if (typeof style.color === 'number' && style.color in SGRColor) {
                sequences.push(CSISequence.create(CSICommand.SGR, [style.color]));
            }
            else if (typeof style.color === 'object') {
                sequences.push(CSISequence.fromStr(TextFormatter.rgb(style.color.r, style.color.g, style.color.b)));
            }
            else if (typeof style.color === 'number') {
                sequences.push(CSISequence.fromStr(TextFormatter.color256(style.color)));
            }
        }
        // Apply background colors
        if (style.backgroundColor !== undefined) {
            if (typeof style.backgroundColor === 'number' && style.backgroundColor in SGRColor) {
                sequences.push(CSISequence.create(CSICommand.SGR, [style.backgroundColor]));
            }
            else if (typeof style.backgroundColor === 'object') {
                sequences.push(CSISequence.fromStr(TextFormatter.rgb(style.backgroundColor.r, style.backgroundColor.g, style.backgroundColor.b, true)));
            }
            else if (typeof style.backgroundColor === 'number') {
                sequences.push(CSISequence.fromStr(TextFormatter.color256(style.backgroundColor, true)));
            }
        }
        return sequences;
    }
}
