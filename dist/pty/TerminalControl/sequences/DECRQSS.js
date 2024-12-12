import { ControlCharacter } from "../Command.js";
import { DCSSequence } from "../DCSSequence.js";
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
