
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
                this.data = jsonifyMse(e.target.result);
                console.log(this.data);
                setMana(this.data.card);
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

function jsonifyMse(text){
    const lines = text.split(/\r?\n/);
    const result = {};
    
    let currentParent = null;
    let currentDepth = 0;
    let cardCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // console.log(`Operating on line ${line}`);
        let indentation = line.match(/^\t*/)[0].length;
        if (!line.trim()) continue;
        let nextIndent = 0;
        if(i+1 < lines.length) {
            nextIndent = lines[i+1].match(/^\t*/)[0].length;
        }

        // If this line does not begin with a tab, then set it as a parent in case the next is.
        if(indentation === 0) {
            // This value has no parents so reset the stack.
            currentDepth = 0;
            currentParent = null;
            
            // Split this on the colon, and push it into the result.
            // If the next item is at a further indentation, then this is a parent item and should be an empty object instead.
            let [key, value] = line.split(':');
            if (nextIndent === 0){ 
                result[key] = coerceValue(value);
            }
            // Keep note of this as a parent if it has any children.
            else {
                result[key] = {};
                currentDepth++;
                currentParent = result[key];
            }

        }
        else {
            // If the depth is not matching the number of preceding tabs this is an orphaned child.
            if (currentDepth != indentation){
                console.error(`Current Depth was: ${indentation} but the expectation was ${currentDepth}`);
                console.error(`Encountered malformed line ${i}: ${line}`);
                throw new Error(`Encountered malformed line ${i}: ${line}`);
            }
            else {
                // console.log(`Item ${lines[i]}`)
            }

            // Instead of doing split on ":" here, we need to
            // explicitly find the first one, because the rules text
            // may contain another. 
            const trimmed = line.trim();
            const colonIndex = trimmed.indexOf(':');
            const key = trimmed.slice(0, colonIndex).trim();
            let value = trimmed.slice(colonIndex + 1).trim();
            // console.log(`Key Value pair is: ${key},${value}`);

            // Check if the next line is indented at depth +1; If so, set this as the new parent element.
            // Otherwise, set this as the child of the existing parent element and move on.

            if (nextIndent > currentDepth) {
                // console.log(`Next line is: ${lines[i+1]}`);
                // This is to be an obj, and the subsequent items are it's members.
                // UNLESS this is `rules_text` which breaks the rules!
                if (key === "rule_text") { 
                    // If we found the rule text, then we need to wrap up all of the values in an arr,
                    // until we find the next item of lower depth.
                    // This is a wildly hacky solution, which modifies the upper loop's index!!
                    let rule_text_values = [];
                    let rule_text_index = 0;
                    let testIndent = nextIndent;
                    while(testIndent > currentDepth) {
                        rule_text_values.push(lines[i+1+rule_text_index].trim());
                        rule_text_index++;
                        testIndent = lines[i+1+rule_text_index].match(/^\t*/)[0].length;
                    }
                    // Skip iterating over these lines.
                    i += rule_text_index;
                    currentParent[key] = rule_text_values;
                }
                else {
                    currentParent[key] = {};
                    currentDepth++;
                    currentParent = currentParent[key];
                }
            }
            else if (nextIndent < currentDepth) {
                currentParent[key] = value;
                currentDepth--;
            }
            else {
                currentParent[key] = value;
            }
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
    if (!isNaN(val) && val.trim() !== '') return Number(val);
    if (isNaN(val)) return val.trim();
    return val;
}