
/**
 * Represents an MSE set, formatted in the .mse-set file.

 */
class MseSet {

    /**
     * @param {File} file - The `.mse-set` or MSE set text file.
     */
    constructor(file) {
        this.file = file;
        this.data = null;
        this.assets = [];
    }

    async load() {
        const signature = new Uint8Array(await this.file.slice(0, 4).arrayBuffer());
        const isArchive = signature[0] === 0x50 && signature[1] === 0x4b;
        if (isArchive) {
            if (typeof JSZip === 'undefined') {
                throw new Error('The ZIP library has not loaded yet. Please wait a moment and try again.');
            }
            const archive = await JSZip.loadAsync(this.file);
            const setEntry = Object.values(archive.files).find(entry =>
                !entry.dir && entry.name.split('/').pop() === 'set'
            );
            if (!setEntry) throw new Error('The MSE archive does not contain a set file.');
            this.data = jsonifyMse(await setEntry.async('string'));

            const imageNames = new Set();
            const cards = Array.isArray(this.data.card) ? this.data.card : this.data.card ? [this.data.card] : [];
            cards.forEach(card => {
                if (card.image) imageNames.add(String(card.image).replace(/\.[^.]+$/, '').toLowerCase());
            });
            for (const entry of Object.values(archive.files)) {
                const name = entry.name.split('/').pop();
                if (entry.dir || !imageNames.has(name.replace(/\.[^.]+$/, '').toLowerCase())) continue;
                this.assets.push(new File([await entry.async('blob')], name));
            }
        } else {
            this.data = jsonifyMse(await this.file.text());
        }
        return this.data;
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

function jsonifyMse(text) {
    const trimmedText = text.trim();
    if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
        return JSON.parse(trimmedText);
    }

    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const result = {};
    const stack = [{indentation: -1, value: result}];
    const indentationOf = line => (line.match(/^\t*/) || [''])[0].length;
    const addValue = (parent, key, value) => {
        if (!Object.prototype.hasOwnProperty.call(parent, key)) {
            parent[key] = value;
        } else if (Array.isArray(parent[key])) {
            parent[key].push(value);
        } else {
            parent[key] = [parent[key], value];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const indentation = indentationOf(line);
        while (stack.length > 1 && stack[stack.length - 1].indentation >= indentation) {
            stack.pop();
        }

        const trimmedLine = line.trim();
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex < 0) {
            throw new Error(`Malformed MSE line ${i + 1}: ${line}`);
        }

        const key = trimmedLine.slice(0, colonIndex).trim();
        const rawValue = trimmedLine.slice(colonIndex + 1).trim();
        const parent = stack[stack.length - 1].value;
        let nextLineIndex = i + 1;
        while (nextLineIndex < lines.length && !lines[nextLineIndex].trim()) {
            nextLineIndex++;
        }
        const hasChildren = nextLineIndex < lines.length && indentationOf(lines[nextLineIndex]) > indentation;

        if ((['rule_text', 'notes', 'flavor_text'].includes(key) || /_text$/.test(key)) && hasChildren) {
            const valueLines = [];
            let ruleLineIndex = i + 1;
            for (; ruleLineIndex < lines.length; ruleLineIndex++) {
                const ruleLine = lines[ruleLineIndex];
                if (ruleLine.trim() && indentationOf(ruleLine) <= indentation) break;
                valueLines.push(ruleLine.trim());
            }
            addValue(parent, key, valueLines.join('\n').trim());
            i = ruleLineIndex - 1;
        } else if (!rawValue && hasChildren) {
            const child = {};
            addValue(parent, key, child);
            stack.push({indentation, value: child});
        } else {
            addValue(parent, key, coerceValue(rawValue));
        }
    }

    return result;
}

/// Extract the mana values, set the Mana cost on the card, and then 
// apply the frame and toughness box appropriately.
function setMana(card) {
    console.log(`Card: ${JSON.stringify(card)}`);

}

// Helper to handle data types (booleans, numbers, strings)
function coerceValue(val) {
    if (val === 'false') return false;
    if (val === 'true') return true;
    if (val === '') return "";
    const number = Number(val);
    if (Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER && val.trim() !== '') return number;
    return val;
}