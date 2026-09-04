
/**
 * Represents an MSE set, formatted in the .mse-set file.

 */
class MseSet {
    
    /**
     *  @param {string} file - The `set` file object.
     * TODO: It would be nice if we could link to the `.mse-set` file instead and operate off of that,
     *  but it will require .zip style operations to be performed.
     */
    constructor(file) {
        try{
            const reader = new FileReader();
            reader.onload = (e) => {
                console.log("Loaded file.");
                // Split block safely across lines and pass to the parser
                this.data = mseToJson(e.target.result);
                console.log(this.data);
            }
            console.log(file);
            reader.readAsText(file, 'UTF-8');
        }
        catch(err) {
            console.error(`Failed to parse file: ${err}`);
        }
    }
}

/**
 * The "Card" object represented for each card.
 * This will serve as the template by which to structure our items.
 */
class MseCard {
    constructor(json) {
        this.json = json
    }


}

/**
 * Coerce the `set` formatting into a JSON object.
 * @param text - Text to parse
 * @returns a fully formed JSON object.
 */
function mseToJson(text) {
    const lines = text.split(/\r?\n/);
    const result = {};
    const stack = [{ indent: -1, object: result }];

    let currentMultiLineKey = null;
    let currentMultiLineValue = [];
    let currentMultiLineIndent = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Calculate indentation level by counting tabs
        const indent = line.match(/^\t*/)[0].length;
        const trimmed = line.trim();

        // Handle multi-line strings (like indented rule_text blocks)
        if (currentMultiLineKey && indent > currentMultiLineIndent) {
            currentMultiLineValue.push(trimmed);
            continue;
        } else if (currentMultiLineKey) {
            // Close out the multi-line string when indentation drops back
            const parent = stack[stack.length - 1].object;
            const finalVal = currentMultiLineValue.join('\n');
            saveValue(parent, currentMultiLineKey, coerceValue(finalVal));
            currentMultiLineKey = null;
            currentMultiLineValue = [];
        }

        // Split key and value by the first colon
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;

        const key = trimmed.slice(0, colonIndex).trim();
        let val = trimmed.slice(colonIndex + 1).trim();

        // Adjust the object depth stack based on indentation
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        const currentParent = stack[stack.length - 1].object;

        // Check if this is the start of a nested object or multi-line block
        const nextLine = lines[i + 1];
        const nextIndent = nextLine ? nextLine.match(/^\t*/)[0].length : 0;

        if (nextIndent > indent) {
            if (val === '') {
                // It's a nested object structure
                const newObj = {};
                saveValue(currentParent, key, newObj);
                stack.push({ indent, object: newObj });
            } else {
                // It's a multi-line text block header
                currentMultiLineKey = key;
                currentMultiLineIndent = indent;
                currentMultiLineValue.push(val);
            }
        } else {
            // Standard single-line key/value
            saveValue(currentParent, key, coerceValue(val));
        }
    }

    return result;
}

// Helper to push values and automatically convert duplicate keys into arrays
function saveValue(parent, key, value) {
    if (parent[key] !== undefined) {
        if (!Array.isArray(parent[key])) {
            parent[key] = [parent[key]];
        }
        parent[key].push(value);
    } else {
        parent[key] = value;
    }
}

// Helper to handle data types (booleans, numbers, strings)
function coerceValue(val) {
    if (val === 'false') return false;
    if (val === 'true') return true;
    if (val === '') return "";
    if (!isNaN(val) && val.trim() !== '') return Number(val);
    return val;
}