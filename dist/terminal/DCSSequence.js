import { VT100Sequence, ControlCharacter, SequenceType, } from "./Command.js";
export class DCSSequence extends VT100Sequence {
    constructor(raw, parameters, intermediateBytes, stringContent, terminator) {
        super(SequenceType.DCS, ControlCharacter.DCS, raw);
        this.parameters = parameters;
        this.intermediateBytes = intermediateBytes;
        this.stringContent = stringContent;
        this.terminator = terminator;
    }
    isValid() {
        // DCS must:
        // 1. End with ST (unlike OSC which can end with BEL)
        // 2. Have valid intermediate bytes (if any)
        // 3. Have valid string content
        // 4. Parameters must be valid (if present)
        return (this.terminator === ControlCharacter.ST &&
            this.intermediateBytes.every((b) => this.isIntermediateByte(b)) &&
            this.validateStringContent() &&
            this.validateParameters());
    }
    validateStringContent() {
        // DCS string content must:
        // 1. Not be empty
        // 2. Only contain printable characters (0x20-0x7E)
        // 3. Not contain control characters
        if (!this.stringContent)
            return false;
        return [...this.stringContent].every((char) => {
            const code = char.charCodeAt(0);
            return code >= 0x20 && code <= 0x7e;
        });
    }
    validateParameters() {
        // DCS parameters follow same rules as CSI
        // But also need to check for specific DCS restrictions
        if (!this.parameters.length)
            return true; // Parameters are optional
        return this.parameters.every((param) => {
            // Check if parameter value exists and is within valid range
            return param.value !== null && param.value >= 0 && param.value <= 65535;
        });
    }
    toString() {
        const params = this.parameters.length > 0
            ? this.parameters
                .map((p) => {
                const paramValue = p.value === null ? "" : p.value.toString();
                return p.private ? `?${paramValue}` : paramValue;
            })
                .join(";") + " "
            : "";
        const intermediate = this.intermediateBytes.length > 0
            ? String.fromCharCode(...this.intermediateBytes)
            : "";
        // DCS sequences can be represented in both 7-bit and 8-bit forms
        // 7-bit form: ESC P ... ST
        // 8-bit form: 0x90 ... ST
        // We'll use 7-bit form as it's more widely supported
        return `\x1BP${params}${intermediate}${this.stringContent}\x9C`;
    }
    // Helper method to get the requested status string type (for DECRQSS)
    getStatusStringType() {
        // First character of string content typically identifies the type
        // of status being requested in DECRQSS
        return this.stringContent.charAt(0) || null;
    }
    // Helper method to create a response DCS
    static createResponse(requestDCS, response) {
        // Responses typically start with 1 for valid request, 0 for invalid
        const validRequest = response !== "";
        const responseContent = `${validRequest ? "1" : "0"}$r${response}`;
        return new DCSSequence(new Uint8Array(0), // Raw bytes would be filled by parser
        [], // No parameters in response
        [], // No intermediate bytes in response
        responseContent, ControlCharacter.ST);
    }
}
export class DECRQSSSequence extends DCSSequence {
    constructor(raw, requestedAttribute) {
        super(raw, [], // DECRQSS doesn't use parameters
        [0x24], // $ intermediate byte
        `${requestedAttribute}`, // The attribute being queried
        ControlCharacter.ST);
        this.requestedAttribute = requestedAttribute;
    }
    // Override to add DECRQSS-specific validation
    isValid() {
        return (super.isValid() &&
            this.intermediateBytes.length === 1 &&
            this.intermediateBytes[0] === 0x24 && // $
            this.validateRequestedAttribute());
    }
    validateRequestedAttribute() {
        // List of valid DECRQSS attributes
        const validAttributes = ["m", "r", "s", "t", "|"];
        return validAttributes.includes(this.requestedAttribute);
    }
    // Create appropriate response
    createResponse(attributeValue) {
        return DCSSequence.createResponse(this, attributeValue);
    }
}
